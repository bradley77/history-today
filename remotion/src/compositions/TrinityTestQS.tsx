import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  Vignette,
  GoldLowerThird,
  ContextTag,
  CaptionOverlay,
  EndCardCTA,
  GOLD,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';
import { CTA_CONFIG } from '../shared/QuickStrikeConfig';

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro, ffprobe-verified against the encoded
// MP3s — see scripts/generateVoiceover-Trinity-Test.py). Single source of
// truth for every slide's durationInSeconds below.
const SLIDE1_AUDIO_S = 2.142; // EXCEPTION: slide-1's normal 1.5-2s hard cap is
// waived here per Brad's explicit sign-off — the line needs the full runtime
// to land, so it gets the standard 0.4s pad like every other slide instead of
// being cut short or held pad-less.
const SLIDE2_AUDIO_S = 3.161;
const SLIDE3_AUDIO_S = 4.467;
const SLIDE4_AUDIO_S = 2.952;
const SLIDE5_AUDIO_S = 2.900; // re-measured after "World War Two" respelling (was 3.239 for "WWII")

type SlideConfig = SharedSlideConfig;

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Trinity-Test/01-detonation.jpg',
    audio: 'audio/Trinity-Test-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    overlayText: 'THE GOVERNMENT SAID THE AREA WAS REMOTE',
    // Anchored to the TOP of frame instead of the default bottom: the
    // mushroom cloud fills the lower half of this 1920x2524 source (cover fit
    // maps its full height into frame with no crop headroom to speak of), so
    // a bottom box would overlap the cloud's cap/body no matter how the Ken
    // Burns crop is tuned — pushing scale further just enlarges the cloud
    // along with everything else. The top half of frame is empty sky, so
    // anchoring there gives clean separation from the subject for free.
    overlayPosition: 'top',
    label: 'TRINITY SITE, NEW MEXICO — JULY 16, 1945',
    captionLines: ['The government said the area was remote.'],
    // Default captionY (1260) lands inside the cloud's glow/body (source
    // geometry: cloud glow starts at source_y~1197 of 2524, which maps to
    // screen_y~911 at this cover-fit's base scale — worst case at frame 0,
    // since the push-in only pushes the cloud further down over time).
    // 550 sits in the clear gap between the top headline box (bottom ~340)
    // and the glow (~911), with generous margin both directions.
    captionY: 550,
    // 1920x2524 portrait — cover fit crops the sides slightly. Push-in only, no pan.
    motion: { scaleFrom: 1.0, scaleTo: 1.08, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
  },
];

const [SLIDE1] = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

// ---------------------------------------------------------------------------
// Slide 2 — Warren report. Re-cropped source is a short, wide document strip
// (2444x833) — the shared KenBurnsImage forces object-fit:cover, which for a
// landscape strip this short relative to a 1080x1920 canvas would scale up
// ~2.3x to fill the height, blowing the typewritten text up into an
// unreadable, mostly-cropped-off zoom. Uses the containWidth + blurred-border
// technique instead (same pattern as VicksburgMineQS.tsx's Thulstrup
// painting slide): the sharp image is shown in full at native aspect ratio,
// width-fit to the full 1080px canvas width (no crop, every line of text
// intact), centered vertically; a separate blurred/darkened full-bleed copy
// fills the letterbox gaps above/below instead of leaving hard black bars.
// Ken Burns is a slow push-in only (scale 1.0-1.03) — this is a reading
// slide, not a pan slide, so the text must stay fully in frame throughout.
// ---------------------------------------------------------------------------
const SLIDE2_DURATION_S = SLIDE2_AUDIO_S + PAD_S;
const SLIDE2_FRAMES = Math.round(SLIDE2_DURATION_S * FPS);
const SLIDE2_AUDIO_FRAMES = Math.round(SLIDE2_AUDIO_S * FPS);

