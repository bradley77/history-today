import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
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
// see scripts/generateVoiceover-doolittle-raid.py).
const SLIDE1_AUDIO_S = 5.172245;
const SLIDE2_AUDIO_S = 5.746939;
const SLIDE3_AUDIO_S = 3.552653;
const SLIDE4_AUDIO_S = 5.903673;

// ---------------------------------------------------------------------------
// Mixed video/stat-card Quick Strike. Video clips get the blur-border-fill
// treatment with zero synthetic Ken Burns (the footage carries its own
// motion). The two still slots (formerly 02/04) are stat cards, ported
// structurally from IaDrangValleyQS's LZ Albany slide
// (public/slides/ia-drang-valley/04-lz-albany.jpg): that slide has no
// separate React overlay component — its headline/date/quote/stat/caption/
// footer are baked directly into the source art as a solid-dark-background
// graphic, rendered via a bare image slide with no CaptionOverlay/
// GoldLowerThird on top (avoids crowding the art's own text). Since our
// version needs the same look without a pre-rendered graphic, this
// reproduces that card's type hierarchy as real text elements — colors
// sampled directly from the reference art. That art has no quote block on
// its own pairing and no gold rule anywhere in it; both are matched as
// omitted/absent here rather than invented.
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
   * slide duration instead of freezing on its last frame. */
  playbackRate: number;
};

type StatSlideConfig = {
  id: string;
  kind: 'stat';
  audio: string;
  durationInSeconds: number;
  audioDurationSeconds: number;
  /** Omitted entirely (not rendered as an empty block) when undefined —
   * see slide4, which has no headline/date, matching the "omit rather than
   * leave a gap" treatment applied to the dropped quote block. */
  headline?: string;
  date?: string;
  bigStat: string;
  captionLines: string[];
  footerLines: string[];
};

