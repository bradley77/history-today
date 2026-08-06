import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FPS, OSWALD_URL, GoldLowerThird, CaptionOverlay } from '../shared/QuickStrikeShared';

// Truman Million-Verdict — ONE FRAME format.
//
// Locked decisions from the build brief:
//   - Single continuous image (slides/Truman-Decision/truman-million-verdict.jpg,
//     2926x2832 source confirmed via ffprobe, cover-fit into the 1080x1920
//     canvas), no cutting between images anywhere in this composition.
//   - No fades anywhere: true cold open at full brightness from frame 0 (the
//     image is never wrapped in any opacity interpolation), hard cut ending
//     (composition just stops at frame 749, no fade to black).
//   - One continuous push-in zoom (scale 1.0 -> 1.15, linear, clamped both
//     ends) spanning ALL 749 frames, driven by the composition's own
//     top-level useCurrentFrame — NOT reset per beat. This is why the image
//     lives OUTSIDE the four beat Sequences below: a Sequence resets
//     useCurrentFrame to a local 0 at its own start, which would restart the
//     zoom every beat if the image were rendered inside one.
//   - Four beats, each its own Sequence with its own <Audio> firing at that
//     Sequence's local frame 0 — per-beat audio only, never concatenated
//     into one track (locked convention, same as every QuickStrike). Frame
//     offsets given directly by the brief (already derived from each line's
//     actual measured duration + 0.4s pad — see
//     scripts/generateVoiceover-truman-million-verdict.py).
//   - Beat headline text uses GoldLowerThird (gold rule + reveal animation,
//     ALL-CAPS short-headline convention) rather than CaptionOverlay —
//     confirmed with the user: the four lines are short punchy headlines
//     (GoldLowerThird's convention everywhere else in this codebase), not
//     verbatim sentence-case VO captions (CaptionOverlay's convention), and
//     "gold animated rule styling" specifically names GoldLowerThird's own
//     signature look, which CaptionOverlay doesn't have. Rendered INSIDE
//     each beat's own Sequence (not alongside the top-level image) so the
//     gold-rule reveal animation retriggers on every beat change, per the
//     brief's "retriggered on the same continuous image" instruction.
//     GoldLowerThird's own bottom padding is safe-zone-derived from the same
//     SAFE_ZONE_BOTTOM_Y/buffer constants CaptionOverlay uses (y<=1560 on
//     the 1920px canvas), so the platform-UI floor still holds here.
//   - CaptionOverlay now cycles phrase-by-phrase (2-4 words each, split at
//     natural boundaries) instead of one static block per beat, using its
//     OWN built-in word-count-proportional cue timing (lines + a single
//     audioDurationFrames) — no separate timing math was written for this,
//     the shared component already distributes each phrase's on-screen
//     window across audioDurationFrames proportional to its word count, with
//     no gap/overlap between cues by construction. audioDurationFrames is
//     now each beat's RAW (un-padded) audio duration — rawAudioFrames below
//     — not the padded Sequence duration used two revisions ago, so phrases
//     finish exactly when the speech does rather than stretching into the
//     trailing ~0.4s pad; this matches the raw/padded split convention every
//     other QuickStrike already uses (audioDurationSeconds vs
//     durationInSeconds), which this format just hadn't adopted until now.
//     No forced-alignment timestamps from Kokoro — this is a word-count
//     estimate, not real per-word timing, which is expected. overlayText is
//     still passed through so CaptionOverlay's own ceiling math sits it
//     directly above GoldLowerThird's box for whatever that beat's headline
//     renders at (same stacked pattern every other composition uses) — moot
//     on beat 4, which has no headline to avoid. Font family now matches
//     GoldLowerThird's own bold-sans stack (HEADLINE_FONT_FAMILY below) via
//     CaptionOverlay's new opt-in fontFamily prop, instead of the shared
//     component's un-set (serif) default — see QuickStrikeShared.tsx's diff
//     for that addition; every other composition, which doesn't pass this
//     prop, is unaffected. Caption font size (38, unset here) stays below
//     the headline's 52 so the two remain visually distinct despite sharing
//     a type family now.
//   - Background music (patton-blood-and-guts-music.mp3, volume 0.15, loop)
//     is a single top-level <Audio>, unbounded by any Sequence — same
//     pattern as every other QuickStrike's music bed, which relies on the
//     Composition's own durationInFrames (registered in Root.jsx) to stop
//     it, rather than wrapping it in an explicit Sequence. Now covers the
//     full 824 frames (was 749) automatically, since it was never bounded
//     to the old total in the first place.
//   - Beat 4 (frames 544-749, unchanged range) is narration-only: no
//     GoldLowerThird on this beat, just its (trimmed) CaptionOverlay line
//     and its existing Audio — nothing competes on screen with the caption
//     here. The full "...Comment your verdict." line still plays in beat
//     4's audio; only the ON-SCREEN caption is trimmed, since that closing
//     line now belongs to beat 5's end card instead.
//   - Beat 5 (frames 749-824, NEW) is a silent held end card: same
//     continuous image, no further zoom (the push interpolate's input range
//     is [0, NARRATION_FRAMES] = [0, 749], deliberately NOT the new overall
//     TOTAL_FRAMES — extrapolateRight: 'clamp' already holds it at 1.15 for
//     any frame past 749 with no new logic needed; widening that range to
//     the new total would have made the zoom start moving again during the
//     end card, which is why NARRATION_FRAMES stays a separate constant
//     from TOTAL_FRAMES now that the two diverge). Centered CTA text over a
//     dedicated full-frame scrim (its own component, not GoldLowerThird —
//     Vignette stays transparent through the center and is tuned for
//     bottom-anchored text, so it doesn't sufficiently darken behind
//     CENTERED text). No caption bar, no Audio in this Sequence — only the
//     already-unbounded music bed continues under it.
//   - No PDF/lead-magnet CTA card beyond the beat 5 end card described
//     above — this format still ends on the verdict question text itself,
//     no CTA_CONFIG lookup.

