import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  GOLD,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// Albert Sidney Johnston / Shiloh — BLUEGRAY-family Civil War Quick Strike.
//
// Locked decisions from the build brief:
//   - No fades anywhere: true cold open at frame 0 (isFirst on slide 1), a
//     4-frame hard cut on every other slide (handled by the shared SlidePanel
//     itself), no fade to black at the end.
//   - Per-slide audio only (one <Audio> per Sequence, own local frame 0) — no
//     continuous/concatenated track.
//   - All five source images are already 1080x1920 — the canvas's exact
//     dimensions — INCLUDING 03_thulstrup_battle.jpg, which was expected to
//     be a wide/panoramic source earning the standard Pan-Fill formula but
//     turned out to already be pre-cropped to portrait before delivery.
//     Pan-Fill's own math on that image: base_scale = 1920/1920 = 1.0,
//     rendered width = 1080*1.0 = 1080 = canvas width, pan room = 0px — there
//     is no real pixel data beyond the frame to pan across. Confirmed with
//     the user rather than forcing a manufactured pan into a 0px budget
//     (which would either show black edges or require upscaling far enough
//     to soften the painting's detail). All five slides use the same
//     static-cover-fit-with-minimal-push-in treatment as a result.
//   - Timing is LOCKED from ffprobe-measured VO + pad — see
//     scripts/generateVoiceover-Johnston-Shiloh.py. Do not recalculate.
//     Standard pad is 0.4s (PAD_S); slides 3 & 4 use a REDUCED 0.2s pad
//     (PAD_REDUCED_S) instead — the only lever pulled to bring the 5 VO
//     slides + End Card in under the 900-frame (30s) budget, per explicit
//     instruction to trim pad before touching any VO content. Slide 1 and
//     slide 5 keep the full 0.4s pad untouched (open/close anchors, not to
//     be cut). Total: 839 VO-slide frames + 60 End Card frames = 899 frames
//     / 29.967s — 1 frame under the 900-frame ceiling.
//   - Slide 4's VO/caption was regenerated: the original "Lincoln defended
//     him: He fights." didn't read as a quote when spoken. Replaced with
//     "Grant was blamed for the surprise. But Lincoln refused to fire
//     him — saying just two words: he fights." (SLIDE4_AUDIO_S below is the
//     regenerated file's ffprobe-measured duration, 5.982041s).
//   - Silent End Card, ported verbatim from KerryTestimonyQS.tsx: 60 frames
//     (2.0s), no VO, no trigger word, no comment CTA — on-screen text only
//     ("Follow the page..." / "Like. Save. Share."). See EndCard below.
const PAD_S = 0.4;
const PAD_REDUCED_S = 0.2; // slides 3 & 4 only — see note above

const SLIDE1_AUDIO_S = 4.048980;
const SLIDE2_AUDIO_S = 4.806531;
const SLIDE3_AUDIO_S = 6.295510;
const SLIDE4_AUDIO_S = 5.982041;
const SLIDE5_AUDIO_S = 5.276735;

