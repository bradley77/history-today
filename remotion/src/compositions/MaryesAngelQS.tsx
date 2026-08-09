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

// Angel of Marye's Heights — BLUEGRAY-family Civil War Quick Strike.
// Trigger word: MARYESANGEL.
//
// Locked decisions from the build brief:
//   - No fades anywhere: true cold open at frame 0 (SlidePanel's isFirst
//     prop), 4-frame hard cut on every other slide including the CTA
//     transition, no fade to black at the end.
//   - Per-slide audio only (one <Audio> per Sequence, own local frame 0) —
//     no continuous/concatenated track. Matches every QuickStrike built on
//     this shared engine.
//   - Pan-Fill System (sourceWidth/sourceHeight on every slide) drives the
//     Ken Burns treatment instead of hand-tuned motion — see LostOrdersQS.tsx
//     / AntietamQS.tsx for the same convention.
//   - Slide 1 is a deliberately calm wide establishing shot (not a
//     casualty/carnage photo) — the gold ContextTag carries the location ID
//     instead.

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified —
// see scripts/generateVoiceover-maryesangel.py).
const SLIDE1_AUDIO_S = 4.075;
const SLIDE2_AUDIO_S = 6.635;
const SLIDE3_AUDIO_S = 7.367;
const CTA_AUDIO_S = 4.049;

type SlideConfig = SharedSlideConfig & {
  sourceWidth: number;
  sourceHeight: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Fredericksburg/01-battlefield.jpg',
    audio: 'audio/01-battlefield.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: "MARYE'S HEIGHTS, FREDERICKSBURG",
    overlayText: 'SCREAMS FOR WATER, ALL NIGHT',
    captionLines: [
      'All night, wounded men',
      'scream for water',
      'between the lines',
      'at Fredericksburg.',
    ],
    // 6955x4745, aspect 1.466 — above PAN_FILL_ASPECT_THRESHOLD (1.2), so
    // 'auto' would already resolve 'pan'; set explicitly per the wide
    // establishing-shot brief for this slide.
    sourceWidth: 6955,
    sourceHeight: 4745,
    panFillMode: 'pan',
    panDirection: 'ltr',
  },
  {
    id: 'slide2',
    image: 'slides/Fredericksburg/02-stonewall.jpg',
    audio: 'audio/02-stonewall.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    overlayText: 'THE STONE WALL',
    captionLines: [
      "A Confederate sergeant can't take it.",
      'He climbs the wall unarmed,',
      'carrying water to wounded Union soldiers.',
    ],
    // 2940x2656, aspect 1.107 — below PAN_FILL_ASPECT_THRESHOLD (1.2), so
    // 'auto' would already resolve 'static'; set explicitly.
    sourceWidth: 2940,
    sourceHeight: 2656,
    panFillMode: 'static',
  },
  {
    id: 'slide3',
    image: 'slides/Fredericksburg/03-kirkland-monument.jpg',
    audio: 'audio/03-kirkland-monument.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    overlayText: 'RICHARD KIRKLAND',
    captionLines: [
      'Later accounts describe both sides',
      'holding their fire to let him work.',
      'Amid all that bloodshed,',
      'humanity still existed.',
    ],
    // 2060x2348, aspect 0.877 — below PAN_FILL_ASPECT_THRESHOLD (1.2), so
    // 'auto' would already resolve 'static'; set explicitly.
    sourceWidth: 2060,
    sourceHeight: 2348,
    panFillMode: 'static',
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card — standalone black slide (no background image). Trigger word
// MARYESANGEL, subline pulled from CTA_CONFIG.MARYESANGEL (existing 5-Fact
// Civil War PDF, no new document needed). "Like. Save. Share." is silent,
// always-on text beneath the subline, same pattern as every other recent
// Civil War end card (LostOrdersQS, BattleOfAtlantaQS). Does not count
// against narrative runtime — its own Sequence, appended after
// slidesDuration, same as every other QuickStrike built on this engine.
// ---------------------------------------------------------------------------
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
      <EndCardCTA
        triggerWord="MARYESANGEL"
        subline={CTA_CONFIG.MARYESANGEL.subline}
        audio="audio/04-endcard.mp3"
      />

      <CaptionOverlay
        lines={['Comment MARYESANGEL for the free five fact Civil War PDF.']}
        audioDurationFrames={CTA_AUDIO_FRAMES}
        top={200}
      />

      {/* Silent-viewer text, no VO */}
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

export const totalDuration = slidesDuration + CTA_FRAMES;
export { FPS };

export default function MaryesAngelQS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });
  // CTA starts exactly where the last narrative slide ends (audio + 0.4s
  // pad) — `offset` here is the running total after slide 3, the same
  // accumulator every other Sequence's `from` is derived from, so there is
  // no gap or overlap by construction.
  const ctaFrom = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/LincolnFortStevens-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <SlidePanel slide={slide} isFirst={i === 0} />
        </Sequence>
      ))}

      <Sequence from={ctaFrom} durationInFrames={CTA_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
