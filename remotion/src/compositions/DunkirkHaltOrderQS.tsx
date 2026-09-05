import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  KenBurnsImage,
  Vignette,
  ContextTag,
  GoldLowerThird,
  CaptionOverlay,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// FRONT Quick Strike — "Dunkirk Halt Order". No trigger-word CTA/comment
// automation (matches HessAmnesiaQS's one-off treatment) -- ends on an
// on-image CTA within slide 4 itself rather than a separate end card.
//
// Locked decisions from the build brief:
//   - True cold open: slide 1 fully visible at full brightness from frame 0
//     (isFirst, handled by the shared SlidePanel). 4-frame hard cut on every
//     slide after. No fade-out anywhere -- hard cut ending.
//   - Per-slide audio only (one <Audio> per slide), never a concatenated
//     track. Timing is LOCKED from ffprobe-measured VO + the standard 0.4s
//     pad -- see scripts/generateVoiceover-dunkirk-halt-order.py. Do not
//     recalculate slides 1-3's numbers below.
//   - Pan-Fill (slides 1 & 4, 01-trapped-beach.jpg, 3840x2774, aspect 1.384
//     -- qualifies for the automatic pan, "category 2" in the brief):
//     built via sourceWidth/sourceHeight + panDirection, the same modern
//     system every recent QS composition uses (Hess-Amnesia, North-Anna,
//     Antietam) -- NOT the brief's hand-computed legacy numbers (scale
//     x1.08, ~1520-1610px travel), which predate Pan-Fill and don't match
//     what the shared engine actually renders. Confirmed with the user
//     before building. Actual computed values (getPanFillTransform):
//       baseScale = 1920/2774 = 0.6921, renderedWidth = 2658.0px
//       panRoomPx = 2658.0 - 1080 = 1578.0px
//       marginPerSide = max(1578.0*0.125/2, 50) = 98.6px
//       usablePanPx = 1578.0 - 197.3 = 1380.8px
//       speed cap @ slide 1's 86-frame (2.867s) window: 100*2.867 = 286.7px
//       -> panDistancePx = 286.7px (speed-capped, well under usablePanPx)
//   - Slide 4 reuses slide 1's exact pan math, reversed (rtl vs slide 1's
//     ltr), but the pan must FINISH and hold static for the rest of the
//     (much longer) slide 4 -- not re-run across all 293 frames. Achieved
//     by calling KenBurnsImage with durationFrames=PAN_FRAMES (86, slide
//     1's own frame count) while the actual Sequence/local frame keeps
//     counting past that -- KenBurnsImage's pan interpolate already has
//     extrapolateRight:'clamp', so frames 86-292 hold at the final
//     translateX automatically. No shared-code changes needed.
//   - Slide 2 (02-hitler-paris.jpg, 1280x1559, aspect 0.821 -- "category 1",
//     resolves to Pan-Fill's 'static') and slide 3 (a face/torso-only crop
//     of the same photo, see below) both use an EXPLICIT motion override
//     rather than Pan-Fill's default 1.00->1.05 static push-in, since the
//     brief calls for 1.06 and 1.05->1.12 respectively -- explicit `motion`
//     always wins over that default.
//   - Slide 3 crop: the brief's "center-third, face/torso only" framing
//     can't come from the tiny 1.05->1.12 scale alone (a plain cover-fit of
//     the full 3-man photo at that scale still shows all three men) -- it
//     needs a separately cropped source image, the same way any other
//     "same photo, different crop" slide in this codebase would be built.
//     Cropped via ffmpeg from the original (no upscaling baked into the
//     asset): crop=420:600:315:820 -> public/slides/Dunkirk/
//     02b-hitler-paris-face.jpg (420x600, source pixels [315,820]-[735,1420]
//     of the original), centered on Hitler's face, excluding Speer (left)
//     and the soldier (right). Rendered as a preview and confirmed with the
//     user before this file was written. The small 1.05->1.12 push-in is
//     then applied on top of that crop's own plain cover-fit, exactly like
//     slide 2's treatment of the full photo.
//   - Editorial note (not a code change, flagging for awareness): the
//     Eiffel Tower photo (both slides 2 and 3) is from Hitler's Paris
//     victory tour on June 23, 1940 -- about a month after the May 24
//     halt order slide 2's headline names. It's used here as illustrative
//     imagery of Hitler/the occupation, not a claim that the photo was
//     taken on May 24 itself.
//   - Slide 4's on-screen CTA needs real on-screen time, not just the
//     standard 0.4s pad (0.4s isn't readable). Per direction, slide 4 gets
//     an extended 3.0s silent hold after its VO ends (replacing, not
//     stacking with, the standard pad) instead of the 21.219s total stated
//     in the brief -- confirmed with the user. New total runtime: 23.8s.
//     That hold shows ONLY the CTA headline ("Follow for more history they
//     didn't teach you.") -- the comment-prompt question originally
//     planned as a second on-screen line is deliberately not rendered; it's
//     posted as the video's social comment text instead, tracked outside
//     this file. Removed per direction after the first cut was reviewed.
//   - Music: audio/TokyoFirebombing-music.mp3 at 0.15 volume, looped -- the
//     standing FRONT/WWII Quick Strike bed. Not re-sourced.
const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified
// -- see scripts/generateVoiceover-dunkirk-halt-order.py).
const SLIDE1_AUDIO_S = 2.482;
const SLIDE2_AUDIO_S = 5.329;
const SLIDE3_AUDIO_S = 5.042;
// Re-measured after the Luftwaffe pronunciation fix (kokoro_pipeline.py's
// GERMAN_TERMS_PRONUNCIATION splice) forced slide 4's re-synthesis -- was
// 6.766, now 6.792 per ffprobe. Slides 1-3 are untouched by that fix and
// keep their original measured durations above.
const SLIDE4_AUDIO_S = 6.792;

