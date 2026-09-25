#!/usr/bin/env python3
"""
Slice Gettysburg OR reports out of the OR 27 volume PDFs.

Setup:   pip install pymupdf
Usage:
  python extract_or.py probe 1 622    # preview OR 27,1 page 622 to calibrate the offset
  python extract_or.py run            # the ten essential packet reports
  python extract_or.py run --fact     # essential + fact-check tier

PDF page number = OR page number + OFFSETS[volume]  (1-based).
Starting guesses come from the HathiTrust scans. Your files may differ,
so run probe first and adjust OFFSETS.
"""
import sys
from pathlib import Path
import pymupdf as fitz  # PyMuPDF

VOLUMES = {
    1: Path("OR-27-1 - Gettysburg.pdf"),
    2: Path("OR-27-2 - Gettysburg.pdf"),
}
OFFSETS = {1: 21, 2: 3}
OUT = Path("lrt_packet")

# (order, volume, slug, first OR page, last OR page)
ESSENTIAL = [
    (1, 1, "norton-no17",        199, 207),
    (2, 1, "sykes-no187",        592, 597),
    (3, 1, "barnes-no189",       598, 605),
    (4, 1, "rice-no195",         615, 622),
    (5, 1, "chamberlain-no196",  622, 626),
    (6, 1, "martin-no221",       659, 661),
    (7, 1, "garrard-no217",      651, 652),
    (8, 2, "oates-no444",        392, 393),
    (9, 2, "robertson-no452",    404, 407),
    (10, 1, "meade-no6-excerpt", 114, 121),
]

FACT_CHECK = [
    (11, 1, "vincent-no194",        613, 615),
    (12, 1, "clark-no197",          626, 627),
    (13, 1, "welch-no198",          627, 628),
    (14, 1, "elliott-no199",        628, 630),
    (15, 1, "conner-no200",         630, 631),
    (16, 1, "woodward-no201",       632, 632),
    (17, 1, "lamont-no202",         632, 634),
    (18, 1, "crawford-no218",       652, 656),
    (19, 1, "mccandless-no219",     657, 658),
    (20, 1, "fisher-no220",         658, 659),
    (21, 1, "humphreys-no158",      529, 537),
    (22, 1, "carr-no160",           541, 546),
    (23, 1, "brewster-no169",       558, 562),
    (24, 1, "ayres-no203",          634, 636),
    (25, 1, "casualty-return-no13", 173, 192),
    (26, 2, "longstreet-no430",     357, 364),
    (27, 2, "scruggs-no443",        391, 392),
    (28, 2, "sheffield-no447",      395, 396),
    (29, 2, "work-no454",           408, 410),
    (30, 2, "bane-no455",           410, 411),
    (31, 2, "bryan-no456",          411, 412),
]

_docs = {}


def open_vol(vol):
    if vol not in _docs:
        if not VOLUMES[vol].exists():
            sys.exit(f"Missing file: {VOLUMES[vol]}")
        _docs[vol] = fitz.open(VOLUMES[vol])
    return _docs[vol]


def idx(vol, or_page):
    """0-based PDF page index for an OR page number."""
    return or_page + OFFSETS[vol] - 1


def save_png(doc, i, path, zoom=1.3):
    pix = doc[i].get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    pix.save(str(path))


def probe(vol, or_page):
    doc = open_vol(vol)
    i = idx(vol, or_page)
    if not 0 <= i < len(doc):
        sys.exit(f"Page index {i} outside 0..{len(doc) - 1}")
    OUT.mkdir(exist_ok=True)
    p = OUT / f"probe_v{vol}_or{or_page}.png"
    save_png(doc, i, p)
    print(f"{VOLUMES[vol].name}: {len(doc)} pages. "
          f"OR p.{or_page} -> PDF page {i + 1}. Saved {p}")


def run(items):
    OUT.mkdir(exist_ok=True)
    (OUT / "previews").mkdir(exist_ok=True)
    for order, vol, slug, first, last in items:
        src = open_vol(vol)
        a, b = idx(vol, first), idx(vol, last)
        if a < 0 or b >= len(src):
            print(f"SKIP {slug}: pages {a + 1}-{b + 1} outside volume ({len(src)} pages)")
            continue
        name = f"{order:02d}-{slug}-or27-{vol}-{first}-{last}"
        dst = fitz.open()
        dst.insert_pdf(src, from_page=a, to_page=b)
        dst.save(str(OUT / f"{name}.pdf"), garbage=4, deflate=True)
        dst.close()
        save_png(src, a, OUT / "previews" / f"{name}.png")
        print(f"OK   {name}  (PDF pages {a + 1}-{b + 1})")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["probe"] and len(args) == 3:
        probe(int(args[1]), int(args[2]))
    elif args[:1] == ["run"]:
        run(ESSENTIAL + (FACT_CHECK if "--fact" in args else []))
    else:
        print(__doc__)
