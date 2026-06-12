import { useCurrentFrame, AbsoluteFill, interpolate, Easing } from 'remotion';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';
const GOLD = '#C9A84C';

export default function SeriesTitleCard() {
  const frame = useCurrentFrame();

  // Bar slides off to the right frames 0–20 with ease-out, then holds off screen
  const barTranslate = interpolate(frame, [0, 20], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* "THE PROGRAM" with sliding redaction bar */}
      <div style={{ position: 'relative', display: 'inline-block', padding: '14px 32px', overflow: 'hidden' }}>
        <h1
          style={{
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            fontSize: 128,
            fontWeight: 700,
            color: GOLD,
            margin: 0,
            lineHeight: 1,
            letterSpacing: '0.1em',
          }}
        >
          THE PROGRAM
        </h1>

        {/* Black redaction bar — starts covering the text, slides off right */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000',
            transform: `translateX(${barTranslate}%)`,
          }}
        />
      </div>

      {/* "DECLASSIFIED" subtitle */}
      <p
        style={{
          fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
          fontSize: 38,
          fontWeight: 700,
          color: GOLD,
          margin: 0,
          letterSpacing: '0.45em',
          opacity: 0.65,
        }}
      >
        DECLASSIFIED
      </p>
    </AbsoluteFill>
  );
}
