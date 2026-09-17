#!/usr/bin/env python3
"""
trace_terrain.py

Auto-traces forest vs. clearing boundaries from a scanned period map (like
the 1867 Michler survey) into a real, editable SVG file with vector paths
already drawn -- ready to open directly in Inkscape.

HOW IT WORKS
------------
Old military survey maps mark forest using dense stippling/hachure texture
and mark open ground by leaving it blank. This script measures how densely
"inked" each area of the image is, smooths that into a density map, and
draws a boundary line everywhere the density crosses from sparse (clearing)
to dense (forest). Small, insignificant fingers and islands get merged away
by the smoothing step and tiny leftover specs get dropped, so you get a
handful of clean, simplified shapes instead of hundreds of noisy ones.

The output SVG has two layers, matching a normal Inkscape reference setup:
  - "Reference" (locked): the original source image, so you can still see
    exactly what you traced from.
  - "AutoTraced": the actual vector shapes, already filled tan (clearing)
    or green (forest) as a best guess -- fix any wrong colors by hand,
    that's normal and expected.

THIS IS A STARTING POINT, NOT A FINISHED MAP.
It will not know which shapes are historically significant, it will
sometimes guess the forest/clearing color wrong, and some shapes will still
need manual cleanup or merging. Treat its output the way you'd treat a
rough pencil layout -- a serious head start, not the final art.

REQUIREMENTS
------------
Python 3.9+, and these packages (all free/open-source):
    pip install numpy scipy scikit-image pillow

USAGE
-----
Basic (whole image):
    python trace_terrain.py my_map.jpg

Limit to one region of the image (recommended -- crop to just your target
battle area first, using pixel coordinates: left top right bottom):
    python trace_terrain.py my_map.jpg --crop 1200 3600 4800 7200

Choose your own output filename:
    python trace_terrain.py my_map.jpg --crop 1200 3600 4800 7200 -o wilderness_auto.svg

Tune the results (all optional, defaults work reasonably well as a start):
    --ink-threshold   How dark a pixel must be to count as "ink" (0-255,
                       lower = only very dark marks count). Default 95.
    --min-area        Drop shapes smaller than this many pixels. Raises
                       this to get fewer, larger, simpler shapes. Default 2500.
    --simplify        How aggressively to reduce each shape's point count.
                       Higher = smoother/simpler lines. Default 8.0.
    --blur            How far small features get merged together before
                       tracing. Higher = bigger, simpler merged shapes,
                       lower = more small detail kept. Default 45.
    --max-dim         Large scans are automatically shrunk to at most this
                       many pixels on the longest side before tracing (for
                       speed), then the result is scaled back up to full
                       resolution. Default 1600. Raise this for more detail
                       on very large source files, at the cost of runtime.

Full example with tuning:
    python trace_terrain.py my_map.jpg --crop 1200 3600 4800 7200 \\
        --min-area 400 --blur 35 --simplify 4 -o wilderness_auto.svg
"""

import argparse
import base64
import io
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter
from skimage import measure
from skimage.draw import polygon as sk_polygon


def poly_area(c):
    x, y = c[:, 1], c[:, 0]
    return 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))


def poly_len(c):
    d = np.diff(c, axis=0)
    return float(np.sum(np.sqrt((d ** 2).sum(axis=1))))


def trace_image(gray_arr, ink_threshold, blur, min_area, simplify_tol):
    """Returns list of (points_Nx2_xy, is_forest_bool)."""
    ink = (gray_arr < ink_threshold).astype(np.float32)
    density = uniform_filter(ink, size=13)
    density = uniform_filter(density, size=blur)

    # Local-adaptive normalization: compare each point's density to its own
    # regional average rather than one global threshold. Old scans are
    # rarely evenly inked/lit across the whole page, and a single global
    # cutoff can misread that large-scale unevenness as a fake forest/
    # clearing boundary spanning the image. Comparing locally cancels that.
    local_bg = uniform_filter(density, size=max(blur * 4, 60))
    local_spread = uniform_filter(np.abs(density - local_bg), size=max(blur * 4, 60)) + 1e-4
    norm = np.clip(0.5 + (density - local_bg) / (local_spread * 4), 0, 1)
    norm = uniform_filter(norm, size=9)
    level = 0.5

    raw_contours = measure.find_contours(norm, level)
    kept = [c for c in raw_contours if poly_area(c) > min_area or poly_len(c) > (min_area ** 0.5) * 2]

    shapes = []
    for c in kept:
        # Classify using the ORIGINAL (pre-simplify) contour, rasterized and
        # averaged over its full interior -- a single centroid pixel was
        # unreliable for large, complex, or concave shapes.
        rr, cc = sk_polygon(c[:, 0], c[:, 1], shape=norm.shape)
        if len(rr) == 0:
            continue
        mean_density = norm[rr, cc].mean()
        is_forest = mean_density > level

        simple = measure.approximate_polygon(c, tolerance=simplify_tol)
        if len(simple) < 3:
            continue
        pts_xy = simple[:, [1, 0]]  # (row,col) -> (x,y)
        shapes.append((pts_xy, is_forest))
    return shapes


