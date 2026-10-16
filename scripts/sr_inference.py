"""Bounded, local Real-ESRGAN x2 inference without face restoration."""
from pathlib import Path
import hashlib
import io
from urllib.request import Request, urlopen
import base64

import numpy as np
from PIL import Image, ImageOps
import torch
import torch.nn.functional as F
from sr_model import load_model


def source_bytes(url):
    if url.startswith('data:image/'):
        return base64.b64decode(url.split(',', 1)[1], validate=True)
    if url.startswith('./experten/') or url.startswith('experten/'):
        root=Path(__file__).resolve().parents[1]/'experten'
        path=(root.parent/url).resolve()
        if root.resolve() not in path.parents or path.suffix.lower() not in {'.jpg','.jpeg','.png','.webp'}:
            raise ValueError('Unexpected local source')
        raw=path.read_bytes()
        if len(raw)>32*1024*1024:raise ValueError('Source too large')
        return raw
    if not url.startswith('https://skinmap.ngrok.io/'):
        raise ValueError('Unexpected source host')
    with urlopen(Request(url, headers={'ngrok-skip-browser-warning':'1'}), timeout=45) as response:
        raw = response.read(32 * 1024 * 1024 + 1)
    if len(raw) > 32 * 1024 * 1024:
        raise ValueError('Source too large')
    return raw


class Upscaler:
    def __init__(self, checkpoint):
        if not torch.backends.mps.is_available():
            raise RuntimeError('MPS GPU unavailable; refusing slow CPU fallback')
        self.device = 'mps'
        self.model = load_model(Path(checkpoint), self.device, False)
        if self.model.scale != 2:
            raise ValueError('Expected x2 checkpoint')

    def image(self, raw, tile=256, pad=32):
        with Image.open(io.BytesIO(raw)) as decoded:
            if decoded.width * decoded.height > 16_000_000:
                raise ValueError('Source dimensions too large')
            image = ImageOps.exif_transpose(decoded).convert('RGB')
        # Bound inference and cache dimensions for screen-sized delivery.
        if max(image.size) > 1600:
            image.thumbnail((1600,1600), Image.Resampling.LANCZOS)
        pixels = np.array(image, copy=True)
        h,w = pixels.shape[:2]
        tensor = torch.from_numpy(pixels).permute(2,0,1).unsqueeze(0).float().div_(255).contiguous().to(self.device)
        tensor = F.pad(tensor, (0,w%2,0,h%2), mode='replicate')
        height,width = tensor.shape[2:]
        result = np.empty((height*2,width*2,3),dtype=np.uint8)
        with torch.inference_mode():
            for y in range(0,height,tile):
                for x in range(0,width,tile):
                    y0,x0 = max(0,y-pad),max(0,x-pad)
                    y1,x1 = min(height,y+tile+pad),min(width,x+tile+pad)
                    patch = self.model(tensor[:,:,y0:y1,x0:x1])
                    patch = patch[:,:,2*(y-y0):2*(min(y+tile,height)-y0),2*(x-x0):2*(min(x+tile,width)-x0)]
                    rgb = patch[0].clamp(0,1).mul(255).round().byte().permute(1,2,0).cpu().numpy()
                    result[y*2:min(y+tile,height)*2,x*2:min(x+tile,width)*2] = rgb
                    del patch
        torch.mps.empty_cache()
        return image, Image.fromarray(result[:h*2,:w*2])


def digest(raw):
    return hashlib.sha256(raw).hexdigest()
