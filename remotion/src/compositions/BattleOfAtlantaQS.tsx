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

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro, ffprobe-verified against the encoded
// MP3s -- see scripts/generateVoiceover-battle-of-atlanta.py). Single source
// of truth for every slide's durationInSeconds below and for caption/CTA
// timing.
const SLIDE1_AUDIO_S = 2.456;
const SLIDE2_AUDIO_S = 4.493;
const SLIDE3_AUDIO_S = 3.527;
const SLIDE4_AUDIO_S = 4.127;
const SLIDE5_AUDIO_S = 3.187; // end card VO

// Bull Run's published safe-zone nudge (BullRun1QS.tsx's
// BOTTOM_BLOCK_NUDGE_PX) -- the version Facebook did not flag as obstructing
// content. Reused verbatim rather than re-derived.
const BOTTOM_BLOCK_NUDGE_PX = 40;

type SlideConfig = SharedSlideConfig & {
  sourceWidth: number;
  sourceHeight: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/battle-of-atlanta/01-battle-of-atlanta-sherman.jpg',
    audio: 'audio/battle-of-atlanta-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: 'JULY 22, 1864',
    overlayText: "THE BATTLE OF ATLANTA DIDN'T TAKE ATLANTA",
    captionLines: ["The Battle of Atlanta didn't take Atlanta."],
    bottomOffset: BOTTOM_BLOCK_NUDGE_PX,
    // 1080x1920, aspect 0.5625 -- below PAN_FILL_ASPECT_THRESHOLD (1.2), Pan-Fill
    // resolves 'static' automatically (subtle push-in, no pan).
    sourceWidth: 1080,
    sourceHeight: 1920,
  },
  {
    id: 'slide2',
    image: 'slides/battle-of-atlanta/02-battle-of-atlanta-hood.jpg',
    audio: 'audio/battle-of-atlanta-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: 'LT. GEN. JOHN BELL HOOD',
    overlayText: 'CONFEDERATES BROKE THROUGH',
    captionLines: ['Confederate troops broke through the Union line and captured an artillery battery.'],
    bottomOffset: BOTTOM_BLOCK_NUDGE_PX,
    // 1080x1920, aspect 0.5625 -- static cover-fit, minimal drift.
    sourceWidth: 1080,
    sourceHeight: 1920,
  },
  {
    id: 'slide3',
    image: 'slides/battle-of-atlanta/03-battle-of-atlanta-rebelworks-pan.jpg',
    audio: 'audio/battle-of-atlanta-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: 'CONFEDERATE TRENCH LINE, OUTSIDE ATLANTA',
    overlayText: "ATLANTA DIDN'T FALL THAT DAY",
    captionLines: ['The city held out six more weeks, despite the Union victory.'],
    bottomOffset: BOTTOM_BLOCK_NUDGE_PX,
    // 2735x1965, aspect 1.392 -- at or above PAN_FILL_ASPECT_THRESHOLD (1.2),
    // Pan-Fill resolves 'pan' automatically. base_scale = 1920/1965 ~= 0.977,
    // panRoomPx ~= 1592, and PAN_FILL_RANGE_FRACTION (0.875) lands usable pan
    // distance at ~1393px -- inside the locked 85-90%-of-pan-room range this
    // slide calls for. Left-to-right per spec (opens on the cannon/trench,
    // drifts toward the tent camp depth).
    sourceWidth: 2735,
    sourceHeight: 1965,
    panDirection: 'ltr',
  },
  {
    id: 'slide4',
    image: 'slides/battle-of-atlanta/04-battle-of-atlanta-mcpherson.jpg',
    audio: 'audio/battle-of-atlanta-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    label: 'MAJ. GEN. JAMES B. MCPHERSON',
    overlayText: 'THE UNION LOST ITS COMMANDER',
    captionLines: ['McPherson never got to see any of it.', 'He was killed hours into the fight.'],
    bottomOffset: BOTTOM_BLOCK_NUDGE_PX,
    // 1080x1920, aspect 0.5625 -- static cover-fit, minimal drift.
    sourceWidth: 1080,
    sourceHeight: 1920,
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

// ---------------------------------------------------------------------------
// End card -- matches BullRun1QS's EndCard exactly (same shared EndCardCTA,
// same "Like. Save. Share." reveal, same CaptionOverlay-for-CTA-line
// pattern). Trigger word is SIXWEEKS, not the standing BLUEGRAY series
// trigger -- this video points to its own dedicated PDF ("5 Facts About the
// Battle of Atlanta"), not the standard BLUEGRAY lead magnet, so the subline
// is a one-off constant here rather than added to QuickStrikeConfig's shared
// BLUEGRAY entry (same pattern as SonTayQS's CTA_SUBLINE / GettysburgRetreatQS's
// CTA_SUBTITLE for their own dedicated-document CTAs).
// ---------------------------------------------------------------------------
const CTA_SUBLINE = 'COMMENT SIXWEEKS TO GET THE FREE "5 FACTS ABOUT THE BATTLE OF ATLANTA" PDF';

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
        triggerWord="SIXWEEKS"
        subline={CTA_SUBLINE}
        audio="audio/battle-of-atlanta-vo-05.mp3"
      />

      <CaptionOverlay
        lines={['Comment SIXWEEKS for the free Battle of Atlanta document.']}
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

export default function BattleOfAtlantaQS() {
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

      <Audio src={staticFile('audio/Gettysburg-Day1-music.mp3')} volume={0.15} loop />

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
