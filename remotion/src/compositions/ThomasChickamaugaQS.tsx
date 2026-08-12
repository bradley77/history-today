import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { useMemo } from 'react';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SAFE_ZONE_BOTTOM_Y,
  SlidePanel,
  ContextTag,
  GoldLowerThird,
  CaptionOverlay,
  Vignette,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// George Thomas / "Rock of Chickamauga" — BLUEGRAY-family Civil War Quick
// Strike. Trigger word: BLUEGRAY.
//
// Locked decisions from the build brief:
//   - No fades anywhere: true cold open at frame 0 (isFirst on slide 1), a
//     4-frame hard cut on every other slide, no fade to black at the end.
//   - Per-slide audio only (one <Audio> per Sequence, own local frame 0) —
//     no continuous/concatenated track.
//   - Slide 5 is a real visual CTA (background-removed statue art, gold
//     overlay headline, captions ending in the "Comment BLUEGRAY" line) —
//     rendered as an ordinary slide, not the standalone black EndCardCTA
//     card most other QuickStrikes close on, per this composition's explicit
//     per-slide spec.
//   - Timing is LOCKED from ffprobe-measured VO + the standard 0.4s pad — see
//     scripts/generateVoiceover-thomas-rock-of-chickamauga-qs.py. Do not
//     recalculate; these are the final numbers reported and approved.
const PAD_S = 0.4;

const SLIDE1_AUDIO_S = 4.843;
const SLIDE2_AUDIO_S = 6.272;
const SLIDE3_AUDIO_S = 6.251;
const SLIDE4_AUDIO_S = 6.272;
const SLIDE5_AUDIO_S = 5.461;

// ---------------------------------------------------------------------------
// Pan slides (2-4) — landscape sources wide enough to earn a horizontal pan
// AND, per this brief, a simultaneous Ken Burns scale ramp. QuickStrikeShared's
// Pan-Fill System (sourceWidth/sourceHeight -> SlidePanel) computes the same
// translateX room automatically but its 'pan' mode intentionally holds scale
// fixed at baseScale (see KenBurnsImage's isPan branch in
// QuickStrikeShared.tsx) — it has no support for animating scale WHILE
// panning. So the same Pan-Fill room formula (base_scale = 1920/height,
// pan_room = width*base_scale - 1080, usable = 87.5% of pan_room with a
// 50px-floor edge buffer) is replicated here by hand and fed into a local
// component that layers an animated scale() on top of the calculated
// translateX — same math, same edge-safety guarantee as the shared system,
// just without its extra speed cap (which would otherwise undershoot the
// requested sweep across only a ~200-frame slide). Ported from
// GuadalcanalQS.tsx's PannedImageLayer/PanSlidePanel, which established this
// local-component workaround for the same shared-engine gap.
// ---------------------------------------------------------------------------

