import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  GOLD,
  GoldLowerThird,
  ContextTag,
  CaptionOverlay,
  Vignette,
} from '../shared/QuickStrikeShared';

// Hill 875 — RECON Quick Strike (Vietnam, Battle of Dak To, Nov. 1967).
//
// Locked decisions from the build brief:
//   - No fades anywhere: true cold open at frame 0 (isFirst), 4-frame hard
//     cut (HARD_CUT_FRAMES) on every slide after that, no fade-out anywhere
//     — hard cut ending.
//   - Per-slide audio only (one <Audio> per Sequence, own local frame 0) —
//     no continuous/concatenated VO track. Timing is LOCKED from
//     scripts/generateVoiceover-hill875.py (ffprobe-verified): 123/185/211/
//     230 frames (749 slides + 60 CTA = 809 total @ 30fps). Do not
//     recalculate. (Slide 4 was regenerated with corrected VO text — "And
//     United States forces walked away." instead of "And U.S. forces walked
//     away." — new actual duration 7.275s, was 7.083s; slides 1-3 and their
//     frame counts are unchanged.)
//   - GoldLowerThird headline is a short hook (Max Alignment Principle);
//     CaptionOverlay (QuickStrikeShared.tsx, same component used by
//     GuadalcanalQS.tsx/ThomasChickamaugaQS.tsx) carries the FULL verbatim VO
//     line per slide as closed captions, phrase-chunked at natural clause
//     boundaries. Timing is that component's own word-count-proportional
//     cue split across audioDurationFrames — a documented estimate (Kokoro
//     returns no word/phoneme timestamps), not real forced alignment; no
//     extra generation step exists or is needed for this.
//   - All four slides are wide (2400-2480px), 1920px-tall panoramic stills,
//     already pre-scaled to fill the full canvas height — so each gets ONLY
//     a horizontal Pan-Fill-style translateX move, no scale animation, same
//     rendering technique + easing as GuadalcanalQS.tsx/
//     ThomasChickamaugaQS.tsx's local pan-layer workaround
//     (QuickStrikeShared.tsx's own Pan-Fill System is locked/consume-only
//     and only auto-computes a symmetric sweep from sourceWidth/
//     sourceHeight — it has no hook for the hand-picked asymmetric endpoints
//     this brief specifies, so the same local-component workaround those
//     two files established is reused here rather than inventing a new one).
//   - Cliffhanger ending: black end card, no VO, no trigger word, on-screen
//     text only — ported verbatim from KerryTestimonyQS.tsx/
//     EisenhowerPhotographedEvidenceQS.tsx/HancocksLineQS.tsx/
//     HessAmnesiaQS.tsx/JohnstonShilohQS.tsx/GrantsMemoirsQS.tsx's
//     established no-CTA pattern for one-off/cliffhanger pieces outside the
//     BLUEGRAY/FRONT/RECON trigger-word funnel.
//   - ContextTag (top-left, no entrance animation — QuickStrikeShared.tsx's
//     own static component, same as GuadalcanalQS.tsx's contextTag usage) on
//     all 4 slides. Confirmed clear of GoldLowerThird + CaptionOverlay, now
//     that all three are on screen together:
//       * ContextTag is fixed at top:48/left:40 — near the very top of the
//         1920px canvas, structurally isolated from the other two (which
//         only ever occupy the bottom of the frame, at/above y=1580).
//       * GoldLowerThird is bottom-anchored off the y=1580 safe-zone floor,
//         box growing upward from there.
//       * CaptionOverlay is given each slide's overlayText, so its own
//         ceiling math (computeCaptionCeilingAboveHeadline) measures
//         GoldLowerThird's real rendered box height and keeps the caption's
//         bottom edge above it — by construction (safeTop+height <= ceiling
//         <= safeZoneCeiling=1560), never below y=1580, on any slide,
//         regardless of caption/headline text length.
//     No vertical overlap between any of the three, on any of the 4 slides.
//   - Music bed CONFIRMED: audio/CIA-Gun-music.mp3 (the standard RECON/
//     Vietnam bed also used by IaDrangValleyQS.tsx/GulfOfTonkinQS.tsx/
//     TetCitadelQS.tsx).
const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified —
// see scripts/generateVoiceover-hill875.py). durationInSeconds below is each
// of these + PAD_S, matching the locked frame counts given in the brief
// exactly (123/185/211/230 @ 30fps). SLIDE4_AUDIO_S reflects the regenerated
// slide 4 line ("And United States forces walked away.", was "And U.S.
// forces walked away.") — 7.275s, up from 7.083s; slides 1-3 unchanged.
const SLIDE1_AUDIO_S = 3.691;
const SLIDE2_AUDIO_S = 5.781;
const SLIDE3_AUDIO_S = 6.635;
const SLIDE4_AUDIO_S = 7.275;

