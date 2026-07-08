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

type Motion = {
  scaleFrom: number;
  scaleTo: number;
  // Hard floor enforced via Math.max on every frame — structural insurance against
  // floating-point/interpolation rounding landing fractionally below a fit's
  // required minimum scale (which would underfill the frame and show black bars).
  scaleFloor?: number;
  txFrom: number;
  txTo: number;
  tyFrom: number;
  tyTo: number;
  easing?: 'linear' | 'easeInOut' | 'easeInOutCubic';
};

type SlideConfig = {
  id: string;
  image: string;
  audio: string;
  // Actual VO file duration (measured via Kokoro) + 0.4s pad (slide 1 is the
  // exception — see note on that slide)
  durationInSeconds: number;
  overlayText?: string;
  motion: Motion;
  // 'native' (default): image sized to height:100%/width:auto so its full native
  // width is available to pan across via tx. 'cover': standard object-fit:cover,
  // for near-native-portrait sources where no pan is wanted, just push-in scale.
  // 'containWidth': image sized to width:100%/height:auto, centered vertically —
  // shows the ENTIRE image uncropped for wide/low sources where a horizontal pan
  // would crop away most of a single tableau. Pair with hasBlurBackground so the
  // resulting top/bottom letterbox gaps aren't hard black bars.
  fit?: 'native' | 'cover' | 'containWidth';
  // Blurred, darkened full-bleed copy of the same image behind a 'containWidth'
  // foreground, filling the letterbox gaps left above/below it.
  hasBlurBackground?: boolean;
  // When set, this slide's pan ignores motion.txFrom/txTo entirely and instead
  // samples the shared craterPanTx(globalFrame) curve at (frame + this offset).
  // Used by slides 1 & 2 so their pan is ONE continuous curve across the hard cut
  // between them, not two independently-eased curves that happen to line up.
  craterPanFrameOffset?: number;
  // Closed captions — mirrors the voiceover verbatim (not overlayText, which is a
  // punchier hook), shown as sequential line-by-line chunks.
  captionLines?: string[];
  // Caption line windows are timed proportionally over the slide's ACTUAL audio
  // duration only (excluding the 0.4s pad), so the last line doesn't linger
  // artificially long into silence. In frames.
  captionDurationFrames?: number;
  // Default 1450. Bumped to 1600 on slides where a 1450 caption would collide with
  // a taller (2-line) overlayText block above it.
  captionY?: number;
  // Small gold contextual label, top-left. Identifies what's shown (not a source
  // citation).
  topLabel?: string;
};

// 01-crater-explosion.jpg is 6060x3856. In the 'native' fit branch below it's
// rendered at height:100%, so its rendered width is CANVAS_HEIGHT * (6060/3856)
// ~= 3017.4px — that sizing already IS base_scale (1920/3856 = 0.49792531...),
// which makes a Motion.scale multiplier of 1.0 mean "exactly base_scale". NEVER
// let the multiplier go below 1.0 on this image, or the frame underfills and
// shows black bars (the exact bug already fixed once on Highway of Death) —
// slide 1 & 2's motion.scaleFloor below enforces this structurally rather than
// trusting the eased curve to land exactly on it.
const CRATER_SCALED_WIDTH = 1920 * (6060 / 3856); // ~3017.4px
const CRATER_CENTER_OFFSET = CRATER_SCALED_WIDTH / 2 - 1080 / 2; // ~968.7px (half the pan room)
const CRATER_BASE_SCALE = 1.0; // the scale-multiplier floor (see comment above)
const CRATER_PAN_START_X = 20; // slide 1 opening crop — near the true left edge, minimal buffer
const CRATER_PAN_END_X = 1841; // slide 2 closing crop — ~97px buffer from the right edge (pan room ~1938px)

// Actual measured VO durations (Kokoro sample count / sample rate), before the
// standard 0.4s pad. Named here as the single source of truth for: each slide's
// durationInSeconds (below), the slide 1+2 combined pan frame count, and closed-
// caption timing (which must span only the real audio, not the trailing pad).
const PAD_S = 0.4;
const SLIDE1_AUDIO_S = 2.304; // slide-1 rule: no pad added (see slide 1 below)
const SLIDE2_AUDIO_S = 5.099; // "black powder blewa forty footcrater" respelling — fixes a confirmed double-silence glitch inside "gunpowder", no word-boundary pauses elsewhere
const SLIDE3_AUDIO_S = 4.971;
const SLIDE4_AUDIO_S = 1.856;

// Slide 1 + slide 2 share this one source image and must read as a single
// continuous sweep despite the hard cut between them — so their pan is driven by
// ONE function over their combined frame range, not two independent per-slide
// interpolations.
const SLIDE1_DURATION_S = SLIDE1_AUDIO_S;
const SLIDE2_DURATION_S = SLIDE2_AUDIO_S + PAD_S;
const SLIDE1_FRAMES = Math.round(SLIDE1_DURATION_S * FPS); // 69
const SLIDE2_FRAMES = Math.round(SLIDE2_DURATION_S * FPS); // 165
const CRATER_PAN_FRAMES = SLIDE1_FRAMES + SLIDE2_FRAMES; // 234

