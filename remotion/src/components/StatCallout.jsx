import { useCurrentFrame, interpolate, spring } from 'remotion';

export function StatCallout({
  stat,
  label,
  appearFrame = 0,
  position = { x: 540, y: 400 },
  color = '#FFD700',
}) {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [appearFrame, appearFrame + 15],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const scale = spring({
    frame: frame - appearFrame,
    fps: 30,
    config: { damping: 15, stiffness: 180 },
  });

  if (frame < appearFrame) return null;

  return (
    <div style={{
      position: 'absolute',
      left: position.x,
      top: position.y,
      transform: `translate(-50%, -50%) scale(${scale})`,
      opacity,
      textAlign: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 120,
        height: 2,
        backgroundColor: color,
        margin: '0 auto 8px',
      }} />

      <div style={{
        fontFamily: 'Bebas Neue',
        fontSize: 80,
        color: color,
        lineHeight: 1,
        textShadow: `0 0 20px ${color}80`,
      }}>
        {stat}
      </div>

      <div style={{
        fontFamily: 'Bebas Neue',
        fontSize: 32,
        color: 'white',
        letterSpacing: 3,
      }}>
        {label}
      </div>

      <div style={{
        width: 120,
        height: 2,
        backgroundColor: color,
        margin: '8px auto 0',
      }} />
    </div>
  );
}
