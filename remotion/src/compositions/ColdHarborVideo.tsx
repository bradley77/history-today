import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FPS, OSWALD_URL, HARD_CUT_FRAMES, GOLD, SlidePanel, type SlideConfig as SharedSlideConfig } from '../shared/QuickStrikeShared';

// Cold Harbor — BLUEGRAY-family Civil War Quick Strike. Four image slides
// plus a standalone spoken CTA end card (slide 5). No "Comment BLUEGRAY"
// trigger-word line, no comment automation — not part of this composition's
// locked script, so none was invented (same call North Anna made). The end
// card is a plain "follow" ask, not a lead-magnet CTA, so it does NOT use the
// shared EndCardCTA component (QuickStrikeShared.tsx) — that component
// hardcodes a "Comment [TRIGGERWORD]" mechanic (see BattleOfAtlantaQS.tsx/
// LittleBighornQS.tsx) which has nothing meaningful to render without a real
// trigger word. Instead it follows the hand-rolled, no-trigger-word end-card
// shape already established by this composition's actual Overland Campaign
// siblings — GrantsMemoirsQS.tsx (spoken CTA, own <Audio>, no trigger word)
// and SpotsylvaniaBloodyAngleQS.tsx/HancocksLineQS.tsx (same black-card /
// hard-cut-in / headline+subline-reveal shape, silent versions) — same
// opacity timings, same "Like. Save. Share." subline. Flagged: this diverges
// from the BattleOfAtlantaQS/BattleOfHue precedent named in the build brief,
// which both use trigger-word CTAs (Atlanta) or a baked-in-art CTA slide
// predating the shared engine (Hue) — neither fits a script with no trigger
// word.
//
// Locked decisions from the build brief:
//   - True cold open: slide 1 fully visible at full brightness from frame 0,
//     no fade-in. 4-frame hard cut on every slide after that (SlidePanel's
//     own default via HARD_CUT_FRAMES). No fade to black anywhere, including
//     the ending (hard cut on the last frame).
//   - Per-slide audio only (one <Audio> per Sequence via each slide's own
//     local frame 0, wired through SlidePanel) — never a concatenated track.
//   - Timing is LOCKED from ffprobe-measured VO + the standard 0.4s pad —
//     see PAD_S and SLIDE*_AUDIO_S below. Not recalculated here.
//   - Pan-Fill: sourceWidth/sourceHeight below are the REAL measured pixel
//     dimensions (checked via PIL against the actual files on disk, not
//     assumed), which is what opts each slide into the shared Pan-Fill
//     System (getPanFillTransform in QuickStrikeShared.tsx) instead of a
//     hand-picked motion. panFillMode is also set explicitly per slide
//     (rather than left on 'auto') so the category call is documented intent,
//     not just a side effect of crossing PAN_FILL_ASPECT_THRESHOLD (1.2):
//       - Slide 1 (01-barlows-charge.jpg): 3687x2402, aspect 1.535 -> 'pan'.
//         baseScale = 1920/2402 = 0.7993, renderedWidth = 2947px,
//         panRoomPx = 1867px, usablePanPx (87.5% - the middle of the locked
//         85-90% range - minus the 50px edge buffer) = 1634px. Slide 1 runs
//         179 frames (5.97s); the MAX_PAN_SPEED_PX_PER_SEC=100 speed cap
//         limits the actual pan to ~597px (36.5% of usablePanPx) rather than
//         letting it race the full room in that time — expected and fine,
//         see that constant's own comment in QuickStrikeShared.tsx.
//       - Slide 4 (04-confederate-works.jpg): 2895x2235, aspect 1.295 ->
//         'pan'. baseScale = 1920/2235 = 0.8591, renderedWidth = 2487px,
//         panRoomPx = 1407px, usablePanPx = 1231px. Slide 4 now runs 94
//         frames (3.13s, shorter than the original 117 — see the VO trim
//         noted below); speed-capped pan distance ~313px (25.5% of
//         usablePanPx). panDirection: 'rtl' (reversed from the default
//         'ltr') so the pan ENDS on the standing living tree at the left of
//         frame instead of opening on it — via getPanFillTransform's own
//         panDirection flag, not hand-rolled txFrom/txTo offsets.
//       - Slides 2 (02-grant-camp.jpg, 1457x2269, aspect 0.642) and 3
//         (03-lee-portrait.jpg, 4069x6075, aspect 0.670) are both portrait,
//         well under the threshold -> 'static'. Matches the sibling BLUEGRAY
//         files' choice of a subtle push-in over a frozen frame: no explicit
//         `motion` is passed for these two, so KenBurnsImage's own Pan-Fill
//         'static' default (scaleTo 1.05) applies.
//   - Music: no dedicated cold-harbor track exists yet. Reused
//     lee-resignation-music.mp3 at 0.15 volume, looped — the same choice
//     SpotsylvaniaBloodyAngleQS.tsx and NorthAnnaQS.tsx (the two most recent
//     Overland Campaign siblings) made. Flagged to Brad to swap if he wants a
//     different bed.
//   - Slide 4's VO was trimmed (dropped the trailing "Follow for more.") once
//     the standalone CTA end card below took over the follow ask — re-run
//     scripts/generateVoiceover-cold-harbor-quick-strike.py's LINES entry
//     "04" reflects the new, shorter line; "05" is the new CTA line.
//   - Total run time = sum of all five padded slide/card durations, 613
//     frames / 20.433s at 30fps — no engine guardrail (HARD_CUT_FRAMES,
//     Composition minimums, etc.) pushes this higher; see totalDuration
//     below.

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro, ffprobe-verified against the encoded
// MP3s — see scripts/generateVoiceover-cold-harbor-quick-strike.py). Single
// source of truth for every slide's durationInSeconds below.
const SLIDE1_AUDIO_S = 5.564082;
const SLIDE2_AUDIO_S = 4.336327;
const SLIDE3_AUDIO_S = 3.448163;
// Trimmed from 3.500408s ("...The seven minutes weren't. Follow for more.")
// down to just "...The seven minutes weren't." — the follow ask now lives on
// its own CTA end card (slide 5) instead of tacked onto this line.
const SLIDE4_AUDIO_S = 2.716735;
// End card VO — no trigger word, no comment automation. See file header.
const CTA_AUDIO_S = 2.351020;

