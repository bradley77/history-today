import {
  AbsoluteFill,
  Audio,
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

// Slides 1 & 2 share 01-march.jpg and must read as ONE continuous shot, not a
// cut between two images — so the image itself is rendered by MarchPanLayer
// below as a single Img mounted once for their combined frame range, driven
// by ONE pan function (marchPanTx) over that whole span. Text/captions/audio
// for each slide still live in their own Sequences (MarchTextOverlay) and
// pop in/out normally at the boundary — only the image is exempted from the
// usual per-slide mount/fade lifecycle.
const SLIDE1_DURATION_S = 2.448; // 2.048s actual + 0.4s pad
const SLIDE2_DURATION_S = 3.621; // 3.221s actual + 0.4s pad
const SLIDE1_FRAMES = Math.round(SLIDE1_DURATION_S * FPS); // 73
const SLIDE2_FRAMES = Math.round(SLIDE2_DURATION_S * FPS); // 109
const MARCH_PAN_FRAMES = SLIDE1_FRAMES + SLIDE2_FRAMES; // 182
// Last ACTUALLY REACHABLE frame index (frames run 0..181, never 182) — used as
// the interpolate() upper bound so the pan curve really lands on
// MARCH_PAN_END_X at the last frame instead of falling ~7px short.
const MARCH_PAN_LAST_FRAME = MARCH_PAN_FRAMES - 1; // 181

// Constant CSS scale applied for the full combined pan span (see MarchPanLayer
// below). marchTx's formula bakes this in directly, since the centered
// height:100%/width:auto native fit's pixel mapping depends on the zoom
// level, not just the pan-room geometry.
const MARCH_SCALE = 1.08;

// 01-march.jpg is 2578x1920. Rendered at height:100%, its rendered width is
// CANVAS_HEIGHT * (2578/1920) = 2578px exactly (native height already
// matches the canvas height, so no scaling occurs before the CSS transform
// is applied).
const MARCH_SCALED_WIDTH = 1920 * (2578 / 1920); // 2578px
const MARCH_HALF_WIDTH = MARCH_SCALED_WIDTH / 2; // 1289px
const CANVAS_HALF_WIDTH = 1080 / 2; // 540px
// 94px (pure pan-room math) left the lead prisoner almost entirely hidden
// behind bamboo at frame 0 — tuned empirically against rendered stills
// (tried 220, 450, 500) until he reads clearly: head, face, torso, arm, and
// the white sack he's carrying all visible with clean margin on every side.
const MARCH_PAN_START_X = 450;
const MARCH_PAN_END_X = 1404; // slide 2 closing crop — 94px buffer from the right edge (pan room 1498px)

// Pan distance shrank from 1310px to 954px when MARCH_PAN_START_X moved
// 94->450, which raised the question of whether MARCH_SCALE should drop
// below 1.08 too. Checked: at 1.08 the visible window is 1000px wide
// (1080/1.08), leaving 1128px of margin to the image's right edge at the
// start crop and 174px at the end crop — nowhere close to exposing an edge.
// The <=20-30px "safe threshold" convention used elsewhere (e.g.
// BattleOfHue.tsx) governs the OTHER (object-fit:cover) Ken Burns technique,
// where scale exists solely to buy overflow margin for a small nudge; it
// doesn't apply to this native-fit full-image sweep, where the real
// constraint is staying inside the source's absolute pixel bounds. 954px is
// still nowhere near "small," so there's no geometric or stylistic reason to
// reduce scale here — kept at 1.08.

// Maps a "pixels from the image's left edge" position to the translateX needed
// to show it at the canvas's left edge, for the centered height:100%/width:auto
// native fit, at CSS scale MARCH_SCALE — NOT scale 1.0. The image is scaled
// around its own center (transform-origin: center center) before translateX
// is applied in unscaled screen pixels (see the transform order in
// MarchPanLayer: translateX listed BEFORE scale, so translate isn't inflated
// by the zoom — CSS composes right-to-left, so scale runs first against the
// point, then translate adds a flat, unscaled offset on top). Because the
// zoom happens first, the correct pixel-to-canvas-edge offset scales with
// MARCH_SCALE too: tx = MARCH_SCALE * (MARCH_HALF_WIDTH - x) - CANVAS_HALF_WIDTH.
function marchTx(xFromLeftEdge: number) {
  return MARCH_SCALE * (MARCH_HALF_WIDTH - xFromLeftEdge) - CANVAS_HALF_WIDTH;
}

// ONE continuous, linear pan across the combined frame range. Linear (not
// eased) so there's no deceleration-then-reacceleration seam at the slide
// 1->2 boundary that an eased curve would produce mid-motion.
function marchPanTx(globalFrame: number) {
  const x = interpolate(
    globalFrame,
    [0, MARCH_PAN_LAST_FRAME],
    [MARCH_PAN_START_X, MARCH_PAN_END_X],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return marchTx(x);
}

const MARCH_TOP_LABEL = 'Bataan Death March, Philippines — April 1942';

// Text/caption/audio content for slides 1 & 2 — deliberately NOT part of the
// SLIDES array below, since they no longer drive an image render (that's
// MarchPanLayer's job). Each still gets its own Sequence and pops in/out
// normally; only the shared image is exempt from that lifecycle.
const SLIDE1_TEXT = {
  overlayText: "The march wasn't the deadliest part.",
  audio: 'audio/bataan-death-march-toll-vo-01.mp3',
  audioDurationSeconds: 2.048,
  captionLines: ["The march wasn't the deadliest part."],
  captionY: 1480,
};

const SLIDE2_TEXT = {
  overlayText: '500 Americans died walking 65 miles.',
  audio: 'audio/bataan-death-march-toll-vo-02.mp3',
  audioDurationSeconds: 3.221,
  captionLines: ['Five hundred Americans died walking sixty-five miles.'],
  captionY: 1480,
};

const SLIDE1_AUDIO_FRAMES = Math.round(SLIDE1_TEXT.audioDurationSeconds * FPS);
const SLIDE2_AUDIO_FRAMES = Math.round(SLIDE2_TEXT.audioDurationSeconds * FPS);

type Motion = {
  scaleFrom: number;
  scaleTo: number;
  txFrom: number;
  txTo: number;
  tyFrom: number;
  tyTo: number;
};

type SlideConfig = {
  id: string;
  image: string;
  audio: string;
  // Actual VO file duration (measured via Kokoro) + 0.4s pad
  durationInSeconds: number;
  // Actual VO file duration only, no pad — captions time against this so they
  // finish when speech finishes rather than running into the trailing silence.
  audioDurationSeconds: number;
  overlayText?: string;
  motion: Motion;
  topLabel?: string;
  captionLines: string[];
  captionY: number;
};

// Slides 3+ — genuine image changes, each keeps the standard hard-cut
// (unmount/remount + 4-frame fade-from-black) treatment via SlidePanel.
const SLIDES: SlideConfig[] = [
  {
    id: 'slide3',
    image: 'slides/Bataan/02-campodonnell.jpg',
    audio: 'audio/bataan-death-march-toll-vo-03.mp3',
    durationInSeconds: 3.493, // 3.093s actual + 0.4s pad
    audioDurationSeconds: 3.093,
    overlayText: 'Up to 20,000 prisoners died at Camp O’Donnell.',
    // Slow pan across the camp
    motion: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: -20, txTo: 20, tyFrom: 0, tyTo: 0 },
    topLabel: 'Camp O’Donnell, Philippines — 1942',
    captionLines: ['Up to twenty thousand prisoners died at Camp O’Donnell.'],
    captionY: 1360,
  },
  {
    id: 'slide4',
    image: 'slides/Bataan/03-homma.jpg',
    audio: 'audio/bataan-death-march-toll-vo-04.mp3',
    durationInSeconds: 2.939, // 2.539s actual + 0.4s pad
    audioDurationSeconds: 2.539,
    overlayText: 'The general in charge was executed for it.',
    // Push-in toward the face
    motion: { scaleFrom: 1.0, scaleTo: 1.07, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: -15 },
    topLabel: 'Lt. Gen. Masaharu Homma, Imperial Japanese Army',
    captionLines: ['The general in charge was executed for it.'],
    captionY: 1360,
  },
  {
    id: 'slide5',
    image: 'slides/Bataan/04-endcard-front.jpg',
    audio: 'audio/bataan-death-march-toll-vo-05.mp3',
    durationInSeconds: 2.405, // 2.005s actual + 0.4s pad
    audioDurationSeconds: 2.005,
    // No overlayText / topLabel — the card art already has the closing
    // message baked in, so this slide plays audio only, no text layer on top.
    motion: { scaleFrom: 1.0, scaleTo: 1.0, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
    captionLines: ['Comment FRONT for the free PDF.'],
    captionY: 180,
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

export const totalDuration =
  MARCH_PAN_FRAMES + slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

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

// Closed captions — timed against the slide's actual (unpadded) audio duration
// so the caption finishes when the speech finishes rather than lingering into
// the trailing 0.4s pad. Each slide here is a single short VO line, so there's
// one caption line spanning the full speaking window rather than a sequence of
// word-timed chunks.
function CaptionOverlay({
  lines,
  audioDurationFrames,
  top,
}: {
  lines: string[];
  audioDurationFrames: number;
  top: number;
}) {
  const frame = useCurrentFrame();

  const lineRanges = useMemo(() => {
    const wordCounts = lines.map((line) => line.split(/\s+/).filter(Boolean).length);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);
    let wordsSoFar = 0;
    let startFrame = 0;
    return lines.map((line, i) => {
      wordsSoFar += wordCounts[i];
      const endFrame = Math.round((wordsSoFar / totalWords) * audioDurationFrames);
      const range = { line, startFrame, endFrame };
      startFrame = endFrame;
      return range;
    });
  }, [lines, audioDurationFrames]);

  if (frame >= audioDurationFrames) {
    return null;
  }

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

// The shared 01-march.jpg layer for slides 1 & 2 — mounted ONCE for the full
// combined 182-frame span via a single top-level Sequence, so there's no
// unmount/remount and no opacity fade at the slide 1->2 boundary. Panning is
// driven directly by marchPanTx(frame), since this component's own local
// frame (0..181) IS the continuous counter — no offset arithmetic needed.
function MarchPanLayer() {
  const frame = useCurrentFrame();
  const tx = marchPanTx(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Img
            src={staticFile('slides/Bataan/01-march.jpg')}
            style={{
              height: '100%',
              width: 'auto',
              maxWidth: 'none',
              // translateX listed BEFORE scale so the pan isn't inflated by the
              // zoom (CSS applies the rightmost function first) — see marchTx's
              // comment for why this ordering matters once scale != 1.
              transform: `translateX(${tx}px) scale(${MARCH_SCALE})`,
              transformOrigin: 'center center',
            }}
          />
        </AbsoluteFill>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.75) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Same label text for the whole combined span, so it's rendered once
          here rather than per-slide — it never pops or re-fades at the cut. */}
      <div
        style={{
          position: 'absolute',
          top: 48,
          left: 40,
          color: '#C9A84C',
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: '0.03em',
          fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
          textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          pointerEvents: 'none',
        }}
      >
        {MARCH_TOP_LABEL}
      </div>
    </AbsoluteFill>
  );
}

// Text/caption/audio for one of slides 1 or 2. Unlike MarchPanLayer, this DOES
// mount/unmount at the slide boundary — the gold rule/text fading in fresh
// per slide (via its own local-frame useGoldOverlay) is expected and fine,
// since it's text popping in, not the image cutting to black.
function MarchTextOverlay({
  overlayText,
  captionLines,
  captionY,
  audioDurationFrames,
  audioSrc,
}: {
  overlayText: string;
  captionLines: string[];
  captionY: number;
  audioDurationFrames: number;
  audioSrc: string;
}) {
  const frame = useCurrentFrame();
  const { ruleWidth, textOpacity } = useGoldOverlay(frame);

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 48px 140px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ width: '100%' }}>
          <div
            style={{
              height: 3,
              width: `${ruleWidth}%`,
              backgroundColor: '#C9A84C',
              marginBottom: 16,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.60)',
              padding: '24px 40px',
              textAlign: 'center',
            }}
          >
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
              backgroundColor: '#C9A84C',
              marginTop: 16,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
        </div>
      </AbsoluteFill>

      <CaptionOverlay lines={captionLines} audioDurationFrames={audioDurationFrames} top={captionY} />

      {/* Fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(audioSrc)} />
    </AbsoluteFill>
  );
}

// Slides 3+ only — image, gradients, overlay, label, caption, and audio all
// live and die together per-slide, with the standard 4-frame hard-cut fade
// from black. None of these are the composition's true cold open (that's
// MarchPanLayer/slide 1, which never fades), so the fade always applies.
function SlidePanel({
  slide,
}: {
  slide: SlideConfig & { durationFrames: number; audioDurationFrames: number };
}) {
  const frame = useCurrentFrame();
  const { motion, durationFrames, overlayText } = slide;

  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scale = interpolate(frame, [0, durationFrames], [motion.scaleFrom, motion.scaleTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tx = interpolate(frame, [0, durationFrames], [motion.txFrom, motion.txTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ty = interpolate(frame, [0, durationFrames], [motion.tyFrom, motion.tyTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const { ruleWidth, textOpacity } = useGoldOverlay(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
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
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.75) 100%)',
          pointerEvents: 'none',
        }}
      />

      {overlayText && (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 48px 140px',
            pointerEvents: 'none',
          }}
        >
          <div style={{ width: '100%' }}>
            <div
              style={{
                height: 3,
                width: `${ruleWidth}%`,
                backgroundColor: '#C9A84C',
                marginBottom: 16,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            />
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.60)',
                padding: '24px 40px',
                textAlign: 'center',
              }}
            >
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
                backgroundColor: '#C9A84C',
                marginTop: 16,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            />
          </div>
        </AbsoluteFill>
      )}

      {slide.topLabel && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 40,
            color: '#C9A84C',
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.03em',
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            pointerEvents: 'none',
          }}
        >
          {slide.topLabel}
        </div>
      )}

      <CaptionOverlay
        lines={slide.captionLines}
        audioDurationFrames={slide.audioDurationFrames}
        top={slide.captionY}
      />

      {/* Per-slide voiceover — fires at this slide's own local frame 0, not a shared timeline */}
      <Audio src={staticFile(slide.audio)} />
    </AbsoluteFill>
  );
}

