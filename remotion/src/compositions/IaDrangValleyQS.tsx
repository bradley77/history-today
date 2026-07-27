import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  KenBurnsImage,
  Vignette,
  useGoldOverlay,
  CaptionOverlay,
  EndCardCTA,
  GOLD,
  CANVAS_HEIGHT,
  SAFE_ZONE_BOTTOM_Y,
} from '../shared/QuickStrikeShared';
import { CTA_CONFIG } from '../shared/QuickStrikeConfig';

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified —
// see scripts/generateVoiceover-ia-drang-valley.py).
const SLIDE1_AUDIO_S = 5.616;
const SLIDE2_AUDIO_S = 7.889;
const SLIDE3_AUDIO_S = 4.937;
const SLIDE4_AUDIO_S = 6.975;
const CTA_AUDIO_S = 3.056;

// ---------------------------------------------------------------------------
// This is the first Quick Strike mixing real archival video clips with
// Pan-Fill stills, so video is its own content category: full-bleed,
// object-fit cover, NO Ken Burns pan/scale (the footage already carries its
// own motion). Stills still go through the normal Pan-Fill System.
// ---------------------------------------------------------------------------

type VideoSlideConfig = {
  id: string;
  kind: 'video';
  video: string;
  audio: string;
  durationInSeconds: number;
  audioDurationSeconds: number;
  overlayText: string;
  captionLines: string[];
  /** Stretches playback so the clip's own motion spans the full VO-locked
   * slide duration instead of freezing on its last frame — see per-slide
   * comment below for the source-duration/slide-duration math. Never used
   * to add motion; only to keep the source's existing motion from running
   * out early. */
  playbackRate: number;
  /** Skips this many composition frames (at 1x, before playbackRate scaling)
   * from the start of the source clip — for a source with a dead/frozen lead-in
   * that would otherwise show as a stall. 0 (omitted) for clips with no such
   * issue. See per-slide comment for the frame-diff evidence and math. */
  trimBeforeFrames?: number;
};

type ImageSlideConfig = {
  id: string;
  kind: 'image';
  image: string;
  audio: string;
  durationInSeconds: number;
  audioDurationSeconds: number;
  sourceWidth: number;
  sourceHeight: number;
};

