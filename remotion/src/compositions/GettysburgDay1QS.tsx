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
  // Actual VO file duration (measured via ffprobe) + 0.4s pad
  durationInSeconds: number;
  overlayText: string;
  motion: Motion;
  captionLines: string[];
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Gettysburg-Day1/01-buford.jpg',
    audio: 'audio/gettysburg-day1-qs/gettysburg-day1-qs-vo-01.mp3',
    durationInSeconds: 8.237, // 7.837s actual + 0.4s pad
    overlayText: "THIS MAN WON DAY ONE AT GETTYSBURG. THE UNION ARMY DIDN'T KNOW IT YET.",
    // Slow zoom in toward face, slight pan up
    motion: { scaleFrom: 1.0, scaleTo: 1.08, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -20 },
    captionLines: [
      'This man won Day One at Gettysburg.',
      "The Union army didn't know it yet —",
      'because at that moment, they were fleeing',
      'through the streets of the town.',
    ],
  },
  {
    id: 'slide2',
    image: 'slides/Gettysburg-Day1/02-cemetery-view.jpg',
    audio: 'audio/gettysburg-day1-qs/gettysburg-day1-qs-vo-02.mp3',
    durationInSeconds: 8.341, // 7.941s actual + 0.4s pad
    overlayText: 'NINE THOUSAND UNION CASUALTIES. ONE AFTERNOON.',
    // Pan left to right across the town
    motion: { scaleFrom: 1.06, scaleTo: 1.06, txFrom: -30, txTo: 30, tyFrom: 0, tyTo: 0 },
    captionLines: [
      'Nine thousand Union casualties in a single afternoon.',
      'Routed north and west of town, they broke and ran.',
      'But they ran uphill.',
    ],
  },
  {
    id: 'slide3',
    image: 'slides/Gettysburg-Day1/03-cemetery-gate.jpg',
    audio: 'audio/gettysburg-day1-qs/gettysburg-day1-qs-vo-03.mp3',
    durationInSeconds: 9.882, // 9.482s actual + 0.4s pad
    overlayText: 'THEY RAN TO THE STRONGEST GROUND ON THE BATTLEFIELD.',
    // Slow zoom in toward the arch, slight pan up
    motion: { scaleFrom: 1.0, scaleTo: 1.08, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -20 },
    captionLines: [
      'To Cemetery Hill —',
      'the strongest ground on the battlefield.',
      'Confederates held the town,',
      'Union held the high ground.',
      'Buford bought the time that let them take it.',
    ],
  },
  {
    id: 'slide4',
    image: 'slides/Gettysburg-Day1/04-cta.jpg',
    audio: 'audio/gettysburg-day1-qs/gettysburg-day1-qs-vo-04.mp3',
    durationInSeconds: 2.438, // 2.038s actual + 0.4s pad
    overlayText: 'DAY TWO. TOMORROW.',
    // Static zoom only, no pan
    motion: { scaleFrom: 1.0, scaleTo: 1.02, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
    captionLines: ['Day Two at Gettysburg — tomorrow.'],
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
function CaptionOverlay({ lines, durationFrames }: { lines: string[]; durationFrames: number }) {
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
        top: 1520,
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
  // Slides 2+ get a 4-frame hard cut.
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

      <CaptionOverlay lines={slide.captionLines} durationFrames={durationFrames} />

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

export default function GettysburgDay1QS() {
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
