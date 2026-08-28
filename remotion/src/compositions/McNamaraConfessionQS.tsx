import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  CaptionOverlay,
  GOLD,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// McNamara "We Were Wrong" — RECON Quick Strike. Self-contained (no external
// data file), following the QuickStrikeShared-based one-off pattern (e.g.
// HancocksLineQS.tsx, AntietamQS.tsx) rather than the older HissVideo.jsx
// external-data-file architecture. "Standard HissVideo spec" per the build
// brief refers to that file's STRUCTURAL rules only (no fade anywhere, hard
// cuts, Ken Burns 1.0-1.08 range) — those are honored below via the shared
// engine's own Pan-Fill system, not by copying HissVideo's file layout.
//
// Locked decisions from the build brief:
//   - NO fade in, NO fade out, anywhere. Cold open at frame 0 (isFirst on
//     slide 1, handled by SlidePanel). 4-frame hard cut (HARD_CUT_FRAMES) on
//     every transition, INCLUDING slide 3 -> slide 4 — that boundary is a
//     hard AUDIO cut (see below) but still gets the same 4-frame visual
//     opacity ramp every other transition in this codebase uses. Hard cut
//     to black at the very end (end card holds at opacity 1, no fade-out).
//   - Per-slide audio only for slides 1-3 (one <Audio> per Sequence, own
//     local frame 0) — timing LOCKED from ffprobe-measured VO + the
//     standard 0.4s pad (see scripts/generateVoiceover-mcnamara-confession.py).
//     Do not recalculate.
//   - Slide 4 is real archival footage (04-mcnamara-we-were-wrong.mp4,
//     already blur-border-filled/denoised/sharpened/loudnorm'd to -16 LUFS
//     at exactly 1080x1920 — no live blur-border compositing needed here,
//     unlike IaDrangValleyQS/TetCitadelQS/DoolittleRaidQS's letterboxed 16:9
//     sources). Plays its OWN embedded audio at default volume — no
//     separate Audio element, no muting. Duration is the clip's own real
//     length (261 frames / 8.70s, ffprobe-verified), not VO-padded.
//   - Music (northwoods.mp3, 0.15 volume) plays under slides 1-3 ONLY,
//     confined to exactly that frame range via its own Sequence — when that
//     Sequence unmounts at the slide 3/4 boundary, the Audio element stops
//     dead with it. No fade-out, no crossfade: a true hard cut, by design.
//     Slide 4 and the CTA card get no music and no added VO — slide 4 has
//     only its own embedded audio, the CTA card is fully silent (no Audio
//     element at all, anywhere in that Sequence).
//   - Ken Burns, slides 1-3: all three stills are already portrait-cropped
//     to the exact canvas size (1080x1920 each, confirmed) — zero real pan
//     room, same situation HancocksLineQS's four already-portrait slides
//     were in. sourceWidth/sourceHeight are supplied anyway (not an
//     explicit `motion`) so Pan-Fill's own aspect-ratio check (1080/1920 =
//     0.5625, far under the 1.2 pan threshold) resolves each to its
//     'static' category and applies the shared engine's own built-in
//     subtle push-in (PAN_FILL_STATIC_SCALE_TO, 1.0 -> 1.05) automatically
//     — "minimal pan" satisfied structurally by the shared system, not a
//     hand-picked scale value (same reasoning as AntietamQS.tsx's Pan-Fill
//     note). Slide 4 is video, not a still — no Ken Burns, motion is
//     native to the footage.
//   - Captions: standing project convention (per AntietamQS.tsx/Kerry, etc.)
//     is Remotion-native CaptionOverlay on every slide, synced to that
//     slide's own real (unpadded) VO audio, IN ADDITION TO the GoldLowerThird
//     overlay headline — not a substitute for it, both render together.
//     Slides 1-3 get this via SlidePanel's own captionLines prop (which
//     already threads audioDurationFrames from audioDurationSeconds, so no
//     extra wiring needed). Slide 4's real spoken dialogue gets the same
//     CaptionOverlay component called directly (same technique AntietamQS.tsx
//     uses to call shared building blocks outside SlidePanel), phrase-cued
//     across the clip's own 261-frame length. (Earlier revision of this file
//     omitted captionLines on slides 1-3 entirely -- a spec error, corrected
//     here, not a rendering bug: SlidePanel/CaptionOverlay were never broken.)
//   - Slide 4 also gets a small "1995" date tag, bottom-right corner,
//     clear of the caption block (which sits centered, top ~1450, well
//     above this tag's fixed bottom-right position) and present for the
//     clip's full duration. QuickStrikeShared.tsx is locked/consume-only
//     (per AntietamQS.tsx's own note) and ContextTag only supports
//     top-left/bottom-left, so this is a small local component instead of
//     a shared-file edit.
//   - CTA card: 90 frames (3.00s, per the locked frame map) — silent, no
//     trigger word, no VO. Text content/casing exactly as specified in the
//     brief.
const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified
// — see scripts/generateVoiceover-mcnamara-confession.py). Do not
// recalculate; these are locked. Two updates so far:
//   1. Pronunciation-fix pass (McNamara/Pentagon phoneme splice on 01/03,
//      "U.S." -> "United States" text fix on 02) — 135/202/188 -> 132/199/189
//      frames, boundary 525 -> 520, total 876 (29.20s) -> 871 (29.03s).
//   2. McNamara vowel re-fix (01 only — first pass fixed the doubled-r/
//      rhotic ending but kept the wrong "ɑː" vowel instead of "ɛ"; confirmed
//      correct by ear against an isolated test clip before touching this
//      file) — 132 -> 135 frames, boundary 520 -> 523, total 871 (29.03s)
//      -> 874 (29.13s).
const SLIDE1_AUDIO_S = 4.101;
const SLIDE2_AUDIO_S = 6.243;
const SLIDE3_AUDIO_S = 5.904;

