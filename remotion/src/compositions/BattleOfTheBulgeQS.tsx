import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { useMemo } from 'react';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  KenBurnsImage,
  Vignette,
  ContextTag,
  CaptionOverlay,
  EndCardCTA,
  GOLD,
  useGoldOverlay,
  type Motion,
} from '../shared/QuickStrikeShared';

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam, speed 0.95, en-us) via
// scripts/generateVoiceover-Battle-of-the-Bulge.py. Single source of truth
// for every slide's durationInSeconds below.
const SLIDE1_AUDIO_S = 6.080;
const SLIDE2_AUDIO_S = 6.763;
const SLIDE3_AUDIO_S = 6.421;
const SLIDE4_AUDIO_S = 2.880;

// ---------------------------------------------------------------------------
// SafeZoneOverlayBlock — the gold-rule headline + caption line, merged into
// ONE cohesive container instead of the shared engine's two independently-
// positioned pieces (GoldLowerThird + CaptionOverlay). A prior render of
// this composition put that combined pair flush against the bottom of the
// frame with no margin, colliding with Facebook Reels' UI (username, audio
// attribution, caption/"See more" text lives in the bottom ~220px; the
// like/comment/share/save icon column eats the right ~140px).
//
// Fix: a single wrapping div (caption / rule / bold title / rule, same
// internal spacing as the original two-piece version — reordered so the
// caption reads first, per Brad's follow-up) anchored via one outer padding
// box — padding-bottom 220 keeps the whole block's bottom edge at y=1700
// (not y=1920), padding-right 140 caps its width so nothing crosses x=940,
// padding-left 48 matches the original left margin.
//
// Confirmed via rendered stills (prior order): caption text landed at
// native y~1662 (38px clear of y=1700), rule lines capped at x~927-930
// (10-13px clear of x=940 — thin margin; bump padding-right to 160 if a
// future slide's title wraps wider and pushes the rule closer).
// ---------------------------------------------------------------------------
function SafeZoneOverlayBlock({
  overlayText,
  captionLines,
  frame,
  audioDurationFrames,
  delayFrames = 8,
}: {
  overlayText: string;
  captionLines: string[];
  frame: number;
  audioDurationFrames: number;
  delayFrames?: number;
}) {
  const { ruleWidth, textOpacity } = useGoldOverlay(frame, delayFrames);

  const lineRanges = useMemo(() => {
    const wordCounts = captionLines.map((line) => line.split(/\s+/).filter(Boolean).length);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);
    let wordsSoFar = 0;
    let startFrame = 0;
    return captionLines.map((line, i) => {
      wordsSoFar += wordCounts[i];
      const endFrame = Math.round((wordsSoFar / totalWords) * audioDurationFrames);
      const range = { line, startFrame, endFrame };
      startFrame = endFrame;
      return range;
    });
  }, [captionLines, audioDurationFrames]);

  const activeCaption =
    lineRanges.find((r) => frame >= r.startFrame && frame < r.endFrame) ?? lineRanges[lineRanges.length - 1];

  const captionOpacity = interpolate(
    frame,
    [0, 10, Math.max(11, audioDurationFrames - 6), audioDurationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '0 140px 220px 48px',
        pointerEvents: 'none',
      }}
    >
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 16, opacity: captionOpacity, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: '#fff',
              fontSize: 38,
              fontWeight: 700,
              textAlign: 'center',
              padding: '10px 20px',
              borderRadius: 6,
            }}
          >
            {activeCaption.line}
          </div>
        </div>

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
        <div style={{ backgroundColor: 'rgba(0,0,0,0.60)', padding: '24px 40px', textAlign: 'center' }}>
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
              opacity: textOpacity,
            }}
          >
            {overlayText}
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
// PortraitSlidePanel — standard cover-fit Ken Burns slide (used for slides 1
// and 3), with the safe-zone overlay block above instead of GoldLowerThird +
// CaptionOverlay.
// ---------------------------------------------------------------------------
type PortraitSlide = {
  image: string;
  audio: string;
  durationInSeconds: number;
  audioDurationSeconds: number;
  overlayText: string;
  label: string;
  captionLines: string[];
  motion: Motion;
};

