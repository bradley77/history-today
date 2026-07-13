import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {
  FPS,
  GOLD,
  KenBurnsImage,
  useGoldOverlay,
  EndCardCTA,
} from '../shared/QuickStrikeShared';

const SLUG = 'union-sherman-scorched-earth';

// durationInSeconds = measured MP3 duration + 0.4s padding
// audioDurationSeconds = measured MP3 duration only (used to scope captions)
const SLIDES = [
  {
    id: 'slide1',
    image: 'slides/Sherman/01-sherman.jpg',
    audio: `audio/${SLUG}-01.mp3`,
    durationInSeconds: 3.273,
    audioDurationSeconds: 2.873,
    overlayLines: ["GEORGIA WASN'T FIRST"],
    caption: "Georgia wasn't Sherman's first march of destruction.",
    // No pan — zero-pan, scale 1.0 → 1.06
    kenBurns: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide2',
    image: 'slides/Sherman/02-railroad-destruction.jpg',
    audio: `audio/${SLUG}-02.mp3`,
    durationInSeconds: 7.427,
    audioDurationSeconds: 7.027,
    overlayLines: ['MERIDIAN, MISSISSIPPI', 'FEBRUARY 1864'],
    caption: 'Nine months before Georgia, he marched through Mississippi. His men destroyed 115 miles of railroad.',
    // Pan 25px right — > 20px requires scale ≥ 1.06
    kenBurns: { scaleFrom: 1.06, scaleTo: 1.06, txFrom: 0, txTo: 25, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide3',
    image: 'slides/Sherman/03-columbia-burning.jpg',
    audio: `audio/${SLUG}-03.mp3`,
    durationInSeconds: 5.128,
    audioDurationSeconds: 4.728,
    overlayLines: ['SOUTH CAROLINA', 'FEBRUARY 1865'],
    caption: 'Then came South Carolina. Columbia burned in February 1865.',
    // Drift 15px up — < 20px, scale can be as low as 1.0; using push-in 1.0 → 1.07
    kenBurns: { scaleFrom: 1.0, scaleTo: 1.07, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -15 },
  },
];

const CTA_AUDIO = `audio/${SLUG}-04.mp3`;
const CTA_DURATION_SECONDS = 2.803;
const CTA_AUDIO_SECONDS = 2.403; // measured audio duration, for caption scoping
const CTA_TRIGGER_WORD = 'BLUEGRAY';
const CTA_SUBLINE = 'COMMENT BLUEGRAY BELOW';
const CTA_CAPTION = 'Comment BLUEGRAY below and follow the page.';

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  captionFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const END_CARD_FRAMES = Math.round(CTA_DURATION_SECONDS * FPS);
const END_CARD_CAPTION_FRAMES = Math.round(CTA_AUDIO_SECONDS * FPS);

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);
export const totalDuration = slidesDuration + END_CARD_FRAMES;
export { FPS };

// Caption outline via 8-direction text-shadow — renders over any background.
// NOT QuickStrikeShared's CaptionOverlay: this file's caption is unboxed
// outlined text (not a boxed floating chip), a third distinct caption style
// in this codebase, so it stays local.
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

  const { ruleWidth, textOpacity } = useGoldOverlay(frame, 8);
  const fontSize = overlayLines.length >= 3 ? 36 : 42;

  return (
    <AbsoluteFill>
      {/* Image with Ken Burns — no fade, full brightness from frame 0 */}
      <KenBurnsImage image={slide.image} frame={frame} durationFrames={durationFrames} motion={kenBurns} />

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
              background: GOLD,
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
              background: GOLD,
              width: `${ruleWidth}%`,
              marginTop: 16,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
        </div>
      </AbsoluteFill>

      <Audio src={staticFile(slide.audio)} startFrom={0} />
    </AbsoluteFill>
  );
}

function EndCard() {
  const frame = useCurrentFrame();
  const captionVisible = frame < END_CARD_CAPTION_FRAMES;

  return (
    <AbsoluteFill>
      <EndCardCTA
        triggerWord={CTA_TRIGGER_WORD}
        subline={CTA_SUBLINE}
        audio={CTA_AUDIO}
      />

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
