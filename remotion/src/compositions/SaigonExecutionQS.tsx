import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { FPS, OSWALD_URL, SlidePanel, type SlideConfig as SharedSlideConfig } from '../shared/QuickStrikeShared';

// Saigon Execution — one-off Vietnam Quick Strike, outside the RECON series
// (no trigger-word CTA, no comment automation — slide 4 carries its own
// "Follow for more" VO instead of a separate End Card).
//
// Locked decisions from the build brief:
//   - Per-slide audio only (one <Audio> per Sequence, own local frame 0) —
//     never a concatenated track. Timing is LOCKED from ffprobe-measured VO
//     + the standard 0.4s pad — see
//     scripts/generateVoiceover-saigon-execution.py. Do not recalculate.
//   - Cinematic camera moves, one per slide, each explicitly requested:
//
//     SLIDE 1 (01-execution-wide.jpg, 2664x1920) — the complete, uncropped
//     source shown "contained" (object-fit:contain, via KenBurnsImage's
//     foregroundFit prop) for the slide's ENTIRE duration -- the full
//     street scene stays visible throughout (Loan, the prisoner, buildings,
//     the whole frame), with the shared hasBlurBackground mechanism (the
//     same one Son Tay/HighwayOfDeath already use) filling the letterboxed
//     bars above/below with a blurred, darkened, scaled-up copy of the same
//     image rather than flat black. A very slight scale (1.0 -> 1.04) gives
//     it a bit of life without cropping into anything resembling a pan --
//     the earlier build's internal Pan-Fill pan (tight crop landing on the
//     gun/prisoner) was removed entirely; that reveal now happens naturally
//     at the hard cut into slide 2's own tight framing instead.
//
//     SLIDE 2 (02-execution-closeup.jpg, already 1080x1920 — no Pan-Fill
//     room, and already upscaled ~1.3x in its static crop per the brief) —
//     explicit manual `motion`, NOT Pan-Fill: scale pinned at 1.0/1.0 (no
//     zoom at all, so as not to compound the source's existing softness)
//     with a barely-there translateX drift (-14 to +14px, ~2.6% of the
//     1080px frame width) held across the full 7.714s — no holdTailFrames,
//     since the brief wants this drift unhurried and NOT timed to a word.
//
//     SLIDE 3 (03-adams-award.jpg, 1080x1920 — source has real headroom per
//     the brief, 2428x3678 original) — a face-anchored PUSH-IN, not a pan:
//     explicit manual `motion` with scaleFrom 1.0 easing to scaleTo 1.15,
//     PLUS a constant upward offset (tyFrom = tyTo = -272px, not an
//     animated value) so his face rests in the upper two-thirds clear of
//     the bottom-anchored caption/headline. transformOrigin is NOT at his
//     raw eye-level position (~66% down) — see that field's own inline
//     comment in the SLIDES array for the algebra, but in short: CSS
//     composes `scale(s) translateY(ty)` so a constant ty's on-screen
//     contribution is still SCALED by s, meaning origin-at-raw-position
//     would still drift ~40px as scale animates. The origin actually used
//     (51.8%) is his raw position minus the offset, which makes that drift
//     term cancel out algebraically — true zero vertical travel while
//     still landing on the shifted-up resting position, verified by
//     rendering start/mid/settled. Timing mirrors slide 1: holdTailFrames =
//     round(1.8 * 30) = 54 (within the requested 1.5-2s range), so the
//     push-in completes and holds on his face for the last 1.8s of the
//     6.669s clip — timed to the closing quote ("I killed the general with
//     my camera"). hasBlurBackground covers the modest edge overflow the
//     1.15 scale (plus the -272 offset) creates.
//
//     SLIDE 4 (reuses 03-adams-award.jpg, per the brief) — deliberate static
//     hold: no `motion`, no sourceWidth/sourceHeight, so KenBurnsImage's
//     plain identity fallback renders with zero animation at all — the
//     contrast after three moving slides the brief asks for.
//
//   - Every move above uses 'easeInOut' (Easing.inOut(Easing.ease)) rather
//     than the default linear ramp — slide 1's Pan-Fill path already always
//     eases (hardcoded in KenBurnsImage), slides 2/3 opt in explicitly via
//     Motion.easing.
//   - Overlay copy (label/overlayText/captionLines) below is this build's
//     own reasonable default given only VO scripts + camera direction in
//     the brief — not separately specified, so treat as a first draft to
//     revise rather than a locked decision like the timing/motion above.
//   - Music: audio/KheSanh-music.mp3 at 0.15 volume, looped, per direction.

const PAD_S = 0.4;

const SLIDE1_AUDIO_S = 4.65;
const SLIDE2_AUDIO_S = 7.314;
const SLIDE3_AUDIO_S = 6.269;
// Re-measured (ffprobe) after inserting an explicit 275ms silence between
// "Follow for more." and "Like. Save. Share." (see
// scripts/generateVoiceover-saigon-execution-vo04-pause.py) — was 2.011
// before that pause was spliced in (was 3.866 before THAT, for the old,
// longer "...history behind the images you think you already know." script).
const SLIDE4_AUDIO_S = 2.586;

