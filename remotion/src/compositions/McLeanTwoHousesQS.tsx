import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, Easing } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  HARD_CUT_FRAMES,
  PAN_FILL_STATIC_SCALE_TO,
  SlidePanel,
  Vignette,
  ContextTag,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// McLean Two Houses QS (BLUEGRAY/Civil War) -- Wilmer McLean's house was hit
// by a shell at the First Battle of Bull Run (1861); he later moved his
// family to Appomattox Court House, where Lee surrendered to Grant in his
// parlor (1865). Built on the shared QuickStrikeShared/QuickStrikeConfig
// engine, same as every other QuickStrike -- not forked.
//
// Voiceover: Chatterbox Turbo, voice cloned from voice_clean.wav (see
// remotion/scripts/generate_vo_mclean_two_houses_chatterbox.py). Durations
// below are ffprobe-MEASURED against the final "-mid" take (moderate pitch-
// down + warmth/presence EQ + light compression documentary pass, tempo
// unchanged) -- not estimated.
//
// Pan-Fill categories (per the build brief):
//   - Slide 1 (01-mclean-house-bull-run.jpg, 1190x860): Category 3
//     (document/illustration) -- static, no pan, still the engine's standard
//     subtle scale-only drift (1.0->1.05) rather than a fully frozen frame.
//     KenBurnsImage's cover-fit branch hardcodes objectPosition:'center
//     center', which crops this source at raw-image-center (x=595 of 1190)
//     -- but the house's own visual center (the two-story block with the
//     portico, visually spanning roughly x=275-650) sits at x~460, well
//     left of that. A center-of-image crop showed source x=[353,837] at
//     this canvas height, cutting into the house's own left edge (confirmed
//     via rendered still). Hand-rolled below (Slide1, bypassing SlidePanel)
//     with objectPosition:'31% center' instead -- same
//     getPanFillTransform-style math (panRoomPx/baseScale), just solved for
//     a source-x=460 crop center instead of the raw midpoint -- showing
//     source x=[218,702], the full main house block with margin both sides.
//   - Slide 2 (02-mclean-house-appomattox.jpg, 2877x1977): Category 2
//     (wide/panoramic). Pan-Fill's own speed cap (100px/sec) would only
//     cover ~626px of this image's 1499.8px usable pan room (87.5% of the
//     1714px overflow once scaled to fill the 1920px canvas height) across
//     this slide's 6.260s duration -- well short of the 85-90% the brief
//     asks for. Same situation as OperationMenuQuickStrike's slide 1: a
//     hand-rolled pan (Slide2Pan below) bypasses the cap and drives the
//     full 87.5%-of-room travel directly, still using the SAME formula
//     (getPanFillTransform's own margin/usable-room math) just without the
//     cap. No shared-engine changes.
//   - Slide 3 (03-lee-grant-portraits.jpg, 1080x1920): Category 1
//     (portrait/single-subject; here two subjects side by side). Already
//     canvas-matched -- panFillMode='static' for the same minimal scale
//     drift as slide 1, zero horizontal motion.
//
// Headline (overlayText) and location labels are DRAFT/suggested copy, not
// dictated by the build brief -- flagged for Brad's confirmation before this
// is treated as final.
//
// Gold lower third (GoldLowerThird) and closed captions (CaptionOverlay) are
// REMOVED per Brad's request -- headline/caption text below is left in place
// as commented-out data (not deleted) so it's a one-line re-enable if wanted
// back later. Only the top-left location tag (ContextTag) still renders.

const PAD_S = 0.4;

// Actual measured VO durations (Chatterbox Turbo "-mid" take, ffprobe-verified).
// VO3_S updated for the "Lee surrender to Grant" text change -- re-cloned from
// voice_clean.wav, same pipeline, ffprobe-verified against the new file.
const VO1_S = 4.680;
const VO2_S = 5.860;
const VO3_S = 6.404;

const SLIDE1_DURATION_S = VO1_S + PAD_S; // 5.080
const SLIDE2_DURATION_S = VO2_S + PAD_S; // 6.260
const SLIDE3_DURATION_S = VO3_S + PAD_S; // 6.804

// ---------------------------------------------------------------------------
// Slide 1 -- Category 3 (document/illustration), static crop, hand-rolled
// (see file header re: the objectPosition centering fix KenBurnsImage can't
// do -- same precedent as Slide2Pan below).
// ---------------------------------------------------------------------------
const SLIDE1_IMAGE = 'slides/mclean-two-houses/01-mclean-house-bull-run.jpg';
const SLIDE1_DURATION_FRAMES = Math.round(SLIDE1_DURATION_S * FPS);
// See file header for the derivation -- centers the crop on the house's own
// visual center (source x~460) rather than the raw image midpoint (x=595).
const SLIDE1_OBJECT_POSITION = '31% center';

