import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  AbsoluteFill,
  Audio,
  staticFile,
  Sequence,
} from 'remotion';
import { useMemo } from 'react';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

export const FPS = 30;

// Slide durations in frames: durationInSeconds × 30, rounded
//   Slide 01: 3.963s  → 119
//   Slide 02: 4.133s  → 124
//   Slide 03: 10.427s → 313
const DURATIONS = [119, 124, 313];
const END_CARD_FRAMES = 45;

const OFFSETS = DURATIONS.map((_, i) => DURATIONS.slice(0, i).reduce((a, b) => a + b, 0));
const SLIDES_TOTAL = DURATIONS.reduce((a, b) => a + b, 0); // 556
export const totalDuration = SLIDES_TOTAL + END_CARD_FRAMES;  // 646

// Slide 03 multi-beat text boundaries (localFrame within slide 3)
//   5.964s × 30 = 178.92 → 179
//   8.264s × 30 = 247.92 → 248
const BEAT_STARTS = [0, 179, 248];
const BEAT_TEXTS  = ['THE PART THEY LEFT OUT', 'SPEED SAVED LIVES', 'CAUTION COST MORE'];

const SLIDES = [
  {
    image:       'slides/Patton/01-portrait-helmet.jpg',
    audio:       'audio/patton-blood-and-guts-vo-01.mp3',
    overlayText: 'BLOOD AND GUTS',
  },
  {
    image:       'slides/Patton/02-silver-star-jenkins.jpg',
    audio:       'audio/patton-blood-and-guts-vo-02.mp3',
    overlayText: 'WHAT HIS OWN MEN SAID IT MEANT',
  },
  {
    image:       'slides/Patton/03-merkers-art-treasure.jpg',
    audio:       'audio/patton-blood-and-guts-vo-03.mp3',
    overlayText: null, // handled by BEAT_TEXTS
  },
];

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

export default function PattonBloodAndGuts() {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const isEndCard = frame >= SLIDES_TOTAL;

  const slideIndex = useMemo(() => {
    for (let i = OFFSETS.length - 1; i >= 0; i--) {
      if (frame >= OFFSETS[i]) return i;
    }
    return 0;
  }, [frame]);

  const slide      = SLIDES[slideIndex];
  const localFrame = frame - OFFSETS[slideIndex];
  const duration   = DURATIONS[slideIndex];

  // Ken Burns: 1.0 → 1.08 across each slide's full duration (including slide 3's full 313 frames)
  const scale = isEndCard
    ? 1
    : interpolate(localFrame, [0, duration], [1.0, 1.08], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // QUICK STRIKES FORMAT NOTE: NO fade-in on slide 1, NO fade-out at end. True cold open, hard cut
  // ending. Do NOT copy-paste the StuartRide/HissVideo slide-1 fade-in here — that is a main-episode
  // convention that does not apply to Quick Strikes shorts.
  //
  // Slide 1: always opaque (cold open = frame 0 is full-brightness). Slides 2+: 4-frame hard cut.
  const slideOpacity = (isEndCard || slideIndex === 0)
    ? 1
    : interpolate(localFrame, [0, 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Slide 3 beat index — resets beat-local frame so each text beats animates fresh
  const beatIndex = useMemo(() => {
    if (slideIndex !== 2 || isEndCard) return -1;
    for (let i = BEAT_STARTS.length - 1; i >= 0; i--) {
      if (localFrame >= BEAT_STARTS[i]) return i;
    }
    return 0;
  }, [frame]);

  const beatLocalFrame = beatIndex >= 0 ? localFrame - BEAT_STARTS[beatIndex] : 0;

  // Gold overlay values for slides 1 & 2
  const mainOverlay = useGoldOverlay(localFrame);
  // Gold overlay values for slide 3 beats (animates from beat-local 0 each time)
  const beatOverlay = useGoldOverlay(beatLocalFrame);

  const isSlide3     = slideIndex === 2 && !isEndCard;
  const activeText   = isSlide3 ? (beatIndex >= 0 ? BEAT_TEXTS[beatIndex] : null) : slide.overlayText;
  const activeRule   = isSlide3 ? beatOverlay.ruleWidth   : mainOverlay.ruleWidth;
  const activeAlpha  = isSlide3 ? beatOverlay.textOpacity : mainOverlay.textOpacity;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Per-slide voiceover — each fires only during its slide's Sequence window */}
      {SLIDES.map((s, i) => (
        <Sequence key={i} from={OFFSETS[i]} durationInFrames={DURATIONS[i]}>
          <Audio src={staticFile(s.audio)} />
        </Sequence>
      ))}

      {/* Music: constant 0.15, looped through entire composition including end card */}
      <Audio src={staticFile('audio/patton-blood-and-guts-music.mp3')} volume={0.15} loop />

      {/* Slide image layer */}
      {!isEndCard && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            opacity: slideOpacity,
          }}
        >
          <Img
            src={staticFile(slide.image)}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
            }}
          />
        </div>
      )}

      {/* End card — hard cut, no fade-in */}
      {isEndCard && (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
          }}
        >
          <p
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#C9A84C',
              fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
              margin: 0,
              letterSpacing: '0.04em',
              textAlign: 'center',
            }}
          >
            Comment FRONT
          </p>
        </AbsoluteFill>
      )}

      {/* Vignette */}
      {!isEndCard && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.72) 100%)',
            pointerEvents: 'none',
            opacity: slideOpacity,
          }}
        />
      )}

      {/* Bottom gradient for text legibility */}
      {!isEndCard && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '35%',
            background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.75))',
            pointerEvents: 'none',
            opacity: slideOpacity,
          }}
        />
      )}

      {/* Gold animated rule + text overlay */}
      {!isEndCard && activeText && (
        <div
          style={{
            position: 'absolute',
            bottom: Math.round(height * 0.12),
            left: 0,
            right: 0,
            paddingLeft: 48,
            paddingRight: 48,
            opacity: activeAlpha * slideOpacity,
          }}
        >
          <div
            style={{
              height: 3,
              width: `${activeRule}%`,
              backgroundColor: '#C9A84C',
              marginBottom: 16,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.60)',
              paddingTop: 24,
              paddingBottom: 24,
              paddingLeft: 40,
              paddingRight: 40,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: 58,
                fontWeight: 700,
                color: '#F5F0E8',
                margin: 0,
                lineHeight: 1.25,
                textShadow: '0 2px 14px rgba(0,0,0,0.95)',
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                letterSpacing: '0.01em',
              }}
            >
              {activeText}
            </p>
          </div>
          <div
            style={{
              height: 3,
              width: `${activeRule}%`,
              backgroundColor: '#C9A84C',
              marginTop: 16,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
        </div>
      )}
    </AbsoluteFill>
  );
}
