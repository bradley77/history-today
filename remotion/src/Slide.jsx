import { useCurrentFrame, interpolate, Img } from 'remotion';

const FADE_FRAMES = 15; // 0.5 s crossfade at each edge

export const Slide = ({ image, title, subtitle, duration }) => {
  const frame = useCurrentFrame();

  // Slow Ken Burns: 1.0 → 1.08 over the full slide
  const scale = interpolate(frame, [0, duration], [1, 1.08], {
    extrapolateRight: 'clamp',
  });

  // Fade in at start, hold, fade out at end
  const opacity = interpolate(
    frame,
    [0, FADE_FRAMES, duration - FADE_FRAMES, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#000',
        opacity,
      }}
    >
      {/* Hero image with Ken Burns zoom */}
      <Img
        src={image}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          display: 'block',
        }}
      />

      {/* Text overlay — only rendered when title is provided */}
      {title && (
        <div
          style={{
            position: 'absolute',
            bottom: 180,
            left: 60,
            right: 60,
            textAlign: 'center',
          }}
        >
          {/* Soft gradient backdrop so text reads over any image */}
          <div
            style={{
              position: 'absolute',
              inset: '-40px -60px',
              background:
                'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
              borderRadius: 8,
              pointerEvents: 'none',
            }}
          />
          <p
            style={{
              position: 'relative',
              fontSize: 64,
              fontWeight: 800,
              color: '#fff',
              lineHeight: 1.2,
              margin: 0,
              textShadow: '0 2px 12px rgba(0,0,0,0.9)',
              fontFamily: 'Georgia, serif',
            }}
          >
            {title}
          </p>
          {subtitle && (
            <p
              style={{
                position: 'relative',
                fontSize: 38,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.88)',
                marginTop: 16,
                textShadow: '0 1px 8px rgba(0,0,0,0.9)',
                fontFamily: 'Georgia, serif',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
