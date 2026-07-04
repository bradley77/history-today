import {
  AbsoluteFill,
  Audio,
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
  overlayText?: string;
  motion: Motion;
  captionLines?: string[];
  captionY?: number;
  topLabel?: string;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Gettysburg-Day3/01-hook-battlefield.jpg',
    audio: 'audio/gettysburg-day3-qs/gettysburg-day3-qs-vo-01.mp3',
    durationInSeconds: 6.032, // 5.632s actual + 0.4s pad
    overlayText: "THE UNION DIDN'T JUST HOLD THE LINE AT GETTYSBURG.",
    // Wide pan source: horizontal pan left to right across the full source width
    motion: { scaleFrom: 1.06, scaleTo: 1.08, txFrom: -55, txTo: 55, tyFrom: 0, tyTo: 0 },
    captionLines: [
      "The Union didn't just hold the line at Gettysburg.",
      'It took three broken Confederate plans to win it.',
    ],
    captionY: 1450,
    topLabel: 'CEMETERY RIDGE — GETTYSBURG, PA',
  },
  {
    id: 'slide2',
    image: 'slides/Gettysburg-Day3/02-day1recap-buford.jpg',
    audio: 'audio/gettysburg-day3-qs/gettysburg-day3-qs-vo-02.mp3',
    durationInSeconds: 4.027, // 3.627s actual + 0.4s pad
    overlayText: 'DAY ONE: LEE WENT IN BLIND.',
    // Push-in
    motion: { scaleFrom: 1.0, scaleTo: 1.05, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
    captionLines: [
      'Buford held the line.',
      "Lee's own cavalry was three days away.",
    ],
    captionY: 1450,
    topLabel: 'BRIG. GEN. JOHN BUFORD — U.S. CAVALRY',
  },
  {
    id: 'slide3',
    image: 'slides/Gettysburg-Day3/03-day2recap-longstreet-horse.jpg',
    audio: 'audio/gettysburg-day3-qs/gettysburg-day3-qs-vo-03.mp3',
    durationInSeconds: 5.584, // 5.184s actual + 0.4s pad
    overlayText: 'DAY TWO: THE LINE NEARLY BROKE.',
    // Pull-back
    motion: { scaleFrom: 1.05, scaleTo: 1.0, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
    captionLines: [
      'Longstreet nearly broke the Union left.',
      'The line held through last-minute reinforcements.',
    ],
    captionY: 1450,
    topLabel: 'LT. GEN. JAMES LONGSTREET — C.S.A.',
  },
  {
    id: 'slide4',
    image: 'slides/Gettysburg-Day3/04-day3setup-lee.jpg',
    audio: 'audio/gettysburg-day3-qs/gettysburg-day3-qs-vo-04.mp3',
    durationInSeconds: 5.136, // 4.736s actual + 0.4s pad
    overlayText: 'DAY THREE: ONE MORE ATTACK TO FINISH IT.',
    // Push-in
    motion: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
    captionLines: [
      'Lee ordered one more attack:',
      'a two hour bombardment to silence the guns first.',
    ],
    captionY: 1450,
    topLabel: 'GEN. ROBERT E. LEE — C.S.A.',
  },
  {
    // FIX: this slide's audio (Hunt ordering the guns quiet) now pairs with the
    // Hunt portrait image, not the manuscript. Motion follows the image: portrait
    // gets the pull-back treatment.
    id: 'slide5',
    image: 'slides/Gettysburg-Day3/06-huntreveal-hunt.jpg',
    audio: 'audio/gettysburg-day3-qs/gettysburg-day3-qs-vo-05.mp3',
    durationInSeconds: 5.819, // 5.419s actual + 0.4s pad
    overlayText: 'THE PLAN DEPENDED ON A TRICK.',
    // Pull-back
    motion: { scaleFrom: 1.05, scaleTo: 1.0, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
    captionLines: [
      'Union artillery chief Henry Hunt',
      'ordered many of his guns to go quiet,',
      'faking a knockout.',
    ],
    captionY: 1450,
    topLabel: 'COL. HENRY J. HUNT — U.S. ARTILLERY',
  },
  {
    // FIX: this slide's audio (Confederates believing the trick) now pairs with
    // the manuscript/dispatch image, not the Hunt portrait. Motion follows the
    // image: tall manuscript gets the vertical push-in toward the bottom line.
    id: 'slide6',
    image: 'slides/Gettysburg-Day3/05-huntreveal-manuscript.jpg',
    audio: 'audio/gettysburg-day3-qs/gettysburg-day3-qs-vo-06.mp3',
    durationInSeconds: 5.392, // 4.992s actual + 0.4s pad
    overlayText: 'CONFEDERATE GUNNERS BELIEVED IT.',
    // Tall source: vertical push-in toward the bottom of the page
    motion: { scaleFrom: 1.0, scaleTo: 1.15, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -90 },
    captionLines: [
      'Confederate artillery commanders believed',
      'many Union guns had already been silenced.',
    ],
    captionY: 1450,
    topLabel: 'BATTLEFIELD DISPATCH — JULY 3, 1863',
  },
  {
    id: 'slide7',
    image: 'slides/Gettysburg-Day3/07-collapse-engraving.jpg',
    audio: 'audio/gettysburg-day3-qs/gettysburg-day3-qs-vo-07.mp3',
    durationInSeconds: 7.355, // 6.955s actual + 0.4s pad
    overlayText: 'THE GUNS CAME BACK.',
    // Wide pan source: horizontal pan right to left (reversal of slide 1), faster velocity
    motion: { scaleFrom: 1.08, scaleTo: 1.1, txFrom: 100, txTo: -100, tyFrom: 0, tyTo: 0 },
    captionLines: [
      'The guns came back.',
      "Armistead's brigade briefly breached the wall,",
      'the deepest Confederate penetration of the line.',
    ],
    captionY: 1450,
    topLabel: "PICKETT'S CHARGE — THE ANGLE",
  },
  {
    id: 'slide8',
    image: 'slides/Gettysburg-Day3/08-resolution-meade.jpg',
    audio: 'audio/gettysburg-day3-qs/gettysburg-day3-qs-vo-08.mp3',
    durationInSeconds: 4.731, // 4.331s actual + 0.4s pad
    overlayText: 'THREE PLANS. THREE FAILURES.',
    // Push-in
    motion: { scaleFrom: 1.0, scaleTo: 1.05, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
    captionLines: [
      'Three plans, three failures.',
      "That's how the Union actually won Gettysburg.",
    ],
    captionY: 1450,
    topLabel: 'MAJ. GEN. GEORGE G. MEADE — U.S. ARMY OF THE POTOMAC',
  },
  {
    id: 'slide9',
    image: 'slides/Gettysburg-Day3/09-close-lincoln.jpg',
    audio: 'audio/gettysburg-day3-qs/gettysburg-day3-qs-vo-09.mp3',
    durationInSeconds: 4.944, // 4.544s actual + 0.4s pad
    overlayText: 'FOUR MONTHS LATER, HE TRIED TO EXPLAIN WHY IT MATTERED.',
    // Very slow, subtle push-in only — the emotional closing beat
    motion: { scaleFrom: 1.0, scaleTo: 1.03, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
    captionLines: [
      'Four months later, in this same town,',
      'Lincoln tried to explain why it mattered.',
    ],
    captionY: 1450,
    topLabel: 'PRESIDENT ABRAHAM LINCOLN',
  },
  {
    id: 'slide10',
    image: 'slides/Gettysburg-Day3/10-cta-endcard.jpg',
    audio: 'audio/gettysburg-day3-qs/gettysburg-day3-qs-vo-10.mp3',
    durationInSeconds: 5.477, // 5.077s actual + 0.4s pad
    // No overlayText / captionLines — the card art already has the closing
    // message baked in, so this slide plays audio only, no text layer on top.
    motion: { scaleFrom: 1.0, scaleTo: 1.0, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
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

// Closed captions — timed as sequential line-by-line chunks, each line's on-screen
// window sized proportionally to its share of the slide's total word count.
function CaptionOverlay({
  lines,
  durationFrames,
  top = 1600,
}: {
  lines: string[];
  durationFrames: number;
  top?: number;
}) {
  const frame = useCurrentFrame();

  const lineRanges = useMemo(() => {
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

  const active =
    lineRanges.find((r) => frame >= r.startFrame && frame < r.endFrame) ??
    lineRanges[lineRanges.length - 1];

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: 900,
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize: 38,
          fontWeight: 700,
          textAlign: 'center',
          padding: '10px 20px',
          borderRadius: 6,
        }}
      >
        {active.line}
      </div>
    </div>
  );
}

function SlidePanel({ slide, isFirst }: { slide: SlideConfig & { durationFrames: number }; isFirst: boolean }) {
  const frame = useCurrentFrame();
  const { motion, durationFrames, overlayText } = slide;

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

      {overlayText && (
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
      )}

      {slide.topLabel && (
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
          {slide.topLabel}
        </div>
      )}

      {slide.captionLines && (
        <CaptionOverlay lines={slide.captionLines} durationFrames={durationFrames} top={slide.captionY} />
      )}

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

export default function GettysburgDay3QS() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/Gettysburg-Day1-music.mp3')} volume={0.15} loop />

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
