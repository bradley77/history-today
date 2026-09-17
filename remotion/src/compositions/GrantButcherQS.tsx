import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FPS, OSWALD_URL, HARD_CUT_FRAMES, GOLD, SlidePanel, type SlideConfig as SharedSlideConfig } from '../shared/QuickStrikeShared';

// Grant Butcher — BLUEGRAY-family Civil War Quick Strike. Four image slides
// plus the standard silent CTA end card (slide 5) — a Chatterbox Turbo
// voice-cloning test built on the same locked QuickStrikeShared engine as
// every other composition here.
//
// Locked decisions from the build brief:
//   - True cold open: slide 1 fully visible at full brightness from frame 0,
//     no fade-in. 4-frame hard cut on every slide after that (SlidePanel's
//     own default via HARD_CUT_FRAMES). No fade to black anywhere, including
//     the ending (hard cut on the last frame).
//   - Per-slide audio only (one <Audio> per Sequence via each slide's own
//     local frame 0, wired through SlidePanel) — never a concatenated track.
//   - Timing is LOCKED from ffprobe-measured Chatterbox VO + the standard
//     0.4s pad — see PAD_S and SLIDE*_AUDIO_S below. Not recalculated here.
//   - NO gold lower third headline overlay on any slide: every slide omits
//     `overlayText` entirely. GoldLowerThird only renders when SlidePanel's
//     `slide.overlayText` is truthy (QuickStrikeShared.tsx SlidePanel,
//     `{overlayText && <GoldLowerThird .../>}`) — so this is achieved by
//     simply not setting the field, the same per-slide mechanism every other
//     composition already uses to skip the headline on a given slide. No
//     shared-engine change, no new flag needed; QuickStrikeShared.tsx and
//     QuickStrikeConfig.ts are untouched. Burned-in CaptionOverlay captions
//     stay on (the existing proportional word-count timing split — see
//     QuickStrikeShared.tsx's "STANDARD CONVENTION (Aug 2026)" comment above
//     CaptionOverlay — same approach used on every other composition).
//   - Pan-Fill: sourceWidth/sourceHeight below are the real measured pixel
//     dimensions (PIL-checked against the actual files on disk). panFillMode
//     is set explicitly per slide (not left on 'auto') so the category call
//     is documented intent:
//       - Slide 1 (Cold-Harbor/02-grant-camp.jpg): 1457x2269, aspect 0.642 —
//         portrait, well under PAN_FILL_ASPECT_THRESHOLD (1.2). Resolves
//         'static' automatically; set explicitly. Same source ColdHarborVideo
//         slide 2 uses, same treatment.
//       - Slide 2 (North-Anna/04-trap-map-oxford.jpg): 1827x3249, aspect
//         0.562 — portrait, resolves 'static' automatically. Aspect is
//         within 0.1% of the 1080:1920 canvas's own 0.5625, so a static
//         cover-fit is effectively an uncropped full-bleed view — the Oxford
//         river crossing and the red earthwork lines sit centered vertically
//         well inside frame regardless. No real crop tradeoff on this one.
//       - Slide 3 (Grant-Butcher/03-james-river-crossing.jpg, REVISED — see
//         below): 7520x5865, aspect 1.282 — ABOVE the 1.2 threshold, Pan-Fill
//         category 2 (wide/panoramic), panFillMode 'pan'. See the slide's own
//         comment for the full pan-room math.
//       - Slide 4 (Spotsylvania/03-grant-decision.jpg): 1080x1920, aspect
//         0.562 — already exactly the canvas's own pixel dimensions.
//         Resolves 'static' automatically; nothing to crop.
//   - Music: no dedicated grant-butcher track exists yet. Reused
//     lee-resignation-music.mp3, looped — same choice NorthAnnaQS.tsx/
//     ColdHarborVideo.tsx/SpotsylvaniaBloodyAngleQS.tsx (the other Overland
//     Campaign siblings) made, all at their own original 0.15. Volume here
//     lowered to 0.12 (-20%) per Brad's follow-up request — see the <Audio>
//     tag itself. Flagged to Brad to swap the track if he wants a different
//     bed.
//   - Total run time = sum of all four padded slide durations + the 60-frame
//     CTA end card (slide 5, see below) = 992 frames / 33.067s at 30fps.
//   - REVISED (Brad's follow-up, three changes):
//     (1) Slide 1 VO swapped to the Turbo test-a take (grant-butcher-vo-01
//         -test-a.mp3 copied over the locked grant-butcher-vo-01.mp3;
//         -test-a.mp3 itself left in place alongside it) — 5.51s -> 5.88s
//         raw duration before the silence trim below.
//     (2) All four VO files had leading/trailing silence trimmed (ffmpeg
//         atrim, bundled compositor build) after a preview review flagged
//         long pauses. Two of the four (slides 3/4) turned out to have a
//         genuine MID-FILE silence gap instead of just pauses — a stuttering
//         blip/silence pattern (slide 3) and a flat true-silence dropout
//         (slide 4), both confirmed as TTS generation artifacts (persisted
//         at -45dB, not just quiet breath). Not trimmed; re-generated
//         instead (see (3)).
//     (3) FINAL (this pass): slides 2, 3, and 4 were regenerated as
//         grant-butcher-vo-0{2,3,4}-test-a.mp3 with the SAME
//         ChatterboxTurboTTS settings as grant-butcher-vo-01-test-a.mp3
//         (temperature=0.8, top_k=1000, top_p=0.95, repetition_penalty=1.2,
//         despotism-ref.wav) for voice consistency across all four slides,
//         verified clean at -40dB/-45dB (no stutter, no flat dropout —
//         every remaining gap shrinks or vanishes at -45dB, the signature of
//         a natural breath, not an artifact), trimmed the same
//         leading/trailing-only way, and copied over the locked
//         grant-butcher-vo-0{2,3,4}.mp3 files. SLIDE*_AUDIO_S below are the
//         final ffprobe-measured durations after all of the above — single
//         source of truth for durationInSeconds.
//     (4) Slide 2 script corrected ("But at the Wilderness..." -> "But after
//         each costly engagement at the Wilderness..."; "kept moving
//         south...storming" -> "kept sliding south...pulling back") and its
//         VO regenerated as grant-butcher-vo-02-test-b.mp3 (same locked
//         settings), verified clean (no internal gaps at all, not even
//         breath, at -35/-40/-45dB), trimmed, and copied over the locked
//         grant-butcher-vo-02.mp3. SLIDE2_AUDIO_S below reflects this.
const PAD_S = 0.4;

