import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { useMemo } from 'react';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

export const FPS = 30;

const HARD_CUT_FRAMES = 4;

type Motion = {
  scaleFrom: number;
  scaleTo: number;
  txFrom: number;
  txTo: number;
  tyFrom: number;
  tyTo: number;
  easing?: 'linear' | 'easeInOut' | 'easeInOutCubic';
  // CSS transform-origin, as a percentage of the rendered (native-aspect) image box —
  // not the visible frame. Defaults to 'center center'. Use this OR the animated
  // transformOriginX*/transformOriginY fields below, not both.
  transformOrigin?: string;
  // Animated horizontal transform-origin (percentage of the native image box), interpolated
  // over the same [0, durationFrames] range and easing as scale/tx/ty. Lets a wide pulled-back
  // opening frame stay centered while a tighter closing frame biases toward a focal point (e.g.
  // a cockpit) without either extreme cropping badly. transformOriginY is fixed (not animated).
  transformOriginXFrom?: number;
  transformOriginXTo?: number;
  transformOriginY?: number;
};

type SlideConfig = {
  id: string;
  image: string;
  audio: string;
  // Actual VO file duration (measured via Kokoro) + 0.4s pad
  durationInSeconds: number;
  overlayText?: string;
  motion: Motion;
  // When the foreground can pull back below cover-fit scale (revealing gaps at the edges),
  // render a blurred/darkened full-bleed copy of the same image behind it to fill those gaps.
  hasBlurBackground?: boolean;
  // Closed captions — mirrors the voiceover script (not overlayText), shown as sequential
  // line-by-line chunks timed proportionally to each line's share of the slide's word count.
  captionLines?: string[];
  captionY?: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/highway-of-death/01-a6e-intruder.jpg',
    audio: 'audio/highway-of-death-slide1-voiceover.mp3',
    durationInSeconds: 6.928, // 6.528s actual + 0.4s pad
    overlayText: "They called this the 'clean war.'",
    // Real file is 2720x1920 (height already matches the 1920 frame height, confirmed via
    // direct pixel check) — NOT 2204x1556. Same aspect ratio, different export resolution, so
    // cover-fit for the ACTUAL file is 1.0 in this height:100%-normalized rendering, not 1.234
    // (1.234 = 1920/1556, a ratio that only applies to the assumed-but-wrong source height).
    // Pulled back to an absolute starting scale that shows the full nose-to-tail span within
    // the 1080px frame width (1080/2720 = 0.397, rounded down slightly for a hair of margin),
    // zooming to a moderate (not tight) close-up on the cockpit by the end. No pan.
    // A FIXED cockpit anchor (25%/48%) breaks the wide opening frame: scaling down around an
    // off-center point pushes the far side of the anchor out of frame entirely — verified via
    // render, the nose disappeared off the left edge at scale 0.42, leaving only the tail two-
    // thirds visible. Animating transform-origin toward the nose doesn't work either: for this
    // 2720px-wide native image in a 1080px frame, any origin fraction below ~30% computes to a
    // screen position that's already off-screen-left before any scaling — the visible window
    // can approach but never pass that anchor, so 13% and 25% produce nearly the same framing
    // (verified via render). Panning with translateX instead — same mechanism as slide 2 — is
    // what actually shifts the visible window. Center-anchored the whole time; ease-in-out-cubic
    // (matching slide 2) so scale and pan both read as gradual throughout.
    motion: {
      scaleFrom: 0.42, scaleTo: 0.75, txFrom: 0, txTo: 650, tyFrom: 0, tyTo: 0,
      easing: 'easeInOutCubic',
    },
    hasBlurBackground: true,
    captionLines: [
      'One strike turned it into a one-sided slaughter.',
      'Marine Corps jets boxed in both ends with cluster bombs.',
    ],
    captionY: 1450,
  },
  {
    id: 'slide2',
    image: 'slides/highway-of-death/02-aerial-wreckage.jpg',
    audio: 'audio/highway-of-death-slide2-voiceover.mp3',
    durationInSeconds: 3.621, // 3.221s actual + 0.4s pad
    overlayText: 'Thousands of vehicles. Nowhere left to go.',
    // base_scale 1.038 — slowed sweep pan (~750px total), strong cubic ease-in-out so the
    // middle of the pan reads as visibly slower, not just the start/end.
    motion: { scaleFrom: 1.038, scaleTo: 1.038, txFrom: -375, txTo: 375, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    captionLines: ['For ten hours, aircraft hit everything trapped in between.'],
    captionY: 1450,
  },
  {
    id: 'slide3',
    image: 'slides/highway-of-death/03-t55-burned-car.jpg',
    audio: 'audio/highway-of-death-slide3-voiceover.mp3',
    durationInSeconds: 4.880, // 4.480s actual + 0.4s pad
    overlayText: 'Soldiers, looted cars, and civilians caught in the destruction.',
    // Cover-fit for this source is only ~1.011 (its aspect ratio nearly matches the 1080x1920
    // target already), so a scale relative to cover-fit (e.g. 0.88x that) barely pulls back at
    // all. Use an absolute starting scale well below cover-fit instead, for a genuinely wide
    // opening view (tank, car, trees, ground context) that zooms to a moderate close-up —
    // never as tight as a full cover-fit crop. No pan. Cubic ease-in-out (same strength as
    // slide 2's pan) so the zoom reads as slower, not just shorter.
    // The foreground doesn't cover the frame at these scales, so this slide also gets the
    // blurred full-bleed background (see hasBlurBackground below).
    motion: { scaleFrom: 0.60, scaleTo: 0.80, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    hasBlurBackground: true,
    captionLines: [
      'The death toll is still disputed.',
      'President Bush called a ceasefire the next day.',
    ],
    captionY: 1450,
  },
  {
    id: 'slide4',
    image: 'slides/highway-of-death/04-cta-blackcard.jpg',
    audio: 'audio/highway-of-death-slide4-voiceover.mp3',
    durationInSeconds: 3.664, // 3.264s actual + 0.4s pad
    // No overlayText — CTA text is already baked into the card art.
    motion: { scaleFrom: 1.0, scaleTo: 1.0, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
}));

export const totalDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

function useGoldOverlay(localFrame: number, delayFrames = 8) {
  const ruleWidth = interpolate(
    localFrame,
    [delayFrames, delayFrames + 25],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const textOpacity = interpolate(
    localFrame,
    [delayFrames, delayFrames + 18],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return { ruleWidth, textOpacity };
}

// Closed captions — timed as sequential line-by-line chunks, each line's on-screen
// window sized proportionally to its share of the slide's total word count.
function CaptionOverlay({
  lines,
  durationFrames,
  top = 1600,
}: {
  lines: string[];
  durationFrames: number;
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
      const endFrame = Math.round((wordsSoFar / totalWords) * durationFrames);
      const range = { line, startFrame, endFrame };
      startFrame = endFrame;
      return range;
    });
  }, [lines, durationFrames]);

  const active =
    lineRanges.find((r) => frame >= r.startFrame && frame < r.endFrame) ??
    lineRanges[lineRanges.length - 1];

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
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

function SlidePanel({ slide, isFirst }: { slide: SlideConfig & { durationFrames: number }; isFirst: boolean }) {
  const frame = useCurrentFrame();
  const { motion, durationFrames, overlayText } = slide;

  // QUICK STRIKES FORMAT: TRUE cold open on slide 1 — full brightness at frame 0, no fade-in.
  // Slides 2+ get a 4-frame hard cut. No fade-out anywhere, hard cut ending.
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

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

  const hasAnimatedOrigin =
    motion.transformOriginXFrom !== undefined && motion.transformOriginXTo !== undefined;
  const transformOriginX = hasAnimatedOrigin
    ? interpolate(frame, [0, durationFrames], [motion.transformOriginXFrom!, motion.transformOriginXTo!], {
        easing: easingFn,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : undefined;
  const resolvedTransformOrigin = hasAnimatedOrigin
    ? `${transformOriginX}% ${motion.transformOriginY ?? 50}%`
    : motion.transformOrigin ?? 'center center';

  const { ruleWidth, textOpacity } = useGoldOverlay(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {slide.hasBlurBackground && (
          <AbsoluteFill>
            {/* Blurred, darkened full-bleed copy to fill the gaps left when the foreground
                pulls back below cover-fit scale — the standard blur-border technique.
                Scaled up slightly so the blur radius never samples past its own edge. */}
            <Img
              src={staticFile(slide.image)}
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
          {/* Source images are pre-sized to the canvas height (1920px), so height:100%/width:auto
              renders at native aspect ratio — this exposes the full source width for panning,
              rather than object-fit:cover's pre-crop, which would lock the pan to a fixed slice. */}
          <Img
            src={staticFile(slide.image)}
            style={{
              height: '100%',
              width: 'auto',
              maxWidth: 'none',
              transform: `scale(${scale}) translateX(${tx}px) translateY(${ty}px)`,
              transformOrigin: resolvedTransformOrigin,
            }}
          />
        </AbsoluteFill>
      </AbsoluteFill>

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

      {overlayText && (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 48px 140px',
            pointerEvents: 'none',
          }}
        >
          <div style={{ width: '100%' }}>
            <div
              style={{
                height: 3,
                width: `${ruleWidth}%`,
                backgroundColor: '#C9A84C',
                marginBottom: 16,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            />
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.60)',
                padding: '24px 40px',
                textAlign: 'center',
              }}
            >
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
                {overlayText}
              </p>
            </div>
            <div
              style={{
                height: 3,
                width: `${ruleWidth}%`,
                backgroundColor: '#C9A84C',
                marginTop: 16,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            />
          </div>
        </AbsoluteFill>
      )}

      {slide.captionLines && (
        <CaptionOverlay lines={slide.captionLines} durationFrames={durationFrames} top={slide.captionY} />
      )}

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

export default function HighwayOfDeathQuickStrike() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/highway-of-death-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => {
        const from = offset;
        offset += slide.durationFrames;
        return (
          <Sequence key={slide.id} from={from} durationInFrames={slide.durationFrames} layout="none">
            <SlidePanel slide={slide} isFirst={i === 0} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
