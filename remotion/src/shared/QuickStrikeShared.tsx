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
}: {
  text: string;
  frame: number;
  delayFrames?: number;
  position?: 'top' | 'bottom';
}) {
  const { ruleWidth, textOpacity } = useGoldOverlay(frame, delayFrames);

  return (
    <AbsoluteFill
      style={{
        justifyContent: position === 'top' ? 'flex-start' : 'flex-end',
        alignItems: 'center',
        // Bottom padding 360px (was 140px) keeps the box's bottom edge at
        // y=1560 on the 1920px canvas — inside the y<=1580 safe zone above
        // Facebook Reels' reserved UI band (profile/name/audio/caption bar,
        // ~bottom 300-350px). Ported from GettysburgRetreatQS.tsx's one-off
        // fix so every composition using this shared component gets it.
        // Top-anchored variant (position='top') uses the same 140px clearance
        // the bottom box had before that fix — the top of frame has no
        // reserved platform UI, so it doesn't need the larger margin.
        padding: position === 'top' ? '140px 48px 0' : '0 48px 360px',
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
              fontSize: 52,
              fontWeight: 700,
              color: '#F5F0E8',
              margin: 0,
              lineHeight: 1.25,
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

export function CaptionOverlay({
  lines,
  audioDurationFrames,
  // Shifted from 1480 to 1260 (-220px, matching GoldLowerThird's safe-zone
  // shift below) so the caption stays inside the y<=1580 safe zone and the
  // existing caption-to-headline gap is preserved unchanged.
  top = 1260,
}: {
  lines: string[];
  audioDurationFrames: number;
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
        top,
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
          maxWidth: 900,
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize: 38,
          fontWeight: 700,
          textAlign: 'center',
          padding: '10px 20px',
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
