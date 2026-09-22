import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  KenBurnsImage,
  Vignette,
  CaptionOverlay,
  EndCardCTA,
  GOLD,
  type Motion,
} from '../shared/QuickStrikeShared';
import { CTA_CONFIG } from '../shared/QuickStrikeConfig';
import { QuickStrikeCaptions } from '../components/QuickStrikeCaptions';

const PAD_S = 0.4;

// Actual measured VO durations (Chatterbox Turbo, ffprobe-verified against the
// final TRIMMED files -- see generate_vo_operation_menu_chatterbox.py).
const SLIDE1_AUDIO_S = 8.300;
const SLIDE2_AUDIO_S = 5.590;
const SLIDE3_AUDIO_S = 9.810;
const SLIDE4_AUDIO_S = 2.920;

// Slide duration = audio + 0.4s pad, in frames at 30fps, ROUNDED UP (not the
// engine's usual Math.round via withFrames) -- explicit requirement for this
// composition, so every slide gets at least its full padded audio length.
const SLIDE1_FRAMES = Math.ceil((SLIDE1_AUDIO_S + PAD_S) * FPS); // 261
const SLIDE2_FRAMES = Math.ceil((SLIDE2_AUDIO_S + PAD_S) * FPS); // 180
const SLIDE3_FRAMES = Math.ceil((SLIDE3_AUDIO_S + PAD_S) * FPS); // 307
const SLIDE4_FRAMES = Math.ceil((SLIDE4_AUDIO_S + PAD_S) * FPS); // 100
const SLIDE4_AUDIO_FRAMES = Math.round(SLIDE4_AUDIO_S * FPS);

// Set to a string to render small plain cream text (no gold, no rules) at the
// top left of slide 1 only. Left null per the brief.
const SLIDE1_DATE_STAMP: string | null = null;

// ---------------------------------------------------------------------------
// Slide 1 -- wide establishing map (2941x1901), panned edge-to-edge rather
// than cropped. KenBurnsImage's own Pan-Fill System (getPanFillTransform)
// can't be used here as-is: it always eases (Easing.inOut(Easing.ease), never
// linear) and caps pan speed at 100px/sec, which for this slide's ~8.7s
// duration would cap travel at ~870px -- well short of the 1610px this pan
// needs. So this renders the same height:100%/width:auto + translateX
// technique KenBurnsImage's pan mode and OperationFrequentWindQS's
// TaxiPanLayer both use (proven working pattern in this codebase for
// genuinely panning a source wider than the canvas without cropping), just
// with our own literal endpoints and a plain linear interpolate instead of
// going through KenBurnsImage. Zero changes to the shared engine.
// ---------------------------------------------------------------------------
const SLIDE1_IMAGE = 'slides/Nixon-Cambodia/01-nixon-cambodia-map.jpg';
const SLIDE1_SOURCE_WIDTH = 2941;
const SLIDE1_SOURCE_HEIGHT = 1901;
// Scaled-image-space pixels (0 = source's own left edge once scaled to fill
// the canvas height) for the visible window's LEFT edge at frame 0 / the
// last frame. ~85% of the available pan room, per the brief.
const SLIDE1_PAN_START_X = 200;
const SLIDE1_PAN_END_X = 1810;

const slide1BaseScale = CANVAS_HEIGHT / SLIDE1_SOURCE_HEIGHT;
const slide1RenderedWidth = SLIDE1_SOURCE_WIDTH * slide1BaseScale;
// translateX=0 centers the scaled image, so the visible window's left edge
// sits at this offset by default -- solve for the tx that puts it at our
// literal target instead (positive tx shifts the image right on screen,
// which brings the source's LEFT content into the fixed viewport window).
const slide1DefaultLeftEdge = (slide1RenderedWidth - CANVAS_WIDTH) / 2;
const slide1TxFrom = slide1DefaultLeftEdge - SLIDE1_PAN_START_X;
const slide1TxTo = slide1DefaultLeftEdge - SLIDE1_PAN_END_X;

