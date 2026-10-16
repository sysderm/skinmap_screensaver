"""Precompute upcoming screensaver images on m5; publish a content-bound cache.

Only derived images and opaque hashes are persisted. Originals and clinical
metadata are never logged or committed. The browser verifies original bytes
against the manifest before offering an AI variant.
"""
import argparse
import io
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import time
import fcntl
from sr_inference import Upscaler, source_bytes, digest


def atomic_json(path, data):
    temp=path.with_suffix('.next')
    temp.write_text(json.dumps(data,separators=(',',':')))
    os.replace(temp,path)


def publish(cache, destination):
    host,remote=destination.split(':',1)
    if not re.fullmatch(r'[A-Za-z0-9._-]+',host) or not remote.startswith('/'):
        raise ValueError('Invalid publish destination')
    # Objects arrive first; the manifest is replaced atomically afterwards.
    subprocess.run(['ssh','-o','BatchMode=yes',host,'mkdir -p '+shlex.quote(remote+'/objects')],check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['rsync','-az','--ignore-existing',str(cache/'objects')+'/',destination+'/objects/'],check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['scp','-q',str(cache/'manifest.json'),destination+'/manifest.json.next'],check=True)
    subprocess.run(['ssh','-o','BatchMode=yes',host,'mv '+shlex.quote(remote+'/manifest.json.next')+' '+shlex.quote(remote+'/manifest.json')],check=True,stdout=subprocess.DEVNULL)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--checkpoint',required=True)
    ap.add_argument('--cache',type=Path,required=True)
    ap.add_argument('--publish')
    ap.add_argument('--lookahead',type=int,default=30)
    ap.add_argument('--limit',type=int,default=0)
    args=ap.parse_args()
    cache=args.cache.resolve();cache.mkdir(parents=True,exist_ok=True)
    lock=(cache/'worker.lock').open('w')
    fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    (cache/'objects').mkdir(exist_ok=True)
    model_sha=digest(Path(args.checkpoint).read_bytes())
    manifest={'version':1,'model':'Real-ESRGAN x2','model_sha256':model_sha,'entries':{}}
    if (cache/'manifest.json').exists():
        previous=json.loads((cache/'manifest.json').read_text())
        if previous.get('model_sha256')==model_sha: manifest=previous
    model=Upscaler(args.checkpoint)
    completed=0;last_publish=0;last_plan=0;jobs=[]
    root=Path(__file__).resolve().parents[1]
    print('Upscaling worker started on MPS; clinical contents excluded from logs.',flush=True)
    while True:
        try:
            if not jobs or time.monotonic()-last_plan>45:
                plan=subprocess.run(['node',str(root/'scripts/plan-upscales.cjs'),str(args.lookahead)],capture_output=True,timeout=180,check=True)
                jobs=json.loads(plan.stdout);last_plan=time.monotonic()
            added=False
            while jobs:
                job=jobs.pop(0);key=digest(job['source'].encode())
                existing=manifest['entries'].get(key)
                if existing and (cache/existing['path']).is_file(): continue
                started=time.monotonic()
                raw=source_bytes(job['source'])
                original,upscaled=model.image(raw)
                encoded=io.BytesIO();upscaled.save(encoded,format='WEBP',quality=95,method=4)
                data=encoded.getvalue();asset=digest(data)
                relative='objects/'+asset+'.webp';path=cache/relative
                temp=path.with_suffix('.next');temp.write_bytes(data);os.replace(temp,path)
                manifest['entries'][key]={'path':relative,'source_sha256':digest(raw),'output_sha256':asset,
                    'width':upscaled.width,'height':upscaled.height,'input_width':original.width,'input_height':original.height}
                manifest['updated_at']=int(time.time())
                # Bound metadata growth; orphan objects remain reusable, never exposed by directory listing.
                if len(manifest['entries'])>2048:
                    del manifest['entries'][next(iter(manifest['entries']))]
                atomic_json(cache/'manifest.json',manifest)
                completed+=1;added=True
                print(f'Processed {completed}; {time.monotonic()-started:.2f}s; cache entries {len(manifest["entries"])}.',flush=True)
                if args.publish and (time.monotonic()-last_publish>15 or completed==1):
                    publish(cache,args.publish);last_publish=time.monotonic()
                    print('Cache published.',flush=True)
                break
            if args.limit and completed>=args.limit:
                if args.publish: publish(cache,args.publish)
                return
            if not added:
                if args.publish and time.monotonic()-last_publish>30 and (cache/'manifest.json').exists():
                    publish(cache,args.publish);last_publish=time.monotonic()
                time.sleep(10)
        except KeyboardInterrupt: return
        except Exception as error:
            # Exception messages can contain source URLs or SQL results.
            print('Worker retry after '+type(error).__name__+'; no source details logged.',flush=True)
            jobs=[];time.sleep(15)


if __name__=='__main__':main()
