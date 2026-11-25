"""Verify a four-panel boss atlas against its archived local runtime before signing it."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image

def red_fraction(im):
    w,h=im.size
    crop=im.crop((int(w*.21),int(h*.29),int(w*.78),int(h*.72))).resize((48,32)).convert('RGB')
    return sum(r>100 and r>1.75*g and r>1.72*b and abs(g-b)<26 for r,g,b in crop.getdata())/(48*32)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repo',type=Path)
    parser.add_argument('revision',help='Immutable QA commit containing runtime sources and asset-hashes.json')
    parser.add_argument('figures',type=Path)
    parser.add_argument('manifest',type=Path)
    args=parser.parse_args()
    def git(*params):
        return subprocess.check_output(['git','-C',str(args.repo),*params])
    revision=git('rev-parse',args.revision+'^{commit}').decode().strip()
    paths=git('ls-tree','-r','--name-only','-z',revision).decode().strip('\0').split('\0')
    from io import BytesIO
    sources=[p for p in paths if p!='asset-hashes.json']
    names=''.join(revision+':'+p+'\n' for p in sources).encode()
    objects=BytesIO(subprocess.check_output(['git','-C',str(args.repo),'cat-file','--batch'],input=names))
    for filename in sources:
        size=int(objects.readline().split()[2])
        archived=objects.read(size).replace(b'\r\n',b'\n')
        assert objects.read(1)==b'\n'
        source=(args.repo/filename).read_bytes().replace(b'\r\n',b'\n')
        if source!=archived:raise ValueError('runtime source mismatch: '+filename)
    for filename,expected in json.loads(git('show',revision+':asset-hashes.json')).items():
        if hashlib.sha256((args.repo/filename).read_bytes()).hexdigest()!=expected:
            raise ValueError('runtime asset mismatch: '+filename)
    rows=[]
    for f in sorted(args.figures.glob('*.jpg')):
        with Image.open(f) as img:
            w,h=img.size
            scores=[red_fraction(img.crop((i%2*w//2,i//2*h//2+24,(i%2+1)*w//2,(i//2+1)*h//2))) for i in range(4)]
        if max(scores)>.62:raise ValueError('battlefield obscured: '+f.name)
        rows.append(dict(image=f.name,sha256=hashlib.sha256(f.read_bytes()).hexdigest(),redCoverage=scores))
    if not rows:raise ValueError('empty atlas')
    args.manifest.write_text(json.dumps(dict(revision=revision,images=rows),ensure_ascii=False,indent=1),'utf8')
    print('verified',len(rows),'groups',len(rows)*4,'frames',revision)
if __name__=='__main__':main()