type SlideConfig = VideoSlideConfig | StatSlideConfig;

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    kind: 'video',
    video: 'videos/Doolittle/01-doolittle-b25-launch.mp4',
    audio: 'audio/doolittle-raid-01-voiceover.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    overlayText: "No one had ever launched bombers off a carrier before.",
    captionLines: [
      'This is what launching medium bombers off a carrier looked like',
      'when no one had ever done it before.',
    ],
    // Source clip is 3.970637s; slide is VO-locked to 167 frames (5.5667s @
    // 30fps). Slowed so the footage's own motion covers the full slide
    // instead of freezing on its last frame while the VO is still talking.
    playbackRate: 3.970637 / (167 / FPS),
  },
  {
    id: 'slide2',
    kind: 'stat',
    audio: 'audio/doolittle-raid-02-voiceover.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    headline: 'DOOLITTLE RAID',
    date: 'APRIL 18, 1942',
    bigStat: '16',
    captionLines: ['Bombers launched with no way back to the carrier'],
    footerLines: ['First strike on the Japanese home islands'],
  },
  {
    id: 'slide3',
    kind: 'video',
    video: 'videos/Doolittle/03-doolittle-crew-assembled.mp4',
    audio: 'audio/doolittle-raid-03-voiceover.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    overlayText: '80 men. 16 aircraft. Bombs marked for Tokyo.',
    captionLines: ['Eighty men. Sixteen aircraft.', 'Bombs marked for Tokyo.'],
    // Source clip is 3.003003s; slide is VO-locked to 119 frames (3.9667s @
    // 30fps). Same stretch treatment as slide1.
    playbackRate: 3.003003 / (119 / FPS),
  },
  {
    id: 'slide4',
    kind: 'stat',
    audio: 'audio/doolittle-raid-04-voiceover.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    // No headline/date on this card, by spec.
    bigStat: '0',
    captionLines: ['Planes returned to the carrier'],
    footerLines: ['Doolittle expected a court-martial. He got the Medal of Honor.'],
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card. Locked FRONT CTA, no VO — mirrors LincolnFortStevens' silent
// EndCardCTA (no `audio` prop, fixed 61-frame duration). Subline comes from
// the shared CTA_CONFIG.FRONT entry (not a literal override), so it stays in
// sync with every other FRONT video. "Like. Save. Share." is silent,
// always-on text beneath the subline — same pattern hand-added on every
// other recent Quick Strike end card (DayOfInfamyDraftQS, TrinityTestQS,
// BattleOfTheBulgeQS, LittleBighornQS, etc.); not centralized in
// EndCardCTA itself, so it's duplicated here rather than inherited.
// ---------------------------------------------------------------------------
const END_CARD_DURATION = 61; // frames

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
      <EndCardCTA triggerWord="FRONT" subline={CTA_CONFIG.FRONT.subline} />

      {/* Silent-viewer text, no VO. Bottom padding 340px (not the earlier
          90px some end cards used, e.g. OperationFrequentWindQS) keeps the
          text's bottom edge at y<=1580 — see TrinityTestQS's end card
          comment for why 90px was corrected to 340px. */}
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

// ---------------------------------------------------------------------------
// Blur-border-fill treatment for video — ported as-is from IaDrangValleyQS
// (QuickStrikeShared.tsx is locked/consume-only, no video slide component
// lives there yet). Both layers read the SAME src at the SAME playbackRate
// and mount at the SAME frame, so they're one synced composite.
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
// captions + audio. No Ken Burns here: video is its own content category.
// ---------------------------------------------------------------------------
function VideoSlidePanel({
  slide,
  isFirst,
}: {
  slide: VideoSlideConfig & { durationFrames: number; audioDurationFrames: number };
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();
  const { overlayText, captionLines, video, audio, playbackRate } = slide;

  // Cold open on slide 1 (full brightness frame 0, no fade-in). 4-frame hard
  // cut on every slide after that. No fade-out anywhere.
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

      <SyncedGoldLowerThird text={overlayText} frame={frame} />

      <CaptionOverlay
        lines={captionLines}
        audioDurationFrames={slide.audioDurationFrames}
        overlayText={overlayText}
      />

      {/* Per-slide voiceover — fires at this slide's own local frame 0 */}
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Stat-card slide — solid dark background, no image. Colors sampled directly
// off IaDrangValleyQS's 04-lz-albany.jpg reference art:
//   background #1A1D16, cream text #EAE4D0, muted gray-tan #96948A,
//   stat orange #D3734F. That reference has no gold rule anywhere in it, so
//   none is added here. Headline+date+stat+caption are centered as one
//   group so a card with no headline/date (slide4) doesn't leave the gap
//   that block would have occupied; footer is anchored near the bottom,
//   independent of that group, so both cards' footers land in the same
//   place regardless of what's above them.
// ---------------------------------------------------------------------------
const STAT_BG = '#1A1D16';
const STAT_CREAM = '#EAE4D0';
const STAT_MUTED = '#96948A';
const STAT_ORANGE = '#D3734F';
const STAT_FONT = "'Oswald', Impact, 'Arial Black', sans-serif";

function StatCardPanel({
  slide,
  isFirst,
}: {
  slide: StatSlideConfig & { durationFrames: number; audioDurationFrames: number };
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();
  const { headline, date, bigStat, captionLines, footerLines, audio } = slide;

  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  return (
    <AbsoluteFill style={{ backgroundColor: STAT_BG, opacity }}>
      <Vignette />

      <AbsoluteFill
        style={{
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 80px',
          pointerEvents: 'none',
        }}
      >
        {headline && (
          <div
            style={{
              color: STAT_CREAM,
              fontFamily: STAT_FONT,
              fontWeight: 700,
              fontSize: 64,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            {headline}
          </div>
        )}
        {date && (
          <div
            style={{
              marginTop: 12,
              color: STAT_MUTED,
              fontFamily: STAT_FONT,
              fontWeight: 400,
              fontSize: 28,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            {date}
          </div>
        )}

        <div
          style={{
            marginTop: headline || date ? 96 : 0,
            color: STAT_ORANGE,
            fontFamily: STAT_FONT,
            fontWeight: 700,
            fontSize: 128,
            lineHeight: 1,
            textAlign: 'center',
          }}
        >
          {bigStat}
        </div>

        <div style={{ marginTop: 24, maxWidth: 820 }}>
          {captionLines.map((line, i) => (
            <div
              key={i}
              style={{
                color: STAT_CREAM,
                fontFamily: STAT_FONT,
                fontWeight: 700,
                fontSize: 38,
                lineHeight: 1.3,
                textAlign: 'center',
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 80px 200px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ maxWidth: 820 }}>
          {footerLines.map((line, i) => (
            <div
              key={i}
              style={{
                color: STAT_MUTED,
                fontFamily: STAT_FONT,
                fontWeight: 400,
                fontSize: 26,
                lineHeight: 1.4,
                letterSpacing: '0.01em',
                textAlign: 'center',
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </AbsoluteFill>

      {/* Per-slide voiceover — fires at this slide's own local frame 0 */}
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
}

export const totalDuration = slidesDuration + END_CARD_DURATION;
export { FPS };

export default function DoolittleRaidQS() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/patton-blood-and-guts-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => {
        const from = offset;
        offset += slide.durationFrames;
        return (
          <Sequence key={slide.id} from={from} durationInFrames={slide.durationFrames} layout="none">
            {slide.kind === 'video' ? (
              <VideoSlidePanel slide={slide} isFirst={i === 0} />
            ) : (
              <StatCardPanel slide={slide} isFirst={i === 0} />
            )}
          </Sequence>
        );
      })}

      <Sequence from={slidesDuration} durationInFrames={END_CARD_DURATION} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
