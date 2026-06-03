import { useCurrentFrame, useVideoConfig, interpolate, Img, AbsoluteFill, Audio, staticFile } from 'remotion';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

const slides = [
  { src: '/slides/McVeigh/01-army-yearbook.jpg',    duration: 161, motionType: 'zoomIn',   overlayDelay: 20, objectFit: 'cover',   objectPosition: 'center top',    overlayText: 'No License Plate.' },
  { src: '/slides/McVeigh/02-mugshot.jpg',           duration: 161, motionType: 'panLeft',  overlayDelay: 20, objectFit: 'cover',   objectPosition: 'center top',    overlayText: 'Timothy McVeigh. Gulf War Veteran.' },
  { src: '/slides/McVeigh/03-building-aerial.jpeg',  duration: 161, motionType: 'zoomIn',   overlayDelay: 20, objectFit: 'cover',   objectPosition: 'center center', landscape: true, overlayText: '9:02 a.m. April 19, 1995.' },
  { src: '/slides/McVeigh/04-building-ground.jpg',   duration: 161, motionType: 'panRight', overlayDelay: 20, objectFit: 'cover',   objectPosition: 'center center', landscape: true, overlayText: '168 Killed. 19 Were Children.' },
  { src: '/slides/McVeigh/05-arrest-courthouse.jpg', duration: 176, motionType: 'panLeft',  overlayDelay: 20, objectFit: 'cover',   objectPosition: 'center top',    overlayText: 'Caught. 90 Minutes Later.' },
  { src: '/slides/McVeigh/06-sketch-mugshot.jpg',    duration: 161, motionType: 'none',     overlayDelay: 20, objectFit: 'contain', objectPosition: 'center center', landscape: true, backgroundColor: '#000', overlayText: 'The FBI Had His Face in 24 Hours.' },
  { src: '/slides/McVeigh/07-fbi-sketch.jpg',        duration: 161, motionType: 'zoomIn',   overlayDelay: 20, objectFit: 'cover',   objectPosition: 'center center', landscape: true, overlayText: 'UNSUB-1. Ryder Truck Rental. April 20, 1995.' },
  { src: '/slides/McVeigh/08-demolition.jpg',        duration: 205, motionType: 'zoomOut',  overlayDelay: 20, objectFit: 'cover',   objectPosition: 'center center', landscape: true, overlayText: 'Convicted 1997. Executed 2001.' },
];
// Total: 1347 frames = 44.9 seconds at 30fps

const slidesWithOffsets = slides.map((slide, i) => ({
  ...slide,
  from: slides.slice(0, i).reduce((sum, s) => sum + s.duration, 0),
}));

const getKenBurnsTransform = (motionType, localFrame, duration) => {
  switch (motionType) {
    case 'none':
      return '';
    case 'zoomOut': {
      const scale = interpolate(localFrame, [0, duration], [1.03, 1.0], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
    case 'panLeft': {
      const safePan = ((1.03 - 1) / 2) * 100; // 1.5% at scale 1.03
      const tx = interpolate(localFrame, [0, duration], [0, -safePan], { extrapolateRight: 'clamp' });
      return `scale(1.03) translateX(${tx}%)`;
    }
    case 'panRight': {
      const safePan = ((1.03 - 1) / 2) * 100; // 1.5% at scale 1.03
      const tx = interpolate(localFrame, [0, duration], [0, safePan], { extrapolateRight: 'clamp' });
      return `scale(1.03) translateX(${tx}%)`;
    }
    case 'zoomIn':
    default: {
      const scale = interpolate(localFrame, [0, duration], [1.0, 1.03], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
  }
};

export default function McVeighVideo() {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  // Determine active slide
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

  // Hard cut flash between slides — returns 1 on slide 0 so frame 0 is full opacity
  const cutOpacity = activeSlideIndex === 0
    ? 1
    : interpolate(localFrame, [0, 4], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // Fade out on last slide for clean ending
  const isLastSlide = activeSlideIndex === slidesWithOffsets.length - 1;
  const closeFade = isLastSlide
    ? interpolate(localFrame, [activeSlide.duration - 20, activeSlide.duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const finalOpacity = cutOpacity * closeFade;

  // Overlay text fades in after overlayDelay frames, over 18 frames
  const overlayOpacity = activeSlide.overlayText
    ? interpolate(
        localFrame,
        [activeSlide.overlayDelay, activeSlide.overlayDelay + 18],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0;

  // Gold rule width animates in with overlay text
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
      <Audio src={staticFile('audio/mcveigh-voiceover.mp3')} />
      <Audio src={staticFile('audio/hiss-music.mp3')} volume={0.22} startFrom={174} />
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Image layer */}
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
        {activeSlide.backgroundColor ? (
          <AbsoluteFill style={{ backgroundColor: activeSlide.backgroundColor }}>
            <Img
              src={staticFile(activeSlide.src)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: activeSlide.objectFit,
                objectPosition: activeSlide.objectPosition,
              }}
            />
          </AbsoluteFill>
        ) : (
          <Img
            src={staticFile(activeSlide.src)}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: activeSlide.objectFit,
              objectPosition: activeSlide.objectPosition,
              ...(activeSlide.landscape ? { minHeight: '100%', minWidth: '100%' } : {}),
              transform: transform || undefined,
            }}
          />
        )}
      </div>

      {/* Vignette overlay */}
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

      {/* Bottom gradient */}
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
          {/* Animated gold rule above text */}
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
          {/* Animated gold rule below text */}
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
