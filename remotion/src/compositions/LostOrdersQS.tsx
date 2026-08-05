import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  CaptionOverlay,
  EndCardCTA,
  GOLD,
  REDUCED_HEADLINE_FONT_SIZE,
  REDUCED_HEADLINE_LINE_HEIGHT,
  REDUCED_CAPTION_FONT_SIZE,
  REDUCED_CAPTION_LINE_HEIGHT,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';
import { CTA_CONFIG } from '../shared/QuickStrikeConfig';

// McClellan's Lost Order — BLUEGRAY Quick Strike.
//
// Locked decisions from the build brief:
//   - No fades anywhere: true cold open at frame 0 (SlidePanel's isFirst
//     prop), 4-frame hard cut on every other slide including the CTA
//     transition, no fade to black at the end.
//   - Per-slide audio only (one <Audio> per Sequence, own local frame 0) —
//     no continuous/concatenated track. Matches every QuickStrike built on
//     this shared engine.
//   - Pan-Fill System (sourceWidth/sourceHeight on every slide) drives the
//     Ken Burns treatment instead of hand-tuned motion — see AntietamQS.tsx's
//     header comment: pan mode holds scale FIXED at baseScale
//     (= CANVAS_HEIGHT / sourceHeight) and only animates translateX within
//     the image's own overflow past 1080px at that scale, which structurally
//     guarantees the source edge is never revealed — the invariant the
//     legacy manual-motion rule (scale >=1.06 for pan >20px) protected by
//     hand. No separate scale bump is needed here for that reason.

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified —
// see scripts/generateVoiceover-mcclellan-lost-order.py). Padded values
// (+0.4s) confirmed directly against ffprobe output before wiring.
// Slide 1: 9.300 -> 9.352 after the Maryland phoneme-fix regeneration
// (mˈɛɹɪlˌænd -> mˈɛɹɪlənd, same substitution as
// generateVoiceover-antietam-phoneme-fix-v3.py) shifted the audio by +52ms.
const SLIDE1_AUDIO_S = 9.352;
const SLIDE2_AUDIO_S = 6.687;
const SLIDE3_AUDIO_S = 7.706;
const CTA_AUDIO_S = 3.344;

// Opt-in override into QuickStrikeShared's reduced overlay font sizes (see
// that file's REDUCED_HEADLINE_FONT_SIZE/REDUCED_CAPTION_FONT_SIZE comments)
// — this composition only. Threaded into every SLIDES entry below via
// SlideConfig's headlineFontSize/headlineLineHeight/captionFontSize/
// captionLineHeight fields, and passed directly to the CTA's own
// CaptionOverlay call in EndCard (that slide has no GoldLowerThird instance
// to opt in — EndCardCTA renders the trigger word/subline itself, not a
// gold-rule headline). QuickStrikeShared.tsx itself is untouched here, and
// its own default fontSize/lineHeight values are unchanged, so no other
// composition is affected.
const OVERLAY_FONT_OVERRIDES = {
  headlineFontSize: REDUCED_HEADLINE_FONT_SIZE,
  headlineLineHeight: REDUCED_HEADLINE_LINE_HEIGHT,
  captionFontSize: REDUCED_CAPTION_FONT_SIZE,
  captionLineHeight: REDUCED_CAPTION_LINE_HEIGHT,
};

