import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  CaptionOverlay,
  EndCardCTA,
  GOLD,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';
import { CTA_CONFIG } from '../shared/QuickStrikeConfig';

const PAD_S = 0.4;

// Actual measured VO durations (slide 1 is the archival FDR speech clip, not
// Kokoro — the intentional single-variable swap for this video; slides 2-4
// are Kokoro, am_adam @ 0.95, ffprobe-verified against the encoded MP3s —
// see scripts/generateVoiceover-day-of-infamy-draft.py).
const SLIDE1_AUDIO_S = 19.357;
const SLIDE2_AUDIO_S = 6.792;
const SLIDE3_AUDIO_S = 5.381;
const SLIDE4_AUDIO_S = 3.161; // end card VO

const LABEL = 'WASHINGTON, D.C. — DECEMBER 8, 1941';

type SlideConfig = SharedSlideConfig & {
  sourceWidth?: number;
  sourceHeight?: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Day-of-Infamy/01-fdr-congress-trimmed.jpg',
    audio: 'audio/day-of-infamy-draft-vo-01.mp3',
    durationInSeconds: 19.757,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: LABEL,
    overlayText: "THE LINE THEY MEMORIZED WASN'T HIS FIRST DRAFT",
    captionLines: [
      "Yesterday, December 7th, 1941, a date which will live in infamy — the United States of America was suddenly and deliberately attacked.",
    ],
    // Trimmed crop (2100x2208, narrower than the original 2811x2208) so
    // Pan-Fill's real overflow-based pan has less dead room to sweep through
    // before settling on FDR. panDirection 'rtl' (default is 'ltr') reverses
    // the sweep to start on the dais/Wallace/Rayburn side and settle on FDR
    // by the end. panFillMode set explicitly rather than left to 'auto' —
    // aspect 2100/2208=0.951 is actually BELOW PAN_FILL_ASPECT_THRESHOLD
    // (1.2), so auto would resolve 'static' (scale-drift only, no sweep) on
    // this crop; 'pan' is forced to keep the reveal-then-settle beat.
    sourceWidth: 2100,
    sourceHeight: 2208,
    panFillMode: 'pan',
    panDirection: 'rtl',
  },
  {
    id: 'slide2',
    image: 'slides/Day-of-Infamy/02-draft-establishing.jpg',
    audio: 'audio/day-of-infamy-draft-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: LABEL,
    overlayText: 'HE WROTE IT DIFFERENTLY FIRST',
    captionLines: [
      "The first draft of the speech stated 'a date which will live in world history.' FDR crossed it out himself, in pencil.",
    ],
    // 1730x2440, aspect 0.709 — below the threshold, Pan-Fill resolves
    // 'static' automatically (subtle scale drift).
    sourceWidth: 1730,
    sourceHeight: 2440,
  },
  {
    id: 'slide3',
    image: 'slides/Day-of-Infamy/04-draft-suddenly-edit.jpg',
    audio: 'audio/day-of-infamy-draft-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: LABEL,
    overlayText: "HE ALSO CUT 'WITHOUT WARNING'",
    captionLines: [
      "He changed 'simultaneously' to 'suddenly' and deleted the closing phrase 'without warning.'",
    ],
    // 1730x850, aspect 2.04 — above PAN_FILL_ASPECT_THRESHOLD (1.2), so 'auto'
    // would resolve 'pan'. Forced 'static' instead: a single-edit reveal
    // reads better as a push-in than a lateral sweep. This replaces the prior
    // no-sourceWidth `motion` hack (scaleFrom 1.0/scaleTo 1.25, manual
    // transformOrigin) that only worked around cover-fit's fixed-crop
    // limitation rather than fixing it — real Pan-Fill has no such window
    // cap, so the full "simultaneously"/"suddenly" edit is reachable without
    // hand-picked crop math.
    sourceWidth: 1730,
    sourceHeight: 850,
    panFillMode: 'static',
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

// ---------------------------------------------------------------------------
// End card — standalone black slide, trigger word FRONT, subline pulled from
// CTA_CONFIG. "Like. Save. Share." is silent, always-on text beneath the
// subline, same pattern as BullRun1QS's end card.
// ---------------------------------------------------------------------------
const SLIDE4_DURATION_S = SLIDE4_AUDIO_S + PAD_S;
const SLIDE4_FRAMES = Math.round(SLIDE4_DURATION_S * FPS);
const SLIDE4_AUDIO_FRAMES = Math.round(SLIDE4_AUDIO_S * FPS);

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
        triggerWord="FRONT"
        subline={CTA_CONFIG.FRONT.subline}
        audio="audio/day-of-infamy-draft-vo-04.mp3"
      />

      <CaptionOverlay
        lines={['Comment FRONT for the free WWII document.']}
        audioDurationFrames={SLIDE4_AUDIO_FRAMES}
        top={200}
      />

      {/* Silent-viewer text, no VO */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 40px 340px',
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

export const totalDuration =
  slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0) + SLIDE4_FRAMES;
export { FPS };

export default function DayOfInfamyDraftQS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });
  const slide4From = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/northwoods.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <SlidePanel slide={slide} isFirst={i === 0} />
        </Sequence>
      ))}

      <Sequence from={slide4From} durationInFrames={SLIDE4_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
