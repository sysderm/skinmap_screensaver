"""Produce exactly two authorized original/upscaled comparison boards locally."""
import argparse, io, json, time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
from sr_inference import Upscaler, source_bytes

ap=argparse.ArgumentParser()
ap.add_argument('--jobs',required=True)
ap.add_argument('--checkpoint',required=True)
ap.add_argument('--out',required=True)
args=ap.parse_args()
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
model=Upscaler(args.checkpoint)
jobs=json.loads(Path(args.jobs).read_text())[:2]
if len(jobs)!=2: raise ValueError('Exactly two sources required')
report=[]
for index,job in enumerate(jobs,1):
    started=time.monotonic()
    original,upscaled=model.image(source_bytes(job['source']))
    seconds=round(time.monotonic()-started,2)
    panel=900
    board=Image.new('RGB',(panel*2+36,panel+92),'#0b1320')
    draw=ImageDraw.Draw(board)
    try: font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',24)
    except OSError: font=ImageFont.load_default()
    for column,(label,image) in enumerate([('Real',original),('Upscaled 2x',upscaled)]):
        x=12+column*(panel+12)
        draw.text((x+10,14),f'{label}  ({image.width} x {image.height})',fill='#ebe4d7',font=font)
        fitted=ImageOps.contain(image,(panel,panel),Image.Resampling.LANCZOS)
        board.paste(fitted,(x+(panel-fitted.width)//2,60+(panel-fitted.height)//2))
    path=out/f'skinmap-comparison-{index:02}.png'
    board.save(path)
    report.append({'comparison':index,'input':list(original.size),'output':list(upscaled.size),'seconds':seconds})
    print(json.dumps(report[-1]),flush=True)
(out/'benchmark.json').write_text(json.dumps(report,indent=2))
