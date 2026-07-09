import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { useMemo } from 'react';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

export const FPS = 30;

const HARD_CUT_FRAMES = 4;
const PAD_S = 0.4;

// Measured Kokoro VO durations (am_adam, speed 0.95, en-us) via
// scripts/generateVoiceover-lee-resignation.py, before the standard 0.4s pad.
const SLIDE1_AUDIO_S = 5.440;
const SLIDE2_AUDIO_S = 6.635;
const SLIDE3_AUDIO_S = 5.717;
const SLIDE4_AUDIO_S = 11.840;
const SLIDE5_AUDIO_S = 2.197;

type SlideConfig = {
  id: string;
  image: string;
  audio: string;
  durationInSeconds: number;
  overlayText?: string;
  // Small gold single-line location/context tag, top left — omit for the end card.
  contextTag?: string;
  // Burned-in caption(s), verbatim VO text. Single-element array renders as one
  // static line for the whole slide; multiple elements are shown as sequential
  // chunks, each timed proportionally to its share of the total word count.
  captionLines: string[];
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Lee-Resignation/01-lee-portrait.jpg',
    audio: 'audio/lee-resignation-01-hook-voiceover.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    overlayText: "HE CALLED SECESSION 'NOTHING BUT REVOLUTION.' THEN HE BECAME A CONFEDERATE GENERAL.",
    contextTag: 'GEN. ROBERT E. LEE',
    captionLines: ['Robert E Lee called secession nothing but revolution. Then he became a Confederate general.'],
  },
  {
    id: 'slide2',
    image: 'slides/Lee-Resignation/02-winfield-scott.jpg',
    audio: 'audio/lee-resignation-02-offer-voiceover.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    overlayText: "OFFERED COMMAND OF THE UNION'S MAIN ARMY.",
    contextTag: 'GEN. WINFIELD SCOTT',
    captionLines: ["After Virginia voted to secede, but before Lee resigned, he was offered command of the Union's main army."],
  },
  {
    id: 'slide3',
    image: 'slides/Lee-Resignation/03-calamity-quote.jpg',
    audio: 'audio/lee-resignation-03-quote-voiceover.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    // No overlayText — the quote and its gold rules are already baked into the card art.
    contextTag: "LEE'S LETTER TO G.W. CUSTIS LEE, 1861",
    captionLines: ['In his own letter, Lee wrote he could anticipate no greater calamity than the dissolution of the Union.'],
  },
  {
    id: 'slide4',
    image: 'slides/Lee-Resignation/04-arlington-house.jpg',
    audio: 'audio/lee-resignation-04-resignation-voiceover.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    overlayText: 'HE NEVER CAME HOME. THE UNION MADE IT A CEMETERY.',
    contextTag: "ARLINGTON HOUSE, LEE'S HOME",
    // Three sentences over 12.24s — split at sentence boundaries into sequential
    // chunks (word-count-proportional timing) rather than showing the full
    // paragraph on screen at once.
    captionLines: [
      'He refused the offer anyway, then resigned his commission three days after Virginia voted to secede.',
      'He never returned to live at Arlington.',
      'The Union turned his home into a national cemetery.',
    ],
  },
  {
    id: 'slide5',
    image: 'slides/Lee-Resignation/05-end-card-calamity.jpg',
    audio: 'audio/lee-resignation-05-endcard-voiceover.mp3',
    durationInSeconds: SLIDE5_AUDIO_S + PAD_S,
    // Standalone black end-card — no cliffhanger CTA text; card art already has the CTA.
    // No contextTag — matches the existing no-overlay end-card convention.
    // Single element (no chunk-timing split) with an embedded newline — rendered
    // as two simultaneous stacked lines via the caption's whiteSpace: 'pre-line'.
    captionLines: ['Comment CALAMITY\nfor the free PDF'],
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
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

// Small gold contextual tag — top left, single line, no box. Distinct element
// from the bottom caption/headline stack; omitted entirely on the end card.
function ContextTag({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        left: 40,
        color: '#C9A84C',
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: '0.06em',
        fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
        textShadow: '0 1px 6px rgba(0,0,0,0.9)',
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
}

// Picks the caption chunk active at `frame`, each chunk's on-screen window sized
// proportionally to its share of the total word count across `durationFrames`.
// A single-element array is simply active for the whole duration.
function useActiveCaption(lines: string[], durationFrames: number, frame: number) {
  const ranges = useMemo(() => {
    const wordCounts = lines.map((line) => line.split(/\s+/).filter(Boolean).length);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);
    let wordsSoFar = 0;
    let startFrame = 0;
    return lines.map((line, i) => {
      wordsSoFar += wordCounts[i];
      const endFrame = Math.round((wordsSoFar / totalWords) * durationFrames);
      const range = { line, startFrame, endFrame };
      startFrame = endFrame;
      return range;
    });
  }, [lines, durationFrames]);

  return (
    ranges.find((r) => frame >= r.startFrame && frame < r.endFrame) ??
    ranges[ranges.length - 1]
  ).line;
}

function SlidePanel({ slide, isFirst }: { slide: SlideConfig & { durationFrames: number }; isFirst: boolean }) {
  const frame = useCurrentFrame();
  const { durationFrames, overlayText, contextTag, captionLines } = slide;
  const activeCaption = useActiveCaption(captionLines, durationFrames, frame);
  const captionOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // QUICK STRIKES FORMAT: true cold open on slide 1 — full brightness at frame 0, no
  // fade-in. Slides 2+ get a 4-frame hard cut. No fade-out anywhere, hard cut ending.
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // Source images are already native 1080x1920 (exact canvas match), so a plain
  // object-fit:cover push-in is enough — no pan needed on any slide.
  const scale = interpolate(frame, [0, durationFrames], [1.0, 1.08], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const { ruleWidth, textOpacity } = useGoldOverlay(frame);

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
            transform: `scale(${scale})`,
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

      {contextTag && <ContextTag text={contextTag} />}

      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 48px 140px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ width: '100%' }}>
          {/* Burned-in caption, verbatim VO text — always present, sits directly
              above the gold rule (which doubles as the headline box's top rule
              below, when a headline is also present, exactly as it does on the
              existing NuclearKyoto composition this treatment is matched to). */}
          <div style={{ textAlign: 'center', marginBottom: 14, opacity: captionOpacity }}>
            <p
              style={{
                margin: 0,
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontWeight: 700,
                fontSize: 34,
                lineHeight: 1.3,
                color: '#FFFFFF',
                textShadow: '0 2px 10px rgba(0,0,0,0.9)',
                letterSpacing: '0.01em',
                whiteSpace: 'pre-line',
              }}
            >
              {activeCaption}
            </p>
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

          {overlayText && (
            <>
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
            </>
          )}
        </div>
      </AbsoluteFill>

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

export default function LeeResignationQS() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/lee-resignation-music.mp3')} volume={0.15} loop />

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
