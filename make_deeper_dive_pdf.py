from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, PageBreak
)
from reportlab.platypus.frames import Frame
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import Table, TableStyle
import os, re

# ── colours ──────────────────────────────────────────────────────────────────
NEAR_BLACK  = colors.HexColor("#1a1a1a")
OFF_WHITE   = colors.HexColor("#f5f2ec")
RULE_GREY   = colors.HexColor("#cccccc")
BODY_BLACK  = colors.HexColor("#1c1c1c")

# ── output path ──────────────────────────────────────────────────────────────
OUT_DIR = os.path.join(os.path.dirname(__file__), "public", "documents")
os.makedirs(OUT_DIR, exist_ok=True)
OUT_PATH = os.path.join(OUT_DIR, "alger-hiss-deeper-dive.pdf")

W, H = letter          # 8.5 × 11 inches
MARGIN = 0.85 * inch
HEADER_H = 1.55 * inch  # reserved for cover block on page 1
FOOTER_H = 0.45 * inch

# ── styles ───────────────────────────────────────────────────────────────────
BODY = ParagraphStyle(
    "body",
    fontName="Times-Roman",
    fontSize=11.5,
    leading=17,
    textColor=BODY_BLACK,
    alignment=TA_JUSTIFY,
    spaceAfter=8,
)
SECTION_HEAD = ParagraphStyle(
    "section_head",
    fontName="Times-Bold",
    fontSize=14,
    leading=18,
    textColor=NEAR_BLACK,
    alignment=TA_LEFT,
    spaceBefore=22,
    spaceAfter=6,
)
ITALIC_NOTE = ParagraphStyle(
    "italic_note",
    fontName="Times-Italic",
    fontSize=10,
    leading=15,
    textColor=colors.HexColor("#444444"),
    alignment=TA_LEFT,
    spaceBefore=20,
)
INTRO = ParagraphStyle(
    "intro",
    fontName="Times-Roman",
    fontSize=11.5,
    leading=17,
    textColor=BODY_BLACK,
    alignment=TA_JUSTIFY,
    spaceAfter=8,
    firstLineIndent=0,
)

# ── custom doc template with header + footer ──────────────────────────────────
class EchoDoc(BaseDocTemplate):
    def __init__(self, filename, **kw):
        super().__init__(filename, **kw)
        self._first_page = True

        # Page 1: shorter content frame (header block sits above it)
        frame1 = Frame(
            MARGIN, FOOTER_H + MARGIN * 0.4,
            W - 2 * MARGIN,
            H - HEADER_H - FOOTER_H - MARGIN * 0.8,
            id="page1",
        )
        # Subsequent pages: full content frame
        frame_n = Frame(
            MARGIN, FOOTER_H + MARGIN * 0.6,
            W - 2 * MARGIN,
            H - MARGIN * 0.9 - FOOTER_H - 0.3 * inch,
            id="pagen",
        )
        t1 = PageTemplate(id="First",  frames=[frame1], onPage=self._draw_page1)
        tn = PageTemplate(id="Later",  frames=[frame_n], onPage=self._draw_later)
        self.addPageTemplates([t1, tn])

    # ── cover header block (page 1 only) ──────────────────────────────────────
    def _draw_page1(self, canvas, doc):
        canvas.saveState()

        # dark rectangle across the top
        canvas.setFillColor(NEAR_BLACK)
        canvas.rect(0, H - HEADER_H, W, HEADER_H, stroke=0, fill=1)

        # publication name
        canvas.setFillColor(colors.white)
        canvas.setFont("Times-Bold", 24)
        canvas.drawCentredString(W / 2, H - 0.55 * inch, "Echo & Chronicle")

        # tagline
        canvas.setFont("Times-Italic", 10.5)
        canvas.setFillColor(colors.HexColor("#bbbbbb"))
        canvas.drawCentredString(W / 2, H - 0.82 * inch, "History They Didn't Teach You")

        # thin rule
        canvas.setStrokeColor(colors.HexColor("#555555"))
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, H - 0.98 * inch, W - MARGIN, H - 0.98 * inch)

        # article title
        canvas.setFillColor(colors.white)
        canvas.setFont("Times-Bold", 17)
        canvas.drawCentredString(W / 2, H - 1.22 * inch, "The Deeper File: Alger Hiss")

        # exclusive tag
        canvas.setFont("Times-Italic", 10)
        canvas.setFillColor(colors.HexColor("#cccccc"))
        canvas.drawCentredString(W / 2, H - 1.45 * inch, "Exclusive to Echo & Chronicle Subscribers")

        self._draw_footer(canvas, doc)
        canvas.restoreState()

    def _draw_later(self, canvas, doc):
        canvas.saveState()
        # slim running header
        canvas.setFillColor(NEAR_BLACK)
        canvas.rect(0, H - 0.38 * inch, W, 0.38 * inch, stroke=0, fill=1)
        canvas.setFillColor(colors.HexColor("#aaaaaa"))
        canvas.setFont("Times-Italic", 9)
        canvas.drawString(MARGIN, H - 0.26 * inch, "Echo & Chronicle")
        canvas.setFont("Times-Bold", 9)
        canvas.setFillColor(colors.white)
        canvas.drawCentredString(W / 2, H - 0.26 * inch, "The Deeper File: Alger Hiss")
        canvas.setFont("Times-Italic", 9)
        canvas.setFillColor(colors.HexColor("#aaaaaa"))
        canvas.drawRightString(W - MARGIN, H - 0.26 * inch, f"Page {doc.page}")
        self._draw_footer(canvas, doc)
        canvas.restoreState()

    def _draw_footer(self, canvas, doc):
        y = 0.28 * inch
        canvas.setStrokeColor(RULE_GREY)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, y + 0.16 * inch, W - MARGIN, y + 0.16 * inch)
        canvas.setFont("Times-Italic", 8.5)
        canvas.setFillColor(colors.HexColor("#555555"))
        canvas.drawCentredString(
            W / 2, y - 0.02 * inch,
            "Echo & Chronicle  ·  echoandchronicle.today"
        )