type SlideConfig = VideoSlideConfig | ImageSlideConfig;

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    kind: 'video',
    video: 'videos/ia-drang-valley/01-chopper-landing.mp4',
    audio: 'audio/ia-drang-valley/01-chopper-landing.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    overlayText: "AMERICA WON THIS BATTLE. IT'S ALSO HOW THEY LOST THE WAR.",
    captionLines: [
      'America called it a victory.',
      'The North Vietnamese called it proof they could beat American tactics.',
    ],
    // Source clip is 5.000s; slide is VO-locked to 6.000s (180 frames @
    // 30fps). Slowed to 5.000/6.000 so the footage's own motion covers the
    // full slide instead of freezing on its last frame while the VO is
    // still talking.
    playbackRate: 5.0 / 6.0,
  },
  {
    id: 'slide2',
    kind: 'image',
    image: 'slides/ia-drang-valley/02-troop-scale-map.jpg',
    audio: 'audio/ia-drang-valley/02-troop-scale-map.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    sourceWidth: 1080,
    sourceHeight: 1920,
  },
  {
    id: 'slide3',
    kind: 'video',
    video: 'videos/ia-drang-valley/03-smoke-escalation.mp4',
    audio: 'audio/ia-drang-valley/03-smoke-escalation.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    overlayText: 'OUTNUMBERED FOUR TO ONE',
    captionLines: [
      'Thirty minutes after landing,',
      'a captured soldier revealed they were badly outnumbered.',
    ],
    // Source clip is 5.033s; slide is VO-locked to 5.333s (160 frames @ 30fps).
    //
    // The raw clip's first 30 native (60fps) frames are pixel-identical — a
    // ~0.5s frozen lead-in baked into the archival footage itself, confirmed
    // via frame-diff against the untouched source file (real motion only
    // starts at source frame 31, t≈0.517s). Playing it straight produced a
    // visible stall right after the slide2->slide3 cut. Trimmed past it with
    // trimBeforeFrames below (20 comp-frames ≈0.56s of source, comfortably
    // clearing the frozen zone) and playbackRate recomputed so the shortened
    // remaining footage (5.033 - ~0.56 ≈ 4.47s) still exactly fills the full
    // 160-frame slide: remaining_source / rate = slideSeconds
    //   => rate = source / (slideFrames + trimBeforeFrames) * FPS
    //           = 5.033333 / ((160 + 20) / FPS)
    playbackRate: 5.033333 / ((160 + 20) / FPS),
    trimBeforeFrames: 20,
  },
  {
    id: 'slide4',
    kind: 'image',
    image: 'slides/ia-drang-valley/04-lz-albany.jpg',
    audio: 'audio/ia-drang-valley/04-lz-albany.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    sourceWidth: 1080,
    sourceHeight: 1920,
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card. Trigger word RECON, subline pulled from CTA_CONFIG (RECON's
// established PDF funnel — the free Vietnam fact sheet), matching the exact
// pattern used on SonTayQS and OperationFrequentWindQS. VO is limited to the
// comment-trigger line only (Max Alignment rule); the trigger word and
// "Like. Save. Share." are silent, always-on text — no "Follow Echo and
// Chronicle" wording anywhere per the CTA rule.
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
        triggerWord="RECON"
        subline={CTA_CONFIG.RECON.subline}
        audio="audio/ia-drang-valley/05-cta.mp3"
      />

      <CaptionOverlay
        lines={['Comment RECON to get the free Vietnam fact sheet.']}
        audioDurationFrames={CTA_AUDIO_FRAMES}
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
// Blur-border-fill treatment for video (approved preview): the complete
// original 16:9 frame is shown uncropped, letterboxed over a blurred/
// darkened cover-fill copy of the same footage instead of a hard crop.
//
// Both layers read the SAME src at the SAME playbackRate (and same
// trimBefore, when set) and mount at the SAME frame — OffthreadVideo
// resolves its displayed frame purely from (current composition frame,
// playbackRate, trimBefore), not an autonomous playback clock, so two
// instances with identical props are provably always showing the same
// source timestamp. This is one synced composite, not two independently-
// playing videos.
// ---------------------------------------------------------------------------
function BlurBorderFillVideo({
  video,
  playbackRate,
  trimBeforeFrames,
}: {
  video: string;
  playbackRate: number;
  trimBeforeFrames?: number;
}) {
  return (
    <AbsoluteFill>
      {/* Background: cover-fills the canvas (force_original_aspect_ratio=
          increase + center-crop equivalent via objectFit: 'cover'), blurred
          + darkened. gblur sigma=30 -> CSS blur(30px): the CSS Filter
          Effects spec defines the blur() length as the Gaussian's standard
          deviation, the same "sigma" unit ffmpeg's gblur takes, so this is
          the same operation, not just a visual approximation. brightness=
          -0.15 -> CSS brightness(0.85) is the nearest CSS analog (CSS
          brightness is multiplicative, ffmpeg's eq brightness is additive,
          but 1 + (-0.15) lands in the same place for this darkening use).
          Scaled slightly past 100% so the blur kernel never samples
          transparent space at the frame's outer edge — a CSS-filter-specific
          edge artifact ffmpeg's gblur doesn't have (it edge-extends instead
          of going transparent), so this compensates for a rendering-pipeline
          difference, not a deviation from the approved look. */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <OffthreadVideo
          src={staticFile(video)}
          playbackRate={playbackRate}
          trimBefore={trimBeforeFrames}
          volume={0}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            transform: 'scale(1.08)',
            filter: 'blur(30px) brightness(0.85)',
          }}
        />
      </AbsoluteFill>

      {/* Foreground: fit-by-width (1080px, height auto per native 16:9),
          complete frame, no crop, vertically centered over the blurred backdrop. */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <OffthreadVideo
          src={staticFile(video)}
          playbackRate={playbackRate}
          trimBefore={trimBeforeFrames}
          volume={0}
          style={{ width: '100%', height: 'auto' }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// Mirrors QuickStrikeShared's GoldLowerThird internal (non-exported)
// BOTTOM_SAFE_BUFFER=20. QuickStrikeShared.tsx is locked/consume-only, so
// this literal is duplicated here rather than imported.
const BOTTOM_SAFE_BUFFER = 20;

// ---------------------------------------------------------------------------
// Local stand-in for QuickStrikeShared's GoldLowerThird. That component gives
// its background box full opacity immediately (no fade) while only the text
// fades in on its own delayed timing — producing a frame range where the box
// is visible with nothing in it yet. QuickStrikeShared.tsx is locked
// (consume-only, no edits), so this reproduces its exact visual design (same
// rule/box/text styling, same SAFE_ZONE_BOTTOM_Y anchoring) but puts a SINGLE
// opacity value on the box div itself — the box's background-color and the
// text inside it are the same DOM subtree under that one opacity, not two
// separately-timed animations that happen to share parameters — so there is
// no frame where one is visible and the other isn't. Used for both slide 1
// and slide 3 (VideoSlidePanel).
// ---------------------------------------------------------------------------
function SyncedGoldLowerThird({
  text,
  frame,
  delayFrames = 8,
}: {
  text: string;
  frame: number;
  delayFrames?: number;
}) {
  const { ruleWidth } = useGoldOverlay(frame, delayFrames);
  // Same start frame, same duration, for the box AND the text — they're one
  // fade because they're the same `opacity` value applied once, not two.
  const opacity = interpolate(frame, [delayFrames, delayFrames + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: `0 48px ${CANVAS_HEIGHT - SAFE_ZONE_BOTTOM_Y + BOTTOM_SAFE_BUFFER}px`,
        pointerEvents: 'none',
      }}
    >
      <div style={{ width: '100%' }}>
        <div
          style={{
            height: 3,
            width: `${ruleWidth}%`,
            backgroundColor: GOLD,
            marginBottom: 16,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />
        <div style={{ backgroundColor: 'rgba(0,0,0,0.60)', padding: '24px 40px', textAlign: 'center', opacity }}>
          <p
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: '#F5F0E8',
              margin: 0,
              lineHeight: 1.25,
              textShadow: '0 2px 14px rgba(0,0,0,0.95)',
              fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
              letterSpacing: '0.01em',
            }}
          >
            {text}
          </p>
        </div>
        <div
          style={{
            height: 3,
            width: `${ruleWidth}%`,
            backgroundColor: GOLD,
            marginTop: 16,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Video slide — blur-border-fill footage + vignette + gold-rule headline +
// captions + audio. No KenBurnsImage/Pan-Fill here: video is its own content
// category and gets zero synthetic pan/scale, only the letterboxed composite.
// ---------------------------------------------------------------------------
function VideoSlidePanel({
  slide,
  isFirst,
}: {
  slide: VideoSlideConfig & { durationFrames: number; audioDurationFrames: number };
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();
  const { overlayText, captionLines, video, audio, playbackRate, trimBeforeFrames } = slide;

  // Cold open on slide 1 (full brightness frame 0, no fade-in). 4-frame hard
  // cut on every slide after that. No fade-out anywhere — hard cut ending.
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      {/* volume=0 on both BlurBorderFillVideo layers is on top of the source
          already being muted losslessly via ffmpeg (-an) — belt and
          suspenders against embedded audio. */}
      <BlurBorderFillVideo video={video} playbackRate={playbackRate} trimBeforeFrames={trimBeforeFrames} />
      <Vignette />

      <SyncedGoldLowerThird text={overlayText} frame={frame} />

      <CaptionOverlay
        lines={captionLines}
        audioDurationFrames={slide.audioDurationFrames}
        overlayText={overlayText}
      />

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Image slide — stat/map cards with their text already baked into the
// graphic, so no GoldLowerThird headline or CaptionOverlay here (avoids
// crowding the art's own text). Pan-Fill auto-resolves both to 'static'
// (1080x1920 source, well below the 1.2 pan aspect threshold) — forced
// explicitly here since these are graphic cards, not photos meant to pan.
// ---------------------------------------------------------------------------
function ImageSlidePanel({
  slide,
  isFirst,
}: {
  slide: ImageSlideConfig & { durationFrames: number; audioDurationFrames: number };
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();
  const { durationFrames, image, audio, sourceWidth, sourceHeight } = slide;

  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <KenBurnsImage
        image={image}
        frame={frame}
        durationFrames={durationFrames}
        sourceWidth={sourceWidth}
        sourceHeight={sourceHeight}
        panFillMode="static"
      />
      <Vignette />

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
}

export const totalDuration = slidesDuration + CTA_FRAMES;
export { FPS };

export default function IaDrangValleyQS() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/CIA-Gun-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => {
        const from = offset;
        offset += slide.durationFrames;
        return (
          <Sequence key={slide.id} from={from} durationInFrames={slide.durationFrames} layout="none">
            {slide.kind === 'video' ? (
              <VideoSlidePanel slide={slide} isFirst={i === 0} />
            ) : (
              <ImageSlidePanel slide={slide} isFirst={i === 0} />
            )}
          </Sequence>
        );
      })}

      <Sequence from={slidesDuration} durationInFrames={CTA_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
