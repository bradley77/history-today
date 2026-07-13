import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FPS, HARD_CUT_FRAMES, GOLD, KenBurnsImage, Vignette, useGoldOverlay } from '../shared/QuickStrikeShared';

const SLIDES = [
  {
    image: 'slides/CIAHeartAttackGun/01-frank-church.jpg',
    durationInSeconds: 5.22,
    audio: 'audio/cia-heart-attack-gun-vo-01.mp3',
    overlayText: 'SENATOR FRANK CHURCH VS. THE CIA',
    overlayPosition: 'bottom',
    delayFrames: 6,
    sourceLabel: 'Sen. Frank Church, Committee Chairman',
    kenBurns: { scaleFrom: 1.0, scaleTo: 1.07, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -20 },
  },
  {
    image: 'slides/CIAHeartAttackGun/02-cia-lobby-seal.jpg',
    durationInSeconds: 4.88,
    audio: 'audio/cia-heart-attack-gun-vo-02.mp3',
    overlayText: 'A DART GUN. FROZEN POISON. ALMOST NO TRACE.',
    overlayPosition: 'top',
    delayFrames: 8,
    sourceLabel: 'CIA Headquarters, Langley, Virginia',
    kenBurns: { scaleFrom: 1.04, scaleTo: 1.04, txFrom: -30, txTo: 30, tyFrom: 0, tyTo: 0 },
  },
  {
    image: 'slides/CIAHeartAttackGun/03-colt-m1911.png',
    durationInSeconds: 6.76,
    audio: 'audio/cia-heart-attack-gun-vo-03.mp3',
    overlayText: 'THE DIRECTOR CONFIRMED IT WAS REAL',
    overlayPosition: 'bottom',
    delayFrames: 8,
    sourceLabel: 'Colt M1911 — modified by CIA as dart gun',
    kenBurns: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 20, txTo: -20, tyFrom: 0, tyTo: 0 },
  },
];

const END_CARD_DURATION = 45;

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);
export const totalDuration = slidesDuration + END_CARD_DURATION;
export { FPS };

// NOT QuickStrikeShared's GoldLowerThird: this file's overlay can sit at the
// TOP or bottom of frame with multi-line uppercase text, a different look
// the shared component doesn't cover, so it stays local.
function SlidePanel({ slide, isFirst }) {
  const frame = useCurrentFrame();
  const { durationFrames, kenBurns, overlayText, overlayPosition, delayFrames, sourceLabel } = slide;

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
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Source label — top-left */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          padding: '24px 28px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            fontFamily: 'Georgia, serif',
            fontSize: 24,
            letterSpacing: '0.04em',
            padding: '4px 10px',
          }}
        >
          {sourceLabel}
        </div>
      </AbsoluteFill>

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
          <div style={{ height: 3, background: GOLD, width: `${ruleWidth}%`, marginBottom: 14 }} />

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

          <div style={{ height: 3, background: GOLD, width: `${ruleWidth}%`, marginTop: 14 }} />
        </div>
      </AbsoluteFill>

      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

// Kept local, not migrated to QuickStrikeShared's EndCardCTA: this end card
// is a generic "FOLLOW FOR MORE" banner with no trigger word at all, and
// wasn't part of the requested EndCardCTA migration scope (Lincoln/Tokyo/
// Sherman only), so its exact existing look stays untouched.
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
      style={{ background: '#000', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}
    >
      <div style={{ width: '80%', maxWidth: 900 }}>
        <div style={{ height: 3, background: GOLD, width: `${ruleWidth}%`, marginBottom: 28 }} />

        <div
          style={{
            opacity: textOpacity,
            color: GOLD,
            fontFamily: 'Georgia, serif',
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 28,
          }}
        >
          FOLLOW FOR MORE
        </div>

        <div style={{ height: 3, background: GOLD, width: `${ruleWidth}%` }} />
      </div>
    </AbsoluteFill>
  );
}

export default function CIAHeartAttackGun() {
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

      <Audio src={staticFile('audio/CIA-Gun-music.mp3')} volume={0.15} loop />

      <Sequence from={slidesDuration} durationInFrames={END_CARD_DURATION}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
