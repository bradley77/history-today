import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  GOLD,
  SlidePanel,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// Eisenhower Photographed the Evidence — one-off Quick Strike (WWII/Nuremberg),
// following GrantsMemoirsQS/HessAmnesiaQS/HancocksLineQS's pattern: shared
// SlidePanel engine for all 4 content slides, the established no-trigger-word
// silent end card ported verbatim (see below).
//
// Locked decisions from the build brief:
//   - True cold open: slide 1 fully visible at full brightness from frame 0,
//     no fade-in (isFirst, handled by shared SlidePanel). 4-frame hard cut on
//     every transition after that, INCLUDING into the end card. No fade-out
//     anywhere — hard cut ending.
//   - Per-slide audio only (one <Audio> per Sequence, own local frame 0) —
//     never a concatenated track. Timing is LOCKED from ffprobe-measured VO
//     (post silence-trim) + the standard 0.4s pad — see
//     scripts/generateVoiceover-eisenhower-photographed-evidence.py. Do not
//     recalculate.
//   - Pan-Fill categorization (per build brief):
//       Slide 1 (01-eisenhower-portrait.jpg, 1340x2385, aspect 0.562) —
//       Category 1, portrait/static. Well under the 1.2 pan threshold, so
//       Pan-Fill would resolve 'static' automatically — sourceWidth/Height
//       supplied for documentation, but an explicit `motion` (1.0->1.02, no
//       translate) is given per the brief's "minimal drift only" ask, which
//       is a touch subtler than Pan-Fill's own static default (1.0->1.05).
//       Slide 2 (02-eisenhower-torture-demonstration.jpg, 2930x2364, aspect
//       1.239) — Category 3, dense scene / static crop per the brief. This
//       aspect sits JUST ABOVE the 1.2 pan threshold, so Pan-Fill would
//       auto-resolve this to a PAN unless overridden — panFillMode is
//       explicitly forced to 'static' here to get the no-pan crop the brief
//       calls for. Crop check (visual, against the actual delivered file):
//       plain center cover-fit already shows a horizontal window running
//       ~800px-2130px of the source's 2930px width (~1330px wide, matching
//       the brief's target) — Eisenhower's face (~1514-1603px) and the full
//       demonstration-table/survivor cluster (~760-2060px: bent-over soldier,
//       striped-uniform survivor pulling his arm, wooden crate) all land
//       safely inside that window. Only the crate's outer support beams
//       (~1.3% sliver at each edge, background framing, not a subject) fall
//       just outside — accepted per the brief's "roughly centered" framing.
//       No translateX offset needed. Motion is a modest 1.0->1.03 push-in
//       (matches GrantsMemoirsQS's STATIC_MOTION choice for a busy frame,
//       rather than Pan-Fill's fuller 1.05 default, so the already-tight
//       edges don't crop further than necessary by the end of the slide).
//       Slide 3 (03-ohrdruf-mass-grave-inspection.jpg, 803x1000, aspect
//       0.803) — Category 2, wide/horizontal pan per the brief, despite the
//       raw aspect ratio sitting BELOW the 1.2 auto-pan threshold: height-
//       normalizing this portrait source to the 1920px canvas still leaves
//       462px of real horizontal overflow (base_scale 1.92, rendered width
//       1542px), so panFillMode is explicitly forced to 'pan' to use that
//       room instead of Pan-Fill's aspect-only heuristic defaulting to
//       'static'. panDirection 'ltr': starts on the empty grave-pit trench
//       wall (left of frame, no figures), ends on the survivor/officers
//       cluster (right-center). NOTE: the shared engine's own edge-buffer
//       floor (PAN_FILL_EDGE_BUFFER_PX=50) caps usable pan room at 362px
//       (462 - 2*50), not the ~400px (87%) the build brief estimated by the
//       raw percentage alone — see the build report for the actual number.
//       Slide 4 (04-nuremberg-defendants-dock.jpg, 2951x2404, aspect 1.227)
//       — Category 2, wide/horizontal pan; clears the 1.2 threshold so
//       Pan-Fill's auto pan applies (panFillMode set to 'pan' explicitly
//       here anyway, for the same clarity as slide 3). panDirection 'ltr'
//       per the brief (wood-paneled wall/guards -> defendants' dock). NOTE:
//       the brief's ~1100px pan-room estimate is correct (engine computes
//       ~1118px of usable room), but this slide's 5.99s duration hits the
//       shared MAX_PAN_SPEED_PX_PER_SEC=100 speed cap first: actual travel
//       is capped to ~599px (100px/s * 5.99s), centered in the usable room
//       — see the build report for the resulting start/end crop windows.
//       This is a shared, codebase-wide constant, not a per-slide override.
//   - End card: NO trigger word, NO comment-DM automation on this video (that
//     concept — OHRDRUF — was dropped per direction; nothing in this file or
//     on screen references it any more). Ported verbatim from
//     HancocksLineQS.tsx/HessAmnesiaQS.tsx/JohnstonShilohQS.tsx/
//     KerryTestimonyQS.tsx's own EndCard: black background, no VO, 60 frames
//     (2.0s), headline "Follow the page for more history they didn't teach
//     you." + gold subline "Like. Save. Share." — the established
//     no-trigger-word, newsletter-only-follow pattern for one-off pieces
//     outside the BLUEGRAY/FRONT/RECON series, reused rather than inventing
//     new copy. Satisfies the standing CTA rule ("follow the page" /
//     "follow for more" phrasing, never "Follow Echo and Chronicle").
//     Music continues under it at 0.15 volume via the same un-scoped
//     top-level <Audio> every other slide's Sequence sits inside of.
//   - Music: audio/TokyoFirebombing-music.mp3 at 0.15 volume, looped — the
//     standing WWII Quick Strike bed (per project convention), not a
//     dedicated new track.
//   - Gold animated rule on overlay text: SlidePanel's own GoldLowerThird
//     already renders this on every slide automatically — no extra wiring.
//   - Safe zone: SAFE_ZONE_BOTTOM_Y (1580) is the shared module default and
//     is not overridden here.

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified
// AFTER the leading/trailing-silence trim — see
// scripts/generateVoiceover-eisenhower-photographed-evidence.py). Do not
// recalculate.
//
// Slide 1 was regenerated with "1945" spelled out as "nineteen forty-five"
// in the TTS input (Kokoro reads bare digit-years like "1945" as "nineteen
// hundred forty-five" — the project's standing number-formatting rule).
// On-screen text is untouched: the gold context tag still reads "OHRDRUF,
// GERMANY — APRIL 12, 1945" with digits. Changed audio length: 7.236s ->
// 6.922s (post-trim; same -45dB/0.05s edge-silence method as before, still
// no leading silence, small trailing tail trimmed same as always).
//
// Slide 2 was regenerated with "Ohrdruf" respelled to "Ordroof" in the TTS
// input — verified via kokoro.tokenizer.phonemize (see the script's own
// comment for the full derivation and the respellings tested): the correct
// spelling phonemizes to "OH-uh-druhf" with a diphthong+schwa first
// syllable and the wrong second-syllable vowel; "Ordroof" (one word, no
// hyphen) phonemizes to exactly the target "OHR-droof" — first syllable
// rhyming with door/ore, second with roof/spoof, stress on the first
// syllable. On-screen text is untouched: both the caption and the
// "OHRDRUF CONCENTRATION CAMP" / "OHRDRUF, GERMANY" labels stay correctly
// spelled. Changed audio length: 8.594s -> 8.568s (post-trim).
//
// Slide 4 was regenerated in a prior pass with the "Nuremberg" phoneme-
// splice pronunciation fix (identical substitution already proven on
// generateVoiceover-nuremberg-goering.py / generateVoiceover-hess-amnesia.py
// — reused verbatim, not re-derived): 5.590s -> 5.407s. Slide 3 has never
// been regenerated. Both are unchanged by this pass.
const SLIDE1_AUDIO_S = 6.922;
const SLIDE2_AUDIO_S = 8.568;
const SLIDE3_AUDIO_S = 7.001;
const SLIDE4_AUDIO_S = 5.407;

