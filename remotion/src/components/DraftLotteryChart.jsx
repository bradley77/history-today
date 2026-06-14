import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

// Verified data: average 1969 draft lottery number by birth month
// Source: Selective Service System 1970 Random Selection Sequence table
// Lower number = called earlier. Expected average if random = 183.5
const MONTHS = [
  { label: 'Jan', value: 201 },
  { label: 'Feb', value: 203 },
  { label: 'Mar', value: 225 },
  { label: 'Apr', value: 203 },
  { label: 'May', value: 207 },
  { label: 'Jun', value: 195 },
  { label: 'Jul', value: 181 },
  { label: 'Aug', value: 173 },
  { label: 'Sep', value: 157 },
  { label: 'Oct', value: 182 },
  { label: 'Nov', value: 148 },
  { label: 'Dec', value: 121 },
];

const EXPECTED_AVERAGE = 183.5;
const MAX_VALUE = 250;

// Color thresholds — adjust to taste
function getBarColor(value) {
  if (value < 165) return '#D9534F'; // red — earliest called
  if (value < EXPECTED_AVERAGE) return '#E0A030'; // amber — below average
  return '#3F8F6E'; // teal/green — safer
}

/**
 * DraftLotteryChart
 *
 * Frame-driven animated bar chart. Designed to be dropped into a Remotion
 * <Sequence> as one slide. All timing is controlled via the props below so
 * it can be re-synced once the final voiceover duration is known.
 *
 * Props:
 *  - startFrame: frame (relative to this component's own timeline) at which
 *    the bar grow-in animation begins. Default 0 (starts immediately when
 *    the slide mounts). If used inside a <Sequence from={X}>, frame 0 here
 *    already corresponds to slide-local frame 0 — set this to add a delay
 *    AFTER the slide appears (e.g. let the title settle first).
 *  - growDurationFrames: how many frames the grow-in animation takes.
 *    At 30fps, 45 frames = 1.5s. Adjust to match voiceover pacing.
 *  - title / subtitle: text rendered above the chart.
 */
export const DraftLotteryChart = ({
  startFrame = 0,
  growDurationFrames = 45,
  title = 'AVERAGE DRAFT LOTTERY NUMBER BY BIRTH MONTH',
  subtitle = '1969 drawing — lower number meant called earlier',
}) => {
  const frame = useCurrentFrame();

  // Progress 0 -> 1 over the grow window, eased out for a natural "settle"
  const rawProgress = interpolate(
    frame,
    [startFrame, startFrame + growDurationFrames],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }
  );

  // Single pulse on Nov/Dec bars — fires 10 frames after grow-in completes.
  // Triangle: 0 → 1 → 0 over 30 frames. Brightens bar color and adds a soft glow.
  const pulseStart = startFrame + growDurationFrames + 10;
  const pulseIntensity = interpolate(
    frame,
    [pulseStart, pulseStart + 15, pulseStart + 30],
    [0, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Chart area dimensions (in px, for a 1080x1920 portrait composition this
  // sits inside a centered content box — adjust container sizing in your
  // actual slide wrapper)
  const chartHeight = 700;
  const chartWidth = 900;
  const barGap = 14;
  const barWidth = (chartWidth - barGap * (MONTHS.length - 1)) / MONTHS.length;

  // Pixel position of the "expected average" dashed line
  const avgLineY = chartHeight - (EXPECTED_AVERAGE / MAX_VALUE) * chartHeight;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A1628',
        fontFamily: 'Arial, sans-serif',
        color: '#FFFFFF',
        padding: 60,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: chartWidth,
          marginBottom: 8,
          fontSize: 28,
          letterSpacing: 2,
          color: '#C9D6E8',
          textAlign: 'left',
        }}
      >
        {title}
      </div>
      <div
        style={{
          width: chartWidth,
          marginBottom: 30,
          fontSize: 20,
          color: '#7A8FAE',
          textAlign: 'left',
        }}
      >
        {subtitle}
      </div>

      <div
        style={{
          position: 'relative',
          width: chartWidth,
          height: chartHeight,
        }}
      >
        {/* Expected average dashed line */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: avgLineY,
            width: chartWidth,
            borderTop: '2px dashed rgba(255,255,255,0.35)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: avgLineY - 30,
            fontSize: 18,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          expected average ({EXPECTED_AVERAGE})
        </div>

        {/* Bars */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: chartWidth,
            height: chartHeight,
            display: 'flex',
            alignItems: 'flex-end',
            gap: barGap,
          }}
        >
          {MONTHS.map((m) => {
            const fullBarHeight = (m.value / MAX_VALUE) * chartHeight;
            const animatedHeight = fullBarHeight * rawProgress;
            const animatedValue = Math.round(m.value * rawProgress);

            return (
              <div
                key={m.label}
                style={{
                  width: barWidth,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  height: '100%',
                }}
              >
                {/* Value label above bar */}
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 'bold',
                    color: '#FFFFFF',
                    marginBottom: 6,
                    opacity: rawProgress > 0.15 ? 1 : 0,
                  }}
                >
                  {animatedValue}
                </div>
                {/* Bar — Nov/Dec (value < 165) get a pulse highlight after grow-in */}
                <div
                  style={{
                    width: '100%',
                    height: animatedHeight,
                    backgroundColor: m.value < 165
                      ? `rgb(${Math.round(217 + 38 * pulseIntensity)}, ${Math.round(83 + 45 * pulseIntensity)}, ${Math.round(79 + 33 * pulseIntensity)})`
                      : getBarColor(m.value),
                    borderRadius: '4px 4px 0 0',
                    boxShadow: m.value < 165 && pulseIntensity > 0
                      ? `0 0 ${Math.round(16 * pulseIntensity)}px rgba(255, 100, 90, ${(0.5 * pulseIntensity).toFixed(2)})`
                      : undefined,
                  }}
                />
                {/* Month label */}
                <div
                  style={{
                    fontSize: 22,
                    color: '#C9D6E8',
                    marginTop: 12,
                  }}
                >
                  {m.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