// Slide 4's real clip length (ffprobe-verified, 04-mcnamara-we-were-wrong.mp4)
// — not VO-padded, this is the actual footage duration.
const SLIDE4_VIDEO_S = 8.7;
const SLIDE4_VIDEO_FRAMES = Math.round(SLIDE4_VIDEO_S * FPS); // 261

const CTA_FRAMES = 90; // 3.00s, per the locked frame map

type SlideConfig = SharedSlideConfig & {
  sourceWidth: number;
  sourceHeight: number;
};

// Slides 1-3 only -- slide 4 (video) and the CTA card are handled as
// separate Sequences below, not through SlidePanel.
const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/McNamara/01-official-portrait.jpg',
    audio: 'audio/mcnamara-confession-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: 'SEC. OF DEFENSE, 1961–1968',
    overlayText: 'HE RAN THE VIETNAM WAR FOR SEVEN YEARS',
    captionLines: [
      'Robert McNamara ran the Pentagon',
      'through seven years of Vietnam.',
    ],
    sourceWidth: 1080,
    sourceHeight: 1920,
  },
  {
    id: 'slide2',
    image: 'slides/McNamara/02-cabinet-meeting-1967.jpg',
    audio: 'audio/mcnamara-confession-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    overlayText: 'IN PRIVATE, HE ORDERED THE TRUTH WRITTEN DOWN',
    captionLines: [
      'In nineteen sixty seven, he secretly commissioned a history',
      'of United States decision-making in Vietnam.',
    ],
    sourceWidth: 1080,
    sourceHeight: 1920,
  },
  {
    id: 'slide3',
    image: 'slides/McNamara/03-pentagon-papers-declassified.jpg',
    audio: 'audio/mcnamara-confession-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    overlayText: 'THAT STUDY BECAME THE PENTAGON PAPERS',
    captionLines: [
      'That study became the Pentagon Papers,',
      'the record of decisions the public was never supposed to see.',
    ],
    sourceWidth: 1080,
    sourceHeight: 1920,
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slides123Duration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);
const slide4From = slides123Duration;
const ctaFrom = slide4From + SLIDE4_VIDEO_FRAMES;

// ---------------------------------------------------------------------------
// Small local corner tag for slide 4's "1995" date anchor. Same visual
// language as QuickStrikeShared's ContextTag (gold, Oswald, tracked caps)
// but bottom-RIGHT, which that component doesn't support (top-left/
// bottom-left only) — QuickStrikeShared.tsx is locked/consume-only, so this
// stays local rather than adding a position variant there.
// ---------------------------------------------------------------------------
function DateTag({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 48,
        right: 40,
        color: GOLD,
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: '0.06em',
        fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
        textShadow: '0 1px 6px rgba(0,0,0,0.9)',
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 4 — real archival footage, own embedded audio, no Ken Burns (motion
// is native to the clip). Same 4-frame hard-cut-in opacity ramp as every
// other slide transition, even though the AUDIO side of this boundary is a
// dead cut (music + slide 3's VO stop with no fade — see the music Sequence
// below — while this clip's own track starts at its natural volume from
// frame 0 of this Sequence, no crossfade).
// ---------------------------------------------------------------------------
function McNamaraClip() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      {/* Already blur-border-filled/processed to exactly 1080x1920 -- a
          single full-canvas layer, not the letterboxed double-layer
          composite IaDrangValleyQS/TetCitadelQS/DoolittleRaidQS use for
          raw 16:9 sources. Default volume (no `volume` prop = full) since
          this clip's own embedded audio IS the slide's only sound. */}
      <OffthreadVideo
        src={staticFile('videos/McNamara/04-mcnamara-we-were-wrong.mp4')}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      <CaptionOverlay
        lines={[
          'Yet we were wrong.',
          'I believe we were terribly wrong.',
          'I believe, therefore, we owe it to future generations to explain why.',
        ]}
        audioDurationFrames={SLIDE4_VIDEO_FRAMES}
      />

      <DateTag text="1995" />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// CTA card — silent (no Audio element at all, no music resumes), no trigger
// word, no comment automation. Same hard-cut-in / no-fade-out shape as every
// other end card in this codebase; 90 frames (3.00s) per the locked frame
// map, not the usual 60.
// ---------------------------------------------------------------------------
function CTACard() {
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
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1.3,
            textAlign: 'center',
            textShadow: '0 2px 14px rgba(0,0,0,0.95)',
            margin: '0 0 28px',
          }}
        >
          FOLLOW THE PAGE FOR MORE HISTORY THEY DIDN'T TEACH YOU
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

export const totalDuration = ctaFrom + CTA_FRAMES; // 874 frames / 29.13s
export { FPS };

export default function McNamaraConfessionQS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Confined to slides 1-3 only -- this Sequence unmounting at the
          slide 3/4 boundary is what makes the music (and, independently,
          slide 3's own per-slide Audio ending on its own Sequence) stop
          dead with no fade. northwoods.mp3 (168.8s) is far longer than the
          17.5s window it plays in here, so no loop is needed. */}
      <Sequence from={0} durationInFrames={slides123Duration} layout="none">
        <Audio src={staticFile('audio/northwoods.mp3')} volume={0.15} />
      </Sequence>

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <SlidePanel slide={slide} isFirst={i === 0} />
        </Sequence>
      ))}

      <Sequence from={slide4From} durationInFrames={SLIDE4_VIDEO_FRAMES} layout="none">
        <McNamaraClip />
      </Sequence>

      <Sequence from={ctaFrom} durationInFrames={CTA_FRAMES} layout="none">
        <CTACard />
      </Sequence>
    </AbsoluteFill>
  );
}
