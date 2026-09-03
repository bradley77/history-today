import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  GOLD,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// Spotsylvania / Bloody Angle — one-off Quick Strike, outside the
// BLUEGRAY/FRONT/RECON series (no trigger-word CTA, no comment automation),
// following the same pattern as HancocksLineQS.tsx/Hill875QS.tsx/
// GrantsMemoirsQS.tsx/HessAmnesiaQS.tsx/JohnstonShilohQS.tsx.
//
// Locked decisions from the build brief:
//   - True cold open: slide 1 fully visible at full brightness from frame 0,
//     no fade-in (isFirst on slide 1, handled by the shared SlidePanel).
//     4-frame hard cut on every slide after that. No fade-out anywhere —
//     hard cut ending.
//   - Per-slide audio only (one <Audio> per Sequence, own local frame 0) —
//     never a concatenated track. Timing is LOCKED from ffprobe-measured VO
//     + the standard 0.4s pad (PAD_S) on slides 1-4 — see
//     scripts/generateVoiceover-spotsylvania-bloody-angle.py. Do not
//     recalculate. Slide 5 is a deliberate one-off exception — see
//     SLIDE5_PAD_S below.
//   - Slide 4's VO was revised to add a bridging phrase ("...twenty hours,
//     hand to hand, gunfire the whole time.") and regenerated through the
//     same script/settings (Kokoro am_adam/0.95/en-us) — new ffprobe
//     duration 8.229s, was 6.766s. captionLines updated to match verbatim.
//   - Caption/headline box question (per user request): confirmed
//     GoldLowerThird's `kicker` slot exists but is a single static string
//     sharing the headline's one-shot reveal, not a fit for CaptionOverlay's
//     time-synced, phrase-chunked, multi-line captions — user opted to leave
//     CaptionOverlay as-is on all five slides rather than migrate into it.
//   - Pan-Fill: all five source images are already exact 1080x1920 portrait
//     crops (confirmed via PIL — zero pan room, aspect 0.562, well under the
//     1.2 Pan-Fill threshold), so every slide is Category 1 static cover-fit.
//     No sourceWidth/sourceHeight passed (there is no overflow to pan across
//     regardless); instead every slide uses the same hand-picked minimal
//     push-in (STATIC_MOTION below) rather than Pan-Fill's own 1.05 static
//     default — matches HancocksLineQS.tsx/JohnstonShilohQS.tsx's choice of
//     scaleTo 1.03 for "zero to minimal drift" instead of a frozen frame.
//   - Silent End Card, ported verbatim from HancocksLineQS.tsx/Hill875QS.tsx
//     (itself from JohnstonShilohQS.tsx/KerryTestimonyQS.tsx): 60 frames
//     (2.0s), no VO, no trigger word, no comment CTA — on-screen text only
//     ("Follow the page..." / "Like. Save. Share."). Confirmed with the user
//     as "the same one we've been using the last few videos."
//   - Music: lee-resignation-music.mp3 at 0.15 volume, looped — per user
//     request, switched from the LincolnFortStevens-music.mp3 default. No
//     dedicated Spotsylvania/Wilderness track exists yet.
//   - Context tags (slides 2-4 only; slides 1 and 5 intentionally have none
//     — the tree stump stays unexplained until the payoff): rendered via the
//     shared `label` field on SlideConfig, which SlidePanel wires to
//     QuickStrikeShared.tsx's ContextTag component — NOT GoldLowerThird's
//     `kicker` slot (that was investigated and explicitly ruled out earlier
//     in this build; it's a different component entirely). ContextTag has no
//     entrance animation of its own (static opacity=1, same as every other
//     composition's usage — e.g. Hill875QS.tsx) — it's simply present from
//     the slide's own frame 0, riding in on SlidePanel's hard-cut opacity,
//     so the "one-shot reveal" timing question that applies to GoldLowerThird
//     doesn't apply here at all. Slide 2's tag omits rank entirely (EMORY
//     UPTON) — the portrait shows general's-star insignia but the VO covers
//     events from when he was a colonel. Grant's and Hancock's shoulder
//     insignia were checked for a similar mismatch (per user request) but
//     were inconclusive at the source photos' resolution — Hancock's crop
//     doesn't include his shoulder boards in frame at all, and Grant's
//     visible strap emblem couldn't be resolved to a star count given the
//     image's processing/resolution. Flagged rather than guessed; tags used
//     as given (LT. GEN. ULYSSES S. GRANT / MAJ. GEN. WINFIELD S. HANCOCK).
const PAD_S = 0.4;

