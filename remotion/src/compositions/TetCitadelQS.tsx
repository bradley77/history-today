import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  KenBurnsImage,
  Vignette,
  useGoldOverlay,
  ContextTag,
  CaptionOverlay,
  EndCardCTA,
  GOLD,
  CANVAS_HEIGHT,
  SAFE_ZONE_BOTTOM_Y,
} from '../shared/QuickStrikeShared';
import { CTA_CONFIG } from '../shared/QuickStrikeConfig';

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified —
// see scripts/generateVoiceover-tet-citadel.py).
const SLIDE1_AUDIO_S = 6.400;
const SLIDE2_AUDIO_S = 7.837;
const SLIDE3_AUDIO_S = 5.407;
const SLIDE4_AUDIO_S = 5.930;
const CTA_AUDIO_S = 3.736;

// ---------------------------------------------------------------------------
// Video/stat-card Quick Strike, structurally identical to IaDrangValleyQS:
// video slides get the blur-border-fill treatment (zero synthetic Ken Burns —
// the footage carries its own motion), stat-card slides are pre-designed JPGs
// with their text already baked in, rendered through the Pan-Fill System's
// 'static' category (subtle default push-in, no baked-in-style headline
// overlay — but see ImageSlidePanel below for the verbatim-VO caption these
// do get, added so silent viewers aren't left without any caption coverage
// on these two slides).
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
  /** Top-left context tag, e.g. "SOUTH VIETNAM — JANUARY 30, 1968". Omitted
   * entirely (not rendered empty) when undefined. */
  label?: string;
  /** Stretches playback so the clip's own motion spans the full VO-locked
   * slide duration instead of freezing on its last frame — see per-slide
   * comment below for the source-duration/slide-duration math. */
  playbackRate: number;
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
  /** Verbatim VO line (not the card's own baked-in stat text) burned in as a
   * caption for silent viewers — these stat cards have no CaptionOverlay
   * otherwise, since their overlayText is baked into the JPG. Omitted
   * entirely (not rendered empty) when undefined. */
  captionText?: string;
};