// Extended silent hold after slide 4's VO ends, replacing the standard 0.4s
// pad -- see note above. Covers the CTA headline's own GoldLowerThird
// reveal. The comment-prompt question ("Was the halt order really...") is
// NOT rendered on screen -- it's posted as the video's social comment text
// instead, tracked wherever that copy lives, not in this file.
const SLIDE4_HOLD_S = 3.0;

type SlideConfig = SharedSlideConfig & {
  sourceWidth: number;
  sourceHeight: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Dunkirk/01-trapped-beach.jpg',
    audio: 'audio/dunkirk-halt-order-slide1.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    label: 'DUNKIRK, FRANCE — MAY 1940',
    overlayText: 'HITLER HAD THEM TRAPPED.',
    captionLines: ['Hitler had the British Army trapped at Dunkirk.'],
    sourceWidth: 3840,
    sourceHeight: 2774,
    // panDirection defaults to 'ltr' -- explicit here anyway, since slide 4
    // deliberately mirrors this and the pairing should read at a glance.
    panDirection: 'ltr',
  },
  {
    id: 'slide2',
    image: 'slides/Dunkirk/02-hitler-paris.jpg',
    audio: 'audio/dunkirk-halt-order-slide2.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    overlayText: 'THE HALT ORDER',
    // On-screen text keeps numerals throughout -- the VO script spells
    // numbers out for Kokoro ("twenty-fourth"), but the burned-in caption
    // is independent text and should read like the rest of the on-screen
    // copy ("24"), not like the VO.
    captionLines: ['Then the panzers stopped. On May 24, German armor halted just outside Dunkirk.'],
    sourceWidth: 1280,
    sourceHeight: 1559,
    // Aspect 0.821 < PAN_FILL_ASPECT_THRESHOLD -> Pan-Fill resolves 'static'
    // on its own; sourceWidth/sourceHeight kept for documentation parity
    // even though the explicit motion below (not Pan-Fill's own 1.00->1.05
    // static default) is what actually drives this slide's push-in.
    motion: { scaleFrom: 1, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
  },
  {
    id: 'slide3',
    // Cropped variant of 02-hitler-paris.jpg, not the original -- see file
    // header note. 420x600 native pixels, no upscaling baked into the
    // asset; the object-fit:cover + push-in below does the zoom.
    image: 'slides/Dunkirk/02b-hitler-paris-face.jpg',
    audio: 'audio/dunkirk-halt-order-slide3.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    overlayText: '"A SPORTING CHANCE"',
    captionLines: ['Hitler later reportedly described the decision as giving Britain a sporting chance.'],
    sourceWidth: 420,
    sourceHeight: 600,
    // Continues slide 2's push-in direction/range (1.05->1.12) rather than
    // resetting to 1.00, so this reads as a reveal of the same moment, not
    // a repeated shot.
    motion: { scaleFrom: 1.05, scaleTo: 1.12, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0, easing: 'easeInOutCubic' },
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

// ---------------------------------------------------------------------------
// Slide 4 -- built by hand (not the shared SlidePanel) for two things
// SlidePanel doesn't support: a pan that finishes early and holds, and a
// mid-slide text swap timed off audio end rather than slide end. Still
// consumes only shared exports (KenBurnsImage/Vignette/ContextTag/
// GoldLowerThird/CaptionOverlay) -- no changes to QuickStrikeShared.tsx.
// ---------------------------------------------------------------------------

const SLIDE4_LABEL = 'DUNKIRK, FRANCE — MAY 1940';
const SLIDE4_VO_HEADLINE = 'NERVOUS GENERALS. A BOASTFUL GÖRING. A GAMBLE.';
const SLIDE4_VO_CAPTIONS = [
  'German war diaries reveal a messier truth:',
  'nervous generals, a boastful Göring,',
  'and a gamble on the Luftwaffe.',
];
const SLIDE4_CTA_HEADLINE = "Follow for more history they didn't teach you.";
// The comment-prompt question is deliberately NOT defined/rendered here --
// it's posted as the video's Facebook/social comment text, not on-screen
// copy. See the file header's SLIDE4_HOLD_S note.

const SLIDE4_AUDIO_FRAMES = Math.round(SLIDE4_AUDIO_S * FPS); // 203
const SLIDE4_HOLD_FRAMES = Math.round(SLIDE4_HOLD_S * FPS); // 90
const SLIDE4_DURATION_FRAMES = SLIDE4_AUDIO_FRAMES + SLIDE4_HOLD_FRAMES; // 293

// Pan window slide 4 mirrors from slide 1 -- same image, same frame count
// (86, slide 1's own durationFrames), reversed direction. KenBurnsImage is
// given this SHORTER duration on purpose (see file header note) so the pan
// completes well inside slide 4's 293 frames and holds for the rest.
const PAN_FRAMES = slidesWithFrames[0].durationFrames;

function Slide4({ isFirst }: { isFirst: boolean }) {
  const frame = useCurrentFrame();
  const inVO = frame < SLIDE4_AUDIO_FRAMES;

  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <KenBurnsImage
        image="slides/Dunkirk/01-trapped-beach.jpg"
        frame={frame}
        durationFrames={PAN_FRAMES}
        sourceWidth={3840}
        sourceHeight={2774}
        panDirection="rtl"
      />
      <Vignette />

      {inVO && <ContextTag text={SLIDE4_LABEL} position="top-left" />}

      <Sequence from={0} durationInFrames={SLIDE4_AUDIO_FRAMES} layout="none">
        <GoldLowerThird text={SLIDE4_VO_HEADLINE} frame={useCurrentFrame()} />
        <CaptionOverlay
          lines={SLIDE4_VO_CAPTIONS}
          audioDurationFrames={SLIDE4_AUDIO_FRAMES}
          overlayText={SLIDE4_VO_HEADLINE}
        />
      </Sequence>

      <Sequence from={SLIDE4_AUDIO_FRAMES} durationInFrames={SLIDE4_HOLD_FRAMES} layout="none">
        <GoldLowerThird text={SLIDE4_CTA_HEADLINE} frame={useCurrentFrame()} />
      </Sequence>

      <Sequence from={0} durationInFrames={SLIDE4_AUDIO_FRAMES} layout="none">
        <Audio src={staticFile('audio/dunkirk-halt-order-slide4.mp3')} />
      </Sequence>
    </AbsoluteFill>
  );
}

const slide123Duration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);
export const totalDuration = slide123Duration + SLIDE4_DURATION_FRAMES;
export { FPS };

export default function DunkirkHaltOrderQS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });
  const slide4From = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/TokyoFirebombing-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <SlidePanel slide={slide} isFirst={i === 0} />
        </Sequence>
      ))}

      <Sequence from={slide4From} durationInFrames={SLIDE4_DURATION_FRAMES} layout="none">
        <Slide4 isFirst={false} />
      </Sequence>
    </AbsoluteFill>
  );
}
