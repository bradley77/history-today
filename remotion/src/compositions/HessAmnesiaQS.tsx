import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  GOLD,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// Hess's Amnesia Defense — one-off Nuremberg Quick Strike, outside the
// BLUEGRAY/FRONT/RECON series (no trigger-word CTA, no comment automation).
//
// Locked decisions from the build brief:
//   - True cold open: slide 1 fully visible at full brightness from frame 0,
//     no fade-in (isFirst on slide 1, handled by the shared SlidePanel).
//     4-frame hard cut on every slide after that. No fade-out anywhere —
//     hard cut ending.
//   - Per-slide audio only (one <Audio> per Sequence, own local frame 0) —
//     never a concatenated track.
//   - 4 slides, not 3: the original single slide-3 script line ran 13.02s
//     padded — too long a hold for one image — so it was split at the
//     sentence break into slides 3/4 (see
//     scripts/generateVoiceover-hess-amnesia.py). Slide 4 originally reused
//     03-interrogation.jpg with a reversed pan; it now has its own distinct
//     image (04-verdict.jpg, Ray D'Addario/NARA, record 111-SC-C-3704,
//     PD-US-Government), so no shared-image/opposite-pan handling remains.
//   - Pan-Fill: all four slides qualify for the automatic horizontal pan
//     (aspect ratio >= 1.2 threshold) — sourceWidth/sourceHeight supplied,
//     no explicit `motion`, so KenBurnsImage's Pan-Fill path resolves scale
//     and translateX automatically:
//       01-landing.jpg        4200x3358  aspect 1.251  -> pan, default 'ltr'
//       02-dock.jpg           2944x2274  aspect 1.295  -> pan, default 'ltr'
//       03-interrogation.jpg  3695x3001  aspect 1.231  -> pan, 'rtl'
//         (pushes toward Hess's face/expression — reads as the
//         psychiatrists examining him)
//       04-verdict.jpg        2224x1696  aspect 1.311  -> pan, default 'ltr'
//     Legacy manual-motion scale rule (>20px pan -> scale >=1.06, >30px ->
//     >=1.08) doesn't need a hand-set scale here: Pan-Fill holds scale FIXED
//     at baseScale (= CANVAS_HEIGHT / sourceHeight) and only animates
//     translateX within the resulting overflow, so the image can never
//     reveal its edge no matter how far it pans — the invariant the legacy
//     rule protected by hand is satisfied structurally instead (same
//     reasoning as AntietamQS.tsx). For the record, computed via
//     getPanFillTransform:
//       03-interrogation.jpg (3695x3001):
//         baseScale = 1920/3001 = 0.6398, renderedWidth = 2364px
//         panRoomPx = 2364 - 1080 = 1284px
//         marginPerSide = max(1284*0.125/2, 50) = 80px
//         usablePanPx = 1284 - 160 = 1124px
//         speed cap @ 6.095s padded duration: 610px (speed-capped, well
//         under usablePanPx)
//       04-verdict.jpg (2224x1696):
//         baseScale = 1920/1696 = 1.1321, renderedWidth = 2518px
//         panRoomPx = 2518 - 1080 = 1438px
//         marginPerSide = max(1438*0.125/2, 50) = 90px
//         usablePanPx = 1438 - 180 = 1258px -- more pan room than either
//         01-landing.jpg or 02-dock.jpg, as expected from its aspect ratio
//         speed cap @ 6.774s padded duration: 677px (speed-capped, well
//         under usablePanPx)
//     Both pan distances comfortably exceed the legacy rule's 30px
//     threshold, consistent with Pan-Fill's fixed baseScale already
//     covering the >=1.08 case.
//   - Timing is LOCKED from ffprobe-measured VO + the standard 0.4s pad —
//     see scripts/generateVoiceover-hess-amnesia.py. Do not recalculate.
//   - Silent End Card, ported verbatim from HancocksLineQS.tsx (itself from
//     JohnstonShilohQS.tsx): 60 frames (2.0s), no VO, no trigger word, no
//     comment CTA — on-screen text only ("Follow the page..." / "Like.
//     Save. Share."). No FRONT/BLUEGRAY/RECON automation for this video.
//   - Music: audio/lee-resignation-music.mp3 at 0.15 volume, looped — the
//     same track used in NurembergGoering.jsx (per direction: reuse the
//     Nuremberg/Göring video's track). Not re-sourced.
const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified —
// see scripts/generateVoiceover-hess-amnesia.py). Full script replacement
// (fact-checking pass, not a wording tweak) -- every slide's text changed
// and all four files were regenerated fresh. Slide 1 carries the
// "Nuremberg" phoneme-splice pronunciation fix (same substitution proven on
// generateVoiceover-nuremberg-goering.py) since the new text still mentions
// Nuremberg.
const SLIDE1_AUDIO_S = 5.042;
const SLIDE2_AUDIO_S = 6.243;
const SLIDE3_AUDIO_S = 8.673;
const SLIDE4_AUDIO_S = 3.866;