type SlideConfig = SharedSlideConfig & {
  sourceWidth: number;
  sourceHeight: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/LostOrders/01-mcclellan-portrait.jpg',
    audio: 'audio/LostOrders/LostOrders-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    // Portrait — identifies the person (viewers may not recognize the face),
    // not location/date. Same pattern as AntietamQS.tsx's label field,
    // rendered top-left via SlidePanel's ContextTag.
    label: 'MAJ. GEN. GEORGE B. MCCLELLAN',
    overlayText: "HIS SOLDIERS FOUND LEE'S BATTLE PLAN",
    // VO verbatim, split at the sentence boundary into two caption cues.
    captionLines: [
      'George McClellan is remembered as the general who threw away victory.',
      "His soldiers found Lee's campaign orders wrapped around cigars in a Maryland field.",
    ],
    // 1080x1920, aspect 0.5625 — well below PAN_FILL_ASPECT_THRESHOLD (1.2),
    // so 'auto' would already resolve 'static'; set explicitly per spec
    // (category 1, single-subject portrait). No explicit `motion` passed,
    // so Pan-Fill's own default static drift applies (scaleFrom 1.0 ->
    // scaleTo 1.05) — satisfies "scale as low as 1.0, zero or minimal pan"
    // the same way AntietamQS's static slides do.
    sourceWidth: 1080,
    sourceHeight: 1920,
    panFillMode: 'static',
    ...OVERLAY_FONT_OVERRIDES,
  },
  {
    id: 'slide2',
    image: 'slides/LostOrders/02-lee-portrait.jpg',
    audio: 'audio/LostOrders/LostOrders-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    // Portrait — identifies the person, same rationale as slide 1's label.
    label: 'GEN. ROBERT E. LEE',
    overlayText: 'LEE SPLIT HIS ARMY INTO FOUR PIECES',
    // VO verbatim, split at the sentence boundary into two caption cues.
    captionLines: [
      'The order revealed Lee had split his army into four scattered pieces.',
      'McClellan said he had the paper to beat Lee.',
    ],
    // 1080x1920, aspect 0.5625 — same as slide 1: category 1, single-subject
    // portrait, static with Pan-Fill's default minimal drift.
    sourceWidth: 1080,
    sourceHeight: 1920,
    panFillMode: 'static',
    ...OVERLAY_FONT_OVERRIDES,
  },
  {
    id: 'slide3',
    image: 'slides/LostOrders/03-antietam-bloodylane.jpg',
    audio: 'audio/LostOrders/LostOrders-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    // No face to identify here, so location instead of a person — but
    // deliberately NO date: 03-antietam-bloodylane.jpg is a modern/present-day
    // photograph of the battlefield, not an 1862-era photo, so pairing it
    // with a historical date (e.g. "SEPT 1862", the AntietamQS.tsx pattern
    // for its period photos) would misrepresent the source to viewers.
    label: 'ANTIETAM BATTLEFIELD, MARYLAND',
    overlayText: 'HE HAD THE PLAN. HE STILL LET LEE ESCAPE.',
    // VO verbatim, split at the sentence boundary into two caption cues.
    captionLines: [
      'He waited eighteen hours to move.',
      'Lee reunited his army in time, and the battle became the bloodiest day in American history.',
    ],
    // 3264x1920, aspect 1.7 — above PAN_FILL_ASPECT_THRESHOLD (1.2), so
    // 'auto' would already resolve 'pan'; set explicitly per spec (category
    // 2, wide/panoramic). baseScale = 1920/1920 = 1.0 exactly, renderedWidth
    // = 3264, panRoomPx = 3264 - 1080 = 2184. PAN_FILL_RANGE_FRACTION
    // (0.875, shared default) puts usable pan room at ~1911px (2184 minus a
    // ~136.5px margin per side, above the 50px floor) — the ~87.5%-of-room /
    // ~50px-buffer the brief calls for. This slide's 8.1s duration caps the
    // speed-limited pan distance at MAX_PAN_SPEED_PX_PER_SEC * 8.1 = 810px,
    // so the pan stays centered in that usable room (±405px from center)
    // rather than running edge to edge.
    sourceWidth: 3264,
    sourceHeight: 1920,
    panFillMode: 'pan',
    panDirection: 'ltr',
    ...OVERLAY_FONT_OVERRIDES,
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card — standalone black slide (no background image). Trigger word
// BLUEGRAY, subline pulled from the existing CTA_CONFIG.BLUEGRAY entry (not
// hardcoded, not a new one-off entry — the existing subline text matches the
// brief's requested CTA text exactly). "Like. Save. Share." is silent,
// always-on text beneath the subline, same pattern as BullRun1QS/
// TetCitadelQS end cards. Does not count against narrative runtime — this is
// its own Sequence, appended after slidesDuration, same as every other
// QuickStrike built on this engine.
// ---------------------------------------------------------------------------
const CTA_DURATION_S = CTA_AUDIO_S + PAD_S;
const CTA_FRAMES = Math.round(CTA_DURATION_S * FPS);
const CTA_AUDIO_FRAMES = Math.round(CTA_AUDIO_S * FPS);

function EndCard() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const likeSaveShareOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <EndCardCTA
        triggerWord="BLUEGRAY"
        subline={CTA_CONFIG.BLUEGRAY.subline}
        audio="audio/LostOrders/LostOrders-vo-04.mp3"
      />

      <CaptionOverlay
        lines={['Comment BLUEGRAY for the free five fact Civil War PDF.']}
        audioDurationFrames={CTA_AUDIO_FRAMES}
        top={200}
        captionFontSize={REDUCED_CAPTION_FONT_SIZE}
        captionLineHeight={REDUCED_CAPTION_LINE_HEIGHT}
      />

      {/* Silent-viewer text, no VO */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 40px 90px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            opacity: likeSaveShareOpacity,
            color: GOLD,
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            fontSize: 26,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Like. Save. Share.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export const totalDuration = slidesDuration + CTA_FRAMES;
export { FPS };

export default function LostOrdersQS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });
  // CTA starts exactly where the last narrative slide ends (audio + 0.4s
  // pad) — `offset` here is the running total after slide 3, the same
  // accumulator every other Sequence's `from` is derived from, so there is
  // no gap or overlap by construction.
  const ctaFrom = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/Gettysburg-Day1-music.mp3')} volume={0.15} loop />

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
