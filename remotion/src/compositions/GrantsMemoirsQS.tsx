import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  GOLD,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// Grant's Memoirs — one-off Quick Strike, BLUEGRAY-adjacent but outside the
// BLUEGRAY/FRONT/RECON series proper (no trigger-word CTA, no comment
// automation), following the same pattern as HancocksLineQS.tsx/
// HessAmnesiaQS.tsx.
//
// Locked decisions from the build brief:
//   - True cold open: slide 1 fully visible at full brightness from frame 0,
//     no fade-in (isFirst on slide 1, handled by the shared SlidePanel).
//     4-frame hard cut on every transition after that, INCLUDING into the
//     CTA card. No fade-out anywhere — hard cut ending.
//   - Per-slide audio only (one <Audio> per Sequence, own local frame 0) —
//     never a concatenated track. Timing is LOCKED from ffprobe-measured VO
//     + the standard 0.4s pad — see
//     scripts/generateVoiceover-grants-memoirs.py. Do not recalculate.
//   - Pan-Fill categorization (per build brief):
//       Slides 1,2,3,4,5,7,8 — portrait/single-subject stills, all already
//       narrower than the 1.2 aspect threshold (see per-slide dims below) —
//       Pan-Fill resolves each to 'static' automatically, same minimal
//       push-in treatment as HancocksLineQS/HessAmnesiaQS's portrait slides.
//       Slide 6 (06-porch-lastdays.jpg, 4829x2501, aspect 1.931) — clears
//       the pan threshold by a wide margin; sourceWidth/sourceHeight
//       supplied, no explicit `motion`, so Pan-Fill's default horizontal pan
//       applies at its standard 87.5% PAN_FILL_RANGE_FRACTION (comfortably
//       inside the build brief's "~85-90% of available pan room" ask —
//       this is the shared engine's own existing default, not a per-slide
//       override).
//   - CTA card is SPOKEN, not silent — unlike HancocksLineQS/HessAmnesiaQS's
//     text-only end cards. Own Kokoro line (grants-memoirs-vo-cta.mp3,
//     2.612s raw / 3.012s padded / 90 frames — see generateVoiceover-
//     grants-memoirs.py), played via its own <Audio> at the Sequence's local
//     frame 0, same per-slide-audio pattern as every other slide. No trigger
//     word, no comment automation — CTA text is exactly "Follow the page for
//     the history they didn't teach you" per the build brief (NOT the
//     "Follow the page for more history..." wording HancocksLineQS/
//     HessAmnesiaQS use for their silent cards).
//   - Music: audio/grants-memoirs-music.mp3 at 0.15 volume, looped — its own
//     dedicated track (not reused from HessAmnesiaQS/lee-resignation-music.mp3
//     as originally built).
//   - Gold animated rule on overlay text: SlidePanel's own GoldLowerThird
//     already renders this on every slide automatically — no extra wiring.
//   - Safe zone: SAFE_ZONE_BOTTOM_Y (1580) is the shared module default and
//     is not overridden here — build brief's caption safe-zone ask is
//     satisfied structurally. Slides 3 and 8 both have busy lower-frame
//     content (family group) — checked at render (see render notes).
const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified —
// see scripts/generateVoiceover-grants-memoirs.py). Do not recalculate.
// Round 3 (prosody pass, not pronunciation -- phonemes were already correct):
// slide 1 drops the period after "E" ("Robert E. Lee" -> "Robert E Lee" --
// the period was literally retained as a "." token by Kokoro's phonemizer
// between "E" and "Lee", which caused the audible pause; a "Robert Edward
// Lee" full-name variant was tried and then reverted per direction back to
// "Robert E Lee"), slide 2 swaps "con man" -> "swindler", slide 4 is
// restructured so "cancer" isn't sentence-final, slide 7 swaps "rank" ->
// "count". See the script's own comment for the full reasoning and the
// remaining fallback phrasing kept as a sidecar file
// (grants-memoirs-vo-04-alt.mp3, not wired into this composition).
const SLIDE1_AUDIO_S = 5.695;
const SLIDE2_AUDIO_S = 5.616;
const SLIDE3_AUDIO_S = 6.504;
const SLIDE4_AUDIO_S = 6.374;
const SLIDE5_AUDIO_S = 4.963;
const SLIDE6_AUDIO_S = 4.963;
const SLIDE7_AUDIO_S = 3.866;
const SLIDE8_AUDIO_S = 7.079;
const CTA_AUDIO_S = 2.612;