// Maps a "pixels from the image's left edge" position to the translateX needed to
// show it at the canvas's left edge, for the centered height:100%/width:auto native
// fit at CSS scale 1.0 (i.e. exactly base_scale).
function craterTx(xFromLeftEdge: number) {
  return CRATER_CENTER_OFFSET - xFromLeftEdge;
}

// ONE continuous, LINEAR pan across slides 1+2's combined frame range. Linear
// (not eased) is deliberate: two independently-eased curves decelerate toward
// near-zero velocity at each end, so even with matching position at the cut,
// slide 1 easing to a stop and slide 2 easing back up from a stop reads as a
// visible pause. Constant velocity end-to-end removes that seam entirely.
function craterPanTx(globalFrame: number) {
  const x = interpolate(
    globalFrame,
    [0, CRATER_PAN_FRAMES],
    [CRATER_PAN_START_X, CRATER_PAN_END_X],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return craterTx(x);
}

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Vicksburg/01-crater-explosion.jpg',
    audio: 'audio/vicksburg-mine-vo-01.mp3',
    // Quick Strikes slide-1 rule: max 1.5-2s hold. Measured VO is 2.304s, already at
    // the ceiling before any pad — so NO 0.4s pad here (unlike every other slide),
    // hard cut fires the instant the line finishes.
    durationInSeconds: SLIDE1_DURATION_S,
    overlayText: "THE EXPLOSION WORKED. THE ATTACK DIDN'T.",
    topLabel: 'FORT HILL CRATER, VICKSBURG — JUNE 25, 1863',
    captionLines: ["The explosion worked.", "The attack didn't."],
    captionDurationFrames: Math.round(SLIDE1_AUDIO_S * FPS),
    // Pan is driven entirely by the shared craterPanTx curve (frameOffset 0) —
    // motion.txFrom/txTo below are unused placeholders. Scale is still this slide's
    // own: a "pull out" push that eases from 18% zoomed in down to exactly the
    // base_scale floor by the last frame, never below it (scaleFloor enforces this
    // structurally rather than trusting the eased curve to land on it exactly).
    craterPanFrameOffset: 0,
    motion: {
      scaleFrom: 1.18, scaleTo: CRATER_BASE_SCALE, scaleFloor: CRATER_BASE_SCALE,
      txFrom: 0, txTo: 0,
      tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic',
    },
  },
  {
    id: 'slide2',
    image: 'slides/Vicksburg/01-crater-explosion.jpg',
    audio: 'audio/vicksburg-mine-vo-02.mp3',
    durationInSeconds: SLIDE2_DURATION_S,
    overlayText: '2,200 LBS OF BLACK POWDER. A FORTY-FOOT CRATER.',
    // Same label as slide 1, unchanged — both slides share the same source image,
    // so the label persists across the cut rather than swapping, consistent with
    // the continuous pan already spanning both.
    topLabel: 'FORT HILL CRATER, VICKSBURG — JUNE 25, 1863',
    captionLines: [
      'Twenty-two hundred pounds of black powder',
      'blew a forty-foot crater',
      'into the Confederate line.',
    ],
    captionDurationFrames: Math.round(SLIDE2_AUDIO_S * FPS),
    // Continues the SAME craterPanTx curve, offset by slide 1's frame count — not
    // an independently recalculated starting position, so it's continuous with
    // slide 1's actual last-frame value by construction (one curve, two samples of
    // it) rather than by two separately-tuned numbers happening to match. Scale
    // holds flat at exactly the base_scale floor throughout (no further zoom).
    craterPanFrameOffset: SLIDE1_FRAMES,
    motion: {
      scaleFrom: CRATER_BASE_SCALE, scaleTo: CRATER_BASE_SCALE, scaleFloor: CRATER_BASE_SCALE,
      txFrom: 0, txTo: 0,
      tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic',
    },
  },
  {
    id: 'slide3',
    image: 'slides/Vicksburg/02-crater-assault-thulstrup.jpg',
    audio: 'audio/vicksburg-mine-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    overlayText: 'TWENTY HOURS AT POINT-BLANK RANGE',
    topLabel: 'UNION ASSAULT ON FORT HILL',
    captionLines: [
      'Then twenty hours of fighting',
      'at point-blank range',
      'before Union troops were forced back.',
    ],
    captionDurationFrames: Math.round(SLIDE3_AUDIO_S * FPS),
    // 3365x2240 source — a single dramatic tableau (flag, assault, smoke) that loses
    // meaning if cropped to a vertical sliver via a pan. containWidth shows the
    // ENTIRE painting uncropped (scale = 1080/3365 ~= 0.321, rendered height ~719px,
    // centered vertically); hasBlurBackground fills the resulting top/bottom
    // letterbox gaps instead of leaving hard black bars. Nothing to pan to, so just
    // a slow, subtle push on the foreground only.
    fit: 'containWidth',
    hasBlurBackground: true,
    motion: { scaleFrom: 1.0, scaleTo: 1.05, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
  },
  {
    id: 'slide4',
    image: 'slides/Vicksburg/03-grant-portrait.jpg',
    audio: 'audio/vicksburg-mine-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    overlayText: 'THE SIEGE HELD NINE MORE DAYS.',
    topLabel: 'MAJ. GEN. ULYSSES S. GRANT, U.S.A.',
    captionLines: ['Vicksburg held nine more days.'],
    captionDurationFrames: Math.round(SLIDE4_AUDIO_S * FPS),
    // 3279x5830, near-native 9:16 — cover fit, no pan, standard push-in only.
    fit: 'cover',
    motion: { scaleFrom: 1.0, scaleTo: 1.08, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
  },
  {
    id: 'slide5',
    image: 'slides/Vicksburg/04-cta-blackcard.jpg',
    audio: 'audio/vicksburg-mine-vo-05.mp3',
    durationInSeconds: 2.299, // 1.899s actual + 0.4s pad
    // No overlayText — CTA text is already baked into the card art.
    fit: 'cover',
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

// Closed captions — matches the established E&C Quick Strikes pattern (see
// GettysburgDay1QS.tsx / GettysburgDay3QS.tsx / HighwayOfDeathQuickStrike.tsx;
// not a shared/importable component in this codebase, each composition has its
// own copy). Shown as sequential line-by-line chunks, each line's on-screen
// window sized proportionally to its share of the slide's total word count,
// timed over durationFrames (the ACTUAL audio length, excluding the 0.4s pad —
// see captionDurationFrames on each slide).
function CaptionOverlay({
  lines,
  durationFrames,
  top = 1450,
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

function SlidePanel({ slide }: { slide: SlideConfig & { durationFrames: number } }) {
  const frame = useCurrentFrame();
  const { motion, durationFrames, overlayText, fit = 'native', craterPanFrameOffset, topLabel, captionLines, captionDurationFrames, captionY } = slide;

  const easingFn =
    motion.easing === 'easeInOutCubic'
      ? Easing.inOut(Easing.cubic)
      : motion.easing === 'easeInOut'
      ? Easing.inOut(Easing.ease)
      : Easing.linear;

  const scaleRaw = interpolate(frame, [0, durationFrames], [motion.scaleFrom, motion.scaleTo], {
    easing: easingFn,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Structural floor: never trust the eased curve alone to land exactly on the
  // minimum required scale for a fit — clamp it on every frame, no exceptions.
  const scale = motion.scaleFloor !== undefined ? Math.max(scaleRaw, motion.scaleFloor) : scaleRaw;

  const tx = craterPanFrameOffset !== undefined
    ? craterPanTx(frame + craterPanFrameOffset)
    : interpolate(frame, [0, durationFrames], [motion.txFrom, motion.txTo], {
        easing: easingFn,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
  const ty = interpolate(frame, [0, durationFrames], [motion.tyFrom, motion.tyTo], {
    easing: easingFn,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const { ruleWidth, textOpacity } = useGoldOverlay(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {fit === 'cover' ? (
          <Img
            src={staticFile(slide.image)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
            }}
          />
        ) : fit === 'containWidth' ? (
          <>
            {slide.hasBlurBackground && (
              <AbsoluteFill>
                {/* Blurred, darkened full-bleed copy to fill the letterbox gaps left
                    above/below the uncropped foreground — the standard blur-border
                    technique used elsewhere in this project (e.g. Highway of Death). */}
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
              {/* Sized to width:100%/height:auto so the ENTIRE image is visible,
                  uncropped — no pan target exists on a single wide tableau like this. */}
              <Img
                src={staticFile(slide.image)}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: 'none',
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                }}
              />
            </AbsoluteFill>
          </>
        ) : (
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
            {/* Sized to height:100%/width:auto so the full native width is available
                to pan across via translateX, rather than object-fit:cover's pre-crop
                which would lock the pan to a fixed slice. */}
            <Img
              src={staticFile(slide.image)}
              style={{
                height: '100%',
                width: 'auto',
                maxWidth: 'none',
                transform: `scale(${scale}) translateX(${tx}px) translateY(${ty}px)`,
                transformOrigin: 'center center',
              }}
            />
          </AbsoluteFill>
        )}
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

      {topLabel && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 40,
            color: '#C9A84C',
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.06em',
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            opacity: textOpacity,
            pointerEvents: 'none',
          }}
        >
          {topLabel}
        </div>
      )}

      {captionLines && (
        <CaptionOverlay
          lines={captionLines}
          durationFrames={captionDurationFrames ?? durationFrames}
          top={captionY}
        />
      )}

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

export default function VicksburgMineQS() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/LincolnFortStevens-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide) => {
        const from = offset;
        offset += slide.durationFrames;
        return (
          <Sequence key={slide.id} from={from} durationInFrames={slide.durationFrames} layout="none">
            <SlidePanel slide={slide} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
