import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  KenBurnsImage,
  Vignette,
  GoldLowerThird,
  ContextTag,
  CaptionOverlay,
  EndCardCTA,
  GOLD,
  type Motion,
} from '../shared/QuickStrikeShared';
import { CTA_CONFIG } from '../shared/QuickStrikeConfig';

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro, ffprobe-verified). Single source of
// truth for every slide's durationInSeconds below and for caption timing.
const SLIDE1_AUDIO_S = 2.534; // slide-1 rule: no pad (see slide 1 below) — measured
// above the ~2.2s flag threshold; kept as-is per explicit sign-off rather than
// trimmed further.
const SLIDE2_AUDIO_S = 4.075;
const SLIDE3_AUDIO_S = 5.042;
const SLIDE4_AUDIO_S = 4.180;
const SLIDE5_AUDIO_S = 3.056;

type SlideConfig = {
  id: string;
  image: string;
  audio: string;
  durationInSeconds: number;
  audioDurationSeconds: number;
  overlayText: string;
  label: string;
  motion: Motion;
  captionLines: string[];
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/OperationFrequentWind/01-helicopter-overboard.jpg',
    audio: 'audio/operation-frequent-wind-vo-01.mp3',
    // Quick Strikes slide-1 rule: 1.5-2s hard ceiling, no pad. Measured VO is
    // 2.534s, over the ~2.2s flag threshold — flagged and accepted as-is
    // rather than trimmed further (see comment on SLIDE1_AUDIO_S above).
    durationInSeconds: SLIDE1_AUDIO_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    overlayText: '$10 MILLION IN HELICOPTERS, GONE ON PURPOSE',
    label: 'USS MIDWAY, SOUTH CHINA SEA - APRIL 1975',
    // 2676x3589 portrait source, cover-fit crops the sides slightly. Slow push-in only.
    motion: { scaleFrom: 1.0, scaleTo: 1.08, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    captionLines: ['He destroyed ten million dollars, on purpose.'],
  },
  {
    id: 'slide2',
    image: 'slides/OperationFrequentWind/02-hh53-liftoff-midway.jpg',
    audio: 'audio/operation-frequent-wind-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    overlayText: 'TWENTY-SIX HELICOPTERS. NOWHERE LEFT TO LAND.',
    label: 'USS MIDWAY, SOUTH CHINA SEA - APRIL 1975',
    // 1080x1920 native — exact match to canvas, no pan room at scale 1.0. Modest push-in only.
    motion: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    captionLines: ['Twenty-six helicopters had already landed.', 'There was nowhere to land.'],
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

// ---------------------------------------------------------------------------
// Slides 3 & 4 share 03-buang-taxi-halt.jpg and must read as ONE continuous
// shot, not a cut between two images — so the image itself is rendered by
// TaxiPanLayer below as a single Img mounted once for their combined frame
// range, driven by ONE linear pan function (taxiPanTx) over that whole span.
// Text/captions/audio for each slide still live in their own Sequences
// (TaxiTextOverlay) and pop in/out normally at the boundary — only the image
// is exempted from the usual per-slide mount/fade lifecycle. Pattern follows
// VicksburgMineQS.tsx's craterPanTx (see that file for the fuller writeup of
// why a shared linear curve, not two independently-eased ones, is required).
// ---------------------------------------------------------------------------
const SLIDE3_DURATION_S = SLIDE3_AUDIO_S + PAD_S;
const SLIDE4_DURATION_S = SLIDE4_AUDIO_S + PAD_S;
const SLIDE3_FRAMES = Math.round(SLIDE3_DURATION_S * FPS); // 163
const SLIDE4_FRAMES = Math.round(SLIDE4_DURATION_S * FPS); // 137
const TAXI_PAN_FRAMES = SLIDE3_FRAMES + SLIDE4_FRAMES; // 300
const TAXI_PAN_LAST_FRAME = TAXI_PAN_FRAMES - 1; // 299 — last actually-reachable frame

const SLIDE3_AUDIO_FRAMES = Math.round(SLIDE3_AUDIO_S * FPS);
const SLIDE4_AUDIO_FRAMES = Math.round(SLIDE4_AUDIO_S * FPS);

// 03-buang-taxi-halt.jpg is exactly 1080x1920 — an exact match to the canvas,
// so cover-fit at CSS scale 1.0 leaves ZERO overscan to pan within. TAXI_SCALE
// zooms in first to buy real pan room: at scale 1.3 the rendered box is
// 1404x2496, giving a 162px horizontal margin ((1404-1080)/2). The transform
// below is `scale(S) translateX(T)`, and CSS composes right-to-left — T is
// applied first in the unscaled local frame, then scaled by S along with
// everything else — so the effective on-screen shift is S*T, not T. Keeping
// |T| <= 90 (effective <= 117px) leaves a 45px safety buffer under the 162px
// margin on both ends.
const TAXI_SCALE = 1.3;
const TAXI_PAN_START_TX = 90;
const TAXI_PAN_END_TX = -90;
const TAXI_LABEL = "MAJ. BUANG-LY'S CESSNA, USS MIDWAY - APRIL 1975";

// ONE continuous, LINEAR pan across slides 3+4's combined frame range. Linear
// (not eased) is deliberate: two independently-eased curves decelerate toward
// near-zero velocity at each end, so even with matching position at the cut,
// slide 3 easing to a stop and slide 4 easing back up from a stop reads as a
// visible pause. Constant velocity end-to-end removes that seam entirely.
function taxiPanTx(globalFrame: number) {
  return interpolate(globalFrame, [0, TAXI_PAN_LAST_FRAME], [TAXI_PAN_START_TX, TAXI_PAN_END_TX], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

// The shared 03-buang-taxi-halt.jpg layer for slides 3 & 4 — mounted ONCE for
// the full combined 300-frame span via a single top-level Sequence, so there's
// no unmount/remount and no opacity fade at the slide 3->4 boundary internally.
// This pair isn't the composition's cold open though (that's slide 1) — it
// follows slide 2, a genuine image cut — so the whole layer still gets the
// standard 4-frame hard-cut fade-in at its own mount (frame 0 of this
// Sequence), same as every other non-first slide. Panning is driven directly
// by taxiPanTx(frame), since this component's own local frame (0..299) IS the
// continuous counter — no offset arithmetic needed.
function TaxiPanLayer() {
  const frame = useCurrentFrame();
  const tx = taxiPanTx(frame);
  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile('slides/OperationFrequentWind/03-buang-taxi-halt.jpg')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            transform: `scale(${TAXI_SCALE}) translateX(${tx}px)`,
            transformOrigin: 'center center',
          }}
        />
      </AbsoluteFill>

      <Vignette />

      {/* Same label for the whole combined span, rendered once here rather
          than per-slide, so it never pops or re-fades at the cut. */}
      <ContextTag text={TAXI_LABEL} position="top-left" />
    </AbsoluteFill>
  );
}

// Text/caption/audio for one of slides 3 or 4. Unlike TaxiPanLayer, this DOES
// mount/unmount at the slide boundary — the gold rule/text fading in fresh per
// slide (via GoldLowerThird's own local-frame useGoldOverlay) is expected and
// fine, since it's text popping in, not the image cutting to black.
function TaxiTextOverlay({
  overlayText,
  captionLines,
  audioDurationFrames,
  audioSrc,
}: {
  overlayText: string;
  captionLines: string[];
  audioDurationFrames: number;
  audioSrc: string;
}) {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <GoldLowerThird text={overlayText} frame={frame} />
      <CaptionOverlay lines={captionLines} audioDurationFrames={audioDurationFrames} />
      {/* Fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(audioSrc)} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide 5 — end card. Trigger word RECON, subline pulled from CTA_CONFIG (not
// hardcoded). VO is limited to the comment-trigger line only (per the Max
// Alignment rule) — the trigger word and "Like. Save. Share." are silent,
// always-on text.
// ---------------------------------------------------------------------------
const SLIDE5_DURATION_S = SLIDE5_AUDIO_S + PAD_S;
const SLIDE5_FRAMES = Math.round(SLIDE5_DURATION_S * FPS);
const SLIDE5_AUDIO_FRAMES = Math.round(SLIDE5_AUDIO_S * FPS);

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
        triggerWord="RECON"
        subline={CTA_CONFIG.RECON.subline}
        audio="audio/operation-frequent-wind-vo-05.mp3"
      />

      <CaptionOverlay
        lines={['Comment RECON to get the free Vietnam fact sheet.']}
        audioDurationFrames={SLIDE5_AUDIO_FRAMES}
        top={200}
      />

      {/* Silent-viewer text, no VO — Max Alignment rule */}
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

// ---------------------------------------------------------------------------
// Standard slide 1 & 2 panel — image + vignette + label + lower third +
// captions + audio, with the true cold open on slide 1 and a 4-frame hard cut
// on slide 2.
// ---------------------------------------------------------------------------
function SlidePanel({
  slide,
  isFirst,
}: {
  slide: SlideConfig & { durationFrames: number; audioDurationFrames: number };
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();
  const { motion, durationFrames, overlayText, label } = slide;

  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <KenBurnsImage image={slide.image} frame={frame} durationFrames={durationFrames} motion={motion} />
      <Vignette />

      <ContextTag text={label} position="top-left" />

      <GoldLowerThird text={overlayText} frame={frame} />

      <CaptionOverlay lines={slide.captionLines} audioDurationFrames={slide.audioDurationFrames} />

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

export const totalDuration =
  slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0) + TAXI_PAN_FRAMES + SLIDE5_FRAMES;
export { FPS };

export default function OperationFrequentWindQS() {
  let offset = 0;

  const slide1 = slidesWithFrames[0];
  const slide2 = slidesWithFrames[1];

  const slide1From = offset;
  offset += slide1.durationFrames;
  const slide2From = offset;
  offset += slide2.durationFrames;

  const taxiFrom = offset;
  offset += TAXI_PAN_FRAMES;

  const slide5From = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/my-lai-massacre.mp3')} volume={0.15} loop />

      <Sequence from={slide1From} durationInFrames={slide1.durationFrames} layout="none">
        <SlidePanel slide={slide1} isFirst />
      </Sequence>

      <Sequence from={slide2From} durationInFrames={slide2.durationFrames} layout="none">
        <SlidePanel slide={slide2} isFirst={false} />
      </Sequence>

      <Sequence from={taxiFrom} durationInFrames={TAXI_PAN_FRAMES} layout="none">
        <TaxiPanLayer />
      </Sequence>

      <Sequence from={taxiFrom} durationInFrames={SLIDE3_FRAMES} layout="none">
        <TaxiTextOverlay
          overlayText="A TINY PLANE. A FAMILY OF SEVEN. NEARLY OUT OF FUEL."
          captionLines={[
            'Then a tiny two-seat plane appeared:',
            'a pilot, his wife, five kids,',
            'nearly out of fuel.',
          ]}
          audioDurationFrames={SLIDE3_AUDIO_FRAMES}
          audioSrc="audio/operation-frequent-wind-vo-03.mp3"
        />
      </Sequence>

      <Sequence from={taxiFrom + SLIDE3_FRAMES} durationInFrames={SLIDE4_FRAMES} layout="none">
        <TaxiTextOverlay
          overlayText="HE'D NEVER LANDED ON A CARRIER. HE MADE IT."
          captionLines={["He'd never landed on a carrier before.", 'He made it. All seven survived.']}
          audioDurationFrames={SLIDE4_AUDIO_FRAMES}
          audioSrc="audio/operation-frequent-wind-vo-04.mp3"
        />
      </Sequence>

      <Sequence from={slide5From} durationInFrames={SLIDE5_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