function withFrames(s: { durationInSeconds: number; audioDurationSeconds: number }) {
  return {
    durationFrames: Math.round(s.durationInSeconds * FPS),
    audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
  };
}

function PortraitSlidePanel({ slide, isFirst }: { slide: PortraitSlide; isFirst: boolean }) {
  const frame = useCurrentFrame();
  const { durationFrames, audioDurationFrames } = withFrames(slide);

  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <KenBurnsImage image={slide.image} frame={frame} durationFrames={durationFrames} motion={slide.motion} />
      <Vignette />

      <ContextTag text={slide.label} position="top-left" />

      <SafeZoneOverlayBlock
        overlayText={slide.overlayText}
        captionLines={slide.captionLines}
        frame={frame}
        audioDurationFrames={audioDurationFrames}
      />

      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

const SLIDE1: PortraitSlide = {
  image: 'slides/Battle-of-the_Bulge/01-quiet-ardennes-road.jpg',
  audio: 'audio/Battle-of-the-Bulge-vo-01.mp3',
  durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
  audioDurationSeconds: SLIDE1_AUDIO_S,
  overlayText: "THEY WEREN'T EXPECTING THIS",
  label: 'ARDENNES FOREST, WINTER 1944',
  captionLines: [
    'Everyone thinks Hitler caught the Allies off guard.',
    "He didn't have to.",
    "They weren't expecting a major attack.",
  ],
  // 1760x3129 portrait — subtle lateral drift across the tree line, scale
  // 1.0-1.06 (20px pan stays under the <=20px safe threshold for this scale
  // range, matching the existing formula used elsewhere).
  motion: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 20, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
};

const SLIDE3: PortraitSlide = {
  image: 'slides/Battle-of-the_Bulge/03-us-troops-withdraw.jpg',
  audio: 'audio/Battle-of-the-Bulge-vo-03.mp3',
  durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
  audioDurationSeconds: SLIDE3_AUDIO_S,
  overlayText: 'THE WARNINGS WERE DISMISSED.',
  label: 'FIRST ARMY SECTOR, ARDENNES',
  captionLines: [
    'Captured Germans hinted at an attack.',
    'Command dismissed the warnings.',
    'Days later, five divisions fell back.',
  ],
  // 1462x2599 portrait — standard push-in with a slight vertical drift,
  // matching the existing "standard portrait" formula used elsewhere.
  motion: { scaleFrom: 1.0, scaleTo: 1.07, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -15, easing: 'easeInOutCubic' },
};

const SLIDE1_FRAMES = withFrames(SLIDE1);
const SLIDE3_FRAMES = withFrames(SLIDE3);

// ---------------------------------------------------------------------------
// Slide 2 — German soldier. Source is 2340x2492 — much wider relative to the
// 1080x1920 portrait frame than slides 1/3, so the shared KenBurnsImage
// (hardcoded object-fit:cover) doesn't leave enough pan room. Uses the same
// height-driven technique as TrinityTestQS's McDonaldRanchPanel instead:
//
//   base_scale     = 1920 / 2492 = 0.7704   (cover-fit-equivalent height scale)
//   KB multiplier  = 1.08                    (needed since the 750px pan
//                                              exceeds the ~30px safe
//                                              threshold at base_scale alone)
//   effective_scale = 0.7704 * 1.08 = 0.8321
//   scaled_width   = 2340 * 0.8321 = 1946.9
//   pan_room       = 1946.9 - 1080 = 866.9
//   pan distance   = 750px, buffer ~58.5px held at each extreme
//
// The 1.08 multiplier is baked into the img's CSS height (108% instead of
// 100%) rather than a separate transform: scale(), so the translateX pan
// below can be expressed in raw on-screen pixels without compounding through
// a second scale factor.
//
// Sign convention (same as McDonaldRanchPanel): the image is centered by
// flex before any transform, so a POSITIVE translateX shifts the whole image
// right, sliding its LEFT edge toward center — i.e. positive tx shows the
// LEFT portion of the source (soldier's face). Panning toward NEGATIVE tx
// reveals the RIGHT portion (second soldier + equipment crate).
// ---------------------------------------------------------------------------
const SLIDE2_DURATION_S = SLIDE2_AUDIO_S + PAD_S;
const SLIDE2_FRAMES = Math.round(SLIDE2_DURATION_S * FPS);
const SLIDE2_AUDIO_FRAMES = Math.round(SLIDE2_AUDIO_S * FPS);
const SLIDE2_TX_FROM = 375;
const SLIDE2_TX_TO = -375;

function GermanSoldierPanel() {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const tx = interpolate(frame, [0, SLIDE2_FRAMES], [SLIDE2_TX_FROM, SLIDE2_TX_TO], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Img
            src={staticFile('slides/Battle-of-the_Bulge/02-german-soldier.jpg')}
            style={{
              height: '108%',
              width: 'auto',
              maxWidth: 'none',
              transform: `translateX(${tx}px)`,
              transformOrigin: 'center center',
            }}
          />
        </AbsoluteFill>
      </AbsoluteFill>

      <Vignette />

      <ContextTag text="THE EIFEL SECTOR, 1944" position="top-left" />

      <SafeZoneOverlayBlock
        overlayText="THE GERMANS WENT SILENT ON PURPOSE"
        captionLines={[
          'American codebreakers had read German radio for months.',
          'Then it went silent, replaced by phone and courier.',
        ]}
        frame={frame}
        audioDurationFrames={SLIDE2_AUDIO_FRAMES}
      />

      <Audio src={staticFile('audio/Battle-of-the-Bulge-vo-02.mp3')} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// End card — black card, trigger word FRONT. "Like. Save. Share." is silent,
// always-on text beneath the subline, same pattern as TrinityTestQS. Its own
// caption sits near the TOP of frame (top=200) — already clear of the
// bottom-220px Facebook UI band, so it's untouched by the safe-zone fix.
//
// VO/caption say "World War Two" spelled out — Kokoro reads the "WWII"
// acronym letter by letter instead of as words. The on-screen subline stays
// abbreviated ("WWII") since that's read visually, not spoken.
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
        subline="COMMENT FRONT FOR THE FREE 5-FACT WWII PDF"
        audio="audio/Battle-of-the-Bulge-vo-04.mp3"
      />

      <CaptionOverlay
        lines={['Comment FRONT for the free World War Two PDF.']}
        audioDurationFrames={SLIDE4_AUDIO_FRAMES}
        top={200}
      />

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

export const totalDuration = SLIDE1_FRAMES.durationFrames + SLIDE2_FRAMES + SLIDE3_FRAMES.durationFrames + SLIDE4_FRAMES;
export { FPS };

export default function BattleOfTheBulgeQS() {
  let offset = 0;

  const slide1From = offset;
  offset += SLIDE1_FRAMES.durationFrames;
  const slide2From = offset;
  offset += SLIDE2_FRAMES;
  const slide3From = offset;
  offset += SLIDE3_FRAMES.durationFrames;
  const slide4From = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/TokyoFirebombing-music.mp3')} volume={0.15} loop />

      <Sequence from={slide1From} durationInFrames={SLIDE1_FRAMES.durationFrames} layout="none">
        <PortraitSlidePanel slide={SLIDE1} isFirst />
      </Sequence>

      <Sequence from={slide2From} durationInFrames={SLIDE2_FRAMES} layout="none">
        <GermanSoldierPanel />
      </Sequence>

      <Sequence from={slide3From} durationInFrames={SLIDE3_FRAMES.durationFrames} layout="none">
        <PortraitSlidePanel slide={SLIDE3} isFirst={false} />
      </Sequence>

      <Sequence from={slide4From} durationInFrames={SLIDE4_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
