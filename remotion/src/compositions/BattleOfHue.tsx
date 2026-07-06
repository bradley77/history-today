import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

export const FPS = 30;

const HARD_CUT_FRAMES = 4;

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
  image: string;
  audio: string;
  // Actual VO file duration (measured via Kokoro) + 0.4s pad
  durationInSeconds: number;
  // Actual VO file duration only (no pad) — bounds how long the caption shows
  audioDurationSeconds: number;
  // Omitted on the CTA slide — that card's art already has the payoff baked in
  overlayText?: string;
  // Verbatim VO line (correct spelling — never the phonetic TTS respelling)
  captionText: string;
  motion: Motion;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Hue/01-corridor-soldiers.jpg',
    audio: 'audio/battle-of-hue-vo-01.mp3',
    durationInSeconds: 6.075, // 5.675s actual + 0.4s pad
    audioDurationSeconds: 5.675,
    overlayText: "TET WAS AMERICA'S DEFEAT.",
    captionText: "They teach Tet as the start of America losing. In Hue, Marines fought block by block—and won.",
    // Slight upward pan following the soldiers' walking direction up the
    // corridor. Pan stays at the <=20px safe threshold for the scale range.
    motion: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -20 },
  },
  {
    id: 'slide2',
    image: 'slides/Hue/02-ontos-vehicles.jpg',
    audio: 'audio/battle-of-hue-vo-02.mp3',
    durationInSeconds: 6.245, // 5.845s actual + 0.4s pad
    audioDurationSeconds: 5.845,
    overlayText: 'DAY ONE. NO PLAN FOR THIS.',
    captionText: 'They were so overwhelmed on day one, Marines turned commandeered civilian cars into ambulances.',
    // Hard-crop image, no blurred margin to fall back on — constant scale
    // (satisfies pan>20px requiring scale>=1.06) with a conservative lateral
    // pan across the street line.
    motion: { scaleFrom: 1.08, scaleTo: 1.08, txFrom: -15, txTo: 15, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide3',
    image: 'slides/Hue/03-medic-wounded.jpg',
    audio: 'audio/battle-of-hue-vo-03.mp3',
    durationInSeconds: 6.864, // 6.464s actual + 0.4s pad
    audioDurationSeconds: 6.464,
    overlayText: 'SIXTEEN BLOCKS. HALF THE BATTALION.',
    captionText: 'One Marine battalion fought through sixteen city blocks in the Citadel. Nearly half became casualties doing it.',
    // Emotional peak — push-in only, no pan, let it hold.
    motion: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide4',
    image: 'slides/Hue/04-cta-recon.jpg',
    audio: 'audio/battle-of-hue-vo-04.mp3',
    durationInSeconds: 3.408, // 3.008s actual + 0.4s pad
    audioDurationSeconds: 3.008,
    // No overlayText — the card art already has "COMMENT RECON" baked in.
    captionText: 'Comment RECON for the free PDF on Vietnam.',
    motion: { scaleFrom: 1.0, scaleTo: 1.015, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  // Caption is only ever visible within the slide's real spoken audio —
  // never during the trailing 0.4s pad.
  captionEndFrame: Math.round(s.audioDurationSeconds * FPS),
}));

export const totalDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

function useGoldOverlay(localFrame: number, delayFrames = 8) {
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

// Fades in immediately (ahead of the delayed gold-rule/headline), then fades
// out just before the slide's real audio ends — never lingers into the pad.
function useCaptionOpacity(localFrame: number, endFrame: number) {
  return interpolate(
    localFrame,
    [0, 10, Math.max(11, endFrame - 6), endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
}

const captionStyle = {
  margin: 0,
  fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
  fontWeight: 400,
  fontSize: 32,
  lineHeight: 1.35,
  color: '#E8E2D4',
  textShadow: '0 2px 10px rgba(0,0,0,0.9)',
  letterSpacing: '0.01em',
} as const;

function SlidePanel({
  slide,
  isFirst,
}: {
  slide: SlideConfig & { durationFrames: number; captionEndFrame: number };
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();
  const { motion, durationFrames, overlayText, captionText, captionEndFrame } = slide;

  // QUICK STRIKES FORMAT: TRUE cold open on slide 1 — full brightness at frame 0, no fade-in.
  // Slides 2+ get a 4-frame hard cut. No fade-out anywhere, hard cut ending.
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  const scale = interpolate(frame, [0, durationFrames], [motion.scaleFrom, motion.scaleTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tx = interpolate(frame, [0, durationFrames], [motion.txFrom, motion.txTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ty = interpolate(frame, [0, durationFrames], [motion.tyFrom, motion.tyTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const { ruleWidth, textOpacity } = useGoldOverlay(frame);
  const captionOpacity = useCaptionOpacity(frame, captionEndFrame);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile(slide.image)}
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

      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.75) 100%)',
          pointerEvents: 'none',
        }}
      />

      {overlayText ? (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 48px 140px',
            pointerEvents: 'none',
          }}
        >
          <div style={{ width: '100%' }}>
            {/* Caption — verbatim VO line, sits directly above the gold rule */}
            <div style={{ textAlign: 'center', marginBottom: 14, opacity: captionOpacity }}>
              <p style={captionStyle}>{captionText}</p>
            </div>

            <div
              style={{
                height: 3,
                width: `${ruleWidth}%`,
                backgroundColor: '#C9A84C',
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
                {overlayText}
              </p>
            </div>
            <div
              style={{
                height: 3,
                width: `${ruleWidth}%`,
                backgroundColor: '#C9A84C',
                marginTop: 16,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            />
          </div>
        </AbsoluteFill>
      ) : (
        // CTA slide — no rendered headline (the card art already has one).
        // Caption sits in the empty band below the baked-in "SAVE + SHARE +
        // LIKE" line so it never overlaps the art's own text/rules.
        <div
          style={{
            position: 'absolute',
            top: 1420,
            left: 0,
            right: 0,
            padding: '0 48px',
            textAlign: 'center',
            opacity: captionOpacity,
            pointerEvents: 'none',
          }}
        >
          <p style={captionStyle}>{captionText}</p>
        </div>
      )}

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

export default function BattleOfHue() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/my-lai-massacre.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => {
        const from = offset;
        offset += slide.durationFrames;
        return (
          <Sequence key={slide.id} from={from} durationInFrames={slide.durationFrames} layout="none">
            <SlidePanel slide={slide} isFirst={i === 0} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