def image_to_data_uri(pil_img):
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def build_svg(width, height, ref_img, shapes):
    forest_fill = "#5C7A46"
    forest_stroke = "#33502A"
    clearing_fill = "#D9C48F"
    clearing_stroke = "#8A6B3F"

    ref_uri = image_to_data_uri(ref_img)

    parts = []
    parts.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" '
        f'xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd" '
        f'width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
    )

    # Reference layer: locked, holds the source image
    parts.append(
        f'<g inkscape:label="Reference" inkscape:groupmode="layer" '
        f'sodipodi:insensitive="true" id="reference-layer">'
    )
    parts.append(
        f'<image x="0" y="0" width="{width}" height="{height}" href="{ref_uri}"/>'
    )
    parts.append("</g>")

    # AutoTraced layer: the real editable shapes
    parts.append(
        f'<g inkscape:label="AutoTraced" inkscape:groupmode="layer" id="autotraced-layer">'
    )
    for i, (pts, is_forest) in enumerate(shapes):
        fill = forest_fill if is_forest else clearing_fill
        stroke = forest_stroke if is_forest else clearing_stroke
        d = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in pts) + " Z"
        parts.append(
            f'<path id="auto{i}" d="{d}" fill="{fill}" stroke="{stroke}" '
            f'stroke-width="1.5" fill-opacity="0.9"/>'
        )
    parts.append("</g>")
    parts.append("</svg>")
    return "\n".join(parts)


def main():
    ap = argparse.ArgumentParser(
        description="Auto-trace forest/clearing shapes from a period map into an Inkscape-ready SVG.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("image", help="Path to the source map image (jpg, png, tif...)")
    ap.add_argument("-o", "--output", default=None, help="Output .svg path (default: <image>_traced.svg)")
    ap.add_argument("--crop", nargs=4, type=int, metavar=("LEFT", "TOP", "RIGHT", "BOTTOM"),
                     help="Limit tracing to this pixel region of the image")
    ap.add_argument("--ink-threshold", type=int, default=95, help="Darkness cutoff for counting as ink (default 95)")
    ap.add_argument("--min-area", type=int, default=2500, help="Drop shapes smaller than this (default 2500)")
    ap.add_argument("--simplify", type=float, default=8.0, help="Point-reduction tolerance (default 8.0)")
    ap.add_argument("--blur", type=int, default=45, help="Merge radius for small features (default 45)")
    ap.add_argument("--max-dim", type=int, default=1600,
                     help="Downsample large images to this max side length before tracing, for speed (default 1600)")
    args = ap.parse_args()

    try:
        im = Image.open(args.image).convert("RGB")
    except Exception as e:
        print(f"Could not open image: {e}", file=sys.stderr)
        sys.exit(1)

    if args.crop:
        im = im.crop(tuple(args.crop))

    full_w, full_h = im.size
    print(f"Image size: {full_w}x{full_h} px")

    longest_side = max(full_w, full_h)
    scale = min(1.0, args.max_dim / longest_side)
    if scale < 1.0:
        work_size = (max(1, int(full_w * scale)), max(1, int(full_h * scale)))
        work_im = im.resize(work_size, Image.LANCZOS)
        print(f"Working at reduced size {work_size[0]}x{work_size[1]} for speed "
              f"(use --max-dim to change), scaling result back up afterward.")
    else:
        work_im = im

    gray = np.array(work_im.convert("L")).astype(np.float32)

    print("Measuring ink density and tracing boundaries...")
    shapes = trace_image(
        gray,
        ink_threshold=args.ink_threshold,
        blur=args.blur,
        min_area=args.min_area,
        simplify_tol=args.simplify,
    )

    if scale < 1.0:
        inv = 1.0 / scale
        shapes = [(pts * inv, is_forest) for pts, is_forest in shapes]
    n_forest = sum(1 for _, f in shapes if f)
    n_clear = len(shapes) - n_forest
    print(f"Found {len(shapes)} shapes ({n_forest} forest, {n_clear} clearing).")

    svg = build_svg(im.size[0], im.size[1], im, shapes)

    out_path = args.output or (args.image.rsplit(".", 1)[0] + "_traced.svg")
    with open(out_path, "w") as f:
        f.write(svg)
    print(f"Saved: {out_path}")
    print("Open this file directly in Inkscape -- the Reference and AutoTraced layers are already set up.")


if __name__ == "__main__":
    main()
