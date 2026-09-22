// QuickStrikeCaptions.tsx
//
// Forced-alignment burned-in captions for Operation Menu Quick Strike. Unlike
// the shared CaptionOverlay (QuickStrikeShared.tsx), which apportions cue
// timing by word-count share of the slide's audio duration (an ESTIMATE, since
// Kokoro/Chatterbox give no word timestamps), this component reads real
// per-chunk start/end times produced by a forced aligner (see
// remotion/scripts/generate_captions_operation_menu.py and
// remotion/src/data/operation-menu-captions.json) and switches hard on/off at
// those exact times -- no fade, no slide, no animation, and nothing rendered
// outside a chunk's [start, end) window (the shared component always shows
// SOME line via a last-line fallback; this one shows nothing between chunks).
//
// Style matches the shared CaptionOverlay's box treatment (max-width 900,
// rgba(0,0,0,0.6) box, safe-zone-anchored positioning) but with this video's
// own larger cream-on-black look instead of the shared component's white/38px
// defaults, and no GoldLowerThird headline to avoid (this composition removes
// overlay text/GoldLowerThird entirely, so the ceiling is always the plain
// safe-zone line).
import { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { SAFE_ZONE_BOTTOM_Y } from '../shared/QuickStrikeShared';
import captionsData from '../data/operation-menu-captions.json';

const FONT_FAMILY = "'Oswald', Impact, 'Arial Black', sans-serif";
const FONT_SIZE = 66;
const LINE_HEIGHT = 1.2;
const MAX_WIDTH = 900;
const H_PADDING = 20;
const V_PADDING = 10;
const CREAM = '#EFEBE0';
const BOTTOM_SAFE_BUFFER = 20;
const DEFAULT_TOP = 1450;

type Chunk = { text: string; start: number; end: number };

const CAPTIONS_BY_SLIDE = (captionsData as { fps: number; slides: Record<string, Chunk[]> }).slides;
const CAPTIONS_FPS = (captionsData as { fps: number }).fps;

// Mirrors the shared CaptionOverlay's estimateWrappedLineCount (that helper
// isn't exported from QuickStrikeShared.tsx), sized for THIS component's own
// font/size instead of the shared component's 38px default. Also handles the
// literal '\n' in slide 1's second chunk as an explicit line break.
function estimateWrappedLineCount(text: string, maxTextWidth: number): number {
  const rawLines = text.split('\n');
  if (typeof document === 'undefined') return rawLines.length;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return rawLines.length;
  ctx.font = `700 ${FONT_SIZE}px ${FONT_FAMILY}`;

  let totalLines = 0;
  for (const rawLine of rawLines) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    let lineCount = 1;
    let lineWidth = 0;
    for (const word of words) {
      const wordWidth = ctx.measureText(`${word} `).width;
      if (lineWidth > 0 && lineWidth + wordWidth > maxTextWidth) {
        lineCount += 1;
        lineWidth = wordWidth;
      } else {
        lineWidth += wordWidth;
      }
    }
    totalLines += lineCount;
  }
  return totalLines;
}

function blockHeight(lineCount: number): number {
  return lineCount * FONT_SIZE * LINE_HEIGHT + V_PADDING * 2;
}

export function QuickStrikeCaptions({ slideId, fps }: { slideId: string; fps?: number }) {
  const frame = useCurrentFrame();
  const effectiveFps = fps ?? CAPTIONS_FPS;
  const chunks: Chunk[] = CAPTIONS_BY_SLIDE[slideId] ?? [];

  const active = useMemo(
    () =>
      chunks.find(
        (c) => frame >= Math.round(c.start * effectiveFps) && frame < Math.round(c.end * effectiveFps),
      ),
    [chunks, frame, effectiveFps],
  );

  const usableWidth = MAX_WIDTH - H_PADDING * 2;
  const safeTop = useMemo(() => {
    if (!active) return DEFAULT_TOP;
    const ceiling = SAFE_ZONE_BOTTOM_Y - BOTTOM_SAFE_BUFFER;
    const height = blockHeight(estimateWrappedLineCount(active.text, usableWidth));
    return Math.min(DEFAULT_TOP, ceiling - height);
  }, [active, usableWidth]);

  if (!active) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: safeTop,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 60px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: MAX_WIDTH,
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: CREAM,
          fontSize: FONT_SIZE,
          fontWeight: 700,
          lineHeight: LINE_HEIGHT,
          fontFamily: FONT_FAMILY,
          textAlign: 'center',
          padding: `${V_PADDING}px ${H_PADDING}px`,
          borderRadius: 6,
          whiteSpace: 'pre-line',
        }}
      >
        {active.text}
      </div>
    </div>
  );
}
