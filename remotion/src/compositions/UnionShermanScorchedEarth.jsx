import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

const SLUG = 'union-sherman-scorched-earth';

// durationInSeconds = measured MP3 duration + 0.4s padding
// audioDurationSeconds = measured MP3 duration only (used to scope captions)
const SLIDES = [
  {
    id: 'slide1',
    image: staticFile('slides/Sherman/01-sherman.jpg'),
    audio: staticFile(`audio/${SLUG}-01.mp3`),
    durationInSeconds: 3.273,
    audioDurationSeconds: 2.873,
    overlayLines: ["GEORGIA WASN'T FIRST"],
    caption: "Georgia wasn't Sherman's first march of destruction.",
    // No pan — zero-pan, scale 1.0 → 1.06
    kenBurns: { startScale: 1.0, endScale: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide2',
    image: staticFile('slides/Sherman/02-railroad-destruction.jpg'),
    audio: staticFile(`audio/${SLUG}-02.mp3`),
    durationInSeconds: 7.427,
    audioDurationSeconds: 7.027,
    overlayLines: ['MERIDIAN, MISSISSIPPI', 'FEBRUARY 1864'],
    caption: 'Nine months before Georgia, he marched through Mississippi. His men destroyed 115 miles of railroad.',
    // Pan 25px right — > 20px requires scale ≥ 1.06
    kenBurns: { startScale: 1.06, endScale: 1.06, txFrom: 0, txTo: 25, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide3',
    image: staticFile('slides/Sherman/03-columbia-burning.jpg'),
    audio: staticFile(`audio/${SLUG}-03.mp3`),
    durationInSeconds: 5.128,
    audioDurationSeconds: 4.728,
    overlayLines: ['SOUTH CAROLINA', 'FEBRUARY 1865'],
    caption: 'Then came South Carolina. Columbia burned in February 1865.',
    // Drift 15px up — < 20px, scale can be as low as 1.0; using push-in 1.0 → 1.07
    kenBurns: { startScale: 1.0, endScale: 1.07, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -15 },
  },
];

const CTA_AUDIO = staticFile(`audio/${SLUG}-04.mp3`);
const CTA_DURATION_SECONDS = 2.803;
const CTA_AUDIO_SECONDS = 2.403; // measured audio duration, for caption scoping
const CTA_TRIGGER_WORD = 'UNION';
const CTA_TEXT = 'COMMENT UNION BELOW';
const CTA_CAPTION = 'Comment UNION below and follow the page.';

export const FPS = 30;

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  captionFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const END_CARD_FRAMES = Math.round(CTA_DURATION_SECONDS * FPS);
const END_CARD_CAPTION_FRAMES = Math.round(CTA_AUDIO_SECONDS * FPS);

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);
export const totalDuration = slidesDuration + END_CARD_FRAMES;

function useGoldOverlay(localFrame, delayFrames = 8) {
  const ruleWidth = interpolate(
    localFrame,
    [delayFrames, delayFrames + 25],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const textOpacity = interpolate(
    localFrame,
    [delayFrames, delayFrames + 18],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return { ruleWidth, textOpacity };
}

// Caption outline via 8-direction text-shadow — renders over any background
const CAPTION_SHADOW =
  '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000,' +
  ' -2px 0 0 #000, 2px 0 0 #000, 0 -2px 0 #000, 0 2px 0 #000';

function SlideCaptions({ text, captionFrames }) {
  const frame = useCurrentFrame();
  // Hidden during the 0.4s pad at the end of each slide
  const visible = frame < captionFrames;

  return (
    <div
      style={{
        position: 'absolute',
        top: '72%',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 60px',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          color: '#fff',
          fontFamily: 'Arial, sans-serif',
          fontSize: 36,
          fontWeight: 700,
          textAlign: 'center',
          lineHeight: 1.35,
          textShadow: CAPTION_SHADOW,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function SlidePanel({ slide }) {
  const frame = useCurrentFrame();
  const { durationFrames, captionFrames, kenBurns, overlayLines, caption } = slide;

  const scale = interpolate(
    frame,
    [0, durationFrames],
    [kenBurns.startScale, kenBurns.endScale],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const tx = interpolate(
    frame,
    [0, durationFrames],
    [kenBurns.txFrom, kenBurns.txTo],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const ty = interpolate(
    frame,
    [0, durationFrames],
    [kenBurns.tyFrom, kenBurns.tyTo],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const { ruleWidth, textOpacity } = useGoldOverlay(frame, 8);
  const fontSize = overlayLines.length >= 3 ? 36 : 42;

  return (
    <AbsoluteFill>
      {/* Image with Ken Burns — no fade, full brightness from frame 0 */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={slide.image}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            transform: `scale(${scale}) translateX(${tx}px) translateY(${ty}px)`,
            transformOrigin: 'center center',
          }}
        />
      </AbsoluteFill>

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom gradient for text legibility */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.72) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Burned-in captions — 72% down, scoped to audio duration */}
      <SlideCaptions text={caption} captionFrames={captionFrames} />

      {/* Gold animated rules + centered lower-third overlay */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 40px 140px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ width: '100%', maxWidth: 900 }}>
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

          {overlayLines.map((line, i) => (
            <div
              key={i}
              style={{
                opacity: textOpacity,
                color: '#fff',
                fontFamily: 'Georgia, serif',
                fontSize,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1.25,
                textShadow: '0 2px 8px rgba(0,0,0,0.85)',
                textAlign: 'center',
                marginBottom: i < overlayLines.length - 1 ? 6 : 0,
              }}
            >
              {line}
            </div>
          ))}

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

      <Audio src={slide.audio} startFrom={0} />
    </AbsoluteFill>
  );
}

function EndCard() {
  const frame = useCurrentFrame();
  const textOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ruleWidth = interpolate(frame, [8, 33], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const captionVisible = frame < END_CARD_CAPTION_FRAMES;

  return (
    <AbsoluteFill
      style={{
        background: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
      }}
    >
      <Audio src={CTA_AUDIO} startFrom={0} />

      <div style={{ width: '80%', maxWidth: 900 }}>
        <div
          style={{
            height: 3,
            background: '#C9A84C',
            width: `${ruleWidth}%`,
            marginBottom: 36,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />

        <div
          style={{
            opacity: textOpacity,
            color: '#fff',
            fontFamily: 'Georgia, serif',
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          {CTA_TRIGGER_WORD}
        </div>

        <div
          style={{
            opacity: textOpacity,
            color: '#C9A84C',
            fontFamily: 'Georgia, serif',
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: '0.05em',
            textAlign: 'center',
            marginBottom: 36,
          }}
        >
          {CTA_TEXT}
        </div>

        <div
          style={{
            height: 3,
            background: '#C9A84C',
            width: `${ruleWidth}%`,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />
      </div>

      {/* Burned-in caption — scoped to CTA audio duration */}
      <div
        style={{
          position: 'absolute',
          top: '72%',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: '0 60px',
          pointerEvents: 'none',
          opacity: captionVisible ? 1 : 0,
        }}
      >
        <div
          style={{
            maxWidth: 960,
            color: '#fff',
            fontFamily: 'Arial, sans-serif',
            fontSize: 36,
            fontWeight: 700,
            textAlign: 'center',
            lineHeight: 1.35,
            textShadow: CAPTION_SHADOW,
          }}
        >
          {CTA_CAPTION}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export default function UnionShermanScorchedEarth() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {slidesWithFrames.map((slide) => {
        const start = offset;
        offset += slide.durationFrames;
        return (
          <Sequence key={slide.id} from={start} durationInFrames={slide.durationFrames} layout="none">
            <SlidePanel slide={slide} />
          </Sequence>
        );
      })}

      {/* Background music — full duration, 0.15 volume */}
      <Audio src={staticFile(`audio/${SLUG}-music.mp3`)} volume={0.15} loop />

      {/* End card — CTA audio plays here only */}
      <Sequence from={slidesDuration} durationInFrames={END_CARD_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
