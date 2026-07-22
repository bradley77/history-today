import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  CaptionOverlay,
  EndCardCTA,
  GOLD,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';
import { CTA_CONFIG } from '../shared/QuickStrikeConfig';

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro, ffprobe-verified against the encoded
// MP3s — see scripts/generateVoiceover-bull-run-1.py). Single source of truth
// for every slide's durationInSeconds below and for caption/CTA timing.
const SLIDE1_AUDIO_S = 3.056;
const SLIDE2_AUDIO_S = 4.989;
const SLIDE3_AUDIO_S = 4.101;
const SLIDE4_AUDIO_S = 4.702;
const SLIDE5_AUDIO_S = 2.769; // end card VO

// Persists identically across slides 1-4 (same battle, same date) rather than
// being re-worded per slide — matches the precedent in OperationFrequentWindQS
// (same USS Midway label repeated on both of its lead slides).
const LABEL = 'FIRST BATTLE OF BULL RUN · JULY 21, 1861';

// EXPERIMENTAL: nudges the bottom GoldLowerThird+CaptionOverlay block down
// past the normal y<=1580 safe-zone guarantee, deliberately, while iterating
// on how this looks. Small first pass — retune freely across rounds.
const BOTTOM_BLOCK_NUDGE_PX = 40;

type SlideConfig = SharedSlideConfig & {
  sourceWidth: number;
  sourceHeight: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Bullrun-1/01-congressional-spectators.jpg',
    audio: 'audio/bull-run-1-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: LABEL,
    overlayText: 'THE PICNIC BATTLE',
    captionLines: ['Congressmen packed picnic lunches to watch this battle.'],
    bottomOffset: BOTTOM_BLOCK_NUDGE_PX,
    // 5600x3365, aspect 1.664 — Pan-Fill resolves 'pan' automatically (>= 1.2).
    sourceWidth: 5600,
    sourceHeight: 3365,
  },
  {
    id: 'slide2',
    image: 'slides/Bullrun-1/02-stampede-retreat.jpg',
    audio: 'audio/bull-run-1-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: LABEL,
    overlayText: 'THE RETREAT BEGINS',
    captionLines: [
      'By four o’clock, even senators were fleeing with the army.',
      'One escaped on a stray mule.',
    ],
    bottomOffset: BOTTOM_BLOCK_NUDGE_PX,
    // 1520x1060, aspect 1.434 — Pan-Fill resolves 'pan' automatically.
    sourceWidth: 1520,
    sourceHeight: 1060,
  },
  {
    id: 'slide3',
    image: 'slides/Bullrun-1/03-sudley-ford-crossing.jpg',
    audio: 'audio/bull-run-1-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: LABEL,
    overlayText: 'CUB RUN BRIDGE',
    captionLines: ['An overturned wagon at Cub Run turned a retreat into a full rout.'],
    bottomOffset: BOTTOM_BLOCK_NUDGE_PX,
    // 7126x6104, aspect 1.167 — below PAN_FILL_ASPECT_THRESHOLD (1.2), Pan-Fill
    // resolves 'static' automatically. No manual override needed or given.
    sourceWidth: 7126,
    sourceHeight: 6104,
  },
  {
    id: 'slide4',
    image: 'slides/Bullrun-1/04-retreat-panic-teamsters.jpg',
    audio: 'audio/bull-run-1-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    label: LABEL,
    overlayText: 'TAKEN PRISONER',
    captionLines: [
      'Only one member of Congress reached Richmond that year.',
      'As a prisoner of war.',
    ],
    bottomOffset: BOTTOM_BLOCK_NUDGE_PX,
    // 1888x1225, aspect 1.541 — Pan-Fill resolves 'pan' automatically.
    sourceWidth: 1888,
    sourceHeight: 1225,
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

// ---------------------------------------------------------------------------
// End card — standalone black slide (no background image; slide 4 stays the
// clean payoff shot). Trigger word BLUEGRAY, subline pulled from CTA_CONFIG
// (not hardcoded). "Like. Save. Share." is silent, always-on text beneath the
// subline, same pattern as TrinityTestQS/OperationFrequentWindQS end cards.
// ---------------------------------------------------------------------------
const SLIDE5_DURATION_S = SLIDE5_AUDIO_S + PAD_S;
const SLIDE5_FRAMES = Math.round(SLIDE5_DURATION_S * FPS);
const SLIDE5_AUDIO_FRAMES = Math.round(SLIDE5_AUDIO_S * FPS);

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
      <EndCardCTA
        triggerWord="BLUEGRAY"
        subline={CTA_CONFIG.BLUEGRAY.subline}
        audio="audio/bull-run-1-vo-05.mp3"
      />

      <CaptionOverlay
        lines={['Comment BLUEGRAY for the free Civil War document.']}
        audioDurationFrames={SLIDE5_AUDIO_FRAMES}
        top={200}
      />

      {/* Silent-viewer text, no VO */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 40px 340px',
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

export const totalDuration =
  slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0) + SLIDE5_FRAMES;
export { FPS };

export default function BullRun1QS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });
  const slide5From = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/LincolnFortStevens-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <SlidePanel slide={slide} isFirst={i === 0} />
        </Sequence>
      ))}

      <Sequence from={slide5From} durationInFrames={SLIDE5_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