// ---------------------------------------------------------------------------
// PannedImageLayer — pure horizontal pan, no scale. Ported from
// GuadalcanalQS.tsx's PannedImageLayer (the established workaround for
// QuickStrikeShared's locked Pan-Fill System not accepting hand-picked
// endpoints), with one change: txFrom/txTo are passed directly instead of
// being derived from a single symmetric panDistance, since this brief's pans
// are NOT symmetric about center. Height is fixed at 100% (not Guadalcanal's
// 108% zoom) — these sources are already pre-scaled to exactly fill the
// 1920px canvas height, confirmed via PIL against the actual files
// (2477x1920 / 2411x1920 / 2411x1920 / 2464x1920), so per the brief ("do not
// rescale them again in the composition, just interpolate translateX") no
// extra zoom is applied. Same Easing.inOut(Easing.ease) as every other
// Pan-Fill implementation in this codebase (QuickStrikeShared's
// KenBurnsImage isPan branch, GuadalcanalQS.tsx, ThomasChickamaugaQS.tsx) —
// matched, not reinvented, per the brief's explicit instruction.
// ---------------------------------------------------------------------------
function PannedImageLayer({
  image,
  txFrom,
  txTo,
  durationFrames,
}: {
  image: string;
  txFrom: number;
  txTo: number;
  durationFrames: number;
}) {
  const frame = useCurrentFrame();
  const tx = interpolate(frame, [0, durationFrames], [txFrom, txTo], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Img
          src={staticFile(image)}
          style={{
            height: '100%',
            width: 'auto',
            maxWidth: 'none',
            transform: `translateX(${tx}px)`,
            transformOrigin: 'center center',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// Composes the pan layer under the same Vignette + ContextTag +
// GoldLowerThird + CaptionOverlay + Audio stack every other slide panel in
// this codebase uses (see PanSlidePanel in GuadalcanalQS.tsx/
// ThomasChickamaugaQS.tsx) — same component order, CaptionOverlay given
// overlayText so its ceiling math stays clear of the headline box above it.
function SlidePanel({
  image,
  audio,
  overlayText,
  contextTag,
  captionLines,
  audioDurationFrames,
  txFrom,
  txTo,
  durationFrames,
  isFirst,
}: {
  image: string;
  audio: string;
  overlayText: string;
  contextTag: string;
  captionLines: string[];
  audioDurationFrames: number;
  txFrom: number;
  txTo: number;
  durationFrames: number;
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();

  // Cold open on slide 1 (full brightness frame 0), 4-frame hard cut on every
  // slide after that. No fade-out anywhere — hard cut ending.
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <PannedImageLayer image={image} txFrom={txFrom} txTo={txTo} durationFrames={durationFrames} />
      <Vignette />

      {/* ContextTag has no entrance animation of its own in
          QuickStrikeShared.tsx (static opacity=1 default) — same as every
          other composition's usage (GuadalcanalQS.tsx, ThomasChickamaugaQS.tsx,
          BullRun1QS.tsx), so it's simply present from this slide's own frame 0
          (i.e. it rides in on the panel's own hard-cut opacity above, not a
          second independent fade). */}
      <ContextTag text={contextTag} position="top-left" />

      <GoldLowerThird text={overlayText} frame={frame} />

      {/* Full verbatim VO as closed captions — overlayText passed through so
          CaptionOverlay's ceiling math stays clear of the headline box above
          it (see the file-level doc comment for the timing mechanism). */}
      <CaptionOverlay lines={captionLines} audioDurationFrames={audioDurationFrames} overlayText={overlayText} />

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide config. txFrom/txTo are CSS translateX values in the Pan-Fill
// centered-container convention (image horizontally centered at native
// scale, then shifted by translateX) — NOT the brief's raw crop-window-
// left-edge "x" values directly. Conversion used for all four slides:
//
//   tx = (scaledWidth - 1080) / 2 - x
//
// (centering puts the image's own left edge at (1080-scaledWidth)/2 before
// any translate; solving for the translateX that brings image-space
// coordinate x to the viewport's left edge, screen position 0, gives the
// formula above.) Verified below for every slide that the resulting tx stays
// within +-((scaledWidth-1080)/2) — the pan never exposes empty space past
// the image's real edge.
// ---------------------------------------------------------------------------

const SLIDES = [
  {
    id: 'slide1',
    image: 'slides/hill875/01-hook-terrain-smoke.jpg',
    audio: 'audio/hill875-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    overlayText: 'THIS HILL HAD NO NAME.',
    contextTag: 'DAK TO, SOUTH VIETNAM',
    // Full verbatim VO ("This hill had no name. Only a number. Hill eight
    // seven five."), chunked at its own sentence boundaries — 3 cues.
    captionLines: ['This hill had no name.', 'Only a number.', 'Hill eight seven five.'],
    // 2477x1920 (scaledWidth 2477, half-room 698.5). Brief: x 1247 -> 398.
    //   tx = 698.5 - 1247 = -548.5
    //   tx = 698.5 - 398  =  300.5
    //
    // FLAG FOR REVIEW: this is the fastest pan of the four — |txFrom-txTo| =
    // 849px over 123 frames (4.1s) is ~207px/s, roughly double slide 2-4's
    // rate, on the shortest slide in the deck. Implemented exactly as
    // specified; preview before final lock. If it reads as a whip-pan rather
    // than a settling establishing shot, the brief's own suggested fix is to
    // shorten travel by ending on image-space x~=550 instead of x=398 (still
    // centered on the smoke) — i.e. txTo ~= 698.5-550 = 148.5 — NOT changing
    // this slide's duration.
    txFrom: -548.5,
    txTo: 300.5,
  },
  {
    id: 'slide2',
    image: 'slides/hill875/02-digging-in.jpg',
    audio: 'audio/hill875-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    overlayText: 'DUG IN. WAITING.',
    contextTag: 'HILL 875',
    // Full verbatim VO ("Paratroopers of the one seventy third Airborne dug
    // in below the summit, waiting for orders to move up."), chunked at
    // natural clause boundaries — 3 cues, all 18 words accounted for.
    captionLines: [
      'Paratroopers of the one seventy third Airborne',
      'dug in below the summit,',
      'waiting for orders to move up.',
    ],
    // 2411x1920 (half-room 665.5). Brief: x 0 -> 1158.
    //   tx = 665.5 - 0    =  665.5
    //   tx = 665.5 - 1158 = -492.5
    txFrom: 665.5,
    txTo: -492.5,
  },
  {
    id: 'slide3',
    image: 'slides/hill875/03-contact-firefight.jpg',
    audio: 'audio/hill875-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    overlayText: 'THE BUNKERS SURVIVED THE AIRSTRIKES.',
    contextTag: 'NOV 1967',
    // Full verbatim VO ("When they went up, North Vietnamese troops were dug
    // into bunkers that had largely survived the artillery and
    // airstrikes."), chunked at natural clause boundaries — 4 cues, all 19
    // words accounted for.
    captionLines: [
      'When they went up,',
      'North Vietnamese troops were dug into bunkers',
      'that had largely survived',
      'the artillery and airstrikes.',
    ],
    // 2411x1920 (half-room 665.5). Brief: x 200 -> 998.
    //   tx = 665.5 - 200 =  465.5
    //   tx = 665.5 - 998 = -332.5
    txFrom: 465.5,
    txTo: -332.5,
  },
  {
    id: 'slide4',
    image: 'slides/hill875/04-medevac-payoff.jpg',
    audio: 'audio/hill875-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    overlayText: 'A FIFTH OF THE BRIGADE. FOR A HILL WITH NO NAME.',
    contextTag: '173RD AIRBORNE BRIGADE',
    // Full verbatim VO ("The fight for this hill cost the one seventy third
    // Airborne Brigade a fifth of its strength. And United States forces
    // walked away." — post-fix wording), chunked at natural clause
    // boundaries — 4 cues, all 23 words accounted for.
    captionLines: [
      'The fight for this hill cost',
      'the one seventy third Airborne Brigade',
      'a fifth of its strength.',
      'And United States forces walked away.',
    ],
    // 2464x1920 (half-room 692). Brief: x 1384 -> 398. x=1384 is exactly
    // scaledWidth-1080 (2464-1080=1384) — the true max — so this slide opens
    // panned all the way to the image's right edge.
    //   tx = 692 - 1384 = -692
    //   tx = 692 - 398  =  294
    txFrom: -692,
    txTo: 294,
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card — cliffhanger CTA per brief: black background, no VO, no trigger
// word, on-screen text only. Ported verbatim from KerryTestimonyQS.tsx/
// EisenhowerPhotographedEvidenceQS.tsx/HancocksLineQS.tsx/HessAmnesiaQS.tsx/
// JohnstonShilohQS.tsx/GrantsMemoirsQS.tsx's established no-CTA pattern for
// one-off/cliffhanger pieces — same 60 frames (2.0s @ 30fps, no VO to time
// against), same reveal timing. Wording per brief.
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
          Follow the page for more of the war they didn't put in the textbook.
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

export default function Hill875QS() {
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

      {/* RECON/Vietnam standard music bed — same track as IaDrangValleyQS.tsx/
          GulfOfTonkinQS.tsx/TetCitadelQS.tsx. Confirmed. */}
      <Audio src={staticFile('audio/CIA-Gun-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <SlidePanel
            image={slide.image}
            audio={slide.audio}
            overlayText={slide.overlayText}
            contextTag={slide.contextTag}
            captionLines={slide.captionLines}
            audioDurationFrames={slide.audioDurationFrames}
            txFrom={slide.txFrom}
            txTo={slide.txTo}
            durationFrames={slide.durationFrames}
            isFirst={i === 0}
          />
        </Sequence>
      ))}

      <Sequence from={ctaFrom} durationInFrames={CTA_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
