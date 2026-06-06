import { useCurrentFrame, interpolate } from 'remotion';
import { routeToSVGPath, routeToBezierPath } from '../utils/mapProjection';
import { useRef, useEffect, useState } from 'react';

export function AnimatedRoute({
  waypoints,
  color = '#FFD700',
  strokeWidth = 6,
  startFrame = 0,
  durationFrames = 120,
  showArrowhead = true,
  glowEffect = true,
  glowIntensity = 10,
  animated = false,
  mapConfig,
}) {
  const frame = useCurrentFrame();
  const pathRef = useRef(null);
  const [pathLength, setPathLength] = useState(5000);

  const svgPath = routeToBezierPath(waypoints, mapConfig);

  useEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      console.log('Real path length:', len);
      setPathLength(len);
    }
  }, [svgPath]);

  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const dashOffset = pathLength * (1 - progress);

  // Animated convoy dash effect
  const convoyOffset = animated ? (frame - startFrame) * 3 : 0;
  const convoyDashArray = `${strokeWidth * 4} ${strokeWidth * 3}`;

  const filterId = `glow-${color.replace('#', '')}`;
  const arrowId = `arrow-${color.replace('#', '')}`;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
      }}
      viewBox={`0 0 ${mapConfig?.width || 1216} ${mapConfig?.height || 1920}`}
    >
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={glowIntensity * 0.4} result="blur1"/>
          <feGaussianBlur stdDeviation={glowIntensity * 0.15} result="blur2"/>
          <feMerge>
            <feMergeNode in="blur1"/>
            <feMergeNode in="blur2"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <marker
          id={arrowId}
          markerWidth="12"
          markerHeight="9"
          refX="11"
          refY="4.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 12 4.5, 0 9" fill={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </marker>
      </defs>

      {/* Outer glow layer */}
      {glowEffect && (
        <path
          d={svgPath}
          stroke={color}
          strokeWidth={strokeWidth + 14}
          fill="none"
          opacity={0.15}
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
          filter={`url(#${filterId})`}
          strokeLinecap="round"
        />
      )}

      {/* Mid glow layer */}
      {glowEffect && (
        <path
          d={svgPath}
          stroke={color}
          strokeWidth={strokeWidth + 6}
          fill="none"
          opacity={0.35}
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      )}

      {/* Main solid line */}
      <path
        ref={pathRef}
        d={svgPath}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
        markerEnd={showArrowhead ? `url(#${arrowId})` : undefined}
        filter={glowEffect ? `url(#${filterId})` : undefined}
      />

      {/* Animated convoy dots moving along the line */}
      {animated && progress > 0.1 && (
        <path
          d={svgPath}
          stroke="white"
          strokeWidth={strokeWidth * 0.4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={convoyDashArray}
          strokeDashoffset={-convoyOffset}
          opacity={0.6}
          strokeWidth={2}
          style={{
            clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`,
          }}
        />
      )}
    </svg>
  );
}