const LABEL = 'COLD HARBOR, VA · JUNE 3, 1864';

type SlideConfig = SharedSlideConfig & {
  sourceWidth: number;
  sourceHeight: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Cold-Harbor/01-barlows-charge.jpg',
    audio: 'audio/cold-harbor-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: LABEL,
    overlayText: 'THE SEVEN-MINUTE MYTH',
    captionLines: ['Seven thousand men. Seven minutes.', "That's the Cold Harbor story. The record tells it differently."],
    // 3687x2402, aspect 1.535 — Pan-Fill resolves 'pan' automatically
    // (>= 1.2); set explicitly here to document the call. See pan-room math
    // in the file header comment.
    sourceWidth: 3687,
    sourceHeight: 2402,
    panFillMode: 'pan',
  },
  {
    id: 'slide2',
    image: 'slides/Cold-Harbor/02-grant-camp.jpg',
    audio: 'audio/cold-harbor-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: LABEL,
    overlayText: "NOT FROM GRANT'S OWN REPORT",
    captionLines: ['That seven-minute figure comes from later retellings,', "not Grant's own report."],
    // 1457x2269, aspect 0.642 — portrait, well under PAN_FILL_ASPECT_THRESHOLD
    // (1.2). Pan-Fill resolves 'static' automatically; set explicitly to
    // document the call.
    sourceWidth: 1457,
    sourceHeight: 2269,
    panFillMode: 'static',
  },
  {
    id: 'slide3',
    image: 'slides/Cold-Harbor/03-lee-portrait.jpg',
    audio: 'audio/cold-harbor-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: LABEL,
    overlayText: 'DAYS TO DIG IN',
    captionLines: ["Lee's men had days to dig in,", 'and they used every hour.'],
    // 4069x6075, aspect 0.670 — portrait, well under threshold. Pan-Fill
    // resolves 'static' automatically; set explicitly to document the call.
    sourceWidth: 4069,
    sourceHeight: 6075,
    panFillMode: 'static',
  },
  {
    id: 'slide4',
    image: 'slides/Cold-Harbor/04-confederate-works.jpg',
    audio: 'audio/cold-harbor-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    label: LABEL,
    overlayText: 'THE SLAUGHTER WAS REAL',
    captionLines: ['The slaughter was real.', "The seven minutes weren't."],
    // 2895x2235, aspect 1.295 — Pan-Fill resolves 'pan' automatically
    // (>= 1.2); set explicitly here to document the call. See pan-room math
    // in the file header comment.
    sourceWidth: 2895,
    sourceHeight: 2235,
    panFillMode: 'pan',
    // Reversed from the default 'ltr' — this shot should END on the standing
    // living tree at the left of frame, not open on it. 'rtl' means txFrom/
    // txTo start at [-half, half] (see getPanFillTransform in
    // QuickStrikeShared.tsx), which opens on the source's right content and
    // pans to reveal the left content last.
    panDirection: 'rtl',
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card — spoken CTA, no trigger word, no comment automation. Same shape
// as GrantsMemoirsQS.tsx's CTACard: black background, hard-cut-in opacity
// (HARD_CUT_FRAMES, same as every other slide transition), headline reveal
// at frames 4-16, "Like. Save. Share." subline reveal at frames 20-36, own
// <Audio> firing at this Sequence's local frame 0 (per-slide-audio pattern,
// same as every other slide — never a concatenated track). No fade-out —
// hard cut ending, matching every other card in this codebase.
// ---------------------------------------------------------------------------
const CTA_DURATION_S = CTA_AUDIO_S + PAD_S;
const CTA_FRAMES = Math.round(CTA_DURATION_S * FPS);

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
      <Audio src={staticFile('audio/cold-harbor-vo-05.mp3')} />

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
          Follow for more history they don't teach you.
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

export default function ColdHarborVideo() {
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

      <Audio src={staticFile('audio/lee-resignation-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <SlidePanel slide={slide} isFirst={i === 0} />
        </Sequence>
      ))}

      <Sequence from={ctaFrom} durationInFrames={CTA_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
