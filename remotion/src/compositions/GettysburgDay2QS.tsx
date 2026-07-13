import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  KenBurnsImage,
  Vignette,
  GoldLowerThird,
  ContextTag,
  CaptionOverlay,
  useGoldOverlay,
  type Motion,
} from '../shared/QuickStrikeShared';

type SlideConfig = {
  id: string;
  image: string;
  audio: string;
  // Actual VO file duration (measured via ffprobe) + 0.4s pad
  durationInSeconds: number;
  // Actual VO file duration only, no pad — captions are scoped to this so they
  // finish when the speech finishes rather than lingering into the trailing pad.
  audioDurationSeconds: number;
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
    audioDurationSeconds: 7.811,
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
    audioDurationSeconds: 11.233,
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
    audioDurationSeconds: 10.58,
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
    audioDurationSeconds: 2.09,
    overlayText: 'DAY THREE. TOMORROW.',
    // Static, no Ken Burns needed
    motion: { scaleFrom: 1.0, scaleTo: 1.0, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
    captionLines: ['Day three at Gettysburg — tomorrow.'],
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

export const totalDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);
export { FPS };

function SlidePanel({
  slide,
  isFirst,
}: {
  slide: SlideConfig & { durationFrames: number; audioDurationFrames: number };
  isFirst: boolean;
}) {
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

  const { textOpacity } = useGoldOverlay(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <KenBurnsImage image={slide.image} frame={frame} durationFrames={durationFrames} motion={motion} />
      <Vignette />

      <GoldLowerThird text={overlayText} frame={frame} />

      {slide.cornerLabel && (
        <ContextTag text={slide.cornerLabel} position="bottom-left" opacity={textOpacity} />
      )}

      <CaptionOverlay
        lines={slide.captionLines}
        audioDurationFrames={slide.audioDurationFrames}
        top={slide.captionY}
      />

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