type SlideConfig = VideoSlideConfig | ImageSlideConfig;

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    kind: 'video',
    video: 'videos/Tet/01-m113-convoy.mp4',
    audio: 'audio/tet-citadel-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    overlayText: 'IT HIT MORE PLACES THAN YOU THINK',
    captionLines: [
      'Everyone knows Tet was a massive surprise attack.',
      'What gets left out is how many places it hit at once.',
    ],
    label: 'SOUTH VIETNAM — JANUARY 30, 1968',
    // Source clip is now the cropped 704x464 version (crop=704:464:8:10,
    // removes a black telecine border — spatial crop only, runtime unchanged
    // at 6.473133s). Slide is VO-locked to the shortened line's 204 frames
    // (6.8s @ 30fps). Resulting stretch (~0.95x) sits ABOVE the ~0.71-0.86x
    // range used on IaDrangValleyQS/DoolittleRaidQS's video slides — i.e.
    // close to the clip's native speed rather than the slow-motion stretch
    // those used, and outside the established range on the fast/natural side
    // this time. Flagged as-is per instruction, not adjusted further.
    playbackRate: 6.473133 / (204 / FPS),
  },
  {
    id: 'slide2',
    kind: 'image',
    image: 'slides/Tet/02-100-cities-stat.jpg',
    audio: 'audio/tet-citadel-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    sourceWidth: 1080,
    sourceHeight: 1920,
    captionText:
      'In a single night, communist forces struck more than one hundred cities, towns, and military installations across South Vietnam.',
  },
  {
    id: 'slide3',
    kind: 'video',
    video: 'videos/Tet/03-uh1c-strike.mp4',
    audio: 'audio/tet-citadel-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    overlayText: 'MOST WERE REPELLED WITHIN DAYS',
    captionLines: [
      'Almost everywhere, American and South Vietnamese forces',
      'threw the attacks back within days.',
    ],
    // Source clip is 5.000000s; slide is VO-locked to 174 frames (5.8s @
    // 30fps). Slowed so the footage's own motion covers the full slide
    // instead of freezing on its last frame, same as IaDrangValleyQS slide1.
    playbackRate: 5.0 / (174 / FPS),
  },
  {
    id: 'slide4',
    kind: 'image',
    image: 'slides/Tet/04-hue-held-stat.jpg',
    audio: 'audio/tet-citadel-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    sourceWidth: 1080,
    sourceHeight: 1920,
    captionText: 'Only one major city remained occupied. It took a month of street to street fighting to take it back.',
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card. Trigger word CITADEL, subline pulled from CTA_CONFIG (a new
// one-off entry added alongside RECON, not replacing it — RECON stays intact
// for future Vietnam Quick Strikes). Matches the exact pattern used on
// IaDrangValleyQS/SonTayQS/OperationFrequentWindQS end cards. VO is limited
// to the comment-trigger line only; the trigger word and "Like. Save. Share."
// are silent, always-on text.
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
        triggerWord="CITADEL"
        subline={CTA_CONFIG.CITADEL.subline}
        audio="audio/tet-citadel-vo-05.mp3"
      />

      <CaptionOverlay
        lines={['Comment CITADEL for the free declassified Vietnam document.']}
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
// Blur-border-fill treatment for video — ported as-is from IaDrangValleyQS/
// DoolittleRaidQS (QuickStrikeShared.tsx is locked/consume-only, no video
// slide component lives there yet). Both layers read the SAME src at the
// SAME playbackRate and mount at the SAME frame, so they're one synced
// composite, not two independently-playing videos.
// ---------------------------------------------------------------------------
function BlurBorderFillVideo({ video, playbackRate }: { video: string; playbackRate: number }) {
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <OffthreadVideo
          src={staticFile(video)}
          playbackRate={playbackRate}
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

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <OffthreadVideo
          src={staticFile(video)}
          playbackRate={playbackRate}
          volume={0}
          style={{ width: '100%', height: 'auto' }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// Mirrors QuickStrikeShared's GoldLowerThird internal (non-exported)
// BOTTOM_SAFE_BUFFER=20. QuickStrikeShared.tsx is locked (consume-only), so
// this literal is duplicated here rather than imported — see
// IaDrangValleyQS.tsx for the original rationale.
const BOTTOM_SAFE_BUFFER = 20;

// Local stand-in for QuickStrikeShared's GoldLowerThird, ported from
// IaDrangValleyQS: puts a SINGLE opacity value on the box+text together so
// there's no frame where the box is visible with no text in it yet.
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
// optional context tag + captions + audio. No Ken Burns here: video is its
// own content category and gets zero synthetic pan/scale.
// ---------------------------------------------------------------------------
function VideoSlidePanel({
  slide,
  isFirst,
}: {
  slide: VideoSlideConfig & { durationFrames: number; audioDurationFrames: number };
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();
  const { overlayText, captionLines, video, audio, playbackRate, label } = slide;

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
      <BlurBorderFillVideo video={video} playbackRate={playbackRate} />
      <Vignette />

      {label && <ContextTag text={label} position="top-left" />}

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

// Fades in immediately, fades out just before the slide's real audio ends —
// never lingers into the trailing 0.4s pad. Mirrors BattleOfHue.tsx's local
// useCaptionOpacity exactly (not QuickStrikeShared's CaptionOverlay, which
// is a floating word-cycling box tuned for headline-bearing slides — these
// stat cards have no headline layer to cycle against).
function useCaptionOpacity(localFrame: number, endFrame: number) {
  return interpolate(
    localFrame,
    [0, 10, Math.max(11, endFrame - 6), endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
}

// Mirrors BattleOfHue.tsx's local captionStyle exactly.
const captionStyle = {
  margin: 0,
  fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
  fontWeight: 400,
  fontSize: 32,
  lineHeight: 1.35,
  color: '#E8E2D4',
  textShadow: '0 2px 10px rgba(0,0,0,0.9)',
  letterSpacing: '0.01em',
} as const;

// ---------------------------------------------------------------------------
// Image slide — stat cards with their text already baked into the graphic,
// so no GoldLowerThird headline here (avoids crowding the art's own text).
// Pan-Fill resolves to 'static' (1080x1920 source, below the 1.2 pan aspect
// threshold) — forced explicitly since these are graphic cards, not photos
// meant to pan.
//
// A verbatim-VO caption IS rendered when the slide supplies captionText —
// both stat cards leave a large blank band below their own baked-in footer
// line (confirmed by pixel-sampling both JPGs), so a bottom-anchored caption
// clamped to SAFE_ZONE_BOTTOM_Y sits well clear of that footer regardless of
// how many lines it wraps to.
// ---------------------------------------------------------------------------
function ImageSlidePanel({
  slide,
  isFirst,
}: {
  slide: ImageSlideConfig & { durationFrames: number; audioDurationFrames: number };
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();
  const { durationFrames, image, audio, sourceWidth, sourceHeight, captionText, audioDurationFrames } = slide;

  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  const captionOpacity = useCaptionOpacity(frame, audioDurationFrames);

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

      {captionText && (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: `0 48px ${CANVAS_HEIGHT - SAFE_ZONE_BOTTOM_Y + BOTTOM_SAFE_BUFFER}px`,
            pointerEvents: 'none',
          }}
        >
          <p style={{ ...captionStyle, textAlign: 'center', opacity: captionOpacity }}>{captionText}</p>
        </AbsoluteFill>
      )}

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
}

export const totalDuration = slidesDuration + CTA_FRAMES;
export { FPS };

export default function TetCitadelQS() {
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
