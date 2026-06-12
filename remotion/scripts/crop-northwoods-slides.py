#!/usr/bin/env python3
"""
Crop Northwoods slide images to 1080x1920 portrait for Remotion.
Run from any directory — uses absolute paths.
"""
from PIL import Image
import os, shutil

FOLDER = r'c:\Users\bradl\history-today\remotion\public\slides\Northwood'
TW, TH = 1080, 1920


def scale_cover(img):
    """Scale image so both dimensions are >= target (cover mode)."""
    w, h = img.size
    s = max(TW / w, TH / h)
    return img.resize((round(w * s), round(h * s)), Image.LANCZOS)


def crop_to(img, cx=0.5, cy=0.5):
    """Crop TW×TH centered at (cx, cy) fraction of the scaled image."""
    w, h = img.size
    x0 = max(0, min(w - TW, round(w * cx - TW / 2)))
    y0 = max(0, min(h - TH, round(h * cy - TH / 2)))
    return img.crop((x0, y0, x0 + TW, y0 + TH))


def zoom_to_top(img, top_frac=0.20, cx=0.5):
    """
    Zoom into the top `top_frac` of the document so it fills 1920px tall.
    Used to isolate the UNCLASSIFIED stamp area.
    """
    w, h = img.size
    region_h = h * top_frac          # height of region we want to show
    s = max(TW / w, TH / region_h)   # scale so that region fills TH
    sw, sh = round(w * s), round(h * s)
    scaled = img.resize((sw, sh), Image.LANCZOS)
    x0 = max(0, min(sw - TW, round(sw * cx - TW / 2)))
    return scaled.crop((x0, 0, x0 + TW, TH))


def process(fname, cx, cy, report_prefix=''):
    path = os.path.join(FOLDER, fname)
    img = Image.open(path)
    orig = img.size
    out = crop_to(scale_cover(img), cx, cy)
    assert out.size == (TW, TH), f"unexpected size {out.size}"
    out.save(path, quality=95, optimize=True)
    label = report_prefix or fname
    print(f'  {label}: {orig[0]}x{orig[1]} -> {out.size[0]}x{out.size[1]}')
    return out


print('=== Northwoods slide crops ===\n')

# ── Step 1: create 07-memo-cover-crop.jpg from the ORIGINAL 01 before modifying it ──
src_01 = os.path.join(FOLDER, '01-memo-cover.jpg')
dst_07 = os.path.join(FOLDER, '07-memo-cover-crop.jpg')

orig_01 = Image.open(src_01)
orig_01_size = orig_01.size

# Zoom into top 20% of the document — isolates the UNCLASSIFIED stamp area
stamp_crop = zoom_to_top(orig_01, top_frac=0.20, cx=0.5)
assert stamp_crop.size == (TW, TH)
stamp_crop.save(dst_07, quality=95, optimize=True)
print(f'  07-memo-cover-crop.jpg: {orig_01_size[0]}x{orig_01_size[1]} -> {stamp_crop.size[0]}x{stamp_crop.size[1]}  (top 20%, zoom)')

# ── Step 2: crop all slide images ─────────────────────────────────────────────
#
# cx / cy are fractions of the SCALED image.
# For portrait docs scaled to exactly 1920 tall, cy has no effect (y0 is always 0).
# For landscape docs (04) scaled to 1920 tall, width >> 1080, so cx selects the column.
# For large square photos (02), width ≈ height after scaling, so cx matters.
#
print()
specs = [
    # fname                          cx     cy     note
    ('01-memo-cover.jpg',           0.50,  0.65),  # body text + signature (center-left column)
    ('02-kennedy-joint-chiefs.jpg', 0.50,  0.35),  # group: faces upper-center
    ('03-pretexts-list.jpg',        0.50,  0.25),  # upper half: title + first proposals
    ('04-terror-campaign.jpg',      0.42,  0.70),  # landscape: left-center column, lower half
    ('05-lemnitzer-portrait.jpg',   0.50,  0.30),  # portrait: face upper-center
    ('06-kennedy-oval-office.jpg',  0.50,  0.35),  # portrait: face upper-center
]

for fname, cx, cy in specs:
    process(fname, cx, cy)

# ── Step 3: verify all files ───────────────────────────────────────────────────
print('\n=== Verification ===\n')
for f in sorted(os.listdir(FOLDER)):
    if f.lower().endswith(('.jpg', '.jpeg', '.png')):
        img = Image.open(os.path.join(FOLDER, f))
        status = 'OK' if img.size == (TW, TH) else 'WRONG SIZE'
        print(f'  [{status}]  {f}: {img.size[0]}x{img.size[1]}')
