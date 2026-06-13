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
import { OffthreadVideo } from 'remotion';
import { useMemo } from 'react';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

// Slide durations at 30fps
// Video slides: duration = ceil(source_frames / playbackRate)
//   5a: ceil(210 / 1.3) = 162 frames (5.4s)
//   5b: ceil(240 / 1.3) = 185 frames (6.2s)
// Total: 1277 frames = 42.6s
const slides = [
  {
    image: 'slides/Stuart/01-stuart-portrait.jpg',
    duration: 120,
    motionType: 'zoomIn',
    overlayText: 'The general sent to stop him was his own father-in-law.',
    overlayDelay: 10,
  },
  {
    image: 'slides/Stuart/02-mcclellan-portrait.jpg',
    duration: 135,
    motionType: 'panLeft',
    overlayText: 'Richmond, Virginia. June 1862.',
    overlayDelay: 18,
  },
  {
    image: 'slides/Stuart/05-lee-portrait.jpg',
    duration: 120,
    motionType: 'zoomOut',
    overlayText: 'Lee had one order: go out and come back.',
    overlayDelay: 18,
  },
  {
    image: 'slides/Stuart/06-stuart-cavalry-raid.jpg',
    duration: 105,
    motionType: 'panRight',
    overlayText: 'Stuart kept going.',
    overlayDelay: 15,
  },
  {
    video: 'videos/stuart-ride-around-mcclellan-map.mp4',
    startFrom: 0,
    endAt: 450,
    playbackRate: 1.1,
    duration: 400,
    overlayText: 'He rode completely around the entire Union Army.',
    overlayDelay: 18,
  },
  {
    image: 'slides/Stuart/03-cooke-portrait.jpg',
    duration: 150,
    motionType: 'zoomIn',
    overlayText: 'The Union officer ordered to chase him: his father-in-law.',
    overlayDelay: 18,
  },
  {
    image: 'slides/Stuart/07-harrison-landing-retreat.jpg',
    duration: 135,
    motionType: 'panLeft',
    overlayText: 'Two weeks later, Lee drove McClellan from Richmond.',
    overlayDelay: 18,
  },
  {
    image: 'slides/Stuart/01-stuart-portrait.jpg',
    duration: 316,
    motionType: 'zoomOut',
    overlayText: 'Cooke filed a report. What he wrote is extraordinary.',
    overlayDelay: 18,
  },
];

export const FPS = 30;
export const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0); // 1481 frames = 49.4s

const slidesWithOffsets = slides.map((slide, i) => ({
  ...slide,
  from: slides.slice(0, i).reduce((sum, s) => sum + s.duration, 0),
}));

const getKenBurnsTransform = (motionType, localFrame, duration) => {
  switch (motionType) {
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
      const scale = interpolate(localFrame, [0, duration], [1.05, 1.08], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
  }
};

export default function StuartRide() {
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
  const isVideoSlide = Boolean(activeSlide.video);

  const transform = isVideoSlide
    ? 'none'
    : getKenBurnsTransform(activeSlide.motionType, localFrame, activeSlide.duration);

  // 4-frame hard cut — slide 1 and video slides open at full opacity
  const cutOpacity = (activeSlideIndex === 0 || isVideoSlide)
    ? 1
    : interpolate(localFrame, [0, 4], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // Fade out on slide 9 (index 8)
  const isLastSlide = activeSlideIndex === slidesWithOffsets.length - 1;
  const closeFade = isLastSlide
    ? interpolate(localFrame, [activeSlide.duration - 20, activeSlide.duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const finalOpacity = activeSlideIndex === 0 ? 1 : cutOpacity * closeFade;

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

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Audio src={staticFile('audio/stuart-ride-around-mcclellan-voiceover.mp3')} />
      <Audio
        src={staticFile('audio/stuart-ride-around-mcclellan-music.mp3')}
        volume={0.15}
        loop
      />
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Video layer */}
      {isVideoSlide && (
        <Sequence from={activeSlide.from} durationInFrames={activeSlide.duration}>
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
            <OffthreadVideo
              src={staticFile(activeSlide.video)}
              startFrom={activeSlide.startFrom ?? 0}
              endAt={activeSlide.endAt}
              playbackRate={activeSlide.playbackRate ?? 1}
              volume={0}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center center',
              }}
            />
          </div>
        </Sequence>
      )}

      {/* Image layer — only shown on non-video slides */}
      {!isVideoSlide && (
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
              objectFit: 'cover',
              objectPosition: 'center center',
              transform,
              transformOrigin: 'center center',
              minWidth: '100%',
              minHeight: '100%',
            }}
          />
        </div>
      )}

      {/* Vignette */}
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

      {/* Bottom gradient for text legibility */}
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

      {/* Overlay text block */}
      {activeSlide.overlayText && (
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

    </AbsoluteFill>
  );
}
