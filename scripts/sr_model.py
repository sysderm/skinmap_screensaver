"""Real-ESRGAN RRDB x2 inference architecture.

Reused from the existing local upscaling implementation. Checkpoint and
architecture reference: https://github.com/xinntao/Real-ESRGAN
"""
from pathlib import Path
import torch
import torch.nn as nn
import torch.nn.functional as F

class ResidualDenseBlock(nn.Module):
    def __init__(self, nf=64, gc=32):
        super().__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, nf, gc=32):
        super().__init__()
        self.rdb1, self.rdb2, self.rdb3 = (ResidualDenseBlock(nf, gc) for _ in range(3))

    def forward(self, x):
        return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    """Real-ESRGAN's generator, at either scale.

    The x2 checkpoint folds its scale into a pixel_unshuffle at the input, so
    conv_first takes 12 channels and the 23 blocks run at half resolution. The
    x4 checkpoint has no unshuffle: the same blocks run at full input
    resolution, which is the whole reason it costs about four times as much --
    9.15 s a frame against 2.7 at 1152x1728, measured on this machine.
    """

    def __init__(self, in_ch=3, out_ch=3, nf=64, nb=23, gc=32, scale=2):
        super().__init__()
        self.scale = scale
        self.conv_first = nn.Conv2d(in_ch * 4 if scale == 2 else in_ch, nf, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
        self.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_last = nn.Conv2d(nf, out_ch, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        feat = F.pixel_unshuffle(x, 2) if self.scale == 2 else x
        feat = self.conv_first(feat)
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))


def load_model(path: Path, device: str, half: bool) -> RRDBNet:
    state = torch.load(path, map_location="cpu", weights_only=True)
    state = state.get("params_ema", state.get("params", state))
    # The checkpoint says which it is: 12 input channels means the unshuffled x2.
    scale = 2 if state["conv_first.weight"].shape[1] == 12 else 4
    model = RRDBNet(scale=scale)
    model.load_state_dict(state, strict=True)
    model.eval().to(device)
    if half:
        model.half()
    for p in model.parameters():
        p.requires_grad_(False)
    return model

