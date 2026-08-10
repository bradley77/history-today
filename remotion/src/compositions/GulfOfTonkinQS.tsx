import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  KenBurnsImage,
  Vignette,
  useGoldOverlay,
  GoldLowerThird,
  ContextTag,
  CaptionOverlay,
  SlidePanel,
  withFrames,
  GOLD,
  CANVAS_HEIGHT,
  SAFE_ZONE_BOTTOM_Y,
  type SlideConfig,
} from '../shared/QuickStrikeShared';

const PAD_S = 0.4;
const FONT_STACK = "'Oswald', Impact, 'Arial Black', sans-serif";

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified —
// see scripts/generateVoiceover-gulf-of-tonkin.py). Slide 4's audio reflects
// the "found intelligence supporting" respell (regenerated in place, same
// file — "behind" -> "supporting" avoids implying the intelligence caused
// the attack).
const SLIDE1_AUDIO_S = 5.355;
const SLIDE2_AUDIO_S = 6.336;
const SLIDE3_AUDIO_S = 5.355;
const SLIDE4_AUDIO_S = 8.363;
const CTA_AUDIO_S = 3.776;

const SLIDE1_DURATION_S = SLIDE1_AUDIO_S + PAD_S;
const SLIDE2_DURATION_S = SLIDE2_AUDIO_S + PAD_S;
const SLIDE3_DURATION_S = SLIDE3_AUDIO_S + PAD_S;
const SLIDE4_DURATION_S = SLIDE4_AUDIO_S + PAD_S;
const CTA_DURATION_S = CTA_AUDIO_S + PAD_S;

const SLIDE1_FRAMES = Math.round(SLIDE1_DURATION_S * FPS);
const SLIDE1_AUDIO_FRAMES = Math.round(SLIDE1_AUDIO_S * FPS);
const SLIDE3_FRAMES = Math.round(SLIDE3_DURATION_S * FPS);
const SLIDE3_AUDIO_FRAMES = Math.round(SLIDE3_AUDIO_S * FPS);
const SLIDE4_FRAMES = Math.round(SLIDE4_DURATION_S * FPS);
const CTA_FRAMES = Math.round(CTA_DURATION_S * FPS);
const CTA_AUDIO_FRAMES = Math.round(CTA_AUDIO_S * FPS);

// Mirrors QuickStrikeShared's GoldLowerThird internal (non-exported)
// BOTTOM_SAFE_BUFFER=20. QuickStrikeShared.tsx is locked/consume-only for
// BEHAVIOR changes to existing callers, so this literal is duplicated here
// rather than imported — same rationale as every other QS file's local
// stand-in components. (The kicker/boxOpacity/ceiling-math extensions this
// composition needed WERE made directly in QuickStrikeShared.tsx, as
// backward-compatible opt-in additions — see that file's KICKER_* constants
// and GoldLowerThird/CaptionOverlay's new kicker props.)
const BOTTOM_SAFE_BUFFER = 20;

// ---------------------------------------------------------------------------
// Slide 1 — 01-uss-maddox.jpg (3027x1920). Blur-border-fill, not Pan-Fill:
// this source is exactly 1920px tall, so Pan-Fill's baseScale
// (CANVAS_HEIGHT/sourceHeight) is already 1.0 — there is no "less zoomed"
// pan setting available, and a 1080px-wide crop window only ever reveals
// about a third of the image's 3027px width at once, which is why the
// original pan render read as "zoomed in on the radar mast": whatever the
// pan happened to be centered on at that instant was most of what was on
// screen. The ship itself spans nearly the full width of the source photo,
// so showing its complete silhouette requires fitting by WIDTH instead of
// height. Ported from the video slide blur-border-fill pattern (IaDrangValleyQS/
// TetCitadelQS's BlurBorderFillVideo — same fix for the same "source wider
// than the canvas can show uncropped" problem, just for a still Img instead
// of OffthreadVideo): a blurred/darkened cover-fill copy fills the canvas,
// and a second, uncropped copy is centered over it at width:100%/height:auto
// so the complete bow-to-stern silhouette is always visible. A subtle scale
// drift on the foreground layer keeps this from reading as a frozen frame
// (PAN_FILL_STATIC_SCALE_TO's rationale in QuickStrikeShared applies here
// too, even though this slide doesn't go through Pan-Fill itself).
//
// This is also the composition's cold open (always isFirst — this component
// is only ever used for slide 1), so opacity is fixed at 1, no hard-cut
// fade-in.
// ---------------------------------------------------------------------------
const SHIP_SCALE_FROM = 1.0;
const SHIP_SCALE_TO = 1.04;

