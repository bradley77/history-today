import { AbsoluteFill, Audio, Img, Sequence, Easing, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  ContextTag,
  GoldLowerThird,
  CaptionOverlay,
  Vignette,
  EndCardCTA,
  GOLD,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';
import { CTA_CONFIG } from '../shared/QuickStrikeConfig';

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified —
// see scripts/generateVoiceover-guadalcanal.py). RAW audio duration only —
// PAD_S is added separately at each usage site below, so these must NOT be
// pre-padded. Slide 3 keeps its Savo Island phoneme-splice pronunciation fix.
// Slides 1 and 4 no longer say "Guadalcanal" at all — phoneme injection got
// the sound itself right (confirmed against Wikipedia's IPA) but couldn't
// fix a kokoro_onnx splicing/prosody artifact (it hard-splits synthesis on
// every sentence-ending punctuation mark, independently silence-trims each
// piece, and "Guadalcanal" kept landing right at one of those seams in both
// slides) — so the word was removed from narration at the script level
// instead (see generateVoiceover-guadalcanal.py) and is now shown on screen
// via slide 1's ContextTag below. These are the CURRENT files on disk.
const SLIDE1_AUDIO_S = 9.508571;
const SLIDE2_AUDIO_S = 6.974694;
const SLIDE3_AUDIO_S = 8.124082;
const SLIDE4_AUDIO_S = 9.456327;
const SLIDE5_AUDIO_S = 3.683265; // end card VO

// ---------------------------------------------------------------------------
// Slides 1, 3, 4 — real photos, all wider than the 1080x1920 portrait canvas
// by a large margin (3840x3550, 3840x2773, 5540x4260). A plain cover-fit
// would crop straight to the vertical center strip and throw most of the
// frame away, so these use the height-driven pan technique ported from
// BattleOfTheBulgeQS's GermanSoldierPanel / TrinityTestQS's McDonaldRanch
// panel (QuickStrikeShared.tsx is locked/consume-only — its own Pan-Fill
// System computes margin/speed-cap automatically and doesn't accept a
// hand-picked pan distance, so these three slides render via this local
// component instead of SlidePanel's sourceWidth/sourceHeight path).
//
// Per-slide math (img height set to `${zoom*100}%` of the 1920px-tall
// container, width:auto so the browser preserves the source's real aspect
// ratio — this reproduces base_scale * zoom without needing the raw pixel
// count hardcoded anywhere):
//
//   Slide 1 (01-landing.jpg, 3840x3550):
//     base_scale = 1920/3550 = 0.541, zoom = 1.08 -> effective_scale 0.5843
//     scaled_width = 3840 * 0.5843 = 2244px, pan_room = 2244-1080 = 1164px
//     pan distance 847px leaves >=158px clear on each side (>= the 75px floor)
//   Slide 3 (03-jungle-march.jpg, 3840x2773):
//     base_scale = 1920/2773 = 0.692, zoom = 1.08 -> effective_scale 0.7474
//     scaled_width = 3840 * 0.7474 = 2870px, pan_room = 2870-1080 = 1790px
//     pan distance 1374px leaves >=208px clear on each side (>= the 102px floor)
//   Slide 4 (04-henderson-field.jpg, 5540x4260):
//     base_scale = 1920/4260 = 0.451, zoom = 1.08 -> effective_scale 0.4871
//     scaled_width = 5540 * 0.4871 = 2699px, pan_room = 2699-1080 = 1619px
//     pan distance 1275px leaves >=172px clear on each side (>= the 71px floor)
//
// In every case the real image is wider than the brief assumed, so the
// actual edge clearance comes out MORE generous than the specified buffer,
// never less — safe in both directions. Direction: 'ltr' pan convention used
// elsewhere in this codebase (positive tx shows the source's LEFT content,
// animating toward negative tx reveals its RIGHT content) — no direction was
// specified for these three slides, so all default to that same sweep.
// ---------------------------------------------------------------------------

// PannedImageLayer supplies ONLY the pan/zoom transform on the image — no
// captions, no headline, no audio, no vignette. Isolated on purpose: the
// first draft of this file put the hand-picked pan transform in the same
// component that ALSO mounted CaptionOverlay/GoldLowerThird, and rebuilding
// that component's return value from scratch (rather than composing on top
// of it) silently dropped both of them. Keeping the pan transform as its own
// leaf component makes that mistake structurally harder to repeat.
function PannedImageLayer({
  image,
  zoomHeightPercent,
  panDistance,
  durationFrames,
}: {
  image: string;
  zoomHeightPercent: number;
  panDistance: number;
  durationFrames: number;
}) {
  const frame = useCurrentFrame();
  const half = panDistance / 2;
  const tx = interpolate(frame, [0, durationFrames], [half, -half], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Img
          src={staticFile(image)}
          style={{
            height: `${zoomHeightPercent}%`,
            width: 'auto',
            maxWidth: 'none',
            transform: `translateX(${tx}px)`,
            transformOrigin: 'center center',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// PanSlidePanel composes PannedImageLayer underneath the SAME layer stack
// SlidePanel (QuickStrikeShared.tsx) mounts for every other image slide —
// Vignette, ContextTag, GoldLowerThird (beat headline, gold rule/box/rule),
// then CaptionOverlay (phrase-synced, ceiling-aware of the headline box via
// its own overlayText prop) — in the same order, with overlayText passed to
// BOTH so CaptionOverlay sits directly above GoldLowerThird's box exactly
// like every other composition on this shared engine (DoolittleRaidQS's
// VideoSlidePanel, TrumanMillionVerdict's BeatOverlay). Only the image layer
// itself is custom; the text/caption stack is untouched shared behavior.
function PanSlidePanel({
  image,
  zoomHeightPercent,
  panDistance,
  contextTag,
  overlayText,
  captionLines,
  audio,
  durationFrames,
  audioDurationFrames,
  isFirst,
}: {
  image: string;
  zoomHeightPercent: number;
  panDistance: number;
  contextTag?: string;
  overlayText?: string;
  captionLines: string[];
  audio: string;
  durationFrames: number;
  audioDurationFrames: number;
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();

  // Cold open on slide 1 (full brightness frame 0), 4-frame hard cut on every
  // slide after that. No fade-out anywhere — hard cut ending.
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <PannedImageLayer
        image={image}
        zoomHeightPercent={zoomHeightPercent}
        panDistance={panDistance}
        durationFrames={durationFrames}
      />

      <Vignette />

      {contextTag && <ContextTag text={contextTag} position="top-left" />}

      {overlayText && <GoldLowerThird text={overlayText} frame={frame} />}

      <CaptionOverlay
        lines={captionLines}
        audioDurationFrames={audioDurationFrames}
        overlayText={overlayText}
      />

      {/* Per-slide voiceover — fires at this slide's own local frame 0 */}
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide config
// ---------------------------------------------------------------------------

type PanSlide = {
  id: string;
  kind: 'pan';
  image: string;
  audio: string;
  durationInSeconds: number;
  audioDurationSeconds: number;
  contextTag?: string;
  /** Bold all-caps beat headline, rendered via GoldLowerThird. */
  overlayText: string;
  /** Verbatim VO split into 2-4 word phrases at natural boundaries —
   * CaptionOverlay's own word-count-proportional cue timing swaps between
   * them across audioDurationFrames, no separate timing math needed (same
   * convention as TrumanMillionVerdict's captionPhrases). */
  captionLines: string[];
  zoomHeightPercent: number;
  panDistance: number;
};

type StaticSlide = {
  id: string;
  kind: 'static';
  slide: SharedSlideConfig;
};

const SLIDES: (PanSlide | StaticSlide)[] = [
  {
    id: 'slide1',
    kind: 'pan',
    image: 'slides/Guadalcanal/01-landing.jpg',
    audio: 'audio/guadalcanal/guadalcanal-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    // "Guadalcanal" no longer appears in narration/captions (see the
    // SLIDE1_AUDIO_S comment above) — shown here instead, since this is the
    // only place left in the whole video where the location name is visible.
    // ContextTag (QuickStrikeShared.tsx, locked/consume-only) renders a
    // single line with no whiteSpace:pre-line, so it has no true multi-line
    // mode; no other composition in this codebase has needed one either —
    // the closest precedent (TrinityTestQS) combines a location and a date
    // in one line with an em-dash ("WARREN SAFETY REPORT — JULY 21, 1945").
    // Using a bullet instead of an em-dash here per spec.
    contextTag: 'GUADALCANAL • AUGUST 7, 1942',
    overlayText: 'ALMOST NOBODY SHOT BACK',
    captionLines: [
      'Thousands of Marines',
      'stormed the island.',
      'Almost nobody',
      'shot back.',
      'Most of the people',
      'around the airfield',
      'were construction workers,',
      "and they'd fled",
      'into the jungle.',
    ],
    zoomHeightPercent: 108,
    panDistance: 847,
  },
  {
    id: 'slide2',
    kind: 'static',
    slide: {
      id: 'slide2',
      image: 'slides/Guadalcanal/02-flag-raising.jpg',
      audio: 'audio/guadalcanal/guadalcanal-vo-02.mp3',
      durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
      audioDurationSeconds: SLIDE2_AUDIO_S,
      // Beat headline was missing from the first draft (SlidePanel supports
      // it, but no overlayText was ever passed) — added here so all four
      // content slides carry the same GoldLowerThird beat-headline treatment.
      overlayText: 'CAPTURED IN A DAY',
      captionLines: [
        'Within a day,',
        "they'd captured the",
        'nearly finished airfield',
        'the Japanese had',
        'been building.',
        'It would soon',
        'become Henderson Field.',
      ],
      // 570x739 — low-res source (aspect 0.771, below PAN_FILL_ASPECT_THRESHOLD
      // 1.2), so Pan-Fill auto-resolves 'static': no lateral pan, just the
      // shared engine's default subtle 1.0->1.05 scale-only drift. Deliberately
      // NOT forced into a pan or a larger push-in — upscaling this source
      // further would show compression artifacts.
      sourceWidth: 570,
      sourceHeight: 739,
    },
  },
  {
    id: 'slide3',
    kind: 'pan',
    image: 'slides/Guadalcanal/03-jungle-march.jpg',
    audio: 'audio/guadalcanal/guadalcanal-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    overlayText: 'LEFT WITH A FRACTION OF THEIR SUPPLIES',
    captionLines: [
      'Then, after the disaster',
      'at Savo Island,',
      'the Navy pulled',
      'its transports out,',
      'leaving the Marines',
      'with only a fraction',
      'of their supplies.',
    ],
    zoomHeightPercent: 108,
    panDistance: 1374,
  },
  {
    id: 'slide4',
    kind: 'pan',
    image: 'slides/Guadalcanal/04-henderson-field.jpg',
    audio: 'audio/guadalcanal/guadalcanal-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    overlayText: 'THE FIELD THAT NEVER FELL',
    captionLines: [
      'Jungle disease put',
      'more Marines out',
      'of action than',
      'enemy fire.',
      'Henderson Field',
      'never fell,',
      'and this campaign marked',
      'the end of',
      "Japan's southward advance.",
    ],
    zoomHeightPercent: 108,
    panDistance: 1275,
  },
];

const slidesWithFrames = SLIDES.map((s) => {
  const durationInSeconds = s.kind === 'pan' ? s.durationInSeconds : s.slide.durationInSeconds;
  const audioDurationSeconds = s.kind === 'pan' ? s.audioDurationSeconds : s.slide.audioDurationSeconds;
  return {
    ...s,
    durationFrames: Math.round(durationInSeconds * FPS),
    audioDurationFrames: Math.round(audioDurationSeconds * FPS),
  };
});

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card — standalone black slide, trigger word FRONT, subline from
// CTA_CONFIG.FRONT (standard PDF-offer subline, matching every other recent
// FRONT end card — DoolittleRaidQS, DayOfInfamyDraftQS — confirmed for this
// slide since Guadalcanal is a standard FRONT slot, not an off-night piece).
// "Like. Save. Share." is silent, always-on text beneath the subline, same
// pattern as every other recent Quick Strike end card.
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
        audio="audio/guadalcanal/guadalcanal-vo-05.mp3"
      />

      <CaptionOverlay
        lines={["Comment FRONT and I'll send you the free WWII document."]}
        audioDurationFrames={SLIDE5_AUDIO_FRAMES}
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

export const totalDuration = slidesDuration + SLIDE5_FRAMES;
export { FPS };

export default function GuadalcanalQS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });
  const slide5From = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Standing WWII Quick Strike music bed (per project convention). */}
      <Audio src={staticFile('audio/TokyoFirebombing-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          {slide.kind === 'pan' ? (
            <PanSlidePanel
              image={slide.image}
              zoomHeightPercent={slide.zoomHeightPercent}
              panDistance={slide.panDistance}
              contextTag={slide.contextTag}
              overlayText={slide.overlayText}
              captionLines={slide.captionLines}
              audio={slide.audio}
              durationFrames={slide.durationFrames}
              audioDurationFrames={slide.audioDurationFrames}
              isFirst={i === 0}
            />
          ) : (
            <SlidePanel
              slide={{ ...slide.slide, durationFrames: slide.durationFrames, audioDurationFrames: slide.audioDurationFrames }}
              isFirst={i === 0}
            />
          )}
        </Sequence>
      ))}

      <Sequence from={slide5From} durationInFrames={SLIDE5_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