const SLIDES: SharedSlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Johnston-Shiloh/01_johnston_portrait.jpg',
    audio: 'audio/Johnston-Shiloh/Johnston-Shiloh-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: 'GEN. ALBERT SIDNEY JOHNSTON, C.S.A.',
    overlayText: "THE CONFEDERACY'S BEST HOPE IN THE WEST.",
    captionLines: [
      'Jefferson Davis considered him',
      "the Confederacy's best hope in the West.",
    ],
    // 1080x1920 — exact canvas dimensions, zero native pan room. Static
    // cover-fit with a minimal push-in, same treatment as every portrait
    // source elsewhere in this engine (e.g. ThomasChickamaugaQS.tsx slide 1).
    motion: { scaleFrom: 1.0, scaleTo: 1.03, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
  },
  {
    id: 'slide2',
    image: 'slides/Johnston-Shiloh/02_beauregard_portrait.jpg',
    audio: 'audio/Johnston-Shiloh/Johnston-Shiloh-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: 'GEN. P.G.T. BEAUREGARD, C.S.A.',
    overlayText: 'BY AFTERNOON, HE WAS DEAD.',
    captionLines: [
      'By that afternoon, Johnston was dead.',
      'Command passed to Beauregard mid-battle.',
    ],
    // 1080x1920 — same zero-pan-room case as slide 1.
    motion: { scaleFrom: 1.0, scaleTo: 1.03, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
  },
  {
    id: 'slide3',
    image: 'slides/Johnston-Shiloh/03_thulstrup_battle.jpg',
    audio: 'audio/Johnston-Shiloh/Johnston-Shiloh-vo-03.mp3',
    // Reduced pad (0.2s, not the standard 0.4s) — trimmed to fit the
    // 900-frame budget after adding the End Card. See header note.
    durationInSeconds: SLIDE3_AUDIO_S + PAD_REDUCED_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: 'BATTLE OF SHILOH — APRIL 6–7, 1862',
    overlayText: 'THE BLOODIEST BATTLE AMERICA HAD YET SEEN.',
    captionLines: [
      'Two days of fighting.',
      'Nearly 24,000 casualties —',
      'the bloodiest battle America had seen.',
    ],
    // 1080x1920 — despite being a battle painting, this file was already
    // pre-cropped to portrait before delivery (confirmed via ffprobe: no
    // wider original in the slides folder). Zero native pan room by the
    // same Pan-Fill math as the two portraits above (base_scale =
    // 1920/1920 = 1.0, rendered width = 1080 = canvas width) — user
    // confirmed treating this as static rather than forcing a pan that
    // would either show black edges or require destructive upscaling.
    motion: { scaleFrom: 1.0, scaleTo: 1.03, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
  },
  {
    id: 'slide4',
    image: 'slides/Johnston-Shiloh/04_grant_portrait.jpg',
    audio: 'audio/Johnston-Shiloh/Johnston-Shiloh-vo-04.mp3',
    // Reduced pad (0.2s, not the standard 0.4s) — trimmed to fit the
    // 900-frame budget after adding the End Card. See header note.
    durationInSeconds: SLIDE4_AUDIO_S + PAD_REDUCED_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    label: 'MAJ. GEN. ULYSSES S. GRANT, U.S.A.',
    overlayText: "LINCOLN'S DEFENSE: \"HE FIGHTS.\"",
    // Regenerated VO line (see header note) — caption matches the new audio
    // verbatim, split into phrase-level chunks per CaptionOverlay's timing
    // convention.
    captionLines: [
      'Grant was blamed for the surprise.',
      'But Lincoln refused to fire him —',
      "saying just two words: 'He fights.'",
    ],
    // 1080x1920 — same zero-pan-room case as slides 1 and 2.
    motion: { scaleFrom: 1.0, scaleTo: 1.03, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
  },
  {
    id: 'slide5',
    image: 'slides/Johnston-Shiloh/05_johnston_monument_color.jpg',
    audio: 'audio/Johnston-Shiloh/Johnston-Shiloh-vo-05.mp3',
    durationInSeconds: SLIDE5_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE5_AUDIO_S,
    label: 'SHILOH NATIONAL MILITARY PARK, TENNESSEE',
    overlayText: 'THE HIGHEST-RANKING OFFICER EVER KILLED IN THE WAR.',
    captionLines: [
      'Johnston remains the highest-ranking officer',
      'ever killed in the war.',
      'This is where he fell.',
    ],
    // 1080x1920 — already cropped to the canvas per the build brief. Same
    // static cover-fit / minimal push-in as every other slide.
    motion: { scaleFrom: 1.0, scaleTo: 1.03, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card — ported verbatim from KerryTestimonyQS.tsx: NO voiceover, NO
// trigger word, NO comment CTA. Black background, hard cut in (same
// HARD_CUT_FRAMES=4 transition every other slide uses), constant opacity 1
// for the rest — no fade out, ever. Text has its own quick local reveal
// (opacity 0->1 over a few frames), matching every other end card's
// headline/subline reveal in this codebase — that's a text entrance, not a
// slide-level fade, so it doesn't violate the "no fade" rule.
//
// Duration has no VO to time against — 60 frames (2.0s @ 30fps), matching
// KerryTestimonyQS's END_CARD_FRAMES exactly, per explicit instruction to
// match that build's end card.
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

export default function JohnstonShilohQS() {
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

      {/* lee-resignation-music.mp3, per explicit instruction — swapped from
          the LincolnFortStevens-music.mp3 default, same 0.15 volume/loop. */}
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
