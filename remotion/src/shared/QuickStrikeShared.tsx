// QuickStrikeShared.tsx
//
// Shared engine for the Echo & Chronicle "QuickStrike" format, extracted from
// the patterns already proven across GettysburgDay1-3QS, TokyoFirebombing,
// NuclearKyoto, UnionShermanScorchedEarth, MacArthurInchon, BattleOfHue,
// BataanDeathMarchToll, HighwayOfDeathQuickStrike, and LincolnFortStevens.
//
// Goal: every new video (SIGNAL, RECON, FRONT, BLUEGRAY) imports from here
// instead of re-implementing the gold-rule overlay, captions, Ken Burns, and
// CTA end card by hand. One place to fix bugs or evolve the style.
//
// DECISIONS BAKED IN FROM REVIEWING THE EXISTING FILES:
//   - Captions are scoped to the ACTUAL audio duration, not the padded slide
//     duration (Bataan/BattleOfHue's approach — the more correct one; older
//     files that time against full slide duration should be migrated to this).
//   - EndCardCTA always renders the trigger word as real text (not baked into
//     a PNG), so trigger words can be swapped without regenerating art.
//   - One label component (ContextTag) replaces topLabel/cornerLabel/contextTag —
//     position is a prop, not three different implementations.

import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  Easing,
} from 'remotion';
import { useMemo } from 'react';

export const FPS = 30;
export const HARD_CUT_FRAMES = 4;
export const OSWALD_URL =
  'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

export const GOLD = '#C9A84C';

// Facebook Reels reserves roughly the bottom 340px of the 1920px canvas for
// its own UI (profile/name/audio/caption bar). Text whose bottom edge renders
// below y=1580 gets flagged by Meta's content-quality system and risks
// reduced reach — independently confirmed on a published BLUEGRAY video.
// Every bottom-anchored text block below computes its position FROM this
// line and grows upward as content grows, rather than a fixed offset off the
// very bottom of the canvas that silently stops being safe once a block gets
// taller than whatever it was tuned against.
export const CANVAS_HEIGHT = 1920;
export const CANVAS_WIDTH = 1080;
export const SAFE_ZONE_BOTTOM_Y = 1580;
const BOTTOM_SAFE_BUFFER = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Motion = {
  scaleFrom: number;
  scaleTo: number;
  txFrom: number;
  txTo: number;
  tyFrom: number;
  tyTo: number;
  easing?: 'linear' | 'easeInOut' | 'easeInOutCubic';
  transformOrigin?: string;
};

export type SlideConfig = {
  id: string;
  image: string | null;
  audio: string;
  /** Actual VO file duration (measured) + 0.4s pad */
  durationInSeconds: number;
  /** Actual VO file duration only, no pad — captions/CTA fade out before this ends */
  audioDurationSeconds: number;
  /** Bold all-caps headline in the gold-rule box */
  overlayText?: string;
  /** Anchor the gold-rule box to the top or bottom of frame. Default 'bottom'.
   * Use 'top' when the visual subject sits low in frame (e.g. a mushroom
   * cloud) and a bottom-anchored box would overlap it. */
  overlayPosition?: 'top' | 'bottom';
  /** Verbatim VO line(s) shown as burned-in captions */
  captionLines?: string[];
  captionY?: number;
  /** Small gold label, e.g. "GETTYSBURG, PA — JULY 1, 1863" */
  label?: string;
  labelPosition?: 'top-left' | 'bottom-left';
  motion?: Motion | null;
  hasBlurBackground?: boolean;
};

// ---------------------------------------------------------------------------
// Frame math helpers
// ---------------------------------------------------------------------------

export function withFrames<T extends { durationInSeconds: number; audioDurationSeconds: number }>(
  slide: T,
) {
  return {
    ...slide,
    durationFrames: Math.round(slide.durationInSeconds * FPS),
    audioDurationFrames: Math.round(slide.audioDurationSeconds * FPS),
  };
}