// One-off exception for slide 5 ONLY (not a change to the shared PAD_S
// default above). Slide 5's VO was extended ("Bullets cut down this tree.
// Twenty-two inches of solid oak.") — new ffprobe raw duration is 3.631s,
// which by itself already exceeds the requested 3.4-3.6s total-duration
// target (there's no non-negative pad that lands inside that range). Per
// user direction, using a small standard-style pad rather than 0: 0.169s
// brings the total to an even 3.8s (114 frames @ 30fps) — the closest clean
// value above the target range with real breathing room before the hard cut
// into the end card, instead of cutting right on the VO's last frame.
// (Previously 0.833s, tuned for the old 1.567s raw line — recalculated from
// scratch here, not left over.) Slides 1-4 are unaffected — they still use
// PAD_S.
const SLIDE5_PAD_S = 0.169;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified —
// see scripts/generateVoiceover-spotsylvania-bloody-angle.py). SLIDE4_AUDIO_S
// reflects the regenerated slide 4 line (added bridging phrase ", gunfire
// the whole time." — was 6.766s, now 8.229s). SLIDE5_AUDIO_S reflects the
// regenerated slide 5 line (added "Twenty-two inches of solid oak." — was
// 1.567s, now 3.631s).
const SLIDE1_AUDIO_S = 4.545;
const SLIDE2_AUDIO_S = 4.728;
const SLIDE3_AUDIO_S = 3.030;
const SLIDE4_AUDIO_S = 8.229;
const SLIDE5_AUDIO_S = 3.631;

// Static cover-fit with minimal push-in — used on every slide (see Pan-Fill
// note above). Matches HancocksLineQS/JohnstonShilohQS's choice of scaleTo
// 1.03 over the Pan-Fill System's default 1.05 static push-in.
const STATIC_MOTION = {
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
    image: 'slides/Spotsylvania/01-stump-mystery.jpg',
    audio: 'audio/spotsylvania-bloody-angle-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    overlayText: 'A DECISION THAT COST THOUSANDS',
    captionLines: [
      'Grant made a decision that cost thousands of men.',
      'This is what was left over.',
    ],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide2',
    image: 'slides/Spotsylvania/02-upton-column.jpg',
    audio: 'audio/spotsylvania-bloody-angle-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    overlayText: "UPTON'S COLUMN BREAKS THROUGH",
    // No rank on this tag, deliberately: the portrait shows general's-star
    // insignia, but the VO/script cover events from when Upton was still a
    // colonel. Dropping rank entirely avoids a tag/image mismatch.
    label: 'EMORY UPTON',
    captionLines: [
      "Upton's column broke through in about a minute.",
      'Then it had no support, and pulled back.',
    ],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide3',
    image: 'slides/Spotsylvania/03-grant-decision.jpg',
    audio: 'audio/spotsylvania-bloody-angle-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    overlayText: 'GRANT DECIDES: MORE MEN',
    label: 'LT. GEN. ULYSSES S. GRANT',
    captionLines: ['Grant saw it work.', 'He decided it needed more men.'],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide4',
    image: 'slides/Spotsylvania/04-hancock-breakthrough.jpg',
    audio: 'audio/spotsylvania-bloody-angle-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    overlayText: 'THE BLOODY ANGLE: 20 HOURS',
    label: 'MAJ. GEN. WINFIELD S. HANCOCK',
    captionLines: [
      "Hancock's corps broke through again.",
      'Then the fighting concentrated at the Bloody Angle.',
      'Twenty hours, hand to hand,',
      'gunfire the whole time.',
    ],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide5',
    image: 'slides/Spotsylvania/05-stump-payoff.jpg',
    audio: 'audio/spotsylvania-bloody-angle-vo-05.mp3',
    // One-off exception — see SLIDE5_PAD_S comment above.
    durationInSeconds: SLIDE5_AUDIO_S + SLIDE5_PAD_S,
    audioDurationSeconds: SLIDE5_AUDIO_S,
    overlayText: 'BULLETS CUT DOWN THIS TREE',
    captionLines: ['Bullets cut down this tree.', 'Twenty-two inches of solid oak.'],
    motion: STATIC_MOTION,
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card — ported verbatim from HancocksLineQS.tsx/Hill875QS.tsx: NO
// voiceover, NO trigger word, NO comment CTA. Black background, hard cut in
// (same HARD_CUT_FRAMES=4 transition every other slide uses), constant
// opacity 1 for the rest — no fade out, ever. Text has its own quick local
// reveal (opacity 0->1 over a few frames), matching every other end card's
// headline/subline reveal in this codebase — that's a text entrance, not a
// slide-level fade, so it doesn't violate the "no fade" rule.
//
// Duration has no VO to time against — 60 frames (2.0s @ 30fps), matching
// HancocksLineQS/Hill875QS's END_CARD_FRAMES/CTA_FRAMES exactly.
// ---------------------------------------------------------------------------
const END_CARD_FRAMES = 60;

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

export const totalDuration = slidesDuration + END_CARD_FRAMES;
export { FPS };

export default function SpotsylvaniaBloodyAngleQS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });
  const endCardFrom = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/lee-resignation-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <SlidePanel slide={slide} isFirst={i === 0} />
        </Sequence>
      ))}

      <Sequence from={endCardFrom} durationInFrames={END_CARD_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
