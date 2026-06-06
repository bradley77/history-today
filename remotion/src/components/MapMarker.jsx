import { useCurrentFrame, interpolate, spring } from 'remotion';
import { toPixel } from '../utils/mapProjection';

export function MapMarker({
  lngLat,
  label,
  color = '#FFD700',
  appearFrame = 0,
  type = 'dot',
  mapConfig,
}) {
  const frame = useCurrentFrame();
  const pixel = toPixel(lngLat, mapConfig);

  if (!pixel) return null;

  const [x, y] = pixel;

  const scale = spring({
    frame: frame - appearFrame,
    fps: 30,
    config: { damping: 12, stiffness: 200 },
  });

  const pulseOpacity = interpolate(
    (frame - appearFrame) % 60,
    [0, 30, 60],
    [1, 0.3, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  if (frame < appearFrame) return null;

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: `translate(-50%, -50%) scale(${scale})`,
      pointerEvents: 'none',
    }}>
      {type === 'pulse' && (
        <div style={{
          position: 'absolute',
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          opacity: pulseOpacity,
          transform: 'translate(-50%, -50%)',
          left: '50%',
          top: '50%',
        }} />
      )}

      <div style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        backgroundColor: color,
        border: '2px solid white',
        boxShadow: `0 0 10px ${color}`,
      }} />

      {label && (
        <div style={{
          position: 'absolute',
          left: 18,
          top: -8,
          color: 'white',
          fontSize: 22,
          fontFamily: 'Bebas Neue',
          letterSpacing: 1,
          textShadow: '0 0 8px rgba(0,0,0,0.9), 1px 1px 0 black',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}