const IMAGE = 'slides/Truman-Decision/truman-million-verdict.jpg';

// NARRATION_FRAMES is the push zoom's own input range end (frame at which
// it reaches ZOOM_TO) — kept separate from TOTAL_FRAMES below on purpose:
// the zoom logic itself is unchanged from before this beat 5 existed, still
// targeting exactly frame 749, and extrapolateRight: 'clamp' is what holds
// it there through the new end card rather than any new logic.
const NARRATION_FRAMES = 749;
const END_CARD_FRAMES = 75; // beat 5, ~2.5s at 30fps
const TOTAL_FRAMES = NARRATION_FRAMES + END_CARD_FRAMES; // 824

const ZOOM_FROM = 1.0;
const ZOOM_TO = 1.15;

const END_CARD_TEXT = 'Did Truman still make the right call? Comment your verdict.';

// Matches GoldLowerThird's own hardcoded font stack exactly, so
// CaptionOverlay's phrases read as the same type family as the headline —
// see the opt-in fontFamily prop added to CaptionOverlay in
// QuickStrikeShared.tsx for this composition specifically.
const HEADLINE_FONT_FAMILY = "'Oswald', Impact, 'Arial Black', sans-serif";

type Beat = {
  id: string;
  from: number;
  durationInFrames: number;
  audio: string;
  // Optional — beat 4 omits this entirely (narration-only: caption + audio,
  // no on-screen headline competing with it; the closing CTA line moved to
  // beat 5's dedicated end card instead).
  text?: string;
  // Phrases (2-4 words each), verbatim VO split at natural phrase
  // boundaries — CaptionOverlay's own word-count-proportional cue timing
  // distributes each phrase's on-screen window across rawAudioFrames below,
  // swapping with no gap/no overlap by construction.
  captionPhrases: string[];
  // Raw (un-padded) audio duration in frames — measured via ffprobe (see
  // scripts/generateVoiceover-truman-million-verdict.py), NOT this beat's
  // padded durationInFrames above. Captions are scoped to this so the last
  // phrase finishes when the speech finishes rather than lingering into the
  // trailing ~0.4s pad.
  rawAudioFrames: number;
};

const BEATS: Beat[] = [
  {
    id: 'beat1',
    from: 0,
    durationInFrames: 148, // frames 0-148
    audio: 'audio/truman-million-verdict-voiceover-1.mp3',
    text: 'THE CLAIM: A MILLION LIVES',
    captionPhrases: ["It's often said", 'an invasion of Japan', 'could cost a million', 'American lives.'],
    rawAudioFrames: 136, // 4.519s raw audio -> round(4.519 * 30)
  },
  {
    id: 'beat2',
    from: 148,
    durationInFrames: 383 - 148, // frames 148-383
    audio: 'audio/truman-million-verdict-voiceover-2.mp3',
    text: 'THE DOCUMENT: ~31,000 (OPENING PHASE)',
    captionPhrases: [
      'The declassified minutes',
      'never mention a million.',
      'They discuss thirty one thousand',
      "casualties for the invasion's",
      'opening phase.',
    ],
    rawAudioFrames: 223, // 7.419s raw audio -> round(7.419 * 30)
  },
  {
    id: 'beat3',
    from: 383,
    durationInFrames: 544 - 383, // frames 383-544
    audio: 'audio/truman-million-verdict-voiceover-3.mp3',
    text: 'THE CATCH: NOT ABOUT THE BOMB',
    captionPhrases: [
      'That meeting was',
      'about invading Japan,',
      'not the bomb.',
      "It's barely mentioned",
      'in the minutes.',
    ],
    rawAudioFrames: 149, // 4.963s raw audio -> round(4.963 * 30)
  },
  {
    id: 'beat4',
    from: 544,
    durationInFrames: 749 - 544, // frames 544-749
    audio: 'audio/truman-million-verdict-voiceover-4.mp3',
    // No `text` — narration-only beat, no GoldLowerThird headline here.
    // Caption phrases cover the setup question only; the audio still speaks
    // the full line including "...Comment your verdict." in full, but that
    // closing line is now shown separately as beat 5's end card instead of
    // repeated here.
    captionPhrases: [
      "If Truman wasn't shown",
      'that casualty estimate',
      'at the meeting,',
      'did he still',
      'make the right call?',
    ],
    rawAudioFrames: 193, // 6.426s raw audio -> round(6.426 * 30)
  },
];

