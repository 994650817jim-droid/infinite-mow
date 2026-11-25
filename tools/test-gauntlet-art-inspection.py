"""Exercise the intake checker on disposable fixtures, never on production art."""
from pathlib import Path
from tempfile import TemporaryDirectory
import importlib.util
import json
from PIL import Image, ImageDraw

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('intake', here/'inspect-gauntlet-art.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
with TemporaryDirectory() as scratch:
    root = Path(scratch)
    source, out = root/'delivery', root/'review'
    source.mkdir()
    for filename, (_, size, kind) in checker.definitions().items():
        image = Image.new('RGBA' if kind in ('props', 'warden') else 'RGB', size)
        if kind == 'props':
            draw = ImageDraw.Draw(image)
            for i in range(8):
                x,y = i%4*128,i//4*128
                draw.rectangle((x+10,y+10,x+100,y+111), fill='white')
        elif kind == 'warden':
            ImageDraw.Draw(image).rectangle((130,250,930,1500),fill='white')
        image.save(source/filename)
    assert checker.run(source,out,'all') == 0
    data = json.loads((out/'inspection.json').read_text(encoding='utf8'))
    assert len(data['read']) == 20 and not data['errors']
    with Image.open(out/'ghost-ground-3x3.png') as img: assert img.size == (1536,1536)
    with Image.open(out/'gate-divine-p-crop.png') as img: assert img.size == (365,195)
    with Image.open(source/'gate-ghost-p.webp') as img: img.save(source/'gate-ghost-p.png')
    (source/'gate-ghost-p.webp').unlink()
    assert checker.run(source,out,'gates') == 0
    Image.new('RGB',(1024,1536)).save(source/'warden-ghost-lvbu.png')
    assert checker.run(source,out,'gates') == 1
    (source/'ghost-ground.png').unlink()
    Image.new('RGBA',(512,256)).save(source/'ghost-props.png')
    Image.new('RGB',(512,513)).save(source/'divine-ground.png')
    assert checker.run(source,out,'field') == 1
    data=json.loads((out/'inspection.json').read_text(encoding='utf8'))
    assert len(data['missing']) == 1 and len(data['errors']) == 2
print('intake checks passed')
