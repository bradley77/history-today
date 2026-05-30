import { useCurrentFrame, AbsoluteFill } from 'remotion';

export const FilmGrain = ({ opacity = 0.045 }) => {
  const frame = useCurrentFrame();
  // Cycling seed animates the noise every frame — looks like real film grain
  const seed = frame % 60;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 20 }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id="grain-filter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="4"
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect
          width="100%"
          height="100%"
          filter="url(#grain-filter)"
          opacity={opacity}
        />
      </svg>
    </AbsoluteFill>
  );
};
