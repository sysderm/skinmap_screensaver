"""Fill missing public collection metadata from independently verified SkinMap image matches.

Candidate matches alone are insufficient. Verify full-image colour and spatial
agreement at higher resolution before copying predictions. Never override
recorded values, and never guess a value for an unmatched image.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
from pathlib import Path
from urllib.request import Request,urlopen
import numpy as np
from PIL import Image,ImageOps

def pixels(raw):
    with Image.open(io.BytesIO(raw)) as image:
        image=ImageOps.exif_transpose(image).convert('RGB')
        return image.size,np.asarray(image.resize((96,96),Image.Resampling.LANCZOS),dtype=np.float32)

def missing(value):
    return value is None or str(value).strip().lower() in {'','unknown','nan','none','null','n/a','—','-','not available'}

ap=argparse.ArgumentParser()
ap.add_argument('--collection',required=True,type=Path)
ap.add_argument('--matches',required=True,type=Path)
ap.add_argument('--atlas-descriptors',required=True,type=Path)
args=ap.parse_args()
data=json.loads(args.collection.read_text());entries={e['id']:e for e in data['bilder']}
rows={r['_row_index']:r for r in json.loads(args.atlas_descriptors.read_text())}
candidates=json.loads(args.matches.read_text())
root=args.collection.parent/'bilder'
def verify(match):
    try:
        entry=entries.get(match['id']);row=rows.get(match['row'])
        if not entry or not row or match['rmse']>=4 or match['runner']<=max(10,match['rmse']*3):return None
        token=row['image'];prefix='ea://image/'
        if not token.startswith(prefix):return None
        name=entry['bild']
        if Path(name).name!=name:return None
        raw=(root/name).read_bytes();size,a=pixels(raw)
        url='https://skinmap.ngrok.io/data/images/'+token[len(prefix):]
        with urlopen(Request(url,headers={'ngrok-skip-browser-warning':'1'}),timeout=30) as response:
            remote=response.read(32*1024*1024)
        remote_size,b=pixels(remote)
        rmse=float(np.sqrt(np.mean((a-b)**2)))
        correlation=float(np.corrcoef(a.reshape(-1),b.reshape(-1))[0,1])
        if abs(size[0]/size[1]-remote_size[0]/remote_size[1])>.004 or rmse>8 or correlation<.99:return None
        return entry,row,hashlib.sha256(raw).hexdigest()
    except Exception:return None
counts={k:0 for k in ['fitz','region','alter','sex']};verified=0
with ThreadPoolExecutor(max_workers=8) as pool:
    for result in pool.map(verify,candidates):
        if not result:continue
        entry,row,source_hash=result;verified+=1
        value=row.get('fitzpatrick_pred');fitz=None
        if value is not None:
            n=int(float(value)+.5)
            if 1<=n<=6:fitz=['','I','II','III','IV','V','VI'][n]
        if missing(fitz):fitz=row.get('fitzpatrick_grouped_pred')
        raw={'fitz':fitz,'region':row.get('body_region_pred'),'alter':row.get('age_pred'),'sex':row.get('gender_pred')}
        for key,value in raw.items():
            if not missing(entry.get(key)) or missing(value):continue
            if key=='alter':
                value=round(float(value))
                if not 0<=value<=120:continue
            if key=='sex':
                value={'f':'w','female':'w','w':'w','m':'m','male':'m'}.get(str(value).lower())
                if not value:continue
            entry[key]=value
            entry.setdefault('geschaetzt',[])
            if key not in entry['geschaetzt']:entry['geschaetzt'].append(key)
            counts[key]+=1
        if entry.get('geschaetzt'):
            entry['imputation_source']='SkinMap'
            entry['imputation_reference']='https://arxiv.org/abs/2601.00840'
            entry['imputation_image_sha256']=source_hash
temp=args.collection.with_suffix('.next');temp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
temp.replace(args.collection)
print(json.dumps({'candidates':len(candidates),'verified':verified,'filled':counts,'unmatched_left_blank':len(entries)-verified}))
