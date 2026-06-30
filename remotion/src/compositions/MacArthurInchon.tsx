import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

export const FPS = 30;
export const totalDuration = 1662;

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

type Motion = {
  scaleFrom: number;
  scaleTo: number;
  txFrom: number;
  txTo: number;
  tyFrom: number;
  tyTo: number;
};

type SlideConfig = {
  id: string;
  image: string | null;
  audio: string;
  durationInFrames: number;
  lines: string[];
  motion: Motion | null;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/macarthur-inchon/03-macarthur-binoculars.jpg',
    audio: 'audio/macarthur-inchon/slide-01.mp3',
    durationInFrames: 76,
    lines: ['His own commanders said it was suicide.'],
    motion: { scaleFrom: 1.0, scaleTo: 1.04, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide2',
    image: 'slides/macarthur-inchon/02-seawall-scaling.jpg',
    audio: 'audio/macarthur-inchon/slide-02.mp3',
    durationInFrames: 269,
    lines: ['Thirty-foot tides. Two hours. Seawalls.'],
    motion: { scaleFrom: 1.06, scaleTo: 1.06, txFrom: 0, txTo: 25, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide3',
    image: 'slides/macarthur-inchon/07-command-group.jpg',
    audio: 'audio/macarthur-inchon/slide-03.mp3',
    durationInFrames: 272,
    lines: ['He defended the plan alone. He walked out with their approval.'],
    motion: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide4',
    image: 'slides/macarthur-inchon/01-inchon-lsts.jpg',
    audio: 'audio/macarthur-inchon/slide-04.mp3',
    durationInFrames: 187,
    lines: ['September 15, 1950. Total surprise.'],
    motion: { scaleFrom: 1.06, scaleTo: 1.06, txFrom: 0, txTo: -25, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide5',
    image: 'slides/macarthur-inchon/06-t34-tank.jpg',
    audio: 'audio/macarthur-inchon/slide-05.mp3',
    durationInFrames: 221,
    lines: ['The North Korean army collapsed in weeks.'],
    motion: { scaleFrom: 1.0, scaleTo: 1.07, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide6',
    image: 'slides/macarthur-inchon/04-flag-seoul.jpg',
    audio: 'audio/macarthur-inchon/slide-06.mp3',
    durationInFrames: 296,
    lines: ['Seoul recaptured. The war looked won.'],
    motion: { scaleFrom: 1.06, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -20 },
  },
  {
    id: 'slide7',
    image: 'slides/macarthur-inchon/05-ruins-inchon.jpg',
    audio: 'audio/macarthur-inchon/slide-07.mp3',
    durationInFrames: 144,
    lines: ['Then he looked north. That story is coming.'],
    motion: { scaleFrom: 1.0, scaleTo: 1.05, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide8',
    image: null,
    audio: 'audio/macarthur-inchon/slide-08.mp3',
    durationInFrames: 197,
    lines: [
      'Follow the page.',
      'A like, a share, or a save',
      'helps this history reach more people.',
    ],
    motion: null,
  },
];

function TextOverlay({ lines }: { lines: string[] }) {
  const frame = useCurrentFrame();
  const ruleWidth = interpolate(frame, [0, 25], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fontSize = lines.length >= 3 ? 46 : lines.length === 2 ? 50 : 56;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '0 48px 140px',
        pointerEvents: 'none',
      }}
    >
      <div style={{ width: '100%' }}>
        <div
          style={{
            height: 3,
            background: '#C9A84C',
            width: `${ruleWidth}%`,
            marginBottom: 16,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />

        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.60)',
            padding: '24px 40px',
            textAlign: 'center',
          }}
        >
          {lines.map((line, i) => (
            <p
              key={i}
              style={{
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize,
                fontWeight: 700,
                color: '#fff',
                margin: i < lines.length - 1 ? '0 0 8px 0' : 0,
                lineHeight: 1.25,
                textShadow: '0 2px 14px rgba(0,0,0,0.95)',
                letterSpacing: '0.01em',
              }}
            >
              {line}
            </p>
          ))}
        </div>

        <div
          style={{
            height: 3,
            background: '#C9A84C',
            width: `${ruleWidth}%`,
            marginTop: 16,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

function SlidePanel({ slide }: { slide: SlideConfig }) {
  const frame = useCurrentFrame();
  const { motion, durationInFrames } = slide;

  const imgTransform = motion
    ? (() => {
        const scale = interpolate(frame, [0, durationInFrames], [motion.scaleFrom, motion.scaleTo], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const tx = interpolate(frame, [0, durationInFrames], [motion.txFrom, motion.txTo], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const ty = interpolate(frame, [0, durationInFrames], [motion.tyFrom, motion.tyTo], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return `scale(${scale}) translateX(${tx}px) translateY(${ty}px)`;
      })()
    : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {slide.image && (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img
            src={staticFile(slide.image)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              transform: imgTransform,
              transformOrigin: 'center center',
            }}
          />
        </AbsoluteFill>
      )}

      {slide.image && (
        <>
          <AbsoluteFill
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
              pointerEvents: 'none',
            }}
          />
          <AbsoluteFill
            style={{
              background:
                'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.75) 100%)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      <TextOverlay lines={slide.lines} />
      <Audio src={staticFile(slide.audio)} startFrom={0} />
    </AbsoluteFill>
  );
}

export default function MacArthurInchon() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>
      <Audio src={staticFile('audio/mcarthur-inchon-music.mp3')} volume={0.12} />
      {SLIDES.map((slide) => {
        const from = offset;
        offset += slide.durationInFrames;
        return (
          <Sequence
            key={slide.id}
            from={from}
            durationInFrames={slide.durationInFrames}
            layout="none"
          >
            <SlidePanel slide={slide} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
