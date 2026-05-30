import { useCurrentFrame, interpolate, Img, AbsoluteFill } from 'remotion';

const TEXT_FADE_FRAMES = 12;
const SLIDE_FADE_FRAMES = 15;

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

const kenBurnsTransform = (type, frame, duration) => {
  switch (type) {
    case 'zoomOut': {
      const scale = interpolate(frame, [0, duration], [1.04, 1.0], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
    case 'panLeft': {
      const pan = interpolate(frame, [0, duration], [0, -40], { extrapolateRight: 'clamp' });
      return `translateX(${pan}px)`;
    }
    case 'panRight': {
      const pan = interpolate(frame, [0, duration], [-40, 0], { extrapolateRight: 'clamp' });
      return `translateX(${pan}px)`;
    }
    case 'zoomIn':
    default: {
      const scale = interpolate(frame, [0, duration], [1.0, 1.04], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
  }
};

export const Slide = ({ image, text, textPosition, kenBurns, duration, focalPoint, blurBackground }) => {
  const frame = useCurrentFrame();

  const slideOpacity = interpolate(
    frame,
    [0, SLIDE_FADE_FRAMES, duration - SLIDE_FADE_FRAMES, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const textOpacity = interpolate(
    frame,
    [0, TEXT_FADE_FRAMES, duration - TEXT_FADE_FRAMES, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Slide text up as it fades in for a more kinetic feel
  const textSlideY = interpolate(frame, [0, TEXT_FADE_FRAMES], [28, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const objectPosition = focalPoint ? `${focalPoint.x} ${focalPoint.y}` : 'center center';

  const containerStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  };

  // Blurred fill layer — slightly oversized to hide the soft edge CSS blur creates
  const blurLayerStyle = {
    position: 'absolute',
    top: '-5%',
    left: '-5%',
    width: '110%',
    height: '110%',
    objectFit: 'cover',
    objectPosition: 'center center',
    filter: 'blur(20px) brightness(0.35) saturate(0.6)',
  };

  const cinemaFilter = 'saturate(0.82) contrast(1.1) brightness(0.95)';

  // For landscape images: contain the full image so nothing is cropped
  // For portrait/square images: cover the frame, anchored to focalPoint
  const imageStyle = blurBackground
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        objectPosition: 'center center',
        transform: kenBurnsTransform(kenBurns, frame, duration),
        filter: cinemaFilter,
      }
    : {
        position: 'absolute',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition,
        transform: kenBurnsTransform(kenBurns, frame, duration),
        filter: cinemaFilter,
      };

  const isTop = textPosition === 'top';
  const overlayPosition = isTop
    ? { top: 140, left: 60, right: 60 }
    : { bottom: 180, left: 60, right: 60 };

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        backgroundColor: '#000',
        opacity: slideOpacity,
      }}
    >
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <div style={containerStyle}>
        {blurBackground && <Img src={image} style={blurLayerStyle} />}
        <Img src={image} style={imageStyle} />
      </div>

      {text && (
        <div
          style={{
            position: 'absolute',
            textAlign: 'center',
            opacity: textOpacity,
            transform: `translateY(${textSlideY}px)`,
            ...overlayPosition,
          }}
        >
          {/* Gold rule above text */}
          <div
            style={{
              width: '80%',
              height: 4,
              backgroundColor: 'rgb(200, 155, 50)',
              margin: '0 auto 16px auto',
            }}
          />
          <p
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.2,
              margin: 0,
              textShadow: '0 2px 16px rgba(0,0,0,0.95)',
              fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            }}
          >
            {text}
          </p>
        </div>
      )}
    </AbsoluteFill>
  );
};