function WarrenReportPanel({ isFirst }: { isFirst: boolean }) {
  const frame = useCurrentFrame();

  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // PROVISIONAL — set to 1.6x pending Brad's pick among 1.4x/1.6x/1.8x (see
  // stills). Base multiplier on top of pure width-fit; transformOrigin
  // anchored at 30% across / 16% down (near item 19's paragraph start) so
  // "19."/"20." and the key quote stay framed as scale increases, rather than
  // cropping evenly from both edges around the image's center.
  const SLIDE2_BASE_SCALE = 1.6;
  const scale = SLIDE2_BASE_SCALE * interpolate(frame, [0, SLIDE2_FRAMES], [1.0, 1.03], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <AbsoluteFill>
          <Img
            src={staticFile('slides/Trinity-Test/02-warren-report.jpg')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              transform: 'scale(1.15)',
              filter: 'blur(45px) brightness(0.6)',
            }}
          />
        </AbsoluteFill>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Img
            src={staticFile('slides/Trinity-Test/02-warren-report.jpg')}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: 'none',
              transform: `scale(${scale})`,
              transformOrigin: '30% 16%',
            }}
          />
        </AbsoluteFill>
      </AbsoluteFill>

      <Vignette />

      <ContextTag text="WARREN SAFETY REPORT — JULY 21, 1945" />

      <GoldLowerThird text="FIVE DAYS LATER, THEIR OWN SAFETY CHIEF SAID OTHERWISE" frame={frame} />

      <CaptionOverlay
        lines={['Five days later,', 'their own safety chief said otherwise.']}
        audioDurationFrames={SLIDE2_AUDIO_FRAMES}
        // Default captionY (1260) lands mid-document, overlapping the source
        // image's own printed signature block. The document + gold box eat
        // almost the entire lower frame at this scale, so there's no clean
        // gap below — placed near the top instead (below the ContextTag,
        // above the document), same precedent as slide 5's end-card caption.
        top={140}
      />

      <Audio src={staticFile('audio/Trinity-Test-vo-02.mp3')} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide 3 — McDonald Ranch. True landscape source (3605x2830, short side
// 2830px) sandwiched between two portrait slides, so it needs the landscape
// cover-fit pan formula rather than the shared KenBurnsImage (which is
// hardcoded to object-fit:cover and can't reveal more than a centered crop of
// a wider-than-portrait source — see VicksburgMineQS.tsx's craterTx / native
// fit for the same pattern applied elsewhere in this codebase).
//
// base_scale = 1920 / 2830 = 0.678445 (the height:100% cover-equivalent scale)
// scaled_width = 3605 * base_scale = 2445.795
// pan_room = scaled_width - 1080 = 1365.795
// 50px buffer held at each extreme -> pan runs [50, pan_room-50] = [50, 1315.795],
// i.e. ~92.7% of the room (slightly over the 85-90% guideline, but the 50px
// buffer was the more concrete constraint — flagged for Brad to adjust if he
// wants a tighter pan).
// center_offset = scaled_width/2 - 1080/2 = 682.898
// tx(x) = center_offset - x  ->  txFrom = 632.898, txTo = -632.897 (symmetric,
// since the buffer is symmetric)
// ---------------------------------------------------------------------------
const SLIDE3_DURATION_S = SLIDE3_AUDIO_S + PAD_S;
const SLIDE3_FRAMES = Math.round(SLIDE3_DURATION_S * FPS);
const SLIDE3_AUDIO_FRAMES = Math.round(SLIDE3_AUDIO_S * FPS);
const SLIDE3_TX_FROM = 632.898;
const SLIDE3_TX_TO = -632.897;

function McDonaldRanchPanel({ isFirst }: { isFirst: boolean }) {
  const frame = useCurrentFrame();

  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  const tx = interpolate(frame, [0, SLIDE3_FRAMES], [SLIDE3_TX_FROM, SLIDE3_TX_TO], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Img
            src={staticFile('slides/Trinity-Test/03-mcdonald-ranch.jpg')}
            style={{
              height: '100%',
              width: 'auto',
              maxWidth: 'none',
              transform: `translateX(${tx}px)`,
              transformOrigin: 'center center',
            }}
          />
        </AbsoluteFill>
      </AbsoluteFill>

      <Vignette />

      <ContextTag text="MCDONALD RANCH, TRINITY SITE, NM" />

      <GoldLowerThird text="FALLOUT HIT A STRIP OF LAND NINETY MILES LONG. FAMILIES LIVED THERE." frame={frame} />

      <CaptionOverlay
        lines={['Fallout hit a strip of land ninety miles long.', 'Families lived inside it.']}
        audioDurationFrames={SLIDE3_AUDIO_FRAMES}
        // Default captionY (1260) crowds this slide's 2-line headline box
        // (top ~1344) with almost no gap. Raised for breathing room.
        top={1150}
      />

      <Audio src={staticFile('audio/Trinity-Test-vo-03.mp3')} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide 4 — obelisk. Cover-fit (the shared KenBurnsImage's only mode) maps
// this 2300x2300 square source's full height into frame with almost no
// headroom above the tip (source geometry: tip at source_y~172 of 2300 maps
// to screen_y~144 — barely below the ContextTag at y~48-70), so there's no
// band of pure sky tall enough for a caption, and the obelisk's silhouette is
// centered under literally every horizontal caption position below the tip.
// Switched to the same containWidth + blurred-border technique as slides 2/3:
// showing the full square at width-fit (1080x1080, centered) opens up a
// genuine 420px blurred letterbox gap above (and below) the sharp obelisk,
// giving the caption clean neutral space instead of fighting the subject.
// ---------------------------------------------------------------------------
const SLIDE4_DURATION_S = SLIDE4_AUDIO_S + PAD_S;
const SLIDE4_FRAMES = Math.round(SLIDE4_DURATION_S * FPS);
const SLIDE4_AUDIO_FRAMES = Math.round(SLIDE4_AUDIO_S * FPS);

function ObeliskPanel({ isFirst }: { isFirst: boolean }) {
  const frame = useCurrentFrame();

  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  const scale = interpolate(frame, [0, SLIDE4_FRAMES], [1.0, 1.08], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <AbsoluteFill>
          <Img
            src={staticFile('slides/Trinity-Test/04-obelisk.jpg')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              transform: 'scale(1.15)',
              filter: 'blur(45px) brightness(0.6)',
            }}
          />
        </AbsoluteFill>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Img
            src={staticFile('slides/Trinity-Test/04-obelisk.jpg')}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: 'none',
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
            }}
          />
        </AbsoluteFill>
      </AbsoluteFill>

      <Vignette />

      <ContextTag text="TRINITY SITE, WHITE SANDS MISSILE RANGE" />

      <GoldLowerThird text="THAT REPORT STAYED CLASSIFIED FOR NEARLY EIGHTY YEARS" frame={frame} />

      <CaptionOverlay
        lines={['That report stayed classified for nearly eighty years.']}
        audioDurationFrames={SLIDE4_AUDIO_FRAMES}
        // Sits in the top blurred letterbox gap (sharp image starts at
        // y~377-420 depending on scale) — clear of the ContextTag (~48-70)
        // and clear of the obelisk itself throughout the whole push-in.
        top={150}
      />

      <Audio src={staticFile('audio/Trinity-Test-vo-04.mp3')} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide 5 — standalone black end card (no image; slide 4/obelisk stays clean
// as the payoff shot). Trigger word FRONT, subline pulled from CTA_CONFIG (not
// hardcoded). "Like. Save. Share." is silent, always-on text on its own line
// beneath the subline, same as OperationFrequentWindQS's end card.
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
        triggerWord="FRONT"
        subline={CTA_CONFIG.FRONT.subline}
        audio="audio/Trinity-Test-vo-05.mp3"
      />

      <CaptionOverlay
        lines={['Comment FRONT to get the free World War Two fact sheet.']}
        audioDurationFrames={SLIDE5_AUDIO_FRAMES}
        top={200}
      />

      {/* Silent-viewer text, no VO. Bottom padding 340px (not the 90px used in
          OperationFrequentWindQS's end card) keeps the text's bottom edge at
          y<=1580 — that file's value places it at y~1830, inside the unsafe
          band; not fixed there since only TrinityTestQS was in scope here. */}
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

export const totalDuration = SLIDE1.durationFrames + SLIDE2_FRAMES + SLIDE3_FRAMES + SLIDE4_FRAMES + SLIDE5_FRAMES;
export { FPS };

export default function TrinityTestQS() {
  let offset = 0;

  const slide1From = offset;
  offset += SLIDE1.durationFrames;
  const slide2From = offset;
  offset += SLIDE2_FRAMES;
  const slide3From = offset;
  offset += SLIDE3_FRAMES;
  const slide4From = offset;
  offset += SLIDE4_FRAMES;
  const slide5From = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/patton-blood-and-guts-music.mp3')} volume={0.15} loop />

      <Sequence from={slide1From} durationInFrames={SLIDE1.durationFrames} layout="none">
        <SlidePanel slide={SLIDE1} isFirst />
      </Sequence>

      <Sequence from={slide2From} durationInFrames={SLIDE2_FRAMES} layout="none">
        <WarrenReportPanel isFirst={false} />
      </Sequence>

      <Sequence from={slide3From} durationInFrames={SLIDE3_FRAMES} layout="none">
        <McDonaldRanchPanel isFirst={false} />
      </Sequence>

      <Sequence from={slide4From} durationInFrames={SLIDE4_FRAMES} layout="none">
        <ObeliskPanel isFirst={false} />
      </Sequence>

      <Sequence from={slide5From} durationInFrames={SLIDE5_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
