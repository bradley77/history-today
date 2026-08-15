import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  GOLD,
  SlidePanel,
} from '../shared/QuickStrikeShared';

// ---------------------------------------------------------------------------
// Nuremberg / Göring — FRONT Quick Strike. Locked three-slide script (see
// scripts/generateVoiceover-nuremberg-goering.py for the Kokoro VO source,
// am_adam @ 0.95, en-us). Durations below are ffprobe-measured actual VO
// length + the standard 0.4s pad, matching every other composition on this
// shared engine.
// ---------------------------------------------------------------------------

const PAD_S = 0.4;

const SLIDE1_AUDIO_S = 4.937143; // re-measured after the "Nuremberg" phoneme-splice pronunciation fix (was 5.250612)
const SLIDE2_AUDIO_S = 5.982041;
const SLIDE3_AUDIO_S = 4.832653;

const SLIDES = [
  {
    id: 'slide1',
    image: 'slides/Nuremberg-Goering/01-landing.jpg',
    audio: 'audio/nuremberg-goering-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: 'HERMANN GÖRING',
    overlayText: 'NUREMBERG, 1946',
    captionLines: [
      'The lead prosecutor at Nuremberg',
      'was supposed to destroy Hermann Göring on the stand.',
    ],
    // Static crop, no Ken Burns — locked per spec: all three slides are
    // short-duration and stay dead still, no pan/zoom anywhere.
    motion: { scaleFrom: 1, scaleTo: 1, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide2',
    image: 'slides/Nuremberg-Goering/02-jackson.jpg',
    audio: 'audio/nuremberg-goering-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: 'ROBERT H. JACKSON',
    overlayText: 'GÖRING TAKES CONTROL',
    captionLines: [
      'Instead Göring outwitted him for three days,',
      "once mocking America's own secrecy in open court.",
    ],
    motion: { scaleFrom: 1, scaleTo: 1, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
  {
    id: 'slide3',
    image: 'slides/Nuremberg-Goering/03-fyfe.jpg',
    audio: 'audio/nuremberg-goering-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: 'DAVID MAXWELL FYFE',
    overlayText: 'THE TURNING POINT',
    captionLines: [
      'It took a British lawyer to finally rattle him,',
      "and sweat broke out on Göring's brow.",
    ],
    motion: { scaleFrom: 1, scaleTo: 1, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card — text-only, no CTA. FRONT's DM-funnel automation is off for this
// video: no trigger word, no "Comment ___" prompt, no VO. QuickStrikeShared's
// EndCardCTA always renders that "Comment [TRIGGER]" structure (triggerWord
// is a required prop, unconditionally rendered under a "Comment" line — see
// CIAHeartAttackGun.jsx's own local end card for the established precedent of
// staying local for a trigger-word-free banner instead of forcing EndCardCTA
// into a shape it doesn't support). So this stays a small local component;
// QuickStrikeShared.tsx itself is untouched.
// ---------------------------------------------------------------------------

const END_CARD_DURATION_S = 2.3; // within the requested 2–2.5s window
const END_CARD_DURATION = Math.round(END_CARD_DURATION_S * FPS); // 69 frames

function EndCard() {
  const frame = useCurrentFrame();

  // Hard cut in from slide 3, same 4-frame ramp used everywhere else on this
  // engine — no fade.
  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ruleWidth = interpolate(frame, [8, 33], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{ background: '#000', opacity, justifyContent: 'center', alignItems: 'center' }}
    >
      <div style={{ width: '80%', maxWidth: 900 }}>
        <div style={{ height: 3, background: GOLD, width: `${ruleWidth}%`, marginBottom: 28 }} />

        <div
          style={{
            opacity: textOpacity,
            color: '#F5F0E8',
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            fontWeight: 700,
            fontSize: 48,
            lineHeight: 1.3,
            textAlign: 'center',
            textShadow: '0 2px 14px rgba(0,0,0,0.95)',
          }}
        >
          Follow for more history they didn't teach you.
        </div>

        <div style={{ height: 3, background: GOLD, width: `${ruleWidth}%`, marginTop: 28 }} />
      </div>
    </AbsoluteFill>
  );
}

export const totalDuration = slidesDuration + END_CARD_DURATION;
export { FPS };

export default function NurembergGoering() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Music bed matched to LeeResignationQS per direction, 0.15 volume,
          loops under the whole composition — including the end card. NOTE:
          this track (audio/lee-resignation-music.mp3) is not the WWII-era
          standard bed used elsewhere on this engine (TokyoFirebombing-music.mp3,
          shared by TokyoFirebombing/NuclearKyoto/GuadalcanalQS/BattleOfTheBulgeQS)
          — it's shared between LeeResignationQS and LittleBighornQS, both
          19th-century American conflict pieces (Civil War / Plains Indian
          Wars), not WWII. Flagged for a mood sanity-check against a 1946
          Nuremberg courtroom piece before this gets locked in. */}
      <Audio src={staticFile('audio/lee-resignation-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => {
        const from = offset;
        offset += slide.durationFrames;
        return (
          <Sequence key={slide.id} from={from} durationInFrames={slide.durationFrames} layout="none">
            <SlidePanel slide={slide} isFirst={i === 0} />
          </Sequence>
        );
      })}

      <Sequence from={slidesDuration} durationInFrames={END_CARD_DURATION} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
