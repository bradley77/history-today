import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { useMemo } from 'react';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

export const FPS = 30;

const HARD_CUT_FRAMES = 4;

type Motion = {
  scaleFrom: number;
  scaleTo: number;
  txFrom: number;
  txTo: number;
  tyFrom: number;
  tyTo: number;
  easing?: 'linear' | 'easeInOut' | 'easeInOutCubic';
};

type SlideConfig = {
  id: string;
  image: string;
  audio: string;
  durationInSeconds: number;
  overlayText?: string;
  motion: Motion;
  // 'cover' (default): standard object-fit:cover, for near-portrait sources.
  // 'native': image sized to height:100%/width:auto so its full native width
  // is available to pan across via tx — used for the true-landscape Forbes
  // painting slide, per the locked Ken Burns landscape-to-vertical addendum.
  fit?: 'cover' | 'native';
  captionLines?: string[];
  captionY?: number;
  topLabel?: string;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Lee-Escape/01-lee-portrait.jpg',
    audio: 'audio/gettysburg-retreat-qs/gettysburg-retreat-qs-vo-01.mp3',
    durationInSeconds: 2.427,
    overlayText: "GETTYSBURG DIDN'T BREAK LEE'S ARMY",
    fit: 'cover',
    motion: { scaleFrom: 1.0, scaleTo: 1.08, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    captionLines: ["Gettysburg didn't break Lee's army."],
    captionY: 1230,
    topLabel: 'GEN. ROBERT E. LEE, C.S.A.',
  },
  {
    id: 'slide2',
    image: 'slides/Lee-Escape/02-potomac-crossing.jpg',
    audio: 'audio/gettysburg-retreat-qs/gettysburg-retreat-qs-vo-02.mp3',
    durationInSeconds: 2.683,
    overlayText: 'DAYS LATER, A FLOODED RIVER TRAPPED HIM',
    // Pre-upscaled source (now 4006x1920, matching the rendered box exactly —
    // see slide 2 image history). native fit: height:100%, width:auto renders
    // at the source's native width, exposing the full pan room across
    // translateX rather than pre-cropping via object-fit:cover.
    fit: 'native',
    // centerOffset = (4006-1080)/2 = 1463. window_start = centerOffset - tx.
    // The wagon train (native x~1040) and the bridge/troop crossing (native
    // x~3466) sit at opposite ends of the painting, ~2400px apart — too far
    // apart for one small pan to hold both, so this frames the bridge/troop
    // crossing (chosen over the wagon train; better frame balance, matches
    // the topLabel/overlayText). txFrom:-863 -> window [2326,3406] (approach,
    // some hillside plus the start of the troop line). txTo:-1463 -> window
    // [2926,4006] (settles on the bridge, centered on the crossing at
    // native x~3466, holding to the canvas's own right edge where the
    // marching line recedes into the distance). 600px sweep over 81 frames
    // ≈ 7.4px/frame — slow, readable motion.
    motion: { scaleFrom: 1.0, scaleTo: 1.0, txFrom: -863, txTo: -1463, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    captionLines: ['Days later, a flooded river trapped him.'],
    captionY: 1230,
    topLabel: 'THE POTOMAC AT WILLIAMSPORT, JULY 1863',
  },
  {
    id: 'slide3',
    image: 'slides/Lee-Escape/03-meade-portrait.jpg',
    audio: 'audio/gettysburg-retreat-qs/gettysburg-retreat-qs-vo-03.mp3',
    durationInSeconds: 3.621,
    overlayText: 'MEADE HAD HIM PINNED. MOST OF HIS GENERALS SAID WAIT',
    fit: 'cover',
    motion: { scaleFrom: 1.0, scaleTo: 1.08, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    captionLines: ['Meade had him pinned.', 'Most of his generals said wait.'],
    captionY: 1230,
    topLabel: 'MAJ. GEN. GEORGE G. MEADE, U.S.A.',
  },
  {
    id: 'slide4',
    image: 'slides/Lee-Escape/04-lincoln-portrait.jpg',
    audio: 'audio/gettysburg-retreat-qs/gettysburg-retreat-qs-vo-04.mp3',
    durationInSeconds: 4.475,
    overlayText: 'LEE ESCAPED, NEARLY WHOLE. LINCOLN: "WE HAD THEM WITHIN OUR GRASP."',
    fit: 'cover',
    motion: { scaleFrom: 1.0, scaleTo: 1.08, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
    captionLines: ['Lee escaped, nearly whole.', "Lincoln said they'd had the war in their hands."],
    captionY: 1230,
    topLabel: 'PRESIDENT ABRAHAM LINCOLN, AUGUST 1863',
  },
];

const CTA_AUDIO = 'audio/gettysburg-retreat-qs/gettysburg-retreat-qs-vo-05.mp3';
const CTA_DURATION_SECONDS = 3.771;
const CTA_TRIGGER_WORD = 'BLUEGRAY';
const CTA_SUBTITLE = 'FOR THE FREE 5-FACT CIVIL WAR PDF';

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
}));

