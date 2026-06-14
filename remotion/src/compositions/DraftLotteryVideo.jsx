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
import { DraftLotteryChart } from '../components/DraftLotteryChart';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap';

export const FPS = 30;

const slides = [
  // Slide 1 — frames 0–223: hook + mechanism, sentences [1]–[4]
  // 02-drum-capsules is Tarr spinning the lottery drum — the "random" mechanism as cold open.
  {
    image: 'slides/Draft/02-drum-capsules.jpg',
    duration: 224,
    motionType: 'panLeft',
    overlayText: 'The government called it completely random.',
    overlayDelay: 12,
  },
  // Slide 2 — frames 224–438: the drawing moment, sentences [5]–[6b]
  // 01-pirnie-drawing IS Congressman Pirnie reaching into the capsule jar on 12/1/1969.
  // overlayDelay 150: rule starts at local frame 150, 9 frames before [6] "September fourteenth." at local frame 159.
  {
    image: 'slides/Draft/01-pirnie-drawing.jpg',
    duration: 215,
    motionType: 'zoomIn',
    overlayText: 'September 14. Number one.',
    overlayDelay: 150,
  },
  // Slide 3 — frames 439–518: the broken promise, sentence [7]
  // Hershey (SSS Director) = the face of the "equal shot" claim. [7] starts at local frame 7 (composition frame 446).
  {
    image: 'slides/Draft/03-hershey-portrait.jpg',
    duration: 80,
    motionType: 'zoomOut',
    overlayText: 'Every birthday. An equal shot.',
    overlayDelay: 8,
  },
  // Slide 4 — frames 519–787: animated bar chart, sentences [8]–[11]
  // Chart grows over first 180 frames (fully grown at composition frame 699).
  {
    chart: true,
    duration: 269,
  },
  // Slide 5 — frames 788–890: SSS sequence table document, sentence [12]
  // Actual government lottery data — shown while voiceover says "less than one in a thousand."
  {
    image: 'slides/Draft/04-sequence-table.jpg',
    duration: 103,
    motionType: 'none',
    contain: true,
    containBackground: '#0A1628',
    overlayText: 'Less than one in a thousand.',
    overlayDelay: 10,
  },
  // Slide 6 — frames 891–971: scatterplot, sentence [13]
  // Researchers' chart — shown while "Decades later, researchers found something else."
  {
    image: 'slides/Draft/06-scatterplot.jpg',
    duration: 81,
    motionType: 'zoomIn',
    contain: true,
    containBackground: '#0A1628',
    overlayText: 'Decades later, researchers found something else.',
    overlayDelay: 10,
  },
  // Slide 7 — frames 972–1334: moratorium protest, sentences [14]–[18]
  // Runs through conclusion. overlayDelay 75 syncs text to [15] at local frame ~82.
  // Audio ends at frame 1335 — last words land over this slide, CTA is silent.
  {
    image: 'slides/Draft/07-moratorium-protest.jpg',
    duration: 363,
    motionType: 'panRight',
    overlayText: 'Their politics changed forever.',
    overlayDelay: 75,
  },
  // Slide 8 — frames 1335–1442: CTA (audio ends at frame 1335 — fully silent)
  {
    cta: {
      main: ['The lottery changed.', 'The politics never did.'],
      sub: ['Follow the page for the rest of the story.'],
    },
    duration: 108,
  },
];

export const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0); // 1443

const slidesWithOffsets = slides.map((slide, i) => ({
  ...slide,
  from: slides.slice(0, i).reduce((sum, s) => sum + s.duration, 0),
}));