const SLIDE3_HOLD_TAIL_FRAMES = Math.round(1.8 * FPS); // 54 — arrival synced to closing quote

type SlideConfig = SharedSlideConfig;

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Saigon-Execution/01-execution-wide.jpg',
    audio: 'audio/saigon-execution-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: 'SAIGON, SOUTH VIETNAM — FEBRUARY 1, 1968',
    overlayText: 'NO AMERICAN IS IN THIS PHOTO',
    captionLines: ['This photo was proof America backed a brutal ally.', 'No American is in it.'],
    // Contained (letterboxed), not cover-fit -- holds the complete,
    // uncropped 2664x1920 scene for the whole slide. hasBlurBackground
    // fills the resulting top/bottom bars with a blurred copy instead of
    // flat black (same mechanism Son Tay/HighwayOfDeath already use).
    hasBlurBackground: true,
    foregroundFit: 'contain',
    motion: {
      scaleFrom: 1.0,
      scaleTo: 1.04,
      txFrom: 0,
      txTo: 0,
      tyFrom: 0,
      tyTo: 0,
      easing: 'easeInOut',
    },
  },
  {
    id: 'slide2',
    image: 'slides/Saigon-Execution/02-execution-closeup.jpg',
    audio: 'audio/saigon-execution-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: 'GENERAL NGUYỄN NGỌC LOAN',
    overlayText: 'THE GENERAL WHO PULLED THE TRIGGER',
    captionLines: [
      "It's a South Vietnamese general executing a Viet Cong prisoner,",
      'accused of killing a police officer and his family.',
    ],
    motion: {
      scaleFrom: 1.0,
      scaleTo: 1.0,
      txFrom: -14,
      txTo: 14,
      tyFrom: 0,
      tyTo: 0,
      easing: 'easeInOut',
    },
  },
  {
    id: 'slide3',
    image: 'slides/Saigon-Execution/03-adams-award.jpg',
    audio: 'audio/saigon-execution-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: 'EDDIE ADAMS, AP PHOTOGRAPHER',
    overlayText: 'I KILLED THE GENERAL WITH MY CAMERA',
    // overlayPosition/captionY NOT overridden -- shared bottom-anchored
    // convention, same as every other slide/composition.
    captionLines: [
      'It won the Pulitzer and World Press Photo of the Year.',
      "He later said, 'I killed the general with my camera.'",
    ],
    // Face-anchored PUSH-IN, plus a constant upward offset (~-272px,
    // restoring the earlier working version's shift) so his face rests in
    // the upper two-thirds -- with ZERO vertical travel, not an animated
    // tyFrom->tyTo.
    //
    // A naive version of this (origin AT his raw eye-level position, ~66%
    // down, plus a constant tyFrom=tyTo=-272) does NOT actually hold still:
    // CSS composes `scale(s) translateY(ty)` so the translateY is itself
    // scaled by s (screen_y = originY*(1-s) + s*faceY + s*ty) -- so even
    // with ty held constant, its ON-SCREEN contribution (s*ty) still
    // changes as s animates from 1.0 to 1.15, causing a real (if small,
    // ~40px) drift. The fix is choosing transformOrigin so that drift term
    // cancels out algebraically: solving originY*(1-s) + s*faceY + s*ty for
    // "independent of s" requires originY = faceY + ty, i.e. the origin
    // must sit at his (raw eye-level position + the offset), not at his raw
    // position itself:
    //   faceY = 0.66 * 1920 = 1267.2px (eye level, ~50% across)
    //   originY = 1267.2 + (-272) = 995.2px -> 995.2/1920 = 51.8%
    // With transformOrigin at 51.8% (not 66%) and tyFrom=tyTo=-272, his eye
    // level sits at a CONSTANT 995px on screen (1267.2 - 272, matching the
    // requested ~-272 shift) for every scale between 1.0 and 1.15 -- true
    // zero vertical travel, verified by rendering start/mid/settled.
    hasBlurBackground: true,
    motion: {
      scaleFrom: 1.0,
      scaleTo: 1.15,
      txFrom: 0,
      txTo: 0,
      tyFrom: -272,
      tyTo: -272,
      easing: 'easeInOut',
      transformOrigin: '50% 51.8%',
      holdTailFrames: SLIDE3_HOLD_TAIL_FRAMES,
    },
  },
  {
    id: 'slide4',
    image: 'slides/Saigon-Execution/03-adams-award.jpg',
    audio: 'audio/saigon-execution-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    captionLines: ['Follow for more.', 'Like. Save. Share.'],
    // No motion, no sourceWidth/sourceHeight -> KenBurnsImage's plain
    // identity fallback -> zero camera movement, deliberately.
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

export const totalDuration = slidesDuration;
export { FPS };

export default function SaigonExecutionQS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/KheSanh-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <SlidePanel slide={slide} isFirst={i === 0} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