const END_CARD_FRAMES = Math.round(CTA_DURATION_SECONDS * FPS);
const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);
export const totalDuration = slidesDuration + END_CARD_FRAMES;

function useGoldOverlay(localFrame: number, delayFrames = 8) {
  const ruleWidth = interpolate(
    localFrame,
    [delayFrames, delayFrames + 25],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const textOpacity = interpolate(
    localFrame,
    [delayFrames, delayFrames + 18],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return { ruleWidth, textOpacity };
}

function CaptionOverlay({
  lines,
  durationFrames,
  top = 1230,
}: {
  lines: string[];
  durationFrames: number;
  top?: number;
}) {
  const frame = useCurrentFrame();

  const lineRanges = useMemo(() => {
    const wordCounts = lines.map((line) => line.split(/\s+/).filter(Boolean).length);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);
    let wordsSoFar = 0;
    let startFrame = 0;
    return lines.map((line, i) => {
      wordsSoFar += wordCounts[i];
      const endFrame = Math.round((wordsSoFar / totalWords) * durationFrames);
      const range = { line, startFrame, endFrame };
      startFrame = endFrame;
      return range;
    });
  }, [lines, durationFrames]);

  const active =
    lineRanges.find((r) => frame >= r.startFrame && frame < r.endFrame) ??
    lineRanges[lineRanges.length - 1];

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: 900,
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize: 38,
          fontWeight: 700,
          textAlign: 'center',
          padding: '10px 20px',
          borderRadius: 6,
        }}
      >
        {active.line}
      </div>
    </div>
  );
}