function Slide1Pan({ frame, durationFrames }: { frame: number; durationFrames: number }) {
  // No `easing` option passed -- Remotion's interpolate defaults to linear.
  const tx = interpolate(frame, [0, durationFrames], [slide1TxFrom, slide1TxTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Img
          src={staticFile(SLIDE1_IMAGE)}
          style={{ height: '100%', width: 'auto', transform: `translateX(${tx}px)` }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Slide1() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Slide1Pan frame={frame} durationFrames={SLIDE1_FRAMES} />
      <Vignette />

      {SLIDE1_DATE_STAMP && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 40,
            color: '#EFEBE0',
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: '0.04em',
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}
        >
          {SLIDE1_DATE_STAMP}
        </div>
      )}

      <QuickStrikeCaptions slideId="01" fps={FPS} />

      {/* Cold open -- slide 1 is fully visible from frame 0, per the brief. */}
      <Audio src={staticFile('audio/operation-menu-vo-01.mp3')} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slides 2 & 3 -- full-frame 1080x1920 sources (blurred bars already baked
// into the art), static framing with a plain Ken Burns push-in.
// ---------------------------------------------------------------------------
const STATIC_MOTION: Motion = {
  scaleFrom: 1.0,
  scaleTo: 1.08,
  txFrom: 0,
  txTo: 0,
  tyFrom: 0,
  tyTo: 0,
  easing: 'easeInOutCubic',
};

function StaticSlide({
  image,
  audio,
  slideId,
  durationFrames,
}: {
  image: string;
  audio: string;
  slideId: string;
  durationFrames: number;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <KenBurnsImage image={image} frame={frame} durationFrames={durationFrames} motion={STATIC_MOTION} />
      <Vignette />
      <QuickStrikeCaptions slideId={slideId} fps={FPS} />
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide 4 -- reuse the existing RECON end card (EndCardCTA) exactly. The VO
// line ("Comment RECON for the free PDF on Vietnam.") is the only spoken
// text -- the trigger word and "Like. Save. Share." are silent, always-on
// text, per the Max Alignment rule already used by every other Quick Strike's
// end card (see OperationFrequentWindQS.tsx's EndCard for the precedent).
// ---------------------------------------------------------------------------
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
        audio="audio/operation-menu-vo-04.mp3"
      />

      <CaptionOverlay
        lines={['Comment RECON for the free PDF on Vietnam.']}
        audioDurationFrames={SLIDE4_AUDIO_FRAMES}
        top={200}
      />

      {/* Silent-viewer text, no VO -- Max Alignment rule */}
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

export const totalDuration = SLIDE1_FRAMES + SLIDE2_FRAMES + SLIDE3_FRAMES + SLIDE4_FRAMES;
export { FPS };

export default function OperationMenuQuickStrike() {
  let offset = 0;
  const slide1From = offset;
  offset += SLIDE1_FRAMES;
  const slide2From = offset;
  offset += SLIDE2_FRAMES;
  const slide3From = offset;
  offset += SLIDE3_FRAMES;
  const slide4From = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Hard end at the last frame -- no separate Sequence wrapper means
          Remotion trims this to the composition's own total duration; no
          fades, starts at frame 0. northwoods.mp3 runs far longer than this
          composition, so `loop` never actually engages, but is included for
          parity with every other Quick Strike's music-bed convention. */}
      <Audio src={staticFile('audio/northwoods.mp3')} volume={0.15} loop />

      <Sequence from={slide1From} durationInFrames={SLIDE1_FRAMES} layout="none">
        <Slide1 />
      </Sequence>

      <Sequence from={slide2From} durationInFrames={SLIDE2_FRAMES} layout="none">
        <StaticSlide
          image="slides/Nixon-Cambodia/02-b52-bombs-away.jpg"
          audio="audio/operation-menu-vo-02.mp3"
          slideId="02"
          durationFrames={SLIDE2_FRAMES}
        />
      </Sequence>

      <Sequence from={slide3From} durationInFrames={SLIDE3_FRAMES} layout="none">
        <StaticSlide
          image="slides/Nixon-Cambodia/03-arc-light-strike.jpg"
          audio="audio/operation-menu-vo-03.mp3"
          slideId="03"
          durationFrames={SLIDE3_FRAMES}
        />
      </Sequence>

      <Sequence from={slide4From} durationInFrames={SLIDE4_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