const getKenBurnsTransform = (motionType, localFrame, duration) => {
  switch (motionType) {
    case 'none':
      return 'scale(1)';
    case 'zoomOut': {
      const scale = interpolate(localFrame, [0, duration], [1.08, 1.0], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
    case 'panLeft': {
      const tx = interpolate(localFrame, [0, duration], [0, -4], { extrapolateRight: 'clamp' });
      return `scale(1.05) translateX(${tx}%)`;
    }
    case 'panRight': {
      const tx = interpolate(localFrame, [0, duration], [0, 4], { extrapolateRight: 'clamp' });
      return `scale(1.05) translateX(${tx}%)`;
    }
    case 'zoomIn':
    default: {
      const scale = interpolate(localFrame, [0, duration], [1.0, 1.08], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
  }
};

export default function DraftLotteryVideo() {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const { activeSlide, activeSlideIndex } = useMemo(() => {
    let active = slidesWithOffsets[0];
    let index = 0;
    for (let i = slidesWithOffsets.length - 1; i >= 0; i--) {
      if (frame >= slidesWithOffsets[i].from) {
        active = slidesWithOffsets[i];
        index = i;
        break;
      }
    }
    return { activeSlide: active, activeSlideIndex: index };
  }, [frame]);

  const localFrame = frame - activeSlide.from;
  const isChartSlide = Boolean(activeSlide.chart);
  const isCtaSlide = Boolean(activeSlide.cta);
  const isImageSlide = !isChartSlide && !isCtaSlide;

  const transform = isImageSlide
    ? getKenBurnsTransform(activeSlide.motionType, localFrame, activeSlide.duration)
    : 'scale(1)';

  // 4-frame hard cut — slide 0 opens cold
  const cutOpacity =
    activeSlideIndex === 0
      ? 1
      : interpolate(localFrame, [0, 4], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  // Fade out on last slide
  const isLastSlide = activeSlideIndex === slidesWithOffsets.length - 1;
  const closeFade = isLastSlide
    ? interpolate(localFrame, [activeSlide.duration - 20, activeSlide.duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const finalOpacity = activeSlideIndex === 0 ? 1 : cutOpacity * closeFade;

  // CTA slide — single slow breath over the silent hold (barely perceptible)
  const ctaPulse = isCtaSlide
    ? interpolate(localFrame, [20, 54, 88], [0.93, 1, 0.93], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const overlayOpacity = activeSlide.overlayText
    ? interpolate(
        localFrame,
        [activeSlide.overlayDelay, activeSlide.overlayDelay + 18],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0;

  const ruleWidth = activeSlide.overlayText
    ? interpolate(
        localFrame,
        [activeSlide.overlayDelay, activeSlide.overlayDelay + 25],
        [0, 100],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0;

  // Hershey slide (index 2) — identification caption fades in at local frame 4
  const isHersheySlide = activeSlideIndex === 2;
  const captionOpacity = isHersheySlide
    ? interpolate(localFrame, [4, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  // Sequence table slide (index 4) and scatterplot slide (index 5) — same caption pattern
  const isSeqTableSlide = activeSlideIndex === 4;
  const seqTableCaptionOpacity = isSeqTableSlide
    ? interpolate(localFrame, [4, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  const isScatterplotSlide = activeSlideIndex === 5;
  const scatterplotCaptionOpacity = isScatterplotSlide
    ? interpolate(localFrame, [4, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  // Music fade-out over final 30 frames (frames 1413–1443) — silent during CTA close
  const musicVolume = interpolate(frame, [1413, 1443], [0.15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Audio src={staticFile('audio/draft-lottery-voiceover.mp3')} />
      <Audio src={staticFile('audio/draft-lottery-music.mp3')} volume={musicVolume} loop={true} />
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Image layer */}
      {isImageSlide && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            opacity: finalOpacity,
          }}
        >
          <Img
            src={staticFile(activeSlide.image)}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: activeSlide.contain ? 'contain' : 'cover',
              objectPosition: 'center center',
              backgroundColor: activeSlide.contain ? (activeSlide.containBackground || '#000') : undefined,
              transform,
              transformOrigin: 'center center',
              minWidth: '100%',
              minHeight: '100%',
            }}
          />
        </div>
      )}

      {/* Chart slide — DraftLotteryChart wrapped in Sequence for local frame reset */}
      {isChartSlide && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: finalOpacity,
          }}
        >
          <Sequence from={activeSlide.from} durationInFrames={activeSlide.duration}>
            <DraftLotteryChart startFrame={0} growDurationFrames={180} />
          </Sequence>
        </div>
      )}

      {/* Vignette — image slides only */}
      {isImageSlide && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.72) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Bottom gradient for text legibility — image slides only */}
      {isImageSlide && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '35%',
            background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.75))',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* CTA slide — gold Oswald text on black, with cut-in and fade-out */}
      {isCtaSlide && (
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingLeft: 64,
            paddingRight: 64,
            opacity: finalOpacity * ctaPulse,
          }}
        >
          {activeSlide.cta.main.map((line) => (
            <p
              key={line}
              style={{
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 68,
                fontWeight: 700,
                color: '#C9A84C',
                margin: 0,
                lineHeight: 1.2,
                textAlign: 'center',
                letterSpacing: '0.01em',
              }}
            >
              {line}
            </p>
          ))}
          <div style={{ height: 32 }} />
          {activeSlide.cta.sub.map((line) => (
            <p
              key={line}
              style={{
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 40,
                fontWeight: 700,
                color: '#C9A84C',
                margin: 0,
                lineHeight: 1.3,
                textAlign: 'center',
                letterSpacing: '0.04em',
                opacity: 0.8,
              }}
            >
              {line}
            </p>
          ))}
        </AbsoluteFill>
      )}

      {/* Overlay text with gold rules — image slides only */}
      {isImageSlide && activeSlide.overlayText && (
        <div
          style={{
            position: 'absolute',
            bottom: Math.round(height * 0.12),
            left: 0,
            right: 0,
            opacity: overlayOpacity,
            paddingLeft: 48,
            paddingRight: 48,
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
              {activeSlide.overlayText}
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
      {/* Hershey identification caption — top-left broadcast chyron, slide 3 only */}
      {isHersheySlide && (
        <div
          style={{
            position: 'absolute',
            top: 88,
            left: 72,
            opacity: captionOpacity,
          }}
        >
          <div
            style={{
              borderLeft: '3px solid #C9A84C',
              paddingLeft: 16,
              paddingTop: 10,
              paddingBottom: 10,
              paddingRight: 28,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
            }}
          >
            <p
              style={{
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 36,
                fontWeight: 700,
                color: 'rgba(245, 240, 232, 0.92)',
                margin: 0,
                lineHeight: 1.25,
                letterSpacing: '0.02em',
                textShadow: '0 1px 6px rgba(0,0,0,0.85)',
              }}
            >
              General Lewis B. Hershey
            </p>
            <p
              style={{
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 28,
                fontWeight: 400,
                color: 'rgba(245, 240, 232, 0.65)',
                margin: 0,
                marginTop: 4,
                lineHeight: 1.25,
                letterSpacing: '0.03em',
                textShadow: '0 1px 6px rgba(0,0,0,0.85)',
              }}
            >
              Director, Selective Service System
            </p>
          </div>
        </div>
      )}

      {/* Sequence table caption — top-left, dark empty space above the table, slide 5 only */}
      {isSeqTableSlide && (
        <div
          style={{
            position: 'absolute',
            top: 88,
            left: 72,
            opacity: seqTableCaptionOpacity,
          }}
        >
          <div
            style={{
              borderLeft: '3px solid #C9A84C',
              paddingLeft: 16,
              paddingTop: 10,
              paddingBottom: 10,
              paddingRight: 28,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
            }}
          >
            <p
              style={{
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 36,
                fontWeight: 700,
                color: 'rgba(245, 240, 232, 0.92)',
                margin: 0,
                lineHeight: 1.25,
                letterSpacing: '0.02em',
                textShadow: '0 1px 6px rgba(0,0,0,0.85)',
              }}
            >
              Official 1970 lottery results
            </p>
            <p
              style={{
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 28,
                fontWeight: 400,
                color: 'rgba(245, 240, 232, 0.65)',
                margin: 0,
                marginTop: 4,
                lineHeight: 1.25,
                letterSpacing: '0.03em',
                textShadow: '0 1px 6px rgba(0,0,0,0.85)',
              }}
            >
              Selective Service System
            </p>
          </div>
        </div>
      )}

      {/* Scatterplot caption — top-left letterbox bar (~528px tall), slide 6 only */}
      {isScatterplotSlide && (
        <div
          style={{
            position: 'absolute',
            top: 88,
            left: 72,
            opacity: scatterplotCaptionOpacity,
          }}
        >
          <div
            style={{
              borderLeft: '3px solid #C9A84C',
              paddingLeft: 16,
              paddingTop: 10,
              paddingBottom: 10,
              paddingRight: 28,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
            }}
          >
            <p
              style={{
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 36,
                fontWeight: 700,
                color: 'rgba(245, 240, 232, 0.92)',
                margin: 0,
                lineHeight: 1.25,
                letterSpacing: '0.02em',
                textShadow: '0 1px 6px rgba(0,0,0,0.85)',
              }}
            >
              1969 draft numbers by birthdate
            </p>
            <p
              style={{
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 28,
                fontWeight: 400,
                color: 'rgba(245, 240, 232, 0.65)',
                margin: 0,
                marginTop: 4,
                lineHeight: 1.25,
                letterSpacing: '0.03em',
                textShadow: '0 1px 6px rgba(0,0,0,0.85)',
              }}
            >
              Each point = one day of the year
            </p>
          </div>
        </div>
      )}

    </AbsoluteFill>
  );
}