function SlidePanel({ slide, isFirst }: { slide: SlideConfig & { durationFrames: number }; isFirst: boolean }) {
  const frame = useCurrentFrame();
  const { motion, durationFrames, overlayText, fit = 'cover', captionLines, captionY, topLabel } = slide;

  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  const easingFn =
    motion.easing === 'easeInOutCubic'
      ? Easing.inOut(Easing.cubic)
      : motion.easing === 'easeInOut'
      ? Easing.inOut(Easing.ease)
      : Easing.linear;

  const scale = interpolate(frame, [0, durationFrames], [motion.scaleFrom, motion.scaleTo], {
    easing: easingFn,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tx = interpolate(frame, [0, durationFrames], [motion.txFrom, motion.txTo], {
    easing: easingFn,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ty = interpolate(frame, [0, durationFrames], [motion.tyFrom, motion.tyTo], {
    easing: easingFn,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const { ruleWidth, textOpacity } = useGoldOverlay(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {fit === 'native' ? (
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Img
              src={staticFile(slide.image)}
              style={{
                height: '100%',
                width: 'auto',
                maxWidth: 'none',
                transform: `scale(${scale}) translateX(${tx}px) translateY(${ty}px)`,
                transformOrigin: 'center center',
                // Slide 2 only: the bridge/troop crossing sits in the darkest
                // corner of the vignette (pan lands at the right edge) on an
                // already-hazy, muted-contrast source. Lifted here rather than
                // touching the source file. See diagnosis: raw source has real
                // contrast (p90-p10 spread ~53) that the overlay stack below
                // was compressing by ~20% right where the pan lands.
                filter: 'brightness(1.15) contrast(1.1)',
              }}
            />
          </AbsoluteFill>
        ) : (
          <Img
            src={staticFile(slide.image)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              transform: `scale(${scale}) translateX(${tx}px) translateY(${ty}px)`,
              transformOrigin: 'center center',
            }}
          />
        )}
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          // Slide 2 gets a softened vignette/gradient (see filter comment above) —
          // every other slide keeps the original 0.55 / 0.75 darkening.
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${
            slide.id === 'slide2' ? 0.28 : 0.55
          }) 100%)`,
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom, transparent 55%, rgba(0,0,0,${
            slide.id === 'slide2' ? 0.38 : 0.75
          }) 100%)`,
          pointerEvents: 'none',
        }}
      />

      {overlayText && (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            // Bottom padding 360px (was 140px) keeps the box's bottom edge at
            // y=1560 on the 1920px canvas — inside the y<=1580 safe zone above
            // Facebook Reels' reserved UI band (profile/name/audio/caption bar,
            // ~bottom 300-350px). Shifted captionY by the same -220px so the
            // existing caption-to-headline gap is preserved unchanged.
            padding: '0 40px 360px',
            pointerEvents: 'none',
          }}
        >
          <div style={{ width: '100%', maxWidth: 900 }}>
            <div
              style={{
                height: 3,
                background: '#C9A84C',
                width: `${ruleWidth}%`,
                marginBottom: 16,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            />
            <div
              style={{
                opacity: textOpacity,
                color: '#fff',
                fontFamily: 'Georgia, serif',
                fontSize: 44,
                fontWeight: 700,
                letterSpacing: '0.02em',
                lineHeight: 1.25,
                textShadow: '0 2px 8px rgba(0,0,0,0.85)',
                textAlign: 'center',
              }}
            >
              {overlayText}
            </div>
            <div
              style={{
                height: 3,
                background: '#C9A84C',
                width: `${ruleWidth}%`,
                marginTop: 16,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            />
          </div>
        </AbsoluteFill>
      )}

      {topLabel && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 40,
            color: '#C9A84C',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.06em',
            fontFamily: 'Georgia, serif',
            textTransform: 'uppercase',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            opacity: textOpacity,
            pointerEvents: 'none',
          }}
        >
          {topLabel}
        </div>
      )}

      {captionLines && (
        <CaptionOverlay lines={captionLines} durationFrames={durationFrames} top={captionY} />
      )}

      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

function EndCard() {
  const frame = useCurrentFrame();
  const textOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ruleWidth = interpolate(frame, [8, 33], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
      }}
    >
      <Audio src={staticFile(CTA_AUDIO)} startFrom={0} />
      <div style={{ width: '80%', maxWidth: 900 }}>
        <div
          style={{
            height: 3,
            background: '#C9A84C',
            width: `${ruleWidth}%`,
            marginBottom: 28,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />
        <div
          style={{
            opacity: textOpacity,
            color: '#fff',
            fontFamily: 'Georgia, serif',
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Comment
        </div>
        <div
          style={{
            opacity: textOpacity,
            color: '#C9A84C',
            fontFamily: 'Georgia, serif',
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          {CTA_TRIGGER_WORD}
        </div>
        <div
          style={{
            opacity: textOpacity,
            color: '#fff',
            fontFamily: 'Georgia, serif',
            fontSize: 26,
            fontWeight: 400,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 28,
          }}
        >
          {CTA_SUBTITLE}
        </div>
        <div
          style={{
            height: 3,
            background: '#C9A84C',
            width: `${ruleWidth}%`,
            marginBottom: 28,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />
        <div
          style={{
            opacity: textOpacity,
            color: '#F5F0E8',
            fontFamily: 'Georgia, serif',
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Like. Save. Share.
        </div>
      </div>
    </AbsoluteFill>
  );
}

export default function GettysburgRetreatQS() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {slidesWithFrames.map((slide, i) => {
        const from = offset;
        offset += slide.durationFrames;
        return (
          <Sequence key={slide.id} from={from} durationInFrames={slide.durationFrames} layout="none">
            <SlidePanel slide={slide} isFirst={i === 0} />
          </Sequence>
        );
      })}

      <Sequence from={slidesDuration} durationInFrames={END_CARD_FRAMES} layout="none">
        <EndCard />
      </Sequence>

      <Audio src={staticFile('audio/union-sherman-scorched-earth-music.mp3')} volume={0.15} loop />
    </AbsoluteFill>
  );
}
