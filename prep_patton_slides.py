from PIL import Image, ImageFilter
import os

CANVAS_W, CANVAS_H = 1080, 1920
BLUR_RADIUS = 45
JPEG_QUALITY = 90

SOURCE_DIR = r"c:\Users\bradl\history-today\remotion\public\slides\Patton"
OUT_DIR = SOURCE_DIR

MAPPING = [
    ("Patton3.jpg", "01-portrait-helmet.jpg"),
    ("Patton2.jpg", "02-silver-star-jenkins.jpg"),
    ("Patton1.jpg", "03-merkers-art-treasure.jpg"),
]


def make_blurred_bg(img: Image.Image) -> Image.Image:
    """Scale image to cover 1080x1920, then gaussian blur."""
    iw, ih = img.size
    scale = max(CANVAS_W / iw, CANVAS_H / ih)
    new_w, new_h = int(iw * scale), int(ih * scale)
    scaled = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - CANVAS_W) // 2
    top = (new_h - CANVAS_H) // 2
    bg = scaled.crop((left, top, left + CANVAS_W, top + CANVAS_H))
    return bg.filter(ImageFilter.GaussianBlur(radius=BLUR_RADIUS))


def contain_fit(img: Image.Image) -> tuple[Image.Image, int, int]:
    """Scale image to fit within 1080x1920, return (scaled_img, x_offset, y_offset)."""
    iw, ih = img.size
    scale = min(CANVAS_W / iw, CANVAS_H / ih)
    new_w, new_h = int(iw * scale), int(ih * scale)
    scaled = img.resize((new_w, new_h), Image.LANCZOS)
    x = (CANVAS_W - new_w) // 2
    y = (CANVAS_H - new_h) // 2
    return scaled, x, y


def process(src_name: str, dst_name: str) -> int:
    src_path = os.path.join(SOURCE_DIR, src_name)
    dst_path = os.path.join(OUT_DIR, dst_name)

    with Image.open(src_path) as img:
        img = img.convert("RGB")
        canvas = make_blurred_bg(img)
        fg, x, y = contain_fit(img)
        canvas.paste(fg, (x, y))
        canvas.save(dst_path, "JPEG", quality=JPEG_QUALITY)

    size_kb = os.path.getsize(dst_path) // 1024
    print(f"  {src_name} -> {dst_name}  ({size_kb} KB)")
    return size_kb


if __name__ == "__main__":
    print(f"Output dir: {OUT_DIR}\n")
    total = 0
    for src, dst in MAPPING:
        total += process(src, dst)
    print(f"\nTotal: {total} KB")
