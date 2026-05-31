import { useCurrentFrame, useVideoConfig, interpolate, Img, AbsoluteFill, Audio, staticFile } from 'remotion';
import { slides } from '../data/korematsu';

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
      const tx = interpolate(localFrame, [0, duration], [0, -3], { extrapolateRight: 'clamp' });
      return `translateX(${tx}%)`;
    }
    case 'panRight': {
      const tx = interpolate(localFrame, [0, duration], [0, 3], { extrapolateRight: 'clamp' });
      return `translateX(${tx}%)`;
    }
    case 'zoomIn':
    default: {
      const scale = interpolate(localFrame, [0, duration], [1.0, 1.08], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
  }
};

export default function KorematsuVideo() {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  // Determine which slide is active based on cumulative frame count
  let activeSlide = slidesWithOffsets[0];
  let activeSlideIndex = 0;
  for (let i = 0; i < slidesWithOffsets.length; i++) {
    if (frame >= slidesWithOffsets[i].from) {
      activeSlide = slidesWithOffsets[i];
      activeSlideIndex = i;
    }
  }

  const localFrame = frame - activeSlide.from;

  const transform = getKenBurnsTransform(activeSlide.motionType, localFrame, activeSlide.duration);

  // 6-frame flash cut between slides — skip for the first slide so the
  // video opens at full opacity rather than a transparent/checkerboard frame.
  const cutOpacity = activeSlideIndex === 0
    ? 1
    : interpolate(localFrame, [0, 6], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // Overlay text fades in after overlayDelay frames, over 20 frames
  const overlayOpacity = activeSlide.overlayText
    ? interpolate(
        localFrame,
        [activeSlide.overlayDelay, activeSlide.overlayDelay + 20],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity: cutOpacity }}>
      <Audio src={staticFile('audio/korematsu-voiceover.mp3')} />
      <Audio
        src={staticFile('audio/korematsu-music.mp3')}
        volume={0.25}
      />
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
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
          }}
        />
      </div>

      {activeSlide.overlayText && (
        <div
          style={{
            position: 'absolute',
            bottom: Math.round(height * 0.12),
            left: 0,
            right: 0,
            opacity: overlayOpacity,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              paddingTop: 28,
              paddingBottom: 28,
              paddingLeft: 48,
              paddingRight: 48,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: '#fff',
                margin: 0,
                lineHeight: 1.25,
                textShadow: '0 2px 12px rgba(0,0,0,0.9)',
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
              }}
            >
              {activeSlide.overlayText}
            </p>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
}
