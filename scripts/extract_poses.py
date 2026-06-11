#!/usr/bin/env python3
"""Extract composed character poses from MS Comic Chat .avb files.

AVB v2.5 stores characters as separate head images (chunk 0x000a) and
headless body images (0x000b), each tagged with emotion-wheel mappings
(code + intensity) and a neck anchor point. Some characters (jordan) use
single-piece poses instead (0x000c). This script composites head+body for
every emotion mapping and writes PNGs plus a manifest the viewer consumes.

Chunk item layouts (after the 12 bytes of image/mask1/mask2 pointers):
  0x000a (33B): code u16, intensity u8, neck x/y u16, offset x/y i16,
                mouth x/y u16, 6 unknown bytes
  0x000b/0x000c (25B): code u16, intensity u8, anchor x/y u16, 6 unknown bytes

Emotion codes (identified visually from the standard characters):
  1 happy, 2 coy, 3 bored, 4 scared, 5 sad, 6 angry, 7 shouting,
  8 laughing, 9 neutral (wheel center), >9 gestures.
"""
import json
import struct
import sys
import zlib
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
NEUTRAL = 9


def u16(data, o):
    return struct.unpack_from('<H', data, o)[0]


def decode_image(data, ptr):
    """Decode one image (optional palette chunk + infoheader + zlib pixels)."""
    pos = ptr
    palette = None
    sig = struct.unpack_from('>H', data, pos)[0]
    if sig == 0x0101:
        ck_len = u16(data, pos + 2)
        n = u16(data, pos + 4)
        palette = [struct.unpack_from('BBB', data, pos + 6 + 3 * i) for i in range(n)]
        pos += 4 + ck_len
    if struct.unpack_from('>H', data, pos)[0] != 0x2800:
        raise ValueError(f'no infoheader at {pos}')
    w, h = struct.unpack_from('<ii', data, pos + 4)
    bpp = u16(data, pos + 14)
    pos += 40
    orig_len, cmpr_len = struct.unpack_from('<II', data, pos)
    pixels = zlib.decompress(data[pos + 8:pos + 8 + cmpr_len])

    img = Image.new('RGBA', (w, h))
    px = img.load()
    stride = ((w * bpp + 31) // 32) * 4
    transparent = (0, 0, 0, 0)
    for y in range(h):
        row = pixels[(h - 1 - y) * stride:]
        for x in range(w):
            bits = row[x * bpp // 8]
            shift = 8 - bpp - (x * bpp) % 8
            v = (bits >> shift) & ((1 << bpp) - 1)
            if palette:
                px[x, y] = (*palette[v], 255)
            elif bpp == 2:
                # Paletteless 2bpp: 0 = transparent key color
                px[x, y] = [transparent, (254,) * 3 + (255,),
                            (255,) * 3 + (255,), (0, 0, 0, 255)][v]
            elif bpp == 1:
                px[x, y] = transparent if v == 0 else (0, 0, 0, 255)
            else:
                g = v * 255 // ((1 << bpp) - 1)
                px[x, y] = (g, g, g, 255)
    return img


def apply_mask(img, mask):
    """1bpp mask: bit 0 = transparent."""
    if mask.size != img.size:
        return img
    out = img.copy()
    px, mp = out.load(), mask.load()
    for y in range(img.height):
        for x in range(img.width):
            if mp[x, y][3] == 0 or mp[x, y][:3] == (255, 255, 255):
                px[x, y] = (0, 0, 0, 0)
    return out


def parse(path):
    data = path.read_bytes()
    pos, bias = 6, 0
    name = path.stem
    heads, bodies, fulls = [], [], []
    while pos < len(data):
        t = u16(data, pos)
        if t == 0x0001:
            end = data.index(0, pos + 2)
            name = data[pos + 2:end].decode('windows-1252')
            pos = end + 1
        elif t in (0x0006, 0x0007):
            break
        elif t in (0x0002, 0x0008):
            pos += 4
        elif t == 0x0003:
            pos += 6
        elif t == 0x0107:
            bias = struct.unpack_from('<I', data, pos + 4)[0]
            pos += u16(data, pos + 2) + 4
        elif t >= 0x0100:
            pos += u16(data, pos + 2) + 4
        elif t in (0x000a, 0x000b, 0x000c):
            n = u16(data, pos + 2)
            size = 33 if t == 0x000a else 25
            for i in range(n):
                off = pos + 4 + i * size
                ptr, m1, m2 = struct.unpack_from('<III', data, off)
                code, intensity = struct.unpack_from('<HB', data, off + 12)
                if t == 0x000a:
                    nx, ny, ox, oy, mx, my = struct.unpack_from('<HHhhHH', data, off + 15)
                    heads.append(dict(ptr=ptr + bias, m1=m1, m2=m2, code=code,
                                      intensity=intensity, nx=nx, ny=ny,
                                      ox=ox, oy=oy, mx=mx, my=my))
                else:
                    nx, ny = struct.unpack_from('<HH', data, off + 15)
                    rec = dict(ptr=ptr + bias, m1=m1, m2=m2, code=code,
                               intensity=intensity, nx=nx, ny=ny)
                    (bodies if t == 0x000b else fulls).append(rec)
            pos += 4 + n * size
        else:
            raise ValueError(f'{path.name}: unknown chunk {t:#06x} at {pos}')
    return name, heads, bodies, fulls


def get_image(data, cache, rec):
    if rec['ptr'] not in cache:
        img = decode_image(data, rec['ptr'])
        for mp in (rec['m1'], rec['m2']):
            if mp:
                img = apply_mask(img, decode_image(data, mp))
        cache[rec['ptr']] = img
    return cache[rec['ptr']]


def closest(entries, code, intensity):
    """Best entry for an emotion: exact code with nearest intensity, else neutral."""
    matches = [e for e in entries if e['code'] == code]
    if not matches:
        matches = [e for e in entries if e['code'] == NEUTRAL] or entries
    return min(matches, key=lambda e: abs(e['intensity'] - intensity))


def compose(body_img, body, head_img, head):
    dx = body['nx'] - head['nx']
    dy = body['ny'] - head['ny']
    x0, y0 = min(0, dx), min(0, dy)
    x1 = max(body_img.width, dx + head_img.width)
    y1 = max(body_img.height, dy + head_img.height)
    canvas = Image.new('RGBA', (x1 - x0, y1 - y0))
    canvas.paste(body_img, (-x0, -y0))
    canvas.alpha_composite(head_img, (dx - x0, dy - y0))
    mouth = (head['mx'] + dx - x0, head['my'] + dy - y0)
    return canvas, mouth


def extract_character(path, outdir):
    data = path.read_bytes()
    name, heads, bodies, fulls = parse(path)
    chardir = outdir / path.stem
    chardir.mkdir(parents=True, exist_ok=True)
    cache = {}
    poses, posemap, seen = [], [], {}

    if fulls:  # single-piece character
        for e in fulls:
            if e['ptr'] not in seen:
                img = get_image(data, cache, e)
                fn = f'pose{len(poses):02d}.png'
                img.save(chardir / fn)
                seen[e['ptr']] = len(poses)
                poses.append(dict(file=fn, w=img.width, h=img.height, mouth=None))
            posemap.append(dict(code=e['code'], intensity=e['intensity'],
                                pose=seen[e['ptr']]))
    else:
        # One composed pose per head-map entry; body chosen by the same emotion.
        for e in heads:
            body = closest(bodies, e['code'], e['intensity'])
            key = (e['ptr'], body['ptr'])
            if key not in seen:
                img, mouth = compose(get_image(data, cache, body), body,
                                     get_image(data, cache, e), e)
                fn = f'pose{len(poses):02d}.png'
                img.save(chardir / fn)
                seen[key] = len(poses)
                poses.append(dict(file=fn, w=img.width, h=img.height, mouth=mouth))
            posemap.append(dict(code=e['code'], intensity=e['intensity'],
                                pose=seen[key]))

    return dict(name=name, dir=path.stem, poses=poses, map=posemap)


def main():
    outdir = ROOT / 'assets' / 'chars'
    manifest = {'characters': [], 'backgrounds': []}
    for f in sorted((ROOT / 'raw').glob('*.avb')):
        print(f.stem, end=' ', flush=True)
        manifest['characters'].append(extract_character(f, outdir))
    print()
    for f in sorted((ROOT / 'raw').glob('*.bgb')):
        manifest['backgrounds'].append(
            {'name': f.stem, 'file': f'../{f.stem}/{f.stem}.000.png'})
    (outdir / 'manifest.json').write_text(json.dumps(manifest))
    print('wrote', outdir / 'manifest.json')


if __name__ == '__main__':
    main()