export const totalDuration = TOTAL_FRAMES;
export { FPS };

// Reads useCurrentFrame() as a child of the beat's own Sequence, so `frame`
// here is LOCAL to that beat (resets to 0 at each beat's start) — this is
// what makes GoldLowerThird's gold-rule reveal retrigger on every beat
// change, independent of the continuous top-level zoom below. CaptionOverlay
// sits alongside it, same local frame — passing overlayText through makes
// CaptionOverlay position itself directly above whatever box GoldLowerThird
// actually renders for that beat's headline (its own ceiling-avoidance math,
// same stacked pattern every other composition uses), clamped to the same
// y<=1560 safe-zone floor. `text` is optional (beat 4 omits it) — when
// absent, GoldLowerThird is skipped entirely and CaptionOverlay falls back
// to its plain safe-zone ceiling (no headline box to avoid), same as
// omitting overlayText anywhere else in this shared engine.
function BeatOverlay({
  text,
  captionPhrases,
  rawAudioFrames,
}: {
  text?: string;
  captionPhrases: string[];
  rawAudioFrames: number;
}) {
  const frame = useCurrentFrame();
  return (
    <>
      {text && <GoldLowerThird text={text} frame={frame} />}
      <CaptionOverlay
        lines={captionPhrases}
        audioDurationFrames={rawAudioFrames}
        overlayText={text}
        fontFamily={HEADLINE_FONT_FAMILY}
      />
    </>
  );
}

// Beat 5 — dedicated silent end card (frames 749-824). Deliberately NOT
// GoldLowerThird's lower-third box: centered, larger text over a full-frame
// scrim, no caption bar (this text IS the message, not a caption of spoken
// audio — beat 4's own Audio already finished speaking by the time this
// Sequence starts). No fade in/out here either, consistent with the rest of
// this composition's "true cold open, hard cut" rule — the text is simply
// present for the Sequence's whole duration at constant opacity.
function EndCard({ text }: { text: string }) {
  return (
    <AbsoluteFill>
      {/* Full-frame scrim, not the shared Vignette — Vignette stays
          transparent through the center (it's tuned for bottom-anchored
          lower-third text), which wouldn't sufficiently darken behind this
          CENTERED text. */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.85) 100%)',
        }}
      />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
        <p
          style={{
            // Larger than GoldLowerThird's 52px beat headlines.
            fontSize: 64,
            fontWeight: 700,
            color: '#F5F0E8',
            textAlign: 'center',
            lineHeight: 1.3,
            margin: 0,
            textShadow: '0 4px 20px rgba(0,0,0,0.95)',
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            letterSpacing: '0.01em',
          }}
        >
          {text}
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export default function TrumanMillionVerdict() {
  // Composition-absolute frame (0-824), NOT reset by the beat Sequences
  // below — this is what makes the push zoom continuous across all four
  // narration beats instead of restarting each time.
  const frame = useCurrentFrame();

  // Range is [0, NARRATION_FRAMES] (749), NOT [0, TOTAL_FRAMES] (824) —
  // unchanged from before beat 5 existed. extrapolateRight: 'clamp' holds
  // this at ZOOM_TO for every frame past 749, which is what keeps the image
  // motionless (already at its final ~1.15 scale) through the new end card
  // with no additional logic.
  const scale = interpolate(frame, [0, NARRATION_FRAMES], [ZOOM_FROM, ZOOM_TO], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/patton-blood-and-guts-music.mp3')} volume={0.15} loop />

      {/* Single continuous image — cover-fit, then the push scale on top.
          Lives OUTSIDE the beat Sequences so the zoom is driven by the
          composition's own absolute frame, never reset. Opacity is never
          animated here — true cold open, hard cut ending. */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile(IMAGE)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      </AbsoluteFill>

      {BEATS.map((beat) => (
        <Sequence key={beat.id} from={beat.from} durationInFrames={beat.durationInFrames} layout="none">
          <BeatOverlay text={beat.text} captionPhrases={beat.captionPhrases} rawAudioFrames={beat.rawAudioFrames} />
          {/* Per-beat voiceover — fires at this beat's own local frame 0,
              not a shared/concatenated track. */}
          <Audio src={staticFile(beat.audio)} />
        </Sequence>
      ))}

      {/* Beat 5 — silent held end card, frames 749-824. No Audio here: the
          narration already finished in beat 4; only the already-unbounded
          music bed continues under it. */}
      <Sequence from={NARRATION_FRAMES} durationInFrames={END_CARD_FRAMES} layout="none">
        <EndCard text={END_CARD_TEXT} />
      </Sequence>
    </AbsoluteFill>
  );
}