function Slide1Ship() {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, SLIDE1_FRAMES], [SHIP_SCALE_FROM, SHIP_SCALE_TO], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const headline = 'THE ATTACK THAT HELPED GIVE JOHNSON WAR POWERS';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile('slides/GulfOfTonkin/01-uss-maddox.jpg')}
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
        <Img
          src={staticFile('slides/GulfOfTonkin/01-uss-maddox.jpg')}
          style={{
            width: '100%',
            height: 'auto',
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      </AbsoluteFill>

      <Vignette />

      {/* Date folded into the tag now that the kicker line is gone — no
          separate on-screen date element on this slide anymore. */}
      <ContextTag text="USS MADDOX — GULF OF TONKIN — AUGUST 4, 1964" position="top-left" />

      {/* Box lightened/shrunk (0.60->0.45 opacity, 24px->16px vertical
          padding) — even though it now sits over the blurred letterbox band
          rather than the sharp ship art (see above), a lighter box still
          reads as less of an obstruction, per spec. Single-tier headline
          again (no kicker prop) — the date lives in the ContextTag above. */}
      <GoldLowerThird text={headline} frame={frame} boxOpacity={0.45} boxPadding="16px 40px" />

      <CaptionOverlay
        lines={['The Navy reported a second attack in the Gulf of Tonkin,', 'giving Johnson broad war powers.']}
        audioDurationFrames={SLIDE1_AUDIO_FRAMES}
        overlayText={headline}
      />

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile('audio/GulfOfTonkin/vo-01.mp3')} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide 3 — Pan-Fill landscape image (getPanFillTransform, via KenBurnsImage's
// sourceWidth/sourceHeight) + single-tier headline/stat (no kicker line — the
// "3 DAYS LATER" kicker was removed; the Senate/House vote is still spoken in
// the VO, just no longer echoed on screen) + a phrase-chunked verbatim-VO
// caption + context tag + per-slide audio. Name is a holdover from when this
// component rendered a kicker for both callers that used it — kept as-is
// since it's an internal identifier, not user-facing; flag if you'd rather
// it be renamed now that neither remaining use has a kicker.
// ---------------------------------------------------------------------------
function KickerPanSlide({
  image,
  sourceWidth,
  sourceHeight,
  headline,
  headlineFontSize,
  contextTag,
  captionLines,
  audio,
  durationFrames,
  audioDurationFrames,
  isFirst,
}: {
  image: string;
  sourceWidth: number;
  sourceHeight: number;
  headline: string;
  headlineFontSize?: number;
  contextTag: string;
  captionLines: string[];
  audio: string;
  durationFrames: number;
  audioDurationFrames: number;
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <KenBurnsImage
        image={image}
        frame={frame}
        durationFrames={durationFrames}
        sourceWidth={sourceWidth}
        sourceHeight={sourceHeight}
      />
      <Vignette />

      <ContextTag text={contextTag} position="top-left" />

      <GoldLowerThird text={headline} frame={frame} fontSize={headlineFontSize} />

      <CaptionOverlay
        lines={captionLines}
        audioDurationFrames={audioDurationFrames}
        overlayText={headline}
        headlineFontSize={headlineFontSize}
      />

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide 2 — 02-stockdale-portrait.jpg, 1080x1920 native (exact canvas match,
// no Pan-Fill room). Uses the SHARED SlidePanel/GoldLowerThird/CaptionOverlay
// as-is (no bespoke component needed here), same pattern as Operation
// Frequent Wind's slide 2. Minimal push-in only, no pan. `label` renders the
// standard top-left ContextTag via SlidePanel's existing (pre-existing,
// unchanged) label/labelPosition fields.
//
// Rank note: tag reads "REAR ADM." — identifying him as he actually appears
// in this photo (a later-career formal portrait showing the Medal of Honor,
// awarded 1976), not his 1964 rank of Commander at the time of the incident.
// Accurate to the image rather than the event date, so the tag doesn't imply
// the portrait is contemporaneous to 1964.
// ---------------------------------------------------------------------------
const slide2Config: SlideConfig = {
  id: 'slide2',
  image: 'slides/GulfOfTonkin/02-stockdale-portrait.jpg',
  audio: 'audio/GulfOfTonkin/vo-02.mp3',
  durationInSeconds: SLIDE2_DURATION_S,
  audioDurationSeconds: SLIDE2_AUDIO_S,
  overlayText: 'NO BOATS. NO WAKES. NO CONFIRMED ATTACK.',
  captionLines: [
    'Navy pilot James Stockdale flew over the reported battle that night.',
    'He recalled seeing no boats or wakes.',
  ],
  motion: { scaleFrom: 1.0, scaleTo: 1.03, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
  label: 'REAR ADM. JAMES STOCKDALE, USN',
};
const slide2 = withFrames(slide2Config);

// ---------------------------------------------------------------------------
// Slide 4 — stat-card overlay: big year, gold rule, tracked-caps source
// label, gold rule, three-line finding statement. Rendered as a Remotion
// overlay (not baked into the art) so it gets the standard gold-rule reveal,
// per spec. Bottom-anchored the same way GoldLowerThird is (padding derived
// from SAFE_ZONE_BOTTOM_Y), so even this slide's tall stacked block never
// crosses the y<=1580 safe line, regardless of this slide's longer duration.
// No ContextTag on this slide — it's a stat card, not an identifiable
// place/person, matching the no-tag convention already used on end cards.
//
// Background asset: 04-p4-boat-stat-bg.jpg, the plain darkened background
// with no text baked in — StatOverlay below is the only thing rendering the
// "2005 / NSA HISTORICAL REVIEW / finding" text on this slide.
// ---------------------------------------------------------------------------
function StatOverlay({ frame }: { frame: number }) {
  const { ruleWidth, textOpacity } = useGoldOverlay(frame, 8);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: `0 64px ${CANVAS_HEIGHT - SAFE_ZONE_BOTTOM_Y + BOTTOM_SAFE_BUFFER}px`,
        pointerEvents: 'none',
      }}
    >
      <div style={{ width: '100%', textAlign: 'center', opacity: textOpacity }}>
        <div
          style={{
            fontFamily: FONT_STACK,
            fontWeight: 700,
            fontSize: 108,
            color: '#F5F0E8',
            lineHeight: 1,
            textShadow: '0 2px 16px rgba(0,0,0,0.95)',
          }}
        >
          2005
        </div>

        <div style={{ height: 3, width: `${ruleWidth}%`, backgroundColor: GOLD, margin: '20px auto' }} />

        <div
          style={{
            fontFamily: FONT_STACK,
            fontWeight: 600,
            fontSize: 24,
            color: GOLD,
            letterSpacing: '0.14em',
            marginBottom: 20,
          }}
        >
          NSA HISTORICAL REVIEW
        </div>

        <div style={{ height: 3, width: `${ruleWidth}%`, backgroundColor: GOLD, margin: '0 auto 24px' }} />

        <div
          style={{
            fontFamily: FONT_STACK,
            fontWeight: 700,
            fontSize: 40,
            lineHeight: 1.3,
            color: '#F5F0E8',
            textShadow: '0 2px 14px rgba(0,0,0,0.9)',
          }}
        >
          <div>Intelligence supporting the</div>
          <div>second attack had been</div>
          <div>selectively presented.</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function StatCardSlide({ isFirst }: { isFirst: boolean }) {
  const frame = useCurrentFrame();
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      {/* Stat card, not an action slide — static/minimal scale only, no pan. */}
      <KenBurnsImage
        image="slides/GulfOfTonkin/04-p4-boat-stat-bg.jpg"
        frame={frame}
        durationFrames={SLIDE4_FRAMES}
        motion={{ scaleFrom: 1.0, scaleTo: 1.03, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' }}
      />
      <Vignette />

      <StatOverlay frame={frame} />

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile('audio/GulfOfTonkin/vo-04.mp3')} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// End card. Bespoke (not the shared EndCardCTA + independently-positioned
// CaptionOverlay + Like/Save/Share layers used elsewhere) — that established
// pattern centers EndCardCTA's own content and places the caption at a fixed
// top=200 and Like/Save/Share at a fixed bottom padding, three layers with no
// awareness of each other's real height, which reads as three disconnected
// clusters with large gaps between them rather than one composed card
// (confirmed against a real render, not just Studio preview). This renders
// all of it — rule / Comment / RECON / subline / rule / CTA caption /
// Like Save Share — as ONE flex column, vertically centered as a group, with
// deliberate small gaps between sections. Visual values (rule timing, font
// sizes/colors for Comment/RECON/subline) are copied from EndCardCTA's own
// styling for consistency with every other RECON end card; only the layout
// (one column vs. three independent layers) differs.
//
// Subline is a video-specific literal ("GET THE FREE VIETNAM DOCUMENT")
// rather than the shared CTA_CONFIG.RECON entry ("COMMENT RECON TO GET THE
// FREE VIETNAM FACT SHEET") — the wording differs (document vs. fact sheet)
// and would already read as redundant stacked under "Comment RECON" above
// it. Same escape hatch SonTayQS used for its own CTA_SUBLINE.
//
// VO is limited to the comment-trigger caption line only (Max Alignment
// rule); the trigger word/subline and "Like. Save. Share." are silent,
// always-on text. The CTA line is short enough (11 words, ~3.8s) that it
// isn't phrase-chunked like the content slides — a single cue for the whole
// line matches every other RECON end card's caption treatment.
// ---------------------------------------------------------------------------
const CTA_SUBLINE = 'GET THE FREE VIETNAM DOCUMENT';
const CTA_CAPTION = "Comment RECON and I'll send you the free Vietnam document.";

function EndCard() {
  const frame = useCurrentFrame();
  const panelOpacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ruleWidth = interpolate(frame, [8, 33], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // Fades in just after the CTA block above it finishes revealing, fades out
  // just before the audio ends — never lingers into the trailing 0.4s pad.
  // Mirrors CaptionOverlay's own fade timing (10-in / 6-before-end-out).
  const captionOpacity = interpolate(
    frame,
    [14, 24, Math.max(25, CTA_AUDIO_FRAMES - 6), CTA_AUDIO_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const likeSaveShareOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: '#000', opacity: panelOpacity, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '80%', maxWidth: 900, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ height: 3, background: GOLD, width: `${ruleWidth}%`, marginBottom: 28 }} />

        <div
          style={{
            opacity: textOpacity,
            color: GOLD,
            fontFamily: 'Georgia, serif',
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          Comment
        </div>

        <div
          style={{
            opacity: textOpacity,
            color: '#fff',
            fontFamily: 'Georgia, serif',
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          RECON
        </div>

        <div
          style={{
            opacity: textOpacity,
            color: '#E8E2D4',
            fontFamily: FONT_STACK,
            fontSize: 24,
            letterSpacing: '0.06em',
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          {CTA_SUBLINE}
        </div>

        <div style={{ height: 3, background: GOLD, width: `${ruleWidth}%`, marginBottom: 28 }} />

        <div
          style={{
            opacity: captionOpacity,
            maxWidth: 900,
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: 38,
            fontWeight: 700,
            lineHeight: 1.3,
            fontFamily: FONT_STACK,
            textAlign: 'center',
            padding: '10px 20px',
            borderRadius: 6,
            marginBottom: 28,
          }}
        >
          {CTA_CAPTION}
        </div>

        <div
          style={{
            opacity: likeSaveShareOpacity,
            color: GOLD,
            fontFamily: FONT_STACK,
            fontSize: 26,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Like. Save. Share.
        </div>
      </div>

      <Audio src={staticFile('audio/GulfOfTonkin/vo-05-cta.mp3')} />
    </AbsoluteFill>
  );
}

export const totalDuration = SLIDE1_FRAMES + slide2.durationFrames + SLIDE3_FRAMES + SLIDE4_FRAMES + CTA_FRAMES;
export { FPS };

export default function GulfOfTonkinQS() {
  let offset = 0;

  const slide1From = offset;
  offset += SLIDE1_FRAMES;

  const slide2From = offset;
  offset += slide2.durationFrames;

  const slide3From = offset;
  offset += SLIDE3_FRAMES;

  const slide4From = offset;
  offset += SLIDE4_FRAMES;

  const ctaFrom = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/CIA-Gun-music.mp3')} volume={0.15} loop />

      {/* Slide 1 — 01-uss-maddox.jpg, blur-border-fill (full ship visible).
          Cold open. Date lives in the ContextTag, not a kicker line. */}
      <Sequence from={slide1From} durationInFrames={SLIDE1_FRAMES} layout="none">
        <Slide1Ship />
      </Sequence>

      {/* Slide 2 — 02-stockdale-portrait.jpg, portrait 1080x1920, static cover-fit. */}
      <Sequence from={slide2From} durationInFrames={slide2.durationFrames} layout="none">
        <SlidePanel slide={slide2} isFirst={false} />
      </Sequence>

      {/* Slide 3 — 03-capitol-building.jpg, landscape 4479x1920, Pan-Fill
          horizontal pan. Oversized "88–2" stat reveal, no kicker line —
          "three days later" is still spoken in the VO, just not echoed
          on screen. Context tag stays as-is (no date needed there). */}
      <Sequence from={slide3From} durationInFrames={SLIDE3_FRAMES} layout="none">
        <KickerPanSlide
          image="slides/GulfOfTonkin/03-capitol-building.jpg"
          sourceWidth={4479}
          sourceHeight={1920}
          headline="88–2"
          headlineFontSize={104}
          contextTag="U.S. SENATE — WASHINGTON, D.C."
          captionLines={['Three days later, the Senate voted eighty-eight to two.', 'The House already passed it unanimously.']}
          audio="audio/GulfOfTonkin/vo-03.mp3"
          durationFrames={SLIDE3_FRAMES}
          audioDurationFrames={SLIDE3_AUDIO_FRAMES}
          isFirst={false}
        />
      </Sequence>

      {/* Slide 4 — 04-p4-boat-stat-bg.jpg background + StatOverlay (2005 /
          NSA HISTORICAL REVIEW / finding statement), static/minimal scale. */}
      <Sequence from={slide4From} durationInFrames={SLIDE4_FRAMES} layout="none">
        <StatCardSlide isFirst={false} />
      </Sequence>

      {/* End card — trigger word RECON, CTA VO only, silent Like/Save/Share,
          all one composed card (see EndCard's own comment above). */}
      <Sequence from={ctaFrom} durationInFrames={CTA_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
