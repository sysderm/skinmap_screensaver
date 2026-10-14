"""Build the combined public display without publishing private API routes."""
from pathlib import Path
import re, shutil, sys
root=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
s=(root/'index.html').read_text()
s=re.sub(r'function ansicht\(\)\{.*?\n\}', 'function ansicht(){ return "combined"; }', s, count=1, flags=re.S)
(out/'index.html').write_text(s)
shutil.copy(root/'vitrine.json',out/'vitrine.json')
(out/'assets').mkdir(exist_ok=True)
shutil.copy(root/'assets/skinmap-logo.png',out/'assets/skinmap-logo.png')
