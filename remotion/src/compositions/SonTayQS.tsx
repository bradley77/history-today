import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { useMemo } from 'react';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  KenBurnsImage,
  Vignette,
  GoldLowerThird,
  CaptionOverlay,
  EndCardCTA,
  GOLD,
  computeFloorAwareHeadlineFit,
  type Motion,
} from '../shared/QuickStrikeShared';

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified).
// Slide 2 was shortened from the original script (dropped the spoken date,
// since the overlay text already carries "NOV 21, 1970 — SON TAY, NORTH
// VIETNAM") to bring the composition under the 30s runtime ceiling.
const SLIDE1_AUDIO_S = 5.851;
const SLIDE2_AUDIO_S = 5.303;
const SLIDE3_AUDIO_S = 5.695;
const SLIDE4_AUDIO_S = 7.314;
const CTA_AUDIO_S = 2.952;

type SlideConfig = {
  id: string;
  image: string;
  audio: string;
  durationInSeconds: number;
  audioDurationSeconds: number;
  overlayText: string;
  captionLines: string[];
  motion: Motion;
  // y-coordinate where this slide's sharp (non-blurred) image content ends,
  // per the original blur-border-fill composite — not derived from Ken Burns
  // scale (see CaptionOverlay's sharpContentBottomY doc in QuickStrikeShared).
  sharpContentBottomY: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/son-tay/01-raiders.jpg',
    audio: 'audio/son-tay-slide-1.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    overlayText: 'THEY RAIDED AN EMPTY PRISON. EVERY MAN CAME HOME.',
    captionLines: ['Fifty-six men raided a prison in enemy territory and found it empty.', 'Every man came home.'],
    motion: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    sharpContentBottomY: 1389,
  },
  {
    id: 'slide2',
    image: 'slides/son-tay/02-wreckage-compound.jpg',
    audio: 'audio/son-tay-slide-2.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    overlayText: 'NOV 21, 1970 — SON TAY, NORTH VIETNAM',
    captionLines: ['Green Berets crash-landed inside Son Tay prison', 'to free American POWs.'],
    motion: { scaleFrom: 1.0, scaleTo: 1.08, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    sharpContentBottomY: 744,
  },
  {
    id: 'slide3',
    image: 'slides/son-tay/03-equipment.jpg',
    audio: 'audio/son-tay-slide-3.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    overlayText: 'THE POWS HAD ALREADY BEEN MOVED',
    captionLines: ['The prisoners had already been moved.', 'Raiders fought through dozens of armed troops to clear the compound.'],
    motion: { scaleFrom: 1.0, scaleTo: 1.05, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    sharpContentBottomY: 753,
  },
  {
    id: 'slide4',
    image: 'slides/son-tay/04-raiders-return.jpg',
    audio: 'audio/son-tay-slide-4.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    overlayText: '2 INJURIES. ZERO DEATHS.',
    // Third sentence split across two display chunks (same words, no rewording)
    // — as one chunk it doesn't fit on a single line even at CAPTION_MIN_FONT_SIZE
    // within the room available between this slide's sharpContentBottomY floor
    // and the headline above.
    captionLines: [
      'Two injuries. No one was killed.',
      'It remains one of the most precisely executed raids',
      'in American military history.',
    ],
    motion: { scaleFrom: 1.0, scaleTo: 1.08, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    sharpContentBottomY: 1389,
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card. Trigger word RECON. This video's subline is campaign-specific
// (points at the 5-fact Vietnam PDF lead magnet), not the shared
// CTA_CONFIG.RECON.subline used by BattleOfHue/OperationFrequentWindQS — so
// it's passed as a literal here rather than pulled from QuickStrikeConfig,
// to avoid changing the subline on those other videos.
// VO is limited to the comment-trigger line only (Max Alignment rule); the
// trigger word and "Like. Save. Share." are silent, always-on text.
// ---------------------------------------------------------------------------
const CTA_SUBLINE = '5 THINGS THE U.S. GOVERNMENT DID IN VIETNAM NOBODY TAUGHT YOU';
const CTA_DURATION_S = CTA_AUDIO_S + PAD_S;
const CTA_FRAMES = Math.round(CTA_DURATION_S * FPS);
const CTA_AUDIO_FRAMES = Math.round(CTA_AUDIO_S * FPS);

function EndCard() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const likeSaveShareOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <EndCardCTA triggerWord="RECON" subline={CTA_SUBLINE} audio="audio/son-tay-cta.mp3" />

      <CaptionOverlay
        lines={['Comment RECON for the free Vietnam document.']}
        audioDurationFrames={CTA_AUDIO_FRAMES}
        top={200}
      />

      {/* Silent-viewer text, no VO — Max Alignment rule */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 40px 90px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            opacity: likeSaveShareOpacity,
            color: GOLD,
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            fontSize: 26,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Like. Save. Share.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Standard slide panel — image + vignette + gold-rule headline + captions +
// audio, true cold open on slide 1 and a 4-frame hard cut on every slide
// after that. No fades anywhere, hard cut ending — locked Quick Strike spec.
// ---------------------------------------------------------------------------
function SlidePanel({
  slide,
  isFirst,
}: {
  slide: SlideConfig & { durationFrames: number; audioDurationFrames: number };
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();
  const { motion, durationFrames, overlayText } = slide;

  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // sharpContentBottomY is a hard floor for the caption below — if the
  // headline at its default size would leave no room above that floor, this
  // shrinks the HEADLINE instead (never the caption off its floor). Computed
  // once per slide (not per-frame) so the headline never resizes mid-slide.
  const { fontSize: headlineFontSize, lineHeight: headlineLineHeight } = useMemo(
    () =>
      computeFloorAwareHeadlineFit({
        overlayText,
        captionLines: slide.captionLines,
        sharpContentBottomY: slide.sharpContentBottomY,
      }),
    [overlayText, slide.captionLines, slide.sharpContentBottomY],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <KenBurnsImage image={slide.image} frame={frame} durationFrames={durationFrames} motion={motion} />
      <Vignette />

      <GoldLowerThird text={overlayText} frame={frame} fontSize={headlineFontSize} lineHeight={headlineLineHeight} />

      <CaptionOverlay
        lines={slide.captionLines}
        audioDurationFrames={slide.audioDurationFrames}
        sharpContentBottomY={slide.sharpContentBottomY}
        overlayText={overlayText}
        headlineFontSize={headlineFontSize}
        headlineLineHeight={headlineLineHeight}
      />

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

export const totalDuration = slidesDuration + CTA_FRAMES;
export { FPS };

export default function SonTayQS() {
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

      <Sequence from={slidesDuration} durationInFrames={CTA_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
