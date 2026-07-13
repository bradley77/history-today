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
  OSWALD_URL,
  HARD_CUT_FRAMES,
  GOLD,
  KenBurnsImage,
  Vignette,
  ContextTag,
  useGoldOverlay,
  type Motion,
} from '../shared/QuickStrikeShared';

type SlideConfig = {
  id: string;
  image: string;
  audio: string;
  // Actual VO file duration (measured via Kokoro) + 0.4s pad
  durationInSeconds: number;
  // Small gold single-line location/date tag, top left — omit for the end card
  contextTag?: string;
  // Bold all-caps, short story-advancing statement — sits in the bottom stack
  headlineText: string;
  // Verbatim VO line, lighter weight, sits directly above the top gold rule
  captionText: string;
  motion: Motion;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/NuclearKyoto/02-enolagay.jpg',
    audio: 'audio/nuclear-kyoto-slide-1.mp3',
    durationInSeconds: 2.363, // 1.963s actual + 0.4s pad
    contextTag: 'NORTH FIELD — TINIAN, 1945',
    headlineText: 'HIROSHIMA WAS THE FINAL CHOICE',
    captionText: 'Hiroshima was the final choice.',
    motion: { scaleFrom: 1.0, scaleTo: 1.02, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide2',
    image: 'slides/NuclearKyoto/03-trinity.jpg',
    audio: 'audio/nuclear-kyoto-slide-2.mp3',
    durationInSeconds: 3.301, // 2.901s actual + 0.4s pad
    contextTag: 'TRINITY TEST SITE — NM, JULY 1945',
    headlineText: 'KYOTO TOPPED THE ORIGINAL LIST',
    captionText: 'Kyoto was originally at the top of the target list.',
    motion: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0,
      // Cloud sits top-anchored with blurred fill in the bottom margin (re-cropped
      // source). Pivoting the zoom on the cloud itself (not full-canvas center)
      // keeps the crop tightening around the sharp subject as it scales in,
      // rather than enlarging toward the blurred fill.
      transformOrigin: '50% 65%' },
  },
  {
    id: 'slide3',
    image: 'slides/NuclearKyoto/01-stimson.jpg',
    audio: 'audio/nuclear-kyoto-slide-3.mp3',
    durationInSeconds: 7.483, // 7.083s actual + 0.4s pad — extended slide, carries two VO sentences
    contextTag: 'WASHINGTON, D.C.',
    // Carries the action/payoff, not his name+title — that's already delivered
    // verbatim by the caption line below, no need to duplicate it here.
    headlineText: 'STIMSON STRUCK KYOTO FROM THE LIST',
    captionText:
      "Secretary of War Henry Stimson struck it off, citing its cultural significance. He'd visited the city years earlier.",
    // Slight upward pan toward face — pan >20px pairs with scale >=1.06.
    // Single continuous interpolation across the full (longer) slide duration,
    // not reset partway — this used to be two slides (3+4), now merged into one.
    motion: { scaleFrom: 1.06, scaleTo: 1.08, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -24 },
  },
];

const CTA_AUDIO = 'audio/nuclear-kyoto-cta.mp3';
const CTA_DURATION_SECONDS = 2.832; // 2.432s actual + 0.4s pad
const CTA_HEADLINE = 'FOLLOW FOR MORE // COMMENT "FRONT"';

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);
const END_CARD_FRAMES = Math.round(CTA_DURATION_SECONDS * FPS);

export const totalDuration = slidesDuration + END_CARD_FRAMES;
export { FPS };

// Bottom headline stack — original bottom-of-frame position (not top left).
// Top-to-bottom order: verbatim caption (lighter weight) directly above the
// top gold rule, then the bold all-caps headline between the two rules.
// NOT QuickStrikeShared's GoldLowerThird: the caption and headline here are a
// single visually-coupled stack (caption sits inside the same flex container,
// 14px above the rule), which the shared component — a headline-only block —
// doesn't represent, so this stays local.
function BottomStack({
  headline,
  caption,
  frame,
}: {
  headline: string;
  caption?: string;
  frame: number;
}) {
  const { ruleWidth, textOpacity } = useGoldOverlay(frame);
  const captionOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
        {caption && (
          <div
            style={{
              textAlign: 'center',
              marginBottom: 14,
              opacity: captionOpacity,
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontWeight: 400,
                fontSize: 32,
                lineHeight: 1.3,
                color: '#E8E2D4',
                textShadow: '0 2px 10px rgba(0,0,0,0.9)',
                letterSpacing: '0.01em',
              }}
            >
              {caption}
            </p>
          </div>
        )}

        <div
          style={{
            height: 3,
            width: `${ruleWidth}%`,
            backgroundColor: GOLD,
            marginBottom: 16,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.60)',
            padding: '24px 40px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: '#F5F0E8',
              margin: 0,
              lineHeight: 1.25,
              textShadow: '0 2px 14px rgba(0,0,0,0.95)',
              fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
              letterSpacing: '0.01em',
              opacity: textOpacity,
            }}
          >
            {headline}
          </p>
        </div>
        <div
          style={{
            height: 3,
            width: `${ruleWidth}%`,
            backgroundColor: GOLD,
            marginTop: 16,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

function SlidePanel({ slide, isFirst }: { slide: SlideConfig & { durationFrames: number }; isFirst: boolean }) {
  const frame = useCurrentFrame();
  const { motion, durationFrames, headlineText, captionText, contextTag, image } = slide;

  // QUICK STRIKES FORMAT: TRUE cold open on slide 1 — full brightness at frame 0, no fade-in.
  // Slides 2+ get a 4-frame hard cut. No fade-out anywhere, hard cut ending.
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <KenBurnsImage image={image} frame={frame} durationFrames={durationFrames} motion={motion} />
      <Vignette />

      {contextTag && <ContextTag text={contextTag} />}
      <BottomStack headline={headlineText} caption={captionText} frame={frame} />

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

function EndCard() {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      {/* No context tag on the end card */}
      <BottomStack headline={CTA_HEADLINE} frame={frame} />

      {/* CTA voiceover plays over the end card, never over the payoff slide */}
      <Audio src={staticFile(CTA_AUDIO)} />
    </AbsoluteFill>
  );
}

export default function NuclearKyoto() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/TokyoFirebombing-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => {
        const from = offset;
        offset += slide.durationFrames;
        return (
          <Sequence key={slide.id} from={from} durationInFrames={slide.durationFrames} layout="none">
            <SlidePanel slide={slide} isFirst={i === 0} />
          </Sequence>
        );
      })}

      <Sequence from={slidesDuration} durationInFrames={END_CARD_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
