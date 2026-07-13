import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  KenBurnsImage,
  Vignette,
  GoldLowerThird,
  CaptionOverlay,
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
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Gettysburg-Day1/01-buford.jpg',
    audio: 'audio/gettysburg-day1-qs/gettysburg-day1-qs-vo-01.mp3',
    durationInSeconds: 8.237, // 7.837s actual + 0.4s pad
    audioDurationSeconds: 7.837,
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
    audioDurationSeconds: 7.941,
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
    audioDurationSeconds: 9.482,
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
    audioDurationSeconds: 2.038,
    overlayText: 'DAY TWO. TOMORROW.',
    // Static zoom only, no pan
    motion: { scaleFrom: 1.0, scaleTo: 1.02, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
    captionLines: ['Day Two at Gettysburg — tomorrow.'],
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

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <KenBurnsImage image={slide.image} frame={frame} durationFrames={durationFrames} motion={motion} />
      <Vignette />

      <GoldLowerThird text={overlayText} frame={frame} />

      <CaptionOverlay
        lines={slide.captionLines}
        audioDurationFrames={slide.audioDurationFrames}
        top={1520}
      />

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