const SLIDE1_AUDIO_S = 5.799184;
const SLIDE2_AUDIO_S = 7.915102;
const SLIDE3_AUDIO_S = 10.161633;
const SLIDE4_AUDIO_S = 5.616327;

// ---------------------------------------------------------------------------
// Slide 5 — the standard silent CTA end card. NOT the shared EndCardCTA
// (QuickStrikeShared.tsx) — that component hardcodes a "Comment [TRIGGER]"
// lead-magnet mechanic, and this composition has no trigger word (same call
// ColdHarborVideo.tsx/NorthAnnaQS.tsx made). NOT NorthAnnaQS's "ordinary
// slide as closer" pattern either (its slide 6 is actually VO-driven, timed
// like every other slide — the outlier, not the standard, once checked).
// The actual standard for a no-trigger-word BLUEGRAY Quick Strike is this
// hand-rolled black card, copy-pasted verbatim across HancocksLineQS.tsx/
// Hill875QS.tsx/SpotsylvaniaBloodyAngleQS.tsx/JohnstonShilohQS.tsx/
// KerryTestimonyQS.tsx (not a shared QuickStrikeShared export): black
// background, HARD_CUT_FRAMES=4 hard-cut-in (same as every other slide),
// held at opacity 1 with no fade-out (matches the "no fade anywhere,
// including the ending" rule), headline+subline each with their own local
// opacity reveal (4-16 / 20-36 frames). NO voiceover of its own — duration
// is a FIXED 60 frames (2.0s @ 30fps), not audio-driven, matching
// END_CARD_FRAMES in all five sibling files exactly. Background music is
// NOT faded or cut for this card — the composition's single top-level
// looped <Audio> already spans the full composition duration and just
// continues under it, ending on the same final hard cut as everything else.
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

