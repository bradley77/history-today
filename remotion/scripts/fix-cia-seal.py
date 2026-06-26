from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance

SRC  = Path(__file__).resolve().parent.parent / "public" / "slides" / "CIAHeartAttackGun" / "02-cia-lobby-seal.jpg"
CANVAS_W, CANVAS_H = 1080, 1920

img = Image.open(SRC).convert("RGB")
src_w, src_h = img.size
print(f"Source: {src_w}x{src_h}")

# Background: cover fill, blur 40, brightness 30%
scale_bg = max(CANVAS_W * 1.2 / src_w, CANVAS_H * 1.2 / src_h)
bg = img.resize((int(src_w * scale_bg), int(src_h * scale_bg)), Image.LANCZOS)
left = (bg.width  - CANVAS_W) // 2
top  = (bg.height - CANVAS_H) // 2
bg = bg.crop((left, top, left + CANVAS_W, top + CANVAS_H))
bg = bg.filter(ImageFilter.GaussianBlur(radius=40))
bg = ImageEnhance.Brightness(bg).enhance(0.30)

# Foreground: fit by width at 1080px
fg_h = int(src_h * (CANVAS_W / src_w))
fg = img.resize((CANVAS_W, fg_h), Image.LANCZOS)

# Composite centered vertically
canvas = bg.copy()
paste_y = (CANVAS_H - fg_h) // 2
canvas.paste(fg, (0, paste_y))

canvas.save(SRC, "JPEG", quality=95)
print(f"Saved {CANVAS_W}x{CANVAS_H}, fg={CANVAS_W}x{fg_h}, paste at (0,{paste_y})")
