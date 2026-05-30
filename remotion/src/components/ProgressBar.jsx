import { useCurrentFrame, interpolate } from 'remotion';
import { totalDuration } from '../data/config';

export const ProgressBar = () => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, totalDuration], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: `${width}%`,
        height: 5,
        backgroundColor: 'rgb(200, 155, 50)',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    />
  );
};