const SLIDE1_MOTION = {
  scaleFrom: 1.0,
  scaleTo: 1.02,
  txFrom: 0,
  txTo: 0,
  tyFrom: 0,
  tyTo: 0,
  easing: 'easeInOutCubic' as const,
};

const SLIDE2_MOTION = {
  scaleFrom: 1.0,
  scaleTo: 1.03,
  txFrom: 0,
  txTo: 0,
  tyFrom: 0,
  tyTo: 0,
  easing: 'easeInOutCubic' as const,
};

const SLIDES: SharedSlideConfig[] = [
  {
    id: 'slide1',
    // 1340x2385, aspect 0.562 — Category 1 (portrait/static).
    image: 'slides/Eisenhower-ConcentrationCamp/01-eisenhower-portrait.jpg',
    audio: 'audio/eisenhower-photographed-evidence-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: 'OHRDRUF, GERMANY — APRIL 12, 1945',
    overlayText: 'PROOF, NOT VICTORY',
    captionLines: [
      'Eisenhower toured a Nazi camp in April 1945.',
      'What he did next had nothing to do with winning the war.',
    ],
    sourceWidth: 1340,
    sourceHeight: 2385,
    motion: SLIDE1_MOTION,
  },
  {
    id: 'slide2',
    // 2930x2364, aspect 1.239 — Category 3 (dense scene, static crop).
    // panFillMode forced to 'static': this aspect clears the 1.2 auto-pan
    // threshold, but the brief calls for a locked centered crop, not a pan.
    image: 'slides/Eisenhower-ConcentrationCamp/02-eisenhower-torture-demonstration.jpg',
    audio: 'audio/eisenhower-photographed-evidence-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: 'OHRDRUF CONCENTRATION CAMP',
    overlayText: 'ONE ROOM TOO MUCH',
    captionLines: [
      'Soldiers found piles of bodies at Ohrdruf.',
      'Eisenhower walked through personally.',
      'Patton became physically ill and refused to enter one room.',
    ],
    sourceWidth: 2930,
    sourceHeight: 2364,
    panFillMode: 'static',
    motion: SLIDE2_MOTION,
  },
  {
    id: 'slide3',
    // 803x1000, aspect 0.803 — Category 2 (wide/horizontal pan) despite the
    // low raw aspect: height-normalized to the 1920px canvas, this source
    // still overflows the 1080px width by 462px. panFillMode forced to
    // 'pan' since Pan-Fill's own aspect-only auto-check would otherwise
    // default this to 'static'. No explicit `motion` — let Pan-Fill's own
    // translateX pan drive this slide.
    image: 'slides/Eisenhower-ConcentrationCamp/03-ohrdruf-mass-grave-inspection.jpg',
    audio: 'audio/eisenhower-photographed-evidence-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: 'MASS GRAVE, OHRDRUF',
    overlayText: '"IT BEGGARED DESCRIPTION"',
    captionLines: [
      'Eisenhower said what he saw beggared description.',
      'He proposed sending journalists and Congressmen to see it for themselves.',
    ],
    sourceWidth: 803,
    sourceHeight: 1000,
    panFillMode: 'pan',
    panDirection: 'ltr',
  },
  {
    id: 'slide4',
    // 2951x2404, aspect 1.227 — Category 2 (wide/horizontal pan); clears the
    // 1.2 threshold so Pan-Fill's auto pan applies on its own. panFillMode
    // set explicitly anyway for the same documentation clarity as slide 3.
    image: 'slides/Eisenhower-ConcentrationCamp/04-nuremberg-defendants-dock.jpg',
    audio: 'audio/eisenhower-photographed-evidence-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    label: 'NUREMBERG, GERMANY — NOVEMBER 1945',
    overlayText: 'EVIDENCE AT NUREMBERG',
    captionLines: [
      'Seven months later, that kind of documentation',
      'became core evidence at the Nuremberg trials.',
    ],
    sourceWidth: 2951,
    sourceHeight: 2404,
    panFillMode: 'pan',
    panDirection: 'ltr',
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card. Ported verbatim from HancocksLineQS.tsx/HessAmnesiaQS.tsx/
// JohnstonShilohQS.tsx/KerryTestimonyQS.tsx: black background, no VO, no
// trigger word, no comment CTA — on-screen text only ("Follow the page..." /
// "Like. Save. Share."). This is the established no-trigger-word,
// newsletter-only-follow pattern for one-off pieces outside the BLUEGRAY/
// FRONT/RECON series. Duration has no VO to time against — 60 frames (2.0s
// @ 30fps), matching that same precedent exactly.
// ---------------------------------------------------------------------------
const CTA_FRAMES = 60;

function EndCard() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const headlineOpacity = interpolate(frame, [4, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sublineOpacity = interpolate(frame, [20, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '80%', maxWidth: 900, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <p
          style={{
            opacity: headlineOpacity,
            color: '#F5F0E8',
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.3,
            textAlign: 'center',
            textShadow: '0 2px 14px rgba(0,0,0,0.95)',
            margin: '0 0 28px',
          }}
        >
          Follow the page for more history they didn't teach you.
        </p>
        <p
          style={{
            opacity: sublineOpacity,
            color: GOLD,
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            fontSize: 26,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textAlign: 'center',
            margin: 0,
          }}
        >
          Like. Save. Share.
        </p>
      </div>
    </AbsoluteFill>
  );
}

export const totalDuration = slidesDuration + CTA_FRAMES;
export { FPS };

export default function EisenhowerPhotographedEvidenceQS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });
  const ctaFrom = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/TokyoFirebombing-music.mp3')} volume={0.15} loop />

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
