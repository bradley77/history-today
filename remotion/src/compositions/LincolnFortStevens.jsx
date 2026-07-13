import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  HARD_CUT_FRAMES,
  GOLD,
  KenBurnsImage,
  Vignette,
  useGoldOverlay,
  EndCardCTA,
} from '../shared/QuickStrikeShared';

// ---------------------------------------------------------------------------
// Per-slide Ken Burns config (scaleFrom/scaleTo/txFrom/txTo/tyFrom/tyTo — the
// QuickStrikeShared Motion shape — 1.0 = no zoom, px translate, +x = right, +y = down)
// ---------------------------------------------------------------------------
const SLIDES = [
  {
    // Slide 1 — Lincoln portrait
    // Slow push-in toward face, slight upward drift to settle on his eyes
    image: 'slides/LincolnFortStevens/01-lincoln-portrait.jpg',
    // UPDATE: set durationInSeconds = actual audio length + 0.4
    durationInSeconds: 4.21,
    audio: staticFile('audio/lincoln-fort-stevens-slide1-trimmed.mp3'),
    overlayText: 'ABRAHAM LINCOLN\n16TH PRESIDENT',
    overlayPosition: 'bottom',
    delayFrames: 6,
    kenBurns: { scaleFrom: 1.0, scaleTo: 1.07, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -25 },
  },
  {
    // Slide 2 — Fort Stevens 1864 photograph
    // Pan left to right across soldier formation and parapet
    image: 'slides/LincolnFortStevens/02-fort-stevens-photo.jpg',
    // UPDATE: set durationInSeconds = actual audio length + 0.4
    durationInSeconds: 5.33,
    audio: staticFile('audio/lincoln-fort-stevens-slide2.mp3'),
    overlayText: 'FORT STEVENS\nWASHINGTON D.C. — JULY 12, 1864',
    overlayPosition: 'top',
    delayFrames: 8,
    kenBurns: { scaleFrom: 1.04, scaleTo: 1.04, txFrom: 40, txTo: -40, tyFrom: 0, tyTo: 0 },
  },
  {
    // Slide 3 — Memorial plaque
    // Start wide to show "LINCOLN UNDER FIRE AT FORT STEVENS" header text,
    // then push in and drift down to land on the relief figures
    image: 'slides/LincolnFortStevens/03-fort-stevens-plaque.jpg',
    // UPDATE: set durationInSeconds = actual audio length + 0.4
    durationInSeconds: 2.43,
    audio: staticFile('audio/lincoln-fort-stevens-slide3.mp3'),
    overlayText: 'LINCOLN UNDER FIRE\nFORT STEVENS — JULY 12, 1864',
    overlayPosition: 'bottom',
    delayFrames: 10,
    kenBurns: { scaleFrom: 1.0, scaleTo: 1.08, txFrom: 0, txTo: 0, tyFrom: -30, tyTo: 20 },
  },
];

const END_CARD_DURATION = 61; // frames

// Derive frame durations from durationInSeconds
const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);
export const totalDuration = slidesDuration + END_CARD_DURATION;
export { FPS };

// ---------------------------------------------------------------------------
// SlidePanel — renders one slide with per-slide Ken Burns + gold overlay.
// NOT QuickStrikeShared's GoldLowerThird: this file's overlay can sit at the
// TOP or bottom of frame, is unboxed Georgia serif (not the boxed Oswald
// style GoldLowerThird renders), and supports multi-line uppercase text — a
// different look the shared component doesn't cover, so it stays local.
// ---------------------------------------------------------------------------
function SlidePanel({ slide, isFirst }) {
  const frame = useCurrentFrame();
  const { durationFrames, kenBurns, overlayText, overlayPosition, delayFrames } = slide;

  // Hard cut opacity ramp (slides 2+); slide 1 is cold open, full brightness frame 0
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  const { ruleWidth, textOpacity } = useGoldOverlay(frame, delayFrames);

  const isTop = overlayPosition === 'top';

  return (
    <AbsoluteFill style={{ opacity, background: '#000' }}>
      <KenBurnsImage image={slide.image} frame={frame} durationFrames={durationFrames} motion={kenBurns} />

      {/* Vignette — radial only (no bottom linear gradient on this file) */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Gold overlay — top or bottom */}
      <AbsoluteFill
        style={{
          justifyContent: isTop ? 'flex-start' : 'flex-end',
          alignItems: 'center',
          padding: isTop ? '120px 40px 0' : '0 40px 120px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ width: '100%', maxWidth: 900 }}>
          {/* Top rule */}
          <div
            style={{
              height: 3,
              background: GOLD,
              width: `${ruleWidth}%`,
              marginBottom: 14,
            }}
          />

          {/* Text lines */}
          {overlayText.split('\n').map((line, i) => (
            <div
              key={i}
              style={{
                opacity: textOpacity,
                color: '#fff',
                fontFamily: 'Georgia, serif',
                fontSize: 42,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1.25,
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                marginBottom: i < overlayText.split('\n').length - 1 ? 6 : 0,
              }}
            >
              {line}
            </div>
          ))}

          {/* Bottom rule */}
          <div
            style={{
              height: 3,
              background: GOLD,
              width: `${ruleWidth}%`,
              marginTop: 14,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* Per-slide audio */}
      <Audio src={slide.audio} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Main composition
// ---------------------------------------------------------------------------
export default function LincolnFortStevens() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {slidesWithFrames.map((slide, i) => {
        const start = offset;
        offset += slide.durationFrames;
        return (
          <Sequence key={i} from={start} durationInFrames={slide.durationFrames}>
            <SlidePanel slide={slide} isFirst={i === 0} />
          </Sequence>
        );
      })}

      <Audio src={staticFile('audio/LincolnFortStevens-music.mp3')} volume={0.15} loop />

      {/* End card */}
      <Sequence from={slidesDuration} durationInFrames={END_CARD_DURATION}>
        <EndCardCTA triggerWord="BLUEGRAY" subline="" />
      </Sequence>
    </AbsoluteFill>
  );
}
