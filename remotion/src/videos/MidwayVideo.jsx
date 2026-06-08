import { useCurrentFrame, useVideoConfig, interpolate, Img, AbsoluteFill, Audio, staticFile } from 'remotion';
import { slides } from '../data/midway';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

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
      return `translateX(${tx}%)`;
    }
    case 'panRight': {
      const tx = interpolate(localFrame, [0, duration], [0, 4], { extrapolateRight: 'clamp' });
      return `translateX(${tx}%)`;
    }
    case 'zoomIn':
    default: {
      const scale = interpolate(localFrame, [0, duration], [1.0, 1.08], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
  }
};

export default function MidwayVideo() {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  let activeSlide = slidesWithOffsets[0];
  let activeSlideIndex = 0;
  for (let i = 0; i < slidesWithOffsets.length; i++) {
    if (frame >= slidesWithOffsets[i].from) {
      activeSlide = slidesWithOffsets[i];
      activeSlideIndex = i;
    }
  }

  const localFrame = frame - activeSlide.from;
  const isLastSlide = activeSlideIndex === slidesWithOffsets.length - 1;

  const transform = activeSlide.motionType
    ? getKenBurnsTransform(activeSlide.motionType, localFrame, activeSlide.duration)
    : 'none';

  // 4-frame hard cut flash between slides (slide 1 opens at full opacity — cold open)
  const cutOpacity = activeSlideIndex === 0
    ? 1
    : interpolate(localFrame, [0, 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Fade out on last slide
  const closeFade = isLastSlide
    ? interpolate(localFrame, [activeSlide.duration - 20, activeSlide.duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const finalOpacity = cutOpacity * closeFade;

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
      <Audio src={staticFile('audio/battle-of-midway-voiceover.mp3')} />
      <Audio src={staticFile('audio/battle-of-midway-music.mp3')} volume={0.15} />
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Image layer — skipped on CTA text slide */}
      {activeSlide.image && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            overflow: 'hidden',
            opacity: finalOpacity,
          }}
        >
          <Img
            src={staticFile(activeSlide.image)}
            style={{
              position: 'absolute',
              width: '100%', height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              transform,
            }}
          />
        </div>
      )}

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.72) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom gradient for text legibility (image slides only) */}
      {!activeSlide.isCTA && (
        <div
          style={{
            position: 'absolute',
            bottom: 0, left: 0,
            width: '100%', height: '35%',
            background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.75))',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Overlay text */}
      {activeSlide.overlayText && (
        <div
          style={{
            position: 'absolute',
            ...(activeSlide.isCTA
              ? { top: '50%', transform: 'translateY(-50%)' }
              : { bottom: Math.round(height * 0.12) }),
            left: 0, right: 0,
            opacity: overlayOpacity,
            paddingLeft: 48, paddingRight: 48,
          }}
        >
          <div style={{ height: 3, width: `${ruleWidth}%`, backgroundColor: '#C9A84C', marginBottom: 16, marginLeft: 'auto', marginRight: 'auto' }} />
          <div
            style={{
              backgroundColor: 'rgba(0,0,0,0.60)',
              paddingTop: 24, paddingBottom: 24,
              paddingLeft: 40, paddingRight: 40,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: 58, fontWeight: 700,
                color: '#F5F0E8', margin: 0,
                lineHeight: 1.25,
                textShadow: '0 2px 14px rgba(0,0,0,0.95)',
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                letterSpacing: '0.01em',
                whiteSpace: 'pre-line',
              }}
            >
              {activeSlide.overlayText}
            </p>
          </div>
          <div style={{ height: 3, width: `${ruleWidth}%`, backgroundColor: '#C9A84C', marginTop: 16, marginLeft: 'auto', marginRight: 'auto' }} />
        </div>
      )}
    </AbsoluteFill>
  );
}