export default function BataanDeathMarchToll() {
  let offset = MARCH_PAN_FRAMES;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Music bed reused from PattonBloodAndGuts — no silence at frame 0 (confirmed via
          silencedetect: first gap doesn't occur until ~96.8s) and it's already the frame-0
          entry point in its origin composition, so no startFrom offset is needed here. */}
      <Audio src={staticFile('audio/patton-blood-and-guts-music.mp3')} volume={0.15} loop />

      {/* Slides 1+2's shared image — ONE continuous layer for the full 182-frame
          combined span, mounted once. Fixes the frame-73 brightness blip: fading
          this through black at the old slide boundary was the actual bug, not
          the pan math (marchPanTx), which was already correct and continuous. */}
      <Sequence from={0} durationInFrames={MARCH_PAN_FRAMES} layout="none">
        <MarchPanLayer />
      </Sequence>

      <Sequence from={0} durationInFrames={SLIDE1_FRAMES} layout="none">
        <MarchTextOverlay
          overlayText={SLIDE1_TEXT.overlayText}
          captionLines={SLIDE1_TEXT.captionLines}
          captionY={SLIDE1_TEXT.captionY}
          audioDurationFrames={SLIDE1_AUDIO_FRAMES}
          audioSrc={SLIDE1_TEXT.audio}
        />
      </Sequence>

      <Sequence from={SLIDE1_FRAMES} durationInFrames={SLIDE2_FRAMES} layout="none">
        <MarchTextOverlay
          overlayText={SLIDE2_TEXT.overlayText}
          captionLines={SLIDE2_TEXT.captionLines}
          captionY={SLIDE2_TEXT.captionY}
          audioDurationFrames={SLIDE2_AUDIO_FRAMES}
          audioSrc={SLIDE2_TEXT.audio}
        />
      </Sequence>

      {slidesWithFrames.map((slide) => {
        const from = offset;
        offset += slide.durationFrames;
        return (
          <Sequence key={slide.id} from={from} durationInFrames={slide.durationFrames} layout="none">
            <SlidePanel slide={slide} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
