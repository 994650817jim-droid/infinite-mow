"""Inspect an incoming art batch. Originals are opened read-only; previews go to --out."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageOps, ImageStat


def definitions():
    entries = {}
    for name, batch in [('gate-ghost', 'gates'), ('gate-divine', 'gates'),
                        *((f'report-{ending}', 'reports') for ending in
                          ('standard', 'extreme', 'withdrawn', 'defeat', 'coop'))]:
        for suffix, size in [('p', (1080, 1920)), ('l', (1920, 1080))]:
            entries[f'{name}-{suffix}.webp'] = (batch, size, 'header')
    for name in ('ghost-lvbu', 'divine-liubei'):
        entries[f'warden-{name}.png'] = ('gates', (1024, 1536), 'warden')
    for theme in ('ghost', 'divine'):
        entries[f'{theme}-ground.png'] = ('field', (512, 512), 'ground')
        entries[f'{theme}-props.png'] = ('field', (512, 256), 'props')
    return entries


def inspect_file(source, size, kind, out):
    with Image.open(source) as original:
        original.load()
        if original.size != size:
            raise ValueError(f'尺寸应为 {size}，实际为 {original.size}')
        if original.format != {'.webp': 'WEBP', '.png': 'PNG'}[source.suffix.lower()]:
            raise ValueError('扩展名与实际编码不一致')
        image = original.convert('RGBA')
    alpha = image.getchannel('A')
    result = {'source': source.name, 'size': size, 'encodedBytes': source.stat().st_size}
    if kind in ('header', 'ground') and alpha.getextrema() != (255, 255):
        raise ValueError('不透明背景存在透明像素')
    if kind in ('warden', 'props') and alpha.getextrema() != (0, 255):
        raise ValueError('缺少真透明背景或不透明主体')
    out.mkdir(parents=True, exist_ok=True)
    if kind == 'header':
        target = (365, 195) if source.stem.endswith('-p') else (760, 235)
        ImageOps.fit(image.convert('RGB'), target, centering=(.5, .45)).save(out / f'{source.stem}-crop.png')
    elif kind == 'warden':
        result['alphaBounds'] = alpha.getbbox()
        image.thumbnail((256, 384))
        image.save(out / f'{source.stem}-preview.png')
    elif kind == 'props':
        cells = []
        for index in range(8):
            x, y = index % 4 * 128, index // 4 * 128
            bounds = alpha.crop((x, y, x + 128, y + 128)).getbbox()
            if bounds is None:
                raise ValueError(f'第 {index + 1} 格为空')
            cells.append(bounds)
        result['frameAlphaBounds'] = cells
    elif kind == 'ground':
        rgb = image.convert('RGB')
        w, h = size
        surfaces = [(rgb.crop((0, 0, 1, h)), rgb.crop((w-1, 0, w, h))),
                    (rgb.crop((0, 0, w, 1)), rgb.crop((0, h-1, w, h)))]
        result['edgeMeanAbsoluteRGB'] = [ImageStat.Stat(ImageChops.difference(a, b)).mean for a, b in surfaces]
        tiled = Image.new('RGB', (w*3, h*3))
        for y in range(3):
            for x in range(3):
                tiled.paste(rgb, (x*w, y*h))
        tiled.save(out / f'{source.stem}-3x3.png')
    return result


def run(source, out, batch):
    if source.resolve() == out.resolve() or source.resolve() in out.resolve().parents:
        raise ValueError('预览目录请放在原图目录之外')
    items, missing, errors = [], [], {}
    for filename, (group, size, kind) in definitions().items():
        if group != batch and batch != 'all':
            continue
        path = source / filename
        if not path.is_file() and path.suffix == '.webp':
            path = path.with_suffix('.png')  # Approved lossless background delivery.
        if not path.is_file():
            missing.append(filename)
            continue
        try:
            items.append(inspect_file(path, size, kind, out))
        except (OSError, ValueError) as error:
            errors[filename] = str(error)
    out.mkdir(parents=True, exist_ok=True)
    (out/'inspection.json').write_text(json.dumps({'batch': batch, 'read': items, 'missing': missing, 'errors': errors},
                                                 ensure_ascii=False, indent=2), encoding='utf8')
    print(f'{len(items)} inspected, {len(missing)} missing, {len(errors)} invalid')
    return 1 if errors or missing else 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--batch', required=True, choices=['gates', 'reports', 'field', 'all'])
    args = parser.parse_args()
    raise SystemExit(run(args.source, args.out, args.batch))