export function buildTimeline<T extends { durationInSeconds: number; audioDurationSeconds: number }>(
  slides: T[],
) {
  const withF = slides.map(withFrames);
  const totalDuration = withF.reduce((sum, s) => sum + s.durationFrames, 0);
  return { slidesWithFrames: withF, totalDuration };
}

// ---------------------------------------------------------------------------
// useGoldOverlay — the rule-width + text-opacity reveal used on every headline
// ---------------------------------------------------------------------------

export function useGoldOverlay(localFrame: number, delayFrames = 8) {
  const ruleWidth = interpolate(localFrame, [delayFrames, delayFrames + 25], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textOpacity = interpolate(localFrame, [delayFrames, delayFrames + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { ruleWidth, textOpacity };
}

// ---------------------------------------------------------------------------
// GoldLowerThird — the rule / black box / headline / rule stack used on
// (almost) every slide across every composition
// ---------------------------------------------------------------------------

export function GoldLowerThird({
  text,
  frame,
  delayFrames = 8,
  position = 'bottom',
  // Overridable so a slide whose paired CaptionOverlay has a hard floor
  // (sharpContentBottomY) that leaves no room at the default size can shrink
  // this headline instead — see computeFloorAwareHeadlineFit. Must be passed
  // the SAME values given to that caption's headlineFontSize/headlineLineHeight
  // props, or the two boxes' math will disagree about where each one sits.
  fontSize = 52,
  lineHeight = 1.25,
}: {
  text: string;
  frame: number;
  delayFrames?: number;
  position?: 'top' | 'bottom';
  fontSize?: number;
  lineHeight?: number;
}) {
  const { ruleWidth, textOpacity } = useGoldOverlay(frame, delayFrames);

  return (
    <AbsoluteFill
      style={{
        justifyContent: position === 'top' ? 'flex-start' : 'flex-end',
        alignItems: 'center',
        // Bottom padding is derived from SAFE_ZONE_BOTTOM_Y (currently
        // resolves to 360px, keeping the box's bottom edge at y=1560 on the
        // 1920px canvas) rather than a hardcoded number, so the guarantee
        // holds even if the safe-zone line above ever changes. justifyContent
        // 'flex-end' + this padding anchors the box from the bottom up: the
        // child grows upward as its content gets taller, and its bottom edge
        // never moves. Ported from GettysburgRetreatQS.tsx's one-off fix so
        // every composition using this shared component gets it.
        // Top-anchored variant (position='top') uses the same 140px clearance
        // the bottom box had before that fix — the top of frame has no
        // reserved platform UI, so it doesn't need the larger margin.
        padding:
          position === 'top'
            ? '140px 48px 0'
            : `0 48px ${CANVAS_HEIGHT - SAFE_ZONE_BOTTOM_Y + BOTTOM_SAFE_BUFFER}px`,
        pointerEvents: 'none',
      }}
    >
      <div style={{ width: '100%' }}>
        <div
          style={{
            height: 3,
            width: `${ruleWidth}%`,
            backgroundColor: GOLD,
            marginBottom: 16,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />
        <div style={{ backgroundColor: 'rgba(0,0,0,0.60)', padding: '24px 40px', textAlign: 'center' }}>
          <p
            style={{
              fontSize,
              fontWeight: 700,
              color: '#F5F0E8',
              margin: 0,
              lineHeight,
              textShadow: '0 2px 14px rgba(0,0,0,0.95)',
              fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
              letterSpacing: '0.01em',
              opacity: textOpacity,
            }}
          >
            {text}
          </p>
        </div>
        <div
          style={{
            height: 3,
            width: `${ruleWidth}%`,
            backgroundColor: GOLD,
            marginTop: 16,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// ContextTag — replaces topLabel / cornerLabel / contextTag. Position is a prop.
// ---------------------------------------------------------------------------

export function ContextTag({
  text,
  position = 'top-left',
  opacity = 1,
}: {
  text: string;
  position?: 'top-left' | 'bottom-left';
  opacity?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: position === 'top-left' ? 48 : undefined,
        bottom: position === 'bottom-left' ? 48 : undefined,
        left: 40,
        color: GOLD,
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: '0.06em',
        fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
        textShadow: '0 1px 6px rgba(0,0,0,0.9)',
        opacity,
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CaptionOverlay — burned-in captions, scoped to ACTUAL AUDIO duration (not
// the padded slide duration). Fades in fast, fades out just before speech
// ends so it never lingers into the trailing 0.4s pad. This is the corrected
// version of the pattern used inconsistently across the existing files.
// ---------------------------------------------------------------------------

const CAPTION_MAX_WIDTH = 900;
const CAPTION_H_PADDING = 20; // each side, from the box's '10px 20px' padding
const CAPTION_V_PADDING = 10; // each side, from the box's '10px 20px' padding
const CAPTION_FONT_SIZE = 38;
const CAPTION_MIN_FONT_SIZE = 28; // floor for the shrink-to-fit fallback below
// Set explicitly (rather than left to the browser's 'normal') so the
// wrap-height math below matches the actual render exactly.
const CAPTION_LINE_HEIGHT = 1.3;
// Gap kept below a blur-border-fill image's sharp content (sharpContentBottomY).
const SHARP_CONTENT_MARGIN = 25;

// Replays the browser's own greedy line-wrap against the caption box's real
// font and width, so the safe-zone clamp below is based on the box's ACTUAL
// rendered height for arbitrarily long captions — not a guess tuned to look
// right for short ones.
function estimateWrappedLineCount(text: string, maxTextWidth: number, fontSize: number): number {
  if (typeof document === 'undefined') return 1;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return 1;
  ctx.font = `700 ${fontSize}px 'Oswald', Impact, 'Arial Black', sans-serif`;

  const words = text.split(/\s+/).filter(Boolean);
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
  return lineCount;
}

function captionBlockHeight(lineCount: number, fontSize: number): number {
  return lineCount * fontSize * CAPTION_LINE_HEIGHT + CAPTION_V_PADDING * 2;
}

// GoldLowerThird's own box math (font/padding/rule sizes mirrored from that
// component), so CaptionOverlay can tell where the paired headline's box
// actually starts and never render into it. Both boxes are computed
// independently at render time — this keeps them from colliding without
// coupling the two components together.
const HEADLINE_FONT_SIZE = 52;
const HEADLINE_LINE_HEIGHT = 1.25;
const HEADLINE_MIN_FONT_SIZE = 32; // floor for computeFloorAwareHeadlineFit's shrink loop
const HEADLINE_H_PADDING = 40; // each side, GoldLowerThird's box '24px 40px'
const HEADLINE_V_PADDING = 24;
const HEADLINE_RULE_HEIGHT = 3;
const HEADLINE_RULE_GAP = 16; // each rule's margin to the text box
const HEADLINE_OUTER_H_PADDING = 48; // GoldLowerThird's outer '0 48px ...'
// Measured against real renders: canvas measureText() (used to predict line
// wrap below) doesn't account for the headline's letterSpacing (0.01em) and
// runs measurably narrower than the actual browser layout for this text/font
// combination — e.g. one real headline measured ~825px here but visibly wraps
// at the 904px box width, which only happens if its true rendered width is
// over 904px. A wrap this component fails to predict means CaptionOverlay's
// ceiling ends up too permissive, risking a real caption-over-headline
// collision — worse than the caption shrinking a little early — so line-wrap
// estimation for the headline (not the caption, which has its own shrink
// safety net) uses a deliberately narrower effective width.
const HEADLINE_WRAP_SAFETY_FACTOR = 0.85;
const HEADLINE_MAX_WIDTH = (CANVAS_WIDTH - HEADLINE_OUTER_H_PADDING * 2 - HEADLINE_H_PADDING * 2) * HEADLINE_WRAP_SAFETY_FACTOR;
// Gap kept above the paired headline's own visible text (not its box top —
// see HEADLINE_CHROME_BEFORE_TEXT below).
const CAPTION_HEADLINE_GAP = 20;
// computeHeadlineTopY returns the top of the headline's RULE/PADDING box, not
// where its text glyphs actually start — the top rule, its margin, and the
// box's own top padding are empty decorative space above the text, not text
// itself, so a caption is free to sit under THAT boundary too, not just under
// the glyphs. This is exact CSS layout math (rule height + rule margin + box
// padding), not an approximation — it closes a gap that was previously making
// the ceiling needlessly conservative by this many pixels on every slide.
const HEADLINE_CHROME_BEFORE_TEXT = HEADLINE_RULE_HEIGHT + HEADLINE_RULE_GAP + HEADLINE_V_PADDING;

function headlineBoxHeight(lineCount: number, fontSize: number, lineHeight: number): number {
  return HEADLINE_RULE_HEIGHT * 2 + HEADLINE_RULE_GAP * 2 + HEADLINE_V_PADDING * 2 + lineCount * fontSize * lineHeight;
}

// GoldLowerThird's bottom is pinned at SAFE_ZONE_BOTTOM_Y - BOTTOM_SAFE_BUFFER
// (currently 1560) — see GoldLowerThird's padding, which is derived the same way.
function computeHeadlineTopY(text: string, fontSize: number, lineHeight: number): number {
  const lineCount = estimateWrappedLineCount(text, HEADLINE_MAX_WIDTH, fontSize);
  return SAFE_ZONE_BOTTOM_Y - BOTTOM_SAFE_BUFFER - headlineBoxHeight(lineCount, fontSize, lineHeight);
}

// The Y a caption's bottom edge must stay at or above: the headline's own
// rule/padding chrome is empty space a caption may sit under, so this adds
// HEADLINE_CHROME_BEFORE_TEXT back before applying the caption-to-headline
// gap, rather than measuring from the box's outer top.
function computeCaptionCeilingAboveHeadline(text: string, fontSize: number, lineHeight: number): number {
  return computeHeadlineTopY(text, fontSize, lineHeight) + HEADLINE_CHROME_BEFORE_TEXT - CAPTION_HEADLINE_GAP;
}

// For slides with a hard image floor (sharpContentBottomY): the floor is
// non-negotiable (see CaptionOverlay below), so if the headline at its
// default size doesn't leave enough room for even a minimum-size caption
// below the floor, this shrinks the HEADLINE instead — never the floor.
// Call once per slide (the result doesn't depend on which caption cue is
// currently active, only on the worst-case cue, so the headline never
// visibly resizes mid-slide) and pass the same fontSize/lineHeight to both
// GoldLowerThird and this caption's CaptionOverlay.
export function computeFloorAwareHeadlineFit({
  overlayText,
  captionLines,
  sharpContentBottomY,
}: {
  overlayText: string;
  captionLines: string[];
  sharpContentBottomY: number;
}): { fontSize: number; lineHeight: number } {
  const floor = sharpContentBottomY + SHARP_CONTENT_MARGIN;
  const usableWidth = CAPTION_MAX_WIDTH - CAPTION_H_PADDING * 2;
  const minCaptionHeight = Math.max(
    ...captionLines.map((line) =>
      captionBlockHeight(estimateWrappedLineCount(line, usableWidth, CAPTION_MIN_FONT_SIZE), CAPTION_MIN_FONT_SIZE),
    ),
  );
  const requiredCeiling = floor + minCaptionHeight;

  let fontSize = HEADLINE_FONT_SIZE;
  let ceiling = computeCaptionCeilingAboveHeadline(overlayText, fontSize, HEADLINE_LINE_HEIGHT);
  while (ceiling < requiredCeiling && fontSize > HEADLINE_MIN_FONT_SIZE) {
    fontSize -= 2;
    ceiling = computeCaptionCeilingAboveHeadline(overlayText, fontSize, HEADLINE_LINE_HEIGHT);
  }
  return { fontSize, lineHeight: HEADLINE_LINE_HEIGHT };
}

export function CaptionOverlay({
  lines,
  audioDurationFrames,
  // Desired top for ordinary full-bleed (cover-fit) slides, which have no
  // blurred margin to sit in — the sharp image always reaches the very
  // bottom of the canvas on those, so there's no position that clears it
  // entirely under the 1580 safe line. Pushed close to that ceiling (was
  // 1260) so captions sit as low as the safe zone allows. Still just a
  // starting point — the wrap-height clamp below is what actually holds
  // the y<=1580 invariant.
  top = 1450,
  // For blur-border-fill images only (currently Son Tay's four slides and
  // HighwayOfDeathQuickStrike's pulled-back slides): the real, known y-
  // coordinate where THIS slide's sharp (non-blurred) image content ends,
  // measured from the source composite — not a geometric guess from Ken
  // Burns scale (the sharp region's on-screen extent changes as the shot
  // zooms, so no single scale-derived number is safe for the whole slide).
  // When provided, this is a HARD, non-negotiable floor: the caption always
  // renders at exactly sharpContentBottomY + SHARP_CONTENT_MARGIN, never
  // higher up (never overlapping the image), regardless of how tight that
  // makes things above it. If it doesn't fit under the ceiling at normal
  // size, the caption's own font shrinks — and if even minimum-size still
  // doesn't fit, the paired headline must be shrunk via
  // computeFloorAwareHeadlineFit (pass the SAME result to headlineFontSize/
  // headlineLineHeight below) rather than moving the caption off the floor.
  sharpContentBottomY,
  // The headline text this caption is paired with (same string passed to the
  // sibling GoldLowerThird), so the caption's ceiling can be pulled up above
  // the headline's own box when a long headline wraps to 2+ lines and grows
  // taller than usual — otherwise a caption placed just under
  // SAFE_ZONE_BOTTOM_Y or just under sharpContentBottomY can land on top of
  // the headline text instead of above it.
  overlayText,
  // Must match whatever GoldLowerThird is actually rendering the headline
  // at (defaults to GoldLowerThird's own defaults) — only diverges from
  // those defaults when computeFloorAwareHeadlineFit shrank the headline.
  headlineFontSize = 52,
  headlineLineHeight = 1.25,
}: {
  lines: string[];
  audioDurationFrames: number;
  top?: number;
  sharpContentBottomY?: number;
  overlayText?: string;
  headlineFontSize?: number;
  headlineLineHeight?: number;
}) {
  const frame = useCurrentFrame();

  const lineRanges = useMemo(() => {
    const wordCounts = lines.map((line) => line.split(/\s+/).filter(Boolean).length);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);
    let wordsSoFar = 0;
    let startFrame = 0;
    return lines.map((line, i) => {
      wordsSoFar += wordCounts[i];
      const endFrame = Math.round((wordsSoFar / totalWords) * audioDurationFrames);
      const range = { line, startFrame, endFrame };
      startFrame = endFrame;
      return range;
    });
  }, [lines, audioDurationFrames]);

  const active =
    lineRanges.find((r) => frame >= r.startFrame && frame < r.endFrame) ??
    lineRanges[lineRanges.length - 1];

  // Compute the box's actual rendered height for the currently active line,
  // then position it so the bottom edge never crosses the safe zone AND
  // never crosses into the paired headline's own box — anchoring from the
  // bottom up (block height first) rather than trusting a fixed top offset
  // that only happens to work for short lines / short headlines.
  const { safeTop, fontSize } = useMemo(() => {
    const safeZoneCeiling = SAFE_ZONE_BOTTOM_Y - BOTTOM_SAFE_BUFFER;
    const ceiling =
      overlayText !== undefined
        ? Math.min(safeZoneCeiling, computeCaptionCeilingAboveHeadline(overlayText, headlineFontSize, headlineLineHeight))
        : safeZoneCeiling;
    const usableWidth = CAPTION_MAX_WIDTH - CAPTION_H_PADDING * 2;

    if (sharpContentBottomY !== undefined) {
      // sharpContentBottomY is a MINIMUM, not a fixed position — the caption
      // still prefers to sit near the bottom overlay (same target as the
      // no-floor branch below) and only gets pushed down further when the
      // image's sharp content actually reaches that far. Slides where the
      // sharp content ends well above the normal caption position (e.g. a
      // wide establishing shot) must not strand the caption up near the
      // middle of the frame just because a floor was supplied.
      const floor = sharpContentBottomY + SHARP_CONTENT_MARGIN;
      const naturalHeight = captionBlockHeight(estimateWrappedLineCount(active.line, usableWidth, CAPTION_FONT_SIZE), CAPTION_FONT_SIZE);
      const naturalTarget = Math.min(top, ceiling - naturalHeight);
      const desiredTop = Math.max(floor, naturalTarget);

      // Never adjusted below this point — if the headline above doesn't leave
      // room even at CAPTION_MIN_FONT_SIZE, that must be resolved by shrinking
      // the headline (computeFloorAwareHeadlineFit), not by moving the caption
      // off the floor.
      const availableHeight = ceiling - desiredTop;
      let size = CAPTION_FONT_SIZE;
      let height = captionBlockHeight(estimateWrappedLineCount(active.line, usableWidth, size), size);
      while (height > availableHeight && size > CAPTION_MIN_FONT_SIZE) {
        size -= 2;
        height = captionBlockHeight(estimateWrappedLineCount(active.line, usableWidth, size), size);
      }
      return { safeTop: desiredTop, fontSize: size };
    }

    // No hard floor (ordinary full-bleed slide) — free to slide the box
    // upward to stay under the ceiling instead of shrinking the font.
    const lineCount = estimateWrappedLineCount(active.line, usableWidth, CAPTION_FONT_SIZE);
    const height = captionBlockHeight(lineCount, CAPTION_FONT_SIZE);
    const maxTop = ceiling - height;
    return { safeTop: Math.min(top, maxTop), fontSize: CAPTION_FONT_SIZE };
  }, [active.line, top, sharpContentBottomY, overlayText, headlineFontSize, headlineLineHeight]);

  // Fade in over 10 frames, fade out over the last 6 frames of audio — never
  // visible during the trailing pad.
  const opacity = interpolate(
    frame,
    [0, 10, Math.max(11, audioDurationFrames - 6), audioDurationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

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
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: CAPTION_MAX_WIDTH,
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize,
          fontWeight: 700,
          lineHeight: CAPTION_LINE_HEIGHT,
          textAlign: 'center',
          padding: `${CAPTION_V_PADDING}px ${CAPTION_H_PADDING}px`,
          borderRadius: 6,
        }}
      >
        {active.line}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KenBurnsImage — the image + vignette + motion combo used on every slide
// ---------------------------------------------------------------------------

export function KenBurnsImage({
  image,
  frame,
  durationFrames,
  motion,
  hasBlurBackground = false,
}: {
  image: string;
  frame: number;
  durationFrames: number;
  motion: Motion;
  hasBlurBackground?: boolean;
}) {
  const easingFn =
    motion.easing === 'easeInOutCubic'
      ? Easing.inOut(Easing.cubic)
      : motion.easing === 'easeInOut'
      ? Easing.inOut(Easing.ease)
      : Easing.linear;

  const scale = interpolate(frame, [0, durationFrames], [motion.scaleFrom, motion.scaleTo], {
    easing: easingFn,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tx = interpolate(frame, [0, durationFrames], [motion.txFrom, motion.txTo], {
    easing: easingFn,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ty = interpolate(frame, [0, durationFrames], [motion.tyFrom, motion.tyTo], {
    easing: easingFn,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {hasBlurBackground && (
        <AbsoluteFill>
          <Img
            src={staticFile(image)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              transform: 'scale(1.15)',
              filter: 'blur(45px) brightness(0.6)',
            }}
          />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Img
          src={staticFile(image)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            transform: `scale(${scale}) translateX(${tx}px) translateY(${ty}px)`,
            transformOrigin: motion.transformOrigin ?? 'center center',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function Vignette() {
  return (
    <>
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.75) 100%)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// SlidePanel — a full standard slide: image + vignette + lower third +
// optional context tag + captions + audio + hard-cut/cold-open opacity.
// ---------------------------------------------------------------------------

export function SlidePanel({
  slide,
  isFirst,
}: {
  slide: SlideConfig & { durationFrames: number; audioDurationFrames: number };
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();
  const { motion, durationFrames, overlayText, overlayPosition, image, captionLines, captionY, label, labelPosition } = slide;

  // Cold open on slide 1 (full brightness frame 0), 4-frame hard cut on every
  // slide after that. No fade-out anywhere — hard cut ending, matches every
  // existing QuickStrike file.
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      {image && (
        <>
          <KenBurnsImage
            image={image}
            frame={frame}
            durationFrames={durationFrames}
            motion={motion ?? { scaleFrom: 1, scaleTo: 1, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 }}
            hasBlurBackground={slide.hasBlurBackground}
          />
          <Vignette />
        </>
      )}

      {label && <ContextTag text={label} position={labelPosition ?? 'top-left'} />}

      {overlayText && <GoldLowerThird text={overlayText} frame={frame} position={overlayPosition} />}

      {captionLines && (
        <CaptionOverlay
          lines={captionLines}
          audioDurationFrames={slide.audioDurationFrames}
          top={captionY}
        />
      )}

      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// EndCardCTA — the "Comment [TRIGGER]" end card, parametrized. Always real
// text (never baked into a PNG) so trigger words / eras swap without
// regenerating art. Pass an era-specific background image if you want one,
// or leave it black like the existing coded end cards (Lincoln/Tokyo/Sherman).
// ---------------------------------------------------------------------------

export function EndCardCTA({
  triggerWord,
  subline = 'FOLLOW FOR MORE',
  audio,
  backgroundImage,
}: {
  triggerWord: string;
  subline?: string;
  audio?: string;
  backgroundImage?: string;
}) {
  const frame = useCurrentFrame();
  const textOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ruleWidth = interpolate(frame, [8, 33], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
      }}
    >
      {backgroundImage && (
        <AbsoluteFill>
          <Img
            src={staticFile(backgroundImage)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.5)' }}
          />
        </AbsoluteFill>
      )}

      <div style={{ width: '80%', maxWidth: 900, zIndex: 1 }}>
        <div style={{ height: 3, background: GOLD, width: `${ruleWidth}%`, marginBottom: 28 }} />

        <div
          style={{
            opacity: textOpacity,
            color: GOLD,
            fontFamily: 'Georgia, serif',
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          Comment
        </div>

        <div
          style={{
            opacity: textOpacity,
            color: '#fff',
            fontFamily: 'Georgia, serif',
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          {triggerWord}
        </div>

        {subline && (
          <div
            style={{
              opacity: textOpacity,
              color: '#E8E2D4',
              fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
              fontSize: 24,
              letterSpacing: '0.06em',
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            {subline}
          </div>
        )}

        <div style={{ height: 3, background: GOLD, width: `${ruleWidth}%` }} />
      </div>

      {audio && <Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Era color tags — one place to define the visual identity per CTA/series,
// so SIGNAL gets its own accent without touching shared component code.
// ---------------------------------------------------------------------------

export const ERA_ACCENTS = {
  BLUEGRAY: GOLD,       // Civil War — existing gold, unchanged
  FRONT: GOLD,          // WWII — existing gold, unchanged
  RECON: GOLD,          // Vietnam — existing gold, unchanged
  SIGNAL: '#7FA8B8',    // Korea/Cold War/Gulf War — new slate-blue accent,
                         // distinct from the other three at a glance
} as const;