type SlideConfig = SharedSlideConfig & {
  sourceWidth: number;
  sourceHeight: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Hess-Amnesia/01-landing.jpg',
    audio: 'audio/hess-amnesia-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: 'INTERNATIONAL MILITARY TRIBUNAL',
    overlayText: 'NUREMBERG, GERMANY — 1945',
    captionLines: [
      'Every defendant at Nuremberg fought for his life.',
      "One argued he couldn't be tried at all.",
    ],
    sourceWidth: 4200,
    sourceHeight: 3358,
  },
  {
    id: 'slide2',
    image: 'slides/Hess-Amnesia/02-dock.jpg',
    audio: 'audio/hess-amnesia-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: 'RUDOLF HESS',
    overlayText: 'DEPUTY FÜHRER TO ADOLF HITLER',
    captionLines: [
      'Rudolf Hess claimed his memory was gone,',
      'especially when questioned about potentially incriminating actions.',
    ],
    sourceWidth: 2944,
    sourceHeight: 2274,
  },
  {
    id: 'slide3',
    image: 'slides/Hess-Amnesia/03-interrogation.jpg',
    audio: 'audio/hess-amnesia-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: 'RUDOLF HESS',
    overlayText: 'NOVEMBER 30, 1945',
    captionLines: [
      'If ruled incompetent, he could be excluded from trial.',
      'Then in open court, Hess announced his memory had returned',
      'and the amnesia was tactical.',
    ],
    sourceWidth: 3695,
    sourceHeight: 3001,
    panDirection: 'rtl',
  },
  {
    id: 'slide4',
    // Generic tribunal tag, not a named judge -- Lawrence is visible in
    // frame but this deliberately doesn't call him out individually.
    image: 'slides/Hess-Amnesia/04-verdict.jpg',
    audio: 'audio/hess-amnesia-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    label: 'INTERNATIONAL MILITARY TRIBUNAL',
    overlayText: 'LIFE IN SPANDAU PRISON',
    captionLines: [
      'He was ruled fit to stand trial',
      'and sentenced to life in prison.',
    ],
    sourceWidth: 2224,
    sourceHeight: 1696,
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card — ported verbatim from HancocksLineQS.tsx: NO voiceover, NO
// trigger word, NO comment CTA. Black background, hard cut in (same
// HARD_CUT_FRAMES=4 transition every other slide uses), constant opacity 1
// for the rest — no fade out, ever. Text has its own quick local reveal
// (opacity 0->1 over a few frames), matching every other end card's
// headline/subline reveal in this codebase — that's a text entrance, not a
// slide-level fade, so it doesn't violate the "no fade" rule.
//
// Duration has no VO to time against — 60 frames (2.0s @ 30fps), matching
// the HancocksLineQS/JohnstonShilohQS/KerryTestimonyQS END_CARD_FRAMES.
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

export default function HessAmnesiaQS() {
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
