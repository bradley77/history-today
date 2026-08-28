import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  GOLD,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// Hancock's Line — one-off Gettysburg Quick Strike, outside the BLUEGRAY/
// FRONT/RECON series (no trigger-word CTA, no comment automation).
//
// Locked decisions from the build brief:
//   - True cold open: slide 1 fully visible at full brightness from frame 0,
//     no fade-in (isFirst on slide 1, handled by the shared SlidePanel).
//     4-frame hard cut on every slide after that. No fade-out anywhere —
//     hard cut ending.
//   - Per-slide audio only (one <Audio> per Sequence, own local frame 0) —
//     never a concatenated track.
//   - Pan-Fill: slide 2 uses 02-hancock-corps-wide-source.jpg, the
//     content-only crop (matte border and caption stripped) of the
//     Thulstrup painting, at 4460x3125 — NOT the already-portrait-cropped
//     02-hancock-corps.jpg (1080x1920, zero pan room) initially wired in.
//     Pan-Fill math at 4460x3125: aspect 1.427 (>= 1.2 threshold -> pan),
//     base_scale = 1920/3125 = 0.6144, renderedWidth = 4460*0.6144 = 2740px,
//     panRoomPx = 2740-1080 = 1660px, marginPerSide = max(1660*0.125/2, 50)
//     = 104px, usablePanPx = 1660-208 = 1453px — comfortably clears the 50px
//     buffer floor, so this slide gets the real horizontal pan (sourceWidth/
//     sourceHeight props, Pan-Fill resolves 'pan' automatically) rather than
//     the static push-in every other slide uses. All four other slides ARE
//     already-portrait (1080x1920) with zero real pan room — that part of
//     the original finding stands and they keep the static treatment.
//   - Timing is LOCKED from ffprobe-measured VO + the standard 0.4s pad —
//     see scripts/generateVoiceover-hancocks-line.py. Do not recalculate.
//   - Silent End Card, ported verbatim from JohnstonShilohQS.tsx (itself
//     ported from KerryTestimonyQS.tsx): 60 frames (2.0s), no VO, no trigger
//     word, no comment CTA — on-screen text only ("Follow the page..." /
//     "Like. Save. Share."). This is the established no-trigger-word,
//     newsletter-only-follow pattern for one-off pieces outside the series.
//   - Music: LincolnFortStevens-music.mp3 at 0.15 volume, looped — the same
//     track already used as the default bed across BullRun1QS, AntietamQS,
//     VicksburgMineQS, MaryesAngelQS, ThomasChickamaugaQS, and
//     LincolnFortStevens itself. Not re-sourced.
const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified —
// see scripts/generateVoiceover-hancocks-line.py).
const SLIDE1_AUDIO_S = 4.545;
const SLIDE2_AUDIO_S = 4.937;
const SLIDE3_AUDIO_S = 5.851;
const SLIDE4_AUDIO_S = 7.784;
const SLIDE5_AUDIO_S = 2.194;

// Static cover-fit with minimal push-in — used on every slide (see Pan-Fill
// note above). Matches JohnstonShilohQS's own choice of scaleTo 1.03 over
// the Pan-Fill System's default 1.05 static push-in.
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
    image: 'slides/Hancock/01-landing.jpg',
    audio: 'audio/hancocks-line-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: "THE FIELD OF PICKETT'S CHARGE, GETTYSBURG",
    overlayText: 'THE CHARGE CROSSED 3/4 MILE OF OPEN GROUND',
    captionLines: [
      "Pickett's Charge crossed three quarters of a mile.",
      "What's left out: who was waiting.",
    ],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide2',
    // 4460x3125 content-only crop (matte/caption stripped) of the Thulstrup
    // painting — aspect 1.427, Pan-Fill resolves 'pan' automatically. See
    // Pan-Fill note above for the full math. No explicit motion: Pan-Fill's
    // sourceWidth/sourceHeight path drives this slide instead.
    image: 'slides/Hancock/02-hancock-corps-wide-source.jpg',
    audio: 'audio/hancocks-line-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: 'THE UNION LINE UNDER BOMBARDMENT, JULY 3, 1863',
    overlayText: "HANCOCK'S II CORPS HELD THE CENTER",
    captionLines: [
      "Hancock's Second Corps held the center,",
      'the ground against which the charge was directed.',
    ],
    sourceWidth: 4460,
    sourceHeight: 3125,
  },
  {
    id: 'slide3',
    image: 'slides/Hancock/03-armistead.jpg',
    audio: 'audio/hancocks-line-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: 'BRIG. GEN. LEWIS A. ARMISTEAD, CSA',
    overlayText: 'HIS FRIEND ARMISTEAD REACHED THE HIGH-WATER MARK',
    captionLines: [
      "Hancock's friend Lewis Armistead",
      "reached the Confederacy's high-water mark,",
      'then was mortally wounded.',
    ],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide4',
    image: 'slides/Hancock/04-hancock-wounded.jpg',
    audio: 'audio/hancocks-line-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    label: 'MAJ. GEN. WINFIELD SCOTT HANCOCK, USA',
    overlayText: 'WOUNDED, HE REFUSED TO LEAVE THE FIELD',
    captionLines: [
      "A bullet struck Hancock's saddle,",
      'driving wood and a bent nail into his thigh.',
      'He refused to leave while the fighting was still underway.',
    ],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide5',
    // Already blur-border-fill treated in the source JPG — no re-panning.
    image: 'slides/Hancock/05-payoff.jpg',
    audio: 'audio/hancocks-line-vo-05.mp3',
    durationInSeconds: SLIDE5_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE5_AUDIO_S,
    label: 'HIGH WATER MARK MEMORIAL, GETTYSBURG',
    overlayText: 'HE HELD THE CENTER. THE CENTER HELD.',
    captionLines: ['He held the center.', 'The center held.'],
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
// End card — ported verbatim from JohnstonShilohQS.tsx: NO voiceover, NO
// trigger word, NO comment CTA. Black background, hard cut in (same
// HARD_CUT_FRAMES=4 transition every other slide uses), constant opacity 1
// for the rest — no fade out, ever. Text has its own quick local reveal
// (opacity 0->1 over a few frames), matching every other end card's
// headline/subline reveal in this codebase — that's a text entrance, not a
// slide-level fade, so it doesn't violate the "no fade" rule.
//
// Duration has no VO to time against — 60 frames (2.0s @ 30fps), matching
// the JohnstonShilohQS/KerryTestimonyQS END_CARD_FRAMES exactly.
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

export default function HancocksLineQS() {
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

      <Audio src={staticFile('audio/LincolnFortStevens-music.mp3')} volume={0.15} loop />

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
