export const Vignette = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background:
        'radial-gradient(ellipse at 50% 50%, transparent 28%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.82) 100%)',
      pointerEvents: 'none',
      zIndex: 10,
    }}
  />
);
