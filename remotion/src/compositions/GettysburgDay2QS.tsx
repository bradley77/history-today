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
  captionY?: number;
  cornerLabel?: string;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Gettysburg-Day2/01-longstreet.jpg',
    audio: 'audio/gettysburg-day2-qs/gettysburg-day2-qs-vo-01.mp3',
    durationInSeconds: 8.211, // 7.811s actual + 0.4s pad
    overlayText: "LEE WON DAY ONE. HIS TOP GENERAL DIDN'T AGREE WITH THE PLAN.",
    // Slow zoom in toward face, slight pan up
    motion: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -20 },
    captionLines: [
      'Lee held the town after Day One.',
      'The high ground belonged to the North.',
      'Lee had a plan to take it.',
      'His general had a different idea.',
    ],
    captionY: 1450,
    cornerLabel: 'LT. GEN. JAMES LONGSTREET — C.S.A.',
  },
  {
    id: 'slide2',
    image: 'slides/Gettysburg-Day2/02-lee.jpg',
    audio: 'audio/gettysburg-day2-qs/gettysburg-day2-qs-vo-02.mp3',
    durationInSeconds: 11.633, // 11.233s actual + 0.4s pad
    overlayText: 'LEE WANTED AN EARLY ATTACK. LONGSTREET WANTED A DIFFERENT WAR.',
    // Slow zoom in toward face, slight pan right
    motion: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 20, tyFrom: 0, tyTo: 0 },
    captionLines: [
      'Lee intended to strike early on July second.',
      'Longstreet pushed back —',
      'arguing they should force Meade to come to them.',
      'Lee said no.',
      "The assault didn't begin until four in the afternoon.",
    ],
    captionY: 1450,
    cornerLabel: 'GEN. ROBERT E. LEE — C.S.A.',
  },
  {
    id: 'slide3',
    image: 'slides/Gettysburg-Day2/03-devilsden-bw.jpg',
    audio: 'audio/gettysburg-day2-qs/gettysburg-day2-qs-vo-03.mp3',
    durationInSeconds: 10.98, // 10.58s actual + 0.4s pad
    overlayText: 'THE UNION HELD. BY MINUTES.',
    // Pan left to right across the boulders
    motion: { scaleFrom: 1.06, scaleTo: 1.08, txFrom: -30, txTo: 30, tyFrom: 0, tyTo: 0 },
    captionLines: [
      "At Devil's Den, the Peach Orchard,",
      'and Little Round Top —',
      'these key positions had barely been occupied',
      'before the Confederates arrived.',
      'The Union line held by minutes, not hours.',
    ],
    captionY: 1450,
  },
  {
    id: 'slide4',
    image: 'slides/Gettysburg-Day2/04-cta.jpg',
    audio: 'audio/gettysburg-day2-qs/gettysburg-day2-qs-vo-04.mp3',
    durationInSeconds: 2.49, // 2.09s actual + 0.4s pad
    overlayText: 'DAY THREE. TOMORROW.',
    // Static, no Ken Burns needed
    motion: { scaleFrom: 1.0, scaleTo: 1.0, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
    captionLines: ['Day three at Gettysburg — tomorrow.'],
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

      {slide.cornerLabel && (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: 40,
            color: '#C9A84C',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.06em',
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            opacity: textOpacity,
            pointerEvents: 'none',
          }}
        >
          {slide.cornerLabel}
        </div>
      )}

      <CaptionOverlay lines={slide.captionLines} durationFrames={durationFrames} top={slide.captionY} />

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

export default function GettysburgDay2QS() {
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