# ── parse markdown → flowables ────────────────────────────────────────────────
def md_inline(text):
    """Convert *italic* and **bold** spans to ReportLab XML tags."""
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\*(.+?)\*',     r'<i>\1</i>', text)
    # escape bare ampersands that aren't part of an entity
    text = re.sub(r'&(?!#?\w+;)', '&amp;', text)
    return text

def build_story(md_path):
    story = []

    with open(md_path, encoding="utf-8") as f:
        raw = f.read()

    # Strip YAML front-matter if any
    raw = re.sub(r'^---\n.*?\n---\n', '', raw, flags=re.DOTALL)

    lines = raw.splitlines()
    i = 0
    first_h1_skipped = False  # skip the "# The Deeper File…" line (in header)
    first_h3_skipped = False  # skip "### Exclusive…" (in header)

    while i < len(lines):
        line = lines[i]

        # H1 – skip (rendered in header block)
        if line.startswith("# ") and not first_h1_skipped:
            first_h1_skipped = True
            i += 1
            continue

        # H3 subtitle – skip (rendered in header block)
        if line.startswith("### ") and not first_h3_skipped:
            first_h3_skipped = True
            i += 1
            continue

        # H2 section headers
        if line.startswith("## "):
            text = md_inline(line[3:].strip())
            story.append(Paragraph(text, SECTION_HEAD))
            i += 1
            continue

        # Horizontal rules → thin line
        if line.strip() == "---":
            story.append(Spacer(1, 6))
            story.append(HRFlowable(width="100%", thickness=0.5,
                                    color=RULE_GREY, spaceAfter=6))
            i += 1
            continue

        # Italic source note block (lines starting with *)
        if line.startswith("*") and line.endswith("*"):
            text = md_inline(line.strip("*").strip())
            story.append(Paragraph(f"<i>{text}</i>", ITALIC_NOTE))
            i += 1
            continue

        # Blank line
        if line.strip() == "":
            i += 1
            continue

        # Regular paragraph – accumulate consecutive non-blank lines
        para_lines = []
        while i < len(lines) and lines[i].strip() != "" and not lines[i].startswith("#") and lines[i].strip() != "---":
            para_lines.append(lines[i].strip())
            i += 1
        text = md_inline(" ".join(para_lines))
        style = INTRO if not story else BODY
        story.append(Paragraph(text, style))

    return story


# ── build PDF ─────────────────────────────────────────────────────────────────
doc = EchoDoc(
    OUT_PATH,
    pagesize=letter,
    rightMargin=MARGIN,
    leftMargin=MARGIN,
    topMargin=MARGIN,
    bottomMargin=MARGIN,
)

story = build_story(
    os.path.join(os.path.dirname(__file__), "alger-hiss-deeper-dive.md")
)

# switch to "Later" template after page 1
from reportlab.platypus import NextPageTemplate
story.insert(0, NextPageTemplate("Later"))

doc.build(story)
print(f"PDF written: {OUT_PATH}")