function PannedZoomImageLayer({
  image,
  scaleFrom,
  scaleTo,
  txFrom,
  txTo,
  durationFrames,
}: {
  image: string;
  scaleFrom: number;
  scaleTo: number;
  txFrom: number;
  txTo: number;
  durationFrames: number;
}) {
  const frame = useCurrentFrame();

  const scaleRaw = interpolate(frame, [0, durationFrames], [scaleFrom, scaleTo], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Structural floor: the calculated pan below assumes the image never
  // renders smaller than its true base scale (height:100%, i.e. scaleFrom) —
  // clamp on every frame rather than trusting the eased curve alone.
  const scale = Math.max(scaleRaw, scaleFrom);

  const tx = interpolate(frame, [0, durationFrames], [txFrom, txTo], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Img
          src={staticFile(image)}
          style={{
            height: '100%',
            width: 'auto',
            maxWidth: 'none',
            transform: `scale(${scale}) translateX(${tx}px)`,
            transformOrigin: 'center center',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// Composes the SAME layer stack SlidePanel (QuickStrikeShared.tsx) mounts
// for every other image slide — Vignette, ContextTag, GoldLowerThird, then
// CaptionOverlay (ceiling-aware of the headline box via its own overlayText
// prop) — in the same order. Only the image layer itself is custom.
function PanSlidePanel({
  image,
  audio,
  scaleFrom,
  scaleTo,
  txFrom,
  txTo,
  label,
  overlayText,
  captionLines,
  durationFrames,
  audioDurationFrames,
  isFirst,
}: {
  image: string;
  audio: string;
  scaleFrom: number;
  scaleTo: number;
  txFrom: number;
  txTo: number;
  label?: string;
  overlayText: string;
  captionLines: string[];
  durationFrames: number;
  audioDurationFrames: number;
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();

  // Cold open on slide 1 (full brightness frame 0), 4-frame hard cut on every
  // slide after that. No fade-out anywhere — hard cut ending.
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <PannedZoomImageLayer
        image={image}
        scaleFrom={scaleFrom}
        scaleTo={scaleTo}
        txFrom={txFrom}
        txTo={txTo}
        durationFrames={durationFrames}
      />

      <Vignette />

      {label && <ContextTag text={label} position="top-left" />}

      <GoldLowerThird text={overlayText} frame={frame} />

      <CaptionOverlay
        lines={captionLines}
        audioDurationFrames={audioDurationFrames}
        overlayText={overlayText}
      />

      {/* Per-slide voiceover — fires at this slide's own local frame 0 */}
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide 5's caption — same word-wrap/safe-zone/cue-timing math as
// QuickStrikeShared's CaptionOverlay (locked/consume-only, see the pan-slide
// note above), ported locally because this slide needs ONE cue ("Comment
// BLUEGRAY") styled distinctly — gold accent, bolder/larger — as the CTA
// trigger word, which the shared component has no per-line style hook for.
// Trimmed to exactly the call shape this slide uses (no kicker, no
// bottomOffset/safeZoneBottomY override, no sharpContentBottomY floor) —
// every simplification below is safe ONLY because this slide never sets
// those. Constants mirror CaptionOverlay/GoldLowerThird's own private
// module constants in QuickStrikeShared.tsx (not exported, so duplicated
// here rather than imported).
// ---------------------------------------------------------------------------

const GOLD_ACCENT = 'rgb(214, 178, 110)';

const CTA_CAPTION_MAX_WIDTH = 900;
const CTA_CAPTION_H_PADDING = 20;
const CTA_CAPTION_V_PADDING = 10;
const CTA_CAPTION_FONT_SIZE = 38;
const CTA_CAPTION_LINE_HEIGHT = 1.3;
// "Comment BLUEGRAY" cue — larger and bolder than the standard caption size,
// so it reads as the CTA trigger word rather than a normal sentence.
const CTA_HIGHLIGHT_FONT_SIZE = 46;
const CTA_HEADLINE_FONT_SIZE = 52;
const CTA_HEADLINE_LINE_HEIGHT = 1.25;
const CTA_HEADLINE_H_PADDING = 40;
const CTA_HEADLINE_V_PADDING = 24;
const CTA_HEADLINE_RULE_HEIGHT = 3;
const CTA_HEADLINE_RULE_GAP = 16;
const CTA_HEADLINE_OUTER_H_PADDING = 48;
const CTA_HEADLINE_WRAP_SAFETY_FACTOR = 0.85;
const CTA_HEADLINE_MAX_WIDTH =
  (1080 - CTA_HEADLINE_OUTER_H_PADDING * 2 - CTA_HEADLINE_H_PADDING * 2) * CTA_HEADLINE_WRAP_SAFETY_FACTOR;
const CTA_CAPTION_HEADLINE_GAP = 20;
const CTA_HEADLINE_CHROME_BEFORE_TEXT = CTA_HEADLINE_RULE_HEIGHT + CTA_HEADLINE_RULE_GAP + CTA_HEADLINE_V_PADDING;
const CTA_BOTTOM_SAFE_BUFFER = 20;

function ctaEstimateWrappedLineCount(text: string, maxTextWidth: number, fontSize: number): number {
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

function ctaCaptionBlockHeight(lineCount: number, fontSize: number): number {
  return lineCount * fontSize * CTA_CAPTION_LINE_HEIGHT + CTA_CAPTION_V_PADDING * 2;
}

function ctaHeadlineBoxHeight(lineCount: number): number {
  return (
    CTA_HEADLINE_RULE_HEIGHT * 2 +
    CTA_HEADLINE_RULE_GAP * 2 +
    CTA_HEADLINE_V_PADDING * 2 +
    lineCount * CTA_HEADLINE_FONT_SIZE * CTA_HEADLINE_LINE_HEIGHT
  );
}

// The Y a caption's bottom edge must stay at or above, so it never collides
// with the headline box sitting above it. Mirrors
// computeCaptionCeilingAboveHeadline in QuickStrikeShared.tsx exactly, for
// this slide's fixed headline size (no floor-aware shrink, no kicker).
function ctaComputeCaptionCeiling(overlayText: string): number {
  const lineCount = ctaEstimateWrappedLineCount(overlayText, CTA_HEADLINE_MAX_WIDTH, CTA_HEADLINE_FONT_SIZE);
  const headlineTopY = SAFE_ZONE_BOTTOM_Y - CTA_BOTTOM_SAFE_BUFFER - ctaHeadlineBoxHeight(lineCount);
  return headlineTopY + CTA_HEADLINE_CHROME_BEFORE_TEXT - CTA_CAPTION_HEADLINE_GAP;
}

function CTACaptionOverlay({
  lines,
  highlightLines,
  audioDurationFrames,
  overlayText,
  top = 1450,
}: {
  lines: string[];
  highlightLines: Set<string>;
  audioDurationFrames: number;
  overlayText: string;
  top?: number;
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

  const isHighlight = highlightLines.has(active.line);
  const fontSize = isHighlight ? CTA_HIGHLIGHT_FONT_SIZE : CTA_CAPTION_FONT_SIZE;

  // Same "slide the box up to stay under the ceiling" logic as
  // CaptionOverlay's no-floor branch — the ceiling accounts for the
  // headline's real box height so this never renders on top of it.
  const safeTop = useMemo(() => {
    const safeZoneCeiling = SAFE_ZONE_BOTTOM_Y - CTA_BOTTOM_SAFE_BUFFER;
    const ceiling = Math.min(safeZoneCeiling, ctaComputeCaptionCeiling(overlayText));
    const usableWidth = CTA_CAPTION_MAX_WIDTH - CTA_CAPTION_H_PADDING * 2;
    const lineCount = ctaEstimateWrappedLineCount(active.line, usableWidth, fontSize);
    const height = ctaCaptionBlockHeight(lineCount, fontSize);
    const maxTop = ceiling - height;
    return Math.min(top, maxTop);
  }, [active.line, fontSize, overlayText, top]);

  // Fade in over 10 frames, fade out over the last 6 frames of audio — never
  // visible during the trailing pad. Same envelope as CaptionOverlay.
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
          maxWidth: CTA_CAPTION_MAX_WIDTH,
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: isHighlight ? GOLD_ACCENT : '#fff',
          fontSize,
          fontWeight: isHighlight ? 800 : 700,
          lineHeight: CTA_CAPTION_LINE_HEIGHT,
          fontFamily: isHighlight ? "'Oswald', Impact, 'Arial Black', sans-serif" : undefined,
          letterSpacing: isHighlight ? '0.04em' : undefined,
          textAlign: 'center',
          padding: `${CTA_CAPTION_V_PADDING}px ${CTA_CAPTION_H_PADDING}px`,
          borderRadius: 6,
        }}
      >
        {active.line}
      </div>
    </div>
  );
}

// Slide 5's own panel: statue art + slow push-in, gold headline, and the
// highlight-aware caption above. No ContextTag (closing card, per brief).
function CTASlidePanel({
  image,
  audio,
  scaleFrom,
  scaleTo,
  overlayText,
  captionLines,
  highlightCaptionLines,
  durationFrames,
  audioDurationFrames,
  isFirst,
}: {
  image: string;
  audio: string;
  scaleFrom: number;
  scaleTo: number;
  overlayText: string;
  captionLines: string[];
  highlightCaptionLines: string[];
  durationFrames: number;
  audioDurationFrames: number;
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();

  // Cold open on slide 1 (full brightness frame 0), 4-frame hard cut on every
  // slide after that. No fade-out anywhere — hard cut ending.
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  const scale = interpolate(frame, [0, durationFrames], [scaleFrom, scaleTo], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const highlightSet = useMemo(() => new Set(highlightCaptionLines), [highlightCaptionLines]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile(image)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      </AbsoluteFill>

      <Vignette />

      <GoldLowerThird text={overlayText} frame={frame} />

      <CTACaptionOverlay
        lines={captionLines}
        highlightLines={highlightSet}
        audioDurationFrames={audioDurationFrames}
        overlayText={overlayText}
      />

      {/* Per-slide voiceover — fires at this slide's own local frame 0 */}
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide config
// ---------------------------------------------------------------------------

type StaticSlide = SharedSlideConfig & { kind: 'static' };

type PanSlide = {
  kind: 'pan';
  id: string;
  image: string;
  audio: string;
  durationInSeconds: number;
  audioDurationSeconds: number;
  label?: string;
  overlayText: string;
  captionLines: string[];
  scaleFrom: number;
  scaleTo: number;
  txFrom: number;
  txTo: number;
};

type CTASlide = {
  kind: 'cta';
  id: string;
  image: string;
  audio: string;
  durationInSeconds: number;
  audioDurationSeconds: number;
  overlayText: string;
  captionLines: string[];
  // Caption lines (matched verbatim) to render in the gold accent color at
  // the larger CTA-trigger weight instead of standard caption styling.
  highlightCaptionLines: string[];
  scaleFrom: number;
  scaleTo: number;
};

type Slide = StaticSlide | PanSlide | CTASlide;

const SLIDES: Slide[] = [
  {
    kind: 'static',
    id: 'slide1',
    image: 'slides/Thomas-Chickamauga/01-landing.jpg',
    audio: 'audio/thomas-rock-of-chickamauga-qs-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: 'MAJ. GEN. GEORGE H. THOMAS — U.S. ARMY OF THE CUMBERLAND',
    overlayText: "THE MAN WHO SAVED THE UNION ARMY. YOU'VE NEVER HEARD OF HIM.",
    captionLines: [
      'Everyone knows Grant and Sherman.',
      'This man saved the Union army at Chickamauga.',
    ],
    // 3020x4042 portrait, aspect 0.747 — well below PAN_FILL_ASPECT_THRESHOLD
    // (1.2), no pan target. Explicit motion (slow push-in only, per brief)
    // rather than Pan-Fill's default 1.05 static drift.
    motion: { scaleFrom: 1.0, scaleTo: 1.03, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
  },
  {
    kind: 'pan',
    id: 'slide2',
    image: 'slides/Thomas-Chickamauga/02-collapse.jpg',
    audio: 'audio/thomas-rock-of-chickamauga-qs-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: 'BATTLE OF CHICKAMAUGA — SEPTEMBER 1863',
    overlayText: 'SEPTEMBER 1863. THE UNION LINE BREAKS.',
    captionLines: [
      'September, eighteen sixty-three.',
      'The Union center breaks.',
      'Rosecrans rides off, certain the army is finished.',
    ],
    // 7410x4910, aspect 1.509 — above PAN_FILL_ASPECT_THRESHOLD (1.2), earns
    // a pan. base_scale = 1920/4910 = 0.391039, rendered_w = 7410*0.391039 =
    // 2897.60, pan_room = 2897.60-1080 = 1817.60. 87.5% of that room (edge
    // margin works out to 113.6px per side, above the 50px floor, so the
    // floor doesn't bind here) leaves a usable sweep of 1590.4px, centered
    // (+-795.2px) — left to right, toward the break in the line. Scale
    // ramps 1.0 -> 1.08 (pan exceeds the 30px threshold, so the scale floor
    // in PannedZoomImageLayer applies, though it never actually binds since
    // scaleFrom is already the base scale).
    scaleFrom: 1.0,
    scaleTo: 1.08,
    txFrom: 795.2,
    txTo: -795.2,
  },
  {
    kind: 'pan',
    id: 'slide3',
    image: 'slides/Thomas-Chickamauga/03-stand.jpg',
    audio: 'audio/thomas-rock-of-chickamauga-qs-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: 'HORSESHOE RIDGE — SNODGRASS HILL',
    overlayText: 'THE REST OF THE ARMY WAS ALREADY RETREATING.',
    captionLines: [
      'Thomas held Horseshoe Ridge,',
      'rallying broken units and reinforcements',
      'into a line that refused to break.',
    ],
    // 4500x3425, aspect 1.314 — above the pan threshold. base_scale =
    // 1920/3425 = 0.560584, rendered_w = 4500*0.560584 = 2522.63, pan_room =
    // 2522.63-1080 = 1442.63. Margin 90.16px/side (above the 50px floor)
    // leaves a usable sweep of 1262.3px (+-631.15px) — right to left,
    // reversing slide 2's direction, per brief.
    scaleFrom: 1.0,
    scaleTo: 1.06,
    txFrom: -631.15,
    txTo: 631.15,
  },
  {
    kind: 'pan',
    id: 'slide4',
    image: 'slides/Thomas-Chickamauga/04-payoff.jpg',
    audio: 'audio/thomas-rock-of-chickamauga-qs-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    label: 'BATTLE OF NASHVILLE — DECEMBER 1864',
    overlayText: 'GRANT PUT HIM IN COMMAND OF THE ARMY OF THE CUMBERLAND.',
    captionLines: [
      'The army survived.',
      'Grant gave Thomas command.',
      "He delivered one of the war's most decisive victories.",
    ],
    // 6540x4210, aspect 1.553 — above the pan threshold. base_scale =
    // 1920/4210 = 0.456057, rendered_w = 6540*0.456057 = 2982.61, pan_room =
    // 2982.61-1080 = 1902.61. Margin 118.91px/side (above the 50px floor)
    // leaves a usable sweep of 1664.79px (+-832.4px) — left to right.
    scaleFrom: 1.0,
    scaleTo: 1.08,
    txFrom: 832.4,
    txTo: -832.4,
  },
  {
    kind: 'cta',
    id: 'slide5',
    image: 'slides/Thomas-Chickamauga/05-cta.jpg',
    audio: 'audio/thomas-rock-of-chickamauga-qs-vo-05.mp3',
    durationInSeconds: SLIDE5_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE5_AUDIO_S,
    // No label — closing card, per brief.
    overlayText: "HE HAS A STATUE TOO. YOU'VE JUST NEVER SEEN IT.",
    // "Comment BLUEGRAY" split onto its own line (captions remain verbatim
    // to the already-locked VO — this is a line-break/styling change only,
    // no VO regeneration) so it can render as the distinct gold CTA trigger
    // word via highlightCaptionLines below.
    captionLines: [
      'He has a statue too.',
      "Why don't you know his name?",
      'Comment BLUEGRAY',
      'for the five-fact PDF.',
    ],
    highlightCaptionLines: ['Comment BLUEGRAY'],
    // 1390x2219 portrait (background-removed statue), aspect 0.626 — well
    // below PAN_FILL_ASPECT_THRESHOLD, no pan target. Same slow push-in
    // treatment as slide 1.
    scaleFrom: 1.0,
    scaleTo: 1.03,
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

export const totalDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);
export { FPS };

export default function ThomasChickamaugaQS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/LincolnFortStevens-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => {
        if (slide.kind === 'pan') {
          return (
            <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
              <PanSlidePanel
                image={slide.image}
                audio={slide.audio}
                scaleFrom={slide.scaleFrom}
                scaleTo={slide.scaleTo}
                txFrom={slide.txFrom}
                txTo={slide.txTo}
                label={slide.label}
                overlayText={slide.overlayText}
                captionLines={slide.captionLines}
                durationFrames={slide.durationFrames}
                audioDurationFrames={slide.audioDurationFrames}
                isFirst={i === 0}
              />
            </Sequence>
          );
        }
        if (slide.kind === 'cta') {
          return (
            <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
              <CTASlidePanel
                image={slide.image}
                audio={slide.audio}
                scaleFrom={slide.scaleFrom}
                scaleTo={slide.scaleTo}
                overlayText={slide.overlayText}
                captionLines={slide.captionLines}
                highlightCaptionLines={slide.highlightCaptionLines}
                durationFrames={slide.durationFrames}
                audioDurationFrames={slide.audioDurationFrames}
                isFirst={i === 0}
              />
            </Sequence>
          );
        }
        return (
          <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
            <SlidePanel slide={slide} isFirst={i === 0} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