// Category 1 (portrait/single-subject) — static cover-fit with minimal
// push-in, per build brief. Matches HancocksLineQS/HessAmnesiaQS's own
// STATIC_MOTION choice of scaleTo 1.03 over Pan-Fill's default static
// push-in (1.05) — both within the brief's aggressive-Ken-Burns 1.0-1.08
// range.
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
    // 1929x2490, aspect 0.775 — Category 1 (static).
    image: 'slides/Grant/01-landing.jpg',
    audio: 'audio/grants-memoirs-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: 'LT. GEN. ULYSSES S. GRANT',
    overlayText: 'HE SAVED THE UNION',
    captionLines: [
      'Ulysses S Grant beat Robert E Lee,',
      'served two terms as president,',
      'and became a legend.',
    ],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide2',
    // 960x1286, aspect 0.746 — Category 1 (static).
    image: 'slides/Grant/02-statesman.jpg',
    audio: 'audio/grants-memoirs-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: 'PRESIDENT GRANT, LATER YEARS',
    overlayText: 'THEN HE LOST IT ALL',
    captionLines: [
      "By eighteen eighty four, he'd put his fortune",
      'in the hands of a Wall Street swindler',
      'young enough to be his son.',
    ],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide3',
    // 1184x2106, aspect 0.562 — Category 1 (static).
    image: 'slides/Grant/03-family-risk.jpg',
    audio: 'audio/grants-memoirs-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: 'THE GRANT FAMILY',
    overlayText: 'A PONZI SCHEME TOOK EVERYTHING',
    captionLines: [
      "Ferdinand Ward's Ponzi scheme collapsed,",
      "wiping out Grant's fortune",
      'and leaving his family nearly destitute.',
    ],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide4',
    // 3687x4651, aspect 0.793 — Category 1 (static).
    image: 'slides/Grant/04-twain.jpg',
    audio: 'audio/grants-memoirs-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    label: 'MARK TWAIN',
    overlayText: 'THEN CAME THE DIAGNOSIS',
    captionLines: [
      'Doctors found cancer in his throat,',
      'and Mark Twain gave him a chance',
      'to save his family by writing his memoirs.',
    ],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide5',
    // 946x1050, aspect 0.901 — Category 1 (static).
    image: 'slides/Grant/05-writing.jpg',
    audio: 'audio/grants-memoirs-vo-05.mp3',
    durationInSeconds: SLIDE5_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE5_AUDIO_S,
    label: 'GRANT AT MOUNT MCGREGOR, 1885',
    overlayText: 'HE WROTE THROUGH THE PAIN',
    captionLines: [
      'So Grant wrote, wrapped in blankets,',
      'barely able to speak,',
      'less than a month before the end.',
    ],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide6',
    // 4829x2501, aspect 1.931 — Category 2 (wide/landscape). Pan-Fill's
    // default horizontal pan applies automatically (sourceWidth/sourceHeight
    // supplied, no explicit `motion`).
    image: 'slides/Grant/06-porch-lastdays.jpg',
    audio: 'audio/grants-memoirs-vo-06.mp3',
    durationInSeconds: SLIDE6_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE6_AUDIO_S,
    label: 'MOUNT MCGREGOR, JULY 19, 1885',
    overlayText: 'FOUR DAYS BEFORE HE DIED',
    captionLines: [
      'This is him four days before he died,',
      'one day before he finished reviewing the manuscript.',
    ],
    sourceWidth: 4829,
    sourceHeight: 2501,
  },
  {
    id: 'slide7',
    // 822x1222, aspect 0.673 — Category 1 (static).
    image: 'slides/Grant/07-book-cover.jpg',
    audio: 'audio/grants-memoirs-vo-07.mp3',
    durationInSeconds: SLIDE7_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE7_AUDIO_S,
    label: 'PERSONAL MEMOIRS OF U.S. GRANT',
    overlayText: 'THE BOOK BECAME A CLASSIC',
    captionLines: [
      'Critics still count it among',
      'the finest military memoirs ever written.',
    ],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide8',
    // 1924x2508, aspect 0.767 — Category 1 (static).
    image: 'slides/Grant/08-julia.jpg',
    audio: 'audio/grants-memoirs-vo-08.mp3',
    durationInSeconds: SLIDE8_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE8_AUDIO_S,
    label: 'JULIA DENT GRANT',
    overlayText: 'IT SAVED HIS FAMILY',
    captionLines: [
      'Julia received the largest royalty check',
      'written up to that time.',
      'The man who died broke saved his family after all.',
    ],
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
// CTA card — SPOKEN (own Kokoro line + Audio element), unlike the silent
// text-only end cards on HancocksLineQS/HessAmnesiaQS. Same hard-cut-in /
// no-fade-out shape as every other card in this codebase. Duration matches
// the CTA line's own padded length (90 frames / 3.00s), not the usual 60 —
// same reasoning as McNamaraConfessionQS's spoken CTA_FRAMES.
// ---------------------------------------------------------------------------
const CTA_DURATION_S = CTA_AUDIO_S + PAD_S;
const CTA_FRAMES = Math.round(CTA_DURATION_S * FPS);

function CTACard() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ruleWidth = interpolate(frame, [8, 33], [0, 100], {
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
      <Audio src={staticFile('audio/grants-memoirs-vo-cta.mp3')} />

      <div style={{ width: '80%', maxWidth: 900, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ height: 3, background: GOLD, width: `${ruleWidth}%`, marginBottom: 28 }} />
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
          Follow the page for the history they didn't teach you.
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

export default function GrantsMemoirsQS() {
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

      <Audio src={staticFile('audio/grants-memoirs-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <SlidePanel slide={slide} isFirst={i === 0} />
        </Sequence>
      ))}

      <Sequence from={ctaFrom} durationInFrames={CTA_FRAMES} layout="none">
        <CTACard />
      </Sequence>
    </AbsoluteFill>
  );
}
