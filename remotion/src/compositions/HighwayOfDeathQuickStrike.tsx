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
  // Actual VO file duration (measured via Kokoro) + 0.4s pad
  durationInSeconds: number;
  // Actual VO file duration only, no pad — captions are scoped to this so they
  // finish when the speech finishes rather than lingering into the trailing pad.
  audioDurationSeconds: number;
  overlayText?: string;
  motion: Motion;
  // When the foreground can pull back below cover-fit scale (revealing gaps at the edges),
  // render a blurred/darkened full-bleed copy of the same image behind it to fill those gaps.
  hasBlurBackground?: boolean;
  // Closed captions — mirrors the voiceover script (not overlayText), shown as sequential
  // line-by-line chunks timed proportionally to each line's share of the slide's word count.
  captionLines?: string[];
  captionY?: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/highway-of-death/01-a6e-intruder.jpg',
    audio: 'audio/highway-of-death-slide1-voiceover.mp3',
    durationInSeconds: 6.928, // 6.528s actual + 0.4s pad
    audioDurationSeconds: 6.528,
    overlayText: "They called this the 'clean war.'",
    // Real file is 2720x1920 (height already matches the 1920 frame height, confirmed via
    // direct pixel check) — NOT 2204x1556. Same aspect ratio, different export resolution, so
    // cover-fit for the ACTUAL file is 1.0 in this height:100%-normalized rendering, not 1.234
    // (1.234 = 1920/1556, a ratio that only applies to the assumed-but-wrong source height).
    // Pulled back to an absolute starting scale that shows the full nose-to-tail span within
    // the 1080px frame width (1080/2720 = 0.397, rounded down slightly for a hair of margin),
    // zooming to a moderate (not tight) close-up on the cockpit by the end. No pan.
    // A FIXED cockpit anchor (25%/48%) breaks the wide opening frame: scaling down around an
    // off-center point pushes the far side of the anchor out of frame entirely — verified via
    // render, the nose disappeared off the left edge at scale 0.42, leaving only the tail two-
    // thirds visible. Animating transform-origin toward the nose doesn't work either: for this
    // 2720px-wide native image in a 1080px frame, any origin fraction below ~30% computes to a
    // screen position that's already off-screen-left before any scaling — the visible window
    // can approach but never pass that anchor, so 13% and 25% produce nearly the same framing
    // (verified via render). Panning with translateX instead — same mechanism as slide 2 — is
    // what actually shifts the visible window. Center-anchored the whole time; ease-in-out-cubic
    // (matching slide 2) so scale and pan both read as gradual throughout.
    motion: {
      scaleFrom: 0.42, scaleTo: 0.75, txFrom: 0, txTo: 650, tyFrom: 0, tyTo: 0,
      easing: 'easeInOutCubic',
    },
    hasBlurBackground: true,
    captionLines: [
      'One strike turned it into a one-sided slaughter.',
      'Marine Corps jets boxed in both ends with cluster bombs.',
    ],
    captionY: 1450,
  },
  {
    id: 'slide2',
    image: 'slides/highway-of-death/02-aerial-wreckage.jpg',
    audio: 'audio/highway-of-death-slide2-voiceover.mp3',
    durationInSeconds: 3.621, // 3.221s actual + 0.4s pad
    audioDurationSeconds: 3.221,
    overlayText: 'Thousands of vehicles. Nowhere left to go.',
    // base_scale 1.038 — slowed sweep pan (~750px total), strong cubic ease-in-out so the
    // middle of the pan reads as visibly slower, not just the start/end.
    motion: { scaleFrom: 1.038, scaleTo: 1.038, txFrom: -375, txTo: 375, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    captionLines: ['For ten hours, aircraft hit everything trapped in between.'],
    captionY: 1450,
  },
  {
    id: 'slide3',
    image: 'slides/highway-of-death/03-t55-burned-car.jpg',
    audio: 'audio/highway-of-death-slide3-voiceover.mp3',
    durationInSeconds: 4.880, // 4.480s actual + 0.4s pad
    audioDurationSeconds: 4.480,
    overlayText: 'Soldiers, looted cars, and civilians caught in the destruction.',
    // Cover-fit for this source is only ~1.011 (its aspect ratio nearly matches the 1080x1920
    // target already), so a scale relative to cover-fit (e.g. 0.88x that) barely pulls back at
    // all. Use an absolute starting scale well below cover-fit instead, for a genuinely wide
    // opening view (tank, car, trees, ground context) that zooms to a moderate close-up —
    // never as tight as a full cover-fit crop. No pan. Cubic ease-in-out (same strength as
    // slide 2's pan) so the zoom reads as slower, not just shorter.
    // The foreground doesn't cover the frame at these scales, so this slide also gets the
    // blurred full-bleed background (see hasBlurBackground below).
    motion: { scaleFrom: 0.60, scaleTo: 0.80, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    hasBlurBackground: true,
    captionLines: [
      'The death toll is still disputed.',
      'President Bush called a ceasefire the next day.',
    ],
    captionY: 1450,
  },
  {
    id: 'slide4',
    image: 'slides/highway-of-death/04-cta-blackcard.jpg',
    audio: 'audio/highway-of-death-slide4-voiceover.mp3',
    durationInSeconds: 3.664, // 3.264s actual + 0.4s pad
    audioDurationSeconds: 3.264,
    // No overlayText — CTA text is already baked into the card art.
    motion: { scaleFrom: 1.0, scaleTo: 1.0, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
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
  // Slides 2+ get a 4-frame hard cut. No fade-out anywhere, hard cut ending.
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <KenBurnsImage
        image={slide.image}
        frame={frame}
        durationFrames={durationFrames}
        motion={motion}
        hasBlurBackground={slide.hasBlurBackground}
      />
      <Vignette />

      {overlayText && <GoldLowerThird text={overlayText} frame={frame} />}

      {slide.captionLines && (
        <CaptionOverlay
          lines={slide.captionLines}
          audioDurationFrames={slide.audioDurationFrames}
          top={slide.captionY}
        />
      )}

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

export default function HighwayOfDeathQuickStrike() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/highway-of-death-music.mp3')} volume={0.15} loop />

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
