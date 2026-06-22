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

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap';

export const FPS = 30;

// Each duration = Math.round((audioSeconds + 0.4) * 30)
const DURATIONS = [53, 166, 84, 144];
const END_CARD_FRAMES = 45; // 1.5s hard-cut end card, no VO

const SLIDES_TOTAL = DURATIONS.reduce((a, b) => a + b, 0); // 447
const OFFSETS      = DURATIONS.map((_, i) => DURATIONS.slice(0, i).reduce((a, b) => a + b, 0));
export const totalDuration = SLIDES_TOTAL + END_CARD_FRAMES; // 492

const SLIDES = [
  {
    src:         'slides/My-Lai-Massacre/01-thompson-portrait.jpg',
    audio:       'audio/my-lai-massacre-01.mp3',
    overlayText: 'HE STOPPED A MASSACRE',
    nameTag:     true,
  },
  {
    src:         'slides/My-Lai-Massacre/02-aerial-helicopter.jpg',
    audio:       'audio/my-lai-massacre-02.mp3',
    overlayText: 'AMERICAN SOLDIERS WERE KILLING CIVILIANS',
  },
  {
    src:         'slides/My-Lai-Massacre/03-burning-house.jpg',
    audio:       'audio/my-lai-massacre-03.mp3',
    overlayText: 'SO HE LANDED IN THEIR PATH',
  },
  {
    src:         'slides/My-Lai-Massacre/01-thompson-portrait.jpg',
    audio:       'audio/my-lai-massacre-04.mp3',
    overlayText: 'ORDERED HIS GUNNER TO FIRE ON AMERICANS',
    nameTag:     true,
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

export default function MyLaiVideo() {
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

  // Ken Burns: aggressive 1.0 → 1.08 zoom across each slide's full duration
  const scale = isEndCard
    ? 1
    : interpolate(localFrame, [0, duration], [1.0, 1.08], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // QUICK STRIKES FORMAT: NO fade-in on slide 1, NO fade-out at end. True cold open, hard cut ending.
  // Slide 0 always full opacity; subsequent slides use 4-frame hard cut flash.
  const slideOpacity = (isEndCard || slideIndex === 0)
    ? 1
    : interpolate(localFrame, [0, 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const { ruleWidth, textOpacity } = useGoldOverlay(localFrame);

  // Name tag fades in with the main overlay on any slide with nameTag: true
  const nameTagOpacity = slide.nameTag
    ? interpolate(localFrame, [8, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Per-slide voiceover — each fires only during its slide's Sequence window */}
      {SLIDES.map((s, i) => (
        <Sequence key={i} from={OFFSETS[i]} durationInFrames={DURATIONS[i]}>
          <Audio src={staticFile(s.audio)} />
        </Sequence>
      ))}

      {/* Background music, looped at low volume — continues through end card */}
      <Audio src={staticFile('audio/my-lai-massacre.mp3')} volume={0.15} loop />

      {/* Slide image with Ken Burns zoom */}
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
            src={staticFile(slide.src)}
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
              fontSize: 58,
              fontWeight: 700,
              color: '#C9A84C',
              fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
              margin: 0,
              letterSpacing: '0.04em',
              textAlign: 'center',
              paddingLeft: 80,
              paddingRight: 80,
              lineHeight: 1.3,
            }}
          >
            Comment if you want more of the stuff they left out of the textbook
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

      {/* Gold animated rule + main overlay text */}
      {!isEndCard && slide.overlayText && (
        <div
          style={{
            position: 'absolute',
            bottom: Math.round(height * 0.12),
            left: 0,
            right: 0,
            paddingLeft: 48,
            paddingRight: 48,
            opacity: textOpacity * slideOpacity,
          }}
        >
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
              {slide.overlayText}
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
      )}

      {/* Name identification — slide 1 only, top-left corner, gold left-border chyron */}
      {!isEndCard && slide.nameTag && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 48,
            opacity: nameTagOpacity,
          }}
        >
          <div style={{ borderLeft: '3px solid #C9A84C', paddingLeft: 14 }}>
            <p
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: '#C9A84C',
                margin: 0,
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                letterSpacing: '0.08em',
                textShadow: '0 1px 8px rgba(0,0,0,0.95)',
              }}
            >
              WO1 HUGH THOMPSON
            </p>
            <p
              style={{
                fontSize: 22,
                fontWeight: 400,
                color: '#F5F0E8',
                margin: '4px 0 0 0',
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                letterSpacing: '0.06em',
                textShadow: '0 1px 8px rgba(0,0,0,0.95)',
              }}
            >
              U.S. ARMY
            </p>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
}