function Slide1() {
  const frame = useCurrentFrame();
  // Same subtle scale-only drift Pan-Fill's own 'static' category applies by
  // default (PAN_FILL_STATIC_SCALE_TO, easeInOutCubic) -- only the crop
  // centering changes here, not the motion treatment.
  const scale = interpolate(frame, [0, SLIDE1_DURATION_FRAMES], [1, PAN_FILL_STATIC_SCALE_TO], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    // Cold open -- slide 1 is fully visible from frame 0, no fade-in.
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile(SLIDE1_IMAGE)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: SLIDE1_OBJECT_POSITION,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      </AbsoluteFill>
      <Vignette />

      <ContextTag text="MANASSAS, VIRGINIA — JULY 1861" position="top-left" />

      <Audio src={staticFile('audio/mclean-two-houses-vo-01.mp3')} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide 2 -- Category 2 (wide/panoramic), hand-rolled pan (see file header).
// ---------------------------------------------------------------------------
const SLIDE2_IMAGE = 'slides/mclean-two-houses/02-mclean-house-appomattox.jpg';
const SLIDE2_SOURCE_WIDTH = 2877;
const SLIDE2_SOURCE_HEIGHT = 1977;
const SLIDE2_DURATION_FRAMES = Math.round(SLIDE2_DURATION_S * FPS); // 188
// Only consumed by the now-removed CaptionOverlay call below -- kept as a
// commented reference alongside the caption text it timed:
// const SLIDE2_AUDIO_FRAMES = Math.round(VO2_S * FPS); // 176

// Mirrors getPanFillTransform's own math (QuickStrikeShared.tsx) exactly --
// base_scale = canvas height / source height, 87.5% of the overflow (the
// middle of the locked 85-90% range), 50px hard edge-buffer floor -- just
// without that function's MAX_PAN_SPEED_PX_PER_SEC cap, which would
// otherwise fall well short of the requested travel for this slide's
// duration (see file header comment).
const slide2BaseScale = CANVAS_HEIGHT / SLIDE2_SOURCE_HEIGHT; // 0.97117
const slide2RenderedWidth = SLIDE2_SOURCE_WIDTH * slide2BaseScale; // 2794.05
const slide2PanRoomPx = slide2RenderedWidth - CANVAS_WIDTH; // 1714.05
const slide2MarginPerSide = Math.max(slide2PanRoomPx * (1 - 0.875) / 2, 50); // 107.13
const slide2UsablePanPx = slide2PanRoomPx - slide2MarginPerSide * 2; // 1499.80 (87.5% of pan room)
const slide2Half = slide2UsablePanPx / 2; // 749.90
// ltr: txFrom positive brings the source's LEFT content into view first,
// panning to the right content by the end (same sign convention as
// getPanFillTransform's own txFrom/txTo derivation).
const SLIDE2_TX_FROM = slide2Half;
const SLIDE2_TX_TO = -slide2Half;

function Slide2Pan({ frame, durationFrames }: { frame: number; durationFrames: number }) {
  const tx = interpolate(frame, [0, durationFrames], [SLIDE2_TX_FROM, SLIDE2_TX_TO], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Img
          src={staticFile(SLIDE2_IMAGE)}
          style={{ height: '100%', width: 'auto', transform: `translateX(${tx}px)` }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// Gold lower third / captions removed per Brad's request -- kept here as
// reference, not rendered:
// const SLIDE2_OVERLAY_TEXT = 'IT ENDED AT HIS HOUSE, TOO.';
// const SLIDE2_CAPTIONS = [
//   "But one man's house was hit",
//   'by a shell at Bull Run.',
//   'Later, he moved his family',
//   'to Appomattox Court House.',
// ];

function Slide2() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <Slide2Pan frame={frame} durationFrames={SLIDE2_DURATION_FRAMES} />
      <Vignette />

      <ContextTag text="APPOMATTOX COURT HOUSE, VIRGINIA — APRIL 1865" position="top-left" />

      {/* Per-slide voiceover -- fires at this slide's own local frame 0. */}
      <Audio src={staticFile('audio/mclean-two-houses-vo-02.mp3')} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide 3 -- Category 1 (portrait/two subjects side by side), canvas-matched,
// static, minimal drift.
// ---------------------------------------------------------------------------
const slide3: SharedSlideConfig = {
  id: 'slide3',
  image: 'slides/mclean-two-houses/03-lee-grant-portraits.jpg',
  audio: 'audio/mclean-two-houses-vo-03.mp3',
  durationInSeconds: SLIDE3_DURATION_S,
  audioDurationSeconds: VO3_S,
  // Gold lower third / captions removed per Brad's request -- kept here as
  // reference, not rendered:
  // overlayText: "WILMER McLEAN'S TWO HOUSES",
  // captionLines: [
  //   'The owner? Wilmer McLean.',
  //   'His first house saw Bull Run.',
  //   'His second saw Lee surrender to Grant.',
  // ],
  sourceWidth: 1080,
  sourceHeight: 1920,
  panFillMode: 'static',
};

const slide3WithFrames = {
  ...slide3,
  durationFrames: Math.round(slide3.durationInSeconds * FPS),
  audioDurationFrames: Math.round(slide3.audioDurationSeconds * FPS),
};

// ---------------------------------------------------------------------------
// Slide sequencing
// ---------------------------------------------------------------------------

const slide1From = 0;
const slide2From = slide1From + SLIDE1_DURATION_FRAMES;
const slide3From = slide2From + SLIDE2_DURATION_FRAMES;

export const totalDuration = slide3From + slide3WithFrames.durationFrames;
export { FPS };

export default function McLeanTwoHousesQS() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/lee-resignation-music.mp3')} volume={0.15} loop />

      <Sequence from={slide1From} durationInFrames={SLIDE1_DURATION_FRAMES} layout="none">
        <Slide1 />
      </Sequence>

      <Sequence from={slide2From} durationInFrames={SLIDE2_DURATION_FRAMES} layout="none">
        <Slide2 />
      </Sequence>

      <Sequence from={slide3From} durationInFrames={slide3WithFrames.durationFrames} layout="none">
        <SlidePanel slide={slide3WithFrames} isFirst={false} />
      </Sequence>
    </AbsoluteFill>
  );
}
