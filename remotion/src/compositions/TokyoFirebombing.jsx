import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// ---------------------------------------------------------------------------
// Per-slide Ken Burns config
// startScale / endScale: zoom range (1.0 = no zoom)
// startX / endX: horizontal translate in px (positive = right, negative = left)
// startY / endY: vertical translate in px (positive = down, negative = up)
// ---------------------------------------------------------------------------
const SLIDES = [
  {
    // Slide 1 — B-29 in flight
    // Slow push-in, slight downward drift — ominous, plane filling frame
    image: staticFile('slides/Tokyo-Firebombing/01-b29-in-flight.jpg'),
    durationInSeconds: 5.14,
    audio: staticFile('audio/tokyo-firebombing-slide1.mp3'),
    overlayText: 'OPERATION MEETINGHOUSE\nMARCH 9–10, 1945',
    overlayPosition: 'top',
    delayFrames: 6,
    kenBurns: { startScale: 1.0, endScale: 1.07, startX: 0, endX: 0, startY: 0, endY: 20 },
  },
  {
    // Slide 2 — Tokyo aftermath aerial
    // Slow pan right across the devastation — lets scale of destruction read
    image: staticFile('slides/Tokyo-Firebombing/02-tokyo-aftermath-aerial.jpg'),
    durationInSeconds: 5.56,
    audio: staticFile('audio/tokyo-firebombing-slide2.mp3'),
    overlayText: 'TOKYO, JAPAN\nMARCH 10, 1945',
    overlayPosition: 'bottom',
    delayFrames: 8,
    kenBurns: { startScale: 1.08, endScale: 1.08, startX: -30, endX: 30, startY: 0, endY: 0 },
  },
  {
    // Slide 3 — LeMay portrait
    // Very slow push-in toward face — hold on the eyes for the quote
    image: staticFile('slides/Tokyo-Firebombing/03-lemay-portrait.jpg'),
    durationInSeconds: 6.76,
    audio: staticFile('audio/tokyo-firebombing-slide3.mp3'),
    overlayText: 'GEN. CURTIS LEMAY\nXXI BOMBER COMMAND',
    overlayPosition: 'bottom',
    delayFrames: 10,
    kenBurns: { startScale: 1.0, endScale: 1.06, startX: 0, endX: 0, startY: 0, endY: -20 },
  },
];

const FPS = 30;
const END_CARD_DURATION = 61; // frames
const HARD_CUT_FRAMES = 4;

// Derive frame durations from durationInSeconds
const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);
export const totalDuration = slidesDuration + END_CARD_DURATION;
export { FPS };

// ---------------------------------------------------------------------------
// useGoldOverlay — ported directly from LincolnFortStevens
// ---------------------------------------------------------------------------
function useGoldOverlay(localFrame, delayFrames = 8) {
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

// ---------------------------------------------------------------------------
// SlidePanel — renders one slide with per-slide Ken Burns + gold overlay
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

  // Per-slide Ken Burns
  const scale = interpolate(
    frame,
    [0, durationFrames],
    [kenBurns.startScale, kenBurns.endScale],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const translateX = interpolate(
    frame,
    [0, durationFrames],
    [kenBurns.startX, kenBurns.endX],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const translateY = interpolate(
    frame,
    [0, durationFrames],
    [kenBurns.startY, kenBurns.endY],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const { ruleWidth, textOpacity } = useGoldOverlay(frame, delayFrames);

  const isTop = overlayPosition === 'top';

  return (
    <AbsoluteFill style={{ opacity, background: '#000' }}>
      {/* Image with Ken Burns */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={slide.image}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            transform: `scale(${scale}) translateX(${translateX}px) translateY(${translateY}px)`,
            transformOrigin: 'center center',
          }}
        />
      </AbsoluteFill>

      {/* Vignette */}
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
              background: '#C9A84C',
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
              background: '#C9A84C',
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
// End card — black bg, gold FRONT trigger word
// ---------------------------------------------------------------------------
function EndCard() {
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
      <Audio src={staticFile('audio/tokyo-firebombing-slide4.mp3')} />
      <div style={{ width: '80%', maxWidth: 900 }}>
        {/* Top gold rule */}
        <div
          style={{
            height: 3,
            background: '#C9A84C',
            width: `${ruleWidth}%`,
            marginBottom: 28,
          }}
        />

        {/* Comment label */}
        <div
          style={{
            opacity: textOpacity,
            color: '#C9A84C',
            fontFamily: 'Georgia, serif',
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          Comment
        </div>

        {/* FRONT trigger word */}
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
            marginBottom: 28,
          }}
        >
          FRONT
        </div>

        {/* Bottom gold rule */}
        <div
          style={{
            height: 3,
            background: '#C9A84C',
            width: `${ruleWidth}%`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Main composition
// ---------------------------------------------------------------------------
export default function TokyoFirebombing() {
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

      <Audio src={staticFile('audio/TokyoFirebombing-music.mp3')} volume={0.15} loop />

      {/* End card */}
      <Sequence from={slidesDuration} durationInFrames={END_CARD_DURATION}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