type SlideConfig = SharedSlideConfig & {
  sourceWidth: number;
  sourceHeight: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Cold-Harbor/02-grant-camp.jpg',
    audio: 'audio/grant-butcher-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    captionLines: ['Grant is remembered as the butcher of the Civil War,', 'a general who won by grinding up his own men.'],
    // 1457x2269, aspect 0.642 — portrait, well under PAN_FILL_ASPECT_THRESHOLD
    // (1.2). Pan-Fill resolves 'static' automatically; set explicitly to
    // document the call.
    sourceWidth: 1457,
    sourceHeight: 2269,
    panFillMode: 'static',
  },
  {
    id: 'slide2',
    image: 'slides/North-Anna/04-trap-map-oxford.jpg',
    audio: 'audio/grant-butcher-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    captionLines: [
      'But after each costly engagement at the Wilderness, Spotsylvania, and North Anna,',
      "he kept sliding south around Lee's flank",
      'instead of pulling back.',
    ],
    // 1827x3249, aspect 0.562 — within 0.1% of the canvas's own 0.5625.
    // Pan-Fill resolves 'static' automatically; set explicitly. See file
    // header for why this crop is effectively uncropped.
    sourceWidth: 1827,
    sourceHeight: 3249,
    panFillMode: 'static',
  },
  {
    id: 'slide3',
    image: 'slides/Grant-Butcher/03-james-river-crossing.jpg',
    audio: 'audio/grant-butcher-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    captionLines: [
      'After Cold Harbor, Grant wrote that no advantage whatever had been gained to compensate for the loss.',
      'He abandoned another direct drive on Richmond',
      'and turned toward Petersburg.',
    ],
    // "Pontoon bridge across James River, Va., June 1864" (Library of
    // Congress, no known restrictions on publication) — replaces the
    // Cold-Harbor/04-confederate-works.jpg static crop. 7520x5865, aspect
    // 1.282 — ABOVE PAN_FILL_ASPECT_THRESHOLD (1.2), so this is a genuine
    // Pan-Fill category 2 (wide/panoramic) slide: 'pan' left explicit rather
    // than relying on 'auto' to document the call, same convention as every
    // other slide in this file. The engine's own getPanFillTransform math
    // (QuickStrikeShared.tsx) already implements the requested "~85-90% of
    // pan room" rule via PAN_FILL_RANGE_FRACTION=0.875 (the locked midpoint
    // of that range) — no manual tx override needed. Worked the numbers by
    // hand to confirm before relying on it:
    //   base_scale = 1920/5865 = 0.327366
    //   rendered_w = 7520 * 0.327366 = 2461.79px
    //   pan_room   = 2461.79 - 1080 = 1381.79px
    //   usable_pan = pan_room - 2*max(pan_room*0.125/2, 50) = 1209.07px
    //                (87.5% of pan_room, matches the requested range)
    // Slide 3 runs 317 frames (10.567s); MAX_PAN_SPEED_PX_PER_SEC=100 caps
    // the actual pan at ~1056.67px (87.4% of usablePanPx) rather than the
    // full usable room — expected, see that constant's own comment in
    // QuickStrikeShared.tsx. panDirection left at the default 'ltr' (opens
    // on the source's left content, pans right) — no directional call was
    // specified; flag if a particular side of the crossing should open the
    // shot instead.
    sourceWidth: 7520,
    sourceHeight: 5865,
    panFillMode: 'pan',
  },
  {
    id: 'slide4',
    image: 'slides/Spotsylvania/03-grant-decision.jpg',
    audio: 'audio/grant-butcher-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    captionLines: ['A butcher keeps repeating the same mistake.', 'Grant changed his approach when the cost proved unacceptable.'],
    // 1080x1920 — exactly the canvas's own pixel dimensions. Pan-Fill
    // resolves 'static' automatically; set explicitly.
    sourceWidth: 1080,
    sourceHeight: 1920,
    panFillMode: 'static',
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

export const totalDuration = slidesDuration + END_CARD_FRAMES;
export { FPS };

export default function GrantButcherQS() {
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

      {/* Volume lowered from 0.15 to 0.12 (-20%) per Brad's request to sit the
          bed further back under the VO. Spans the full composition,
          including the CTA end card — not faded or cut for it. */}
      <Audio src={staticFile('audio/lee-resignation-music.mp3')} volume={0.12} loop />

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
