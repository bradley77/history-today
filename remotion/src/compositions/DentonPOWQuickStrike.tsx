import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { useMemo } from 'react';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  GOLD,
  SlidePanel,
  KenBurnsImage,
  Vignette,
  ContextTag,
  GoldLowerThird,
  CaptionOverlay,
  computeFloorAwareHeadlineFit,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// RECON Quick Strike -- "Denton POW" (Jeremiah Denton's 1966 forced
// propaganda interview and 1973 release). Standard follow CTA only -- no
// "Comment RECON" trigger-word / lead-magnet DM funnel on this one, per the
// build brief. Built on the shared QuickStrikeShared/QuickStrikeConfig
// engine, same as every other QuickStrike -- not forked.
//
// Locked decisions from the build brief:
//   - True cold open: slide 1 fully visible at full brightness from frame 0
//     (isFirst), no fade-in. 4-frame hard cut between slides 1->2, 2->3,
//     3->4 (not within the 2a/2b or 3a/3b sub-beats -- see below). No fade
//     to black anywhere, including the ending (hard cut on the last frame).
//   - Per-slide/sub-beat audio only, never a concatenated track.
//   - Voice: am_adam, speed 0.95, en-us -- see
//     scripts/generateVoiceover-denton-pow.py. Durations below are
//     ffprobe-MEASURED (not estimated), copied verbatim from that script's
//     output after three passes: trim pass (27.618s -> 25.032s, trimmed
//     vo-01/02b/03a) then a naturalness pass (25.032s -> 24.013s, vo-02a's
//     letter-by-letter "T, O, R, T, U, R, E" changed to "the word TORTURE"
//     spoken as a word -- read choppy aloud; the letter-by-letter detail is
//     still communicated visually via the overlay text). Still ~4s over the
//     ~19-20s target but accepted as-is per Brad's direction.
//   - vo-03a was synthesized as "...United States Naval Intelligence..."
//     (not "U.S. Naval Intelligence") -- Kokoro's phonemizer treats the
//     internal periods in "U.S." as sentence-ending punctuation and inserts
//     an awkward pause mid-word, the same issue documented in
//     generateVoiceover-mcnamara-confession.py. Text-level fix, audio only
//     -- the on-screen caption below keeps "U.S." (that's just text).
//   - Naturalness-pass review flag (not changed, per Brad's "flag, don't
//     alter" instruction): vo-03a's locked trim -- "the first confirmation
//     United States Naval Intelligence had of POW torture" -- reads a
//     little stilted spoken aloud around "had of" (relative clause word
//     order). Left as written since "first confirmation" and "U.S. Naval
//     Intelligence" are locked exactly; flagging for Brad's call. The other
//     four unchanged lines (vo-01, vo-02b, vo-03b, vo-04) read naturally on
//     re-listen -- no other flags.
//   - Slides 2 and 3 are each a CAPTION-SWAP pair: one image, two VO
//     sub-clips (a/b), no hard cut between them -- the visual (Ken Burns
//     motion included) runs continuously across the combined duration, and
//     only the caption changes at the a/b boundary. The gold-rule headline
//     reveal fires ONCE at the top of the pair (2a's frame 0 / 3a's frame
//     0) and is never re-triggered for the b sub-beat -- achieved by
//     rendering GoldLowerThird off the slide's own continuous frame
//     counter (not reset per sub-beat) while CaptionOverlay and each
//     sub-beat's <Audio> sit in their own nested Sequence (own local frame
//     0), same technique as DunkirkHaltOrderQS's hand-built Slide4 (VO
//     phase -> CTA-hold phase on one continuous image). b sub-beats pass no
//     overlayText of their own -- only captionLines change.
//   - Images: 01-midshipman.jpg (506x713, aspect 0.710) and
//     03-homecoming.jpg (1345x2392, aspect 0.562) are both portrait/
//     single-subject, well under PAN_FILL_ASPECT_THRESHOLD (1.2) -- Pan-Fill
//     auto-resolves both to static cover-fit with the default subtle
//     scale-only drift. Slide 1 additionally requests "minimal drift" per
//     the brief, so it gets an explicit STATIC_MOTION (scaleTo 1.03,
//     matching the NorthAnnaQS/HancocksLineQS/JohnstonShilohQS/
//     SpotsylvaniaBloodyAngleQS convention) instead of Pan-Fill's own
//     1.00->1.05 default.
//   - 02-interview.jpg history: the original crop (520x400, aspect 1.3)
//     cleared PAN_FILL_ASPECT_THRESHOLD (1.2) and Pan-Fill's auto-pan
//     drifted the tight face shot off-frame toward blank wall by the end of
//     the 2a/2b window (confirmed visually) -- fixed at the time by forcing
//     panFillMode='static'. Brad then supplied a corrected, wider source
//     (full original frame, not the tight crop) AND flagged that the
//     cover-fit fix's real problem was the 4.8x upscale a 400px-tall source
//     needed to fill the 1920px canvas height, which cropped Denton's eyes
//     out of frame regardless of pan vs. static. The replacement
//     02-interview.jpg is a pre-composited BLUR-BORDER-FILL asset (matches
//     the SonTayQS/HighwayOfDeathQuickStrike convention: the letterboxing
//     is baked into the JPG itself, not a runtime hasBlurBackground
//     render) -- exactly 1080x1920 (canvas-matched), with the sharp
//     original frame letterboxed at native ~1.75x scale from y~572 to
//     y~1347 (measured via row-gradient sharpness analysis) and blurred/
//     darkened bars filling above/below. Treated here as an ordinary
//     canvas-matched image (STATIC_MOTION push-in only, no pan, no
//     hasBlurBackground flag needed since the blur is already in the
//     pixels) with sharpContentBottomY=1350 passed to CaptionOverlay so the
//     caption never floats up into the sharp band -- same pattern as
//     SonTayQS's own sharpContentBottomY-per-slide values.
//   - safe-zone: no compositions here pass safeZoneBottomY/bottomOffset --
//     every slide uses the module default (SAFE_ZONE_BOTTOM_Y = 1580),
//     per the standing fix.
//   - Music: audio/CIA-Gun-music.mp3 at 0.15 volume, looped -- the
//     recurring RECON/Vietnam-era bed (SonTayQS, TetCitadelQS,
//     McNamaraConfessionQS, Hill875QS all reuse it). No dedicated
//     denton-pow track exists yet; flagged to Brad to swap if he wants a
//     different one.
//
// Fourth pass (layout/behavior fixes, no audio changes):
//   1. Slide 2 caption/headline overlap: sharpContentBottomY's hard-floor
//      branch in CaptionOverlay does NOT self-clamp against the headline's
//      own ceiling the way the no-floor branch does -- per that component's
//      own doc comment, a floor slide that doesn't leave enough room must
//      shrink the HEADLINE (computeFloorAwareHeadlineFit), not move the
//      caption off the floor. That call was missing on slide 2, so the
//      caption box (forced down to the floor) and the headline box (sized
//      at the default 52px) overlapped in the middle of frame. Fixed by
//      computing computeFloorAwareHeadlineFit once for slide 2 (worst-case
//      across both 2a/2b caption arrays) and threading the result to both
//      GoldLowerThird and both CaptionOverlay instances, same pattern as
//      SonTayQS's own SlidePanel. Slides 1/3/4 have no sharpContentBottomY,
//      so their no-floor ceiling math already self-avoids this (confirmed
//      via stills before this fix).
//   2. Caption pacing: captionLines arrays previously held one whole VO
//      sentence per cue, so the full sentence sat on screen for the entire
//      sub-beat instead of advancing with speech. Re-chunked every
//      VO-driven caption (slide 1, 2a, 2b, 3a, 3b) into short 3-5 word
//      phrase cues -- CaptionOverlay already apportions each array entry's
//      on/off frames by its share of the cue's word count (see that
//      component's "STANDARD CONVENTION" doc comment), so this is a
//      data-only change, no engine edit. Brad asked this be checked against
//      the account's actual published Reels; this session has no
//      browser/social-media access to pull those up, so the chunking below
//      matches the explicit 3-5-word/synced-to-audio spec given rather than
//      a direct frame comparison -- flagged for Brad to confirm once
//      rendered, or point at a local reference file if one exists.
//   3. CTA slide layout: replaced the top-pinned-headline / stranded-
//      subtitle-in-empty-space layout with McNamaraConfessionQS's own CTACard
//      pattern (same locked copy: "FOLLOW THE PAGE FOR MORE HISTORY THEY
//      DIDN'T TEACH YOU" / "Like. Save. Share.") -- headline + subline in
//      ONE centered flex column, small fixed gap between them, whole group
//      vertically centered in frame. That's the established no-trigger-word
//      RECON/BLUEGRAY/FRONT end-card look (also used by HancocksLineQS,
//      JohnstonShilohQS, EisenhowerPhotographedEvidenceQS, KerryTestimonyQS,
//      SpotsylvaniaBloodyAngleQS), not a new one introduced here.

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified
// -- see scripts/generateVoiceover-denton-pow.py). Do not estimate/recalculate.
const VO01_S = 3.605;
const VO02A_S = 2.952;
const VO02B_S = 2.273;
const VO03A_S = 5.433;
const VO03B_S = 5.198;
const VO04_S = 2.952;

const STATIC_MOTION = {
  scaleFrom: 1.0,
  scaleTo: 1.03,
  txFrom: 0,
  txTo: 0,
  tyFrom: 0,
  tyTo: 0,
  easing: 'easeInOutCubic' as const,
};

// ---------------------------------------------------------------------------
// Slide 1 -- ordinary SlidePanel, real shared engine.
// ---------------------------------------------------------------------------

const slide1: SharedSlideConfig = {
  id: 'slide1',
  image: 'slides/Denton-POW/01-midshipman.jpg',
  audio: 'audio/denton-pow-vo-01.mp3',
  durationInSeconds: VO01_S + PAD_S,
  audioDurationSeconds: VO01_S,
  // "Pre-capture Denton" tag, confirmed by Brad: Denton graduated in the
  // accelerated Class of 1947 (actual graduation date June 5, 1946, due to
  // wartime schedule compression) -- "Class of 1947" is the unambiguous
  // designation, sidestepping the 1946/1947 date conflict.
  label: 'U.S. NAVAL ACADEMY — CLASS OF 1947',
  overlayText: 'NORTH VIETNAM PUT HIM ON TV TO BREAK HIM',
  // Short 3-5 word phrase cues (not the whole sentence at once) -- see
  // "Caption pacing" note above.
  captionLines: ['North Vietnam put a POW', 'on television to break him.'],
  sourceWidth: 506,
  sourceHeight: 713,
  motion: STATIC_MOTION,
};

const slide1WithFrames = {
  ...slide1,
  durationFrames: Math.round(slide1.durationInSeconds * FPS),
  audioDurationFrames: Math.round(slide1.audioDurationSeconds * FPS),
};

// ---------------------------------------------------------------------------
// Slide 4 -- CTA end card. Layout matches McNamaraConfessionQS's own CTACard
// exactly (same locked copy, same no-trigger-word RECON/BLUEGRAY/FRONT
// convention): headline + subline in ONE centered flex column, not
// GoldLowerThird's gold-box/rule treatment (that's for over-image slides) --
// see the "CTA slide layout" note above.
// ---------------------------------------------------------------------------

const SLIDE4_HEADLINE = "FOLLOW THE PAGE FOR MORE HISTORY THEY DIDN'T TEACH YOU";
const SLIDE4_SUBTITLE = 'Like. Save. Share.';
const SLIDE4_AUDIO_FRAMES = Math.round(VO04_S * FPS);
const SLIDE4_DURATION_FRAMES = Math.round((VO04_S + PAD_S) * FPS);

function Slide4() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const headlineOpacity = interpolate(frame, [4, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sublineOpacity = interpolate(frame, [20, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f14', opacity, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '80%', maxWidth: 900, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <p
          style={{
            opacity: headlineOpacity,
            color: '#F5F0E8',
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1.3,
            textAlign: 'center',
            textShadow: '0 2px 14px rgba(0,0,0,0.95)',
            margin: '0 0 28px',
          }}
        >
          {SLIDE4_HEADLINE}
        </p>
        <p
          style={{
            opacity: sublineOpacity,
            color: GOLD,
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            fontSize: 26,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textAlign: 'center',
            margin: 0,
          }}
        >
          {SLIDE4_SUBTITLE}
        </p>
      </div>
      <Audio src={staticFile('audio/denton-pow-vo-04.mp3')} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// CaptionSwapSlide -- one image, two VO sub-clips (a/b), no hard cut between
// them. Ken Burns motion and the GoldLowerThird headline run off ONE
// continuous frame counter for the whole pair (so the headline reveals once,
// at the pair's frame 0, and never re-triggers); CaptionOverlay + each
// sub-clip's <Audio> live in their own nested Sequence so their timing (and
// caption text) is scoped to that sub-clip's own audio, same pattern as
// DunkirkHaltOrderQS's hand-built Slide4.
// ---------------------------------------------------------------------------

function CaptionSwapSlide({
  image,
  sourceWidth,
  sourceHeight,
  motion,
  panFillMode,
  label,
  overlayText,
  sharpContentBottomY,
  aAudio,
  aAudioFrames,
  aCaptionLines,
  bAudio,
  bAudioFrames,
  bCaptionLines,
  totalDurationFrames,
}: {
  image: string;
  sourceWidth: number;
  sourceHeight: number;
  motion?: typeof STATIC_MOTION;
  /** Forces Pan-Fill's category regardless of the image's real aspect ratio.
   * Needed because an explicit `motion` alone does NOT override Pan-Fill's
   * own 'pan' resolution (KenBurnsImage only consults `motion` on its
   * 'static' render path). */
  panFillMode?: 'auto' | 'pan' | 'static';
  label?: string;
  overlayText: string;
  /** For pre-composited blur-border-fill images only (see slide 2's own
   * comment above) -- the real y-coordinate where the sharp, non-blurred
   * letterboxed content ends. Passed through to both sub-beats' own
   * CaptionOverlay as a hard floor, same as SonTayQS's per-slide values. */
  sharpContentBottomY?: number;
  aAudio: string;
  aAudioFrames: number;
  aCaptionLines: string[];
  bAudio: string;
  bAudioFrames: number;
  bCaptionLines: string[];
  totalDurationFrames: number;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Only relevant when sharpContentBottomY is set (slide 2) -- shrinks the
  // headline instead of letting the caption's hard floor collide with it.
  // Computed once, off the WORST-CASE across both sub-beats' caption arrays
  // (not per sub-beat), so the headline is a fixed size for the whole pair
  // and never resizes at the a/b boundary. No-op (returns the defaults) when
  // sharpContentBottomY is undefined, so slide 3 is unaffected.
  const { fontSize: headlineFontSize, lineHeight: headlineLineHeight } = useMemo(
    () =>
      sharpContentBottomY !== undefined
        ? computeFloorAwareHeadlineFit({
            overlayText,
            captionLines: [...aCaptionLines, ...bCaptionLines],
            sharpContentBottomY,
          })
        : { fontSize: undefined, lineHeight: undefined },
    [overlayText, aCaptionLines, bCaptionLines, sharpContentBottomY],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <KenBurnsImage
        image={image}
        frame={frame}
        durationFrames={totalDurationFrames}
        motion={motion}
        sourceWidth={sourceWidth}
        sourceHeight={sourceHeight}
        panFillMode={panFillMode}
      />
      <Vignette />

      {label && <ContextTag text={label} position="top-left" />}

      {/* Continuous frame counter -- reveals once at the pair's frame 0,
          never resets/re-triggers at the a/b boundary. */}
      <GoldLowerThird text={overlayText} frame={frame} fontSize={headlineFontSize} lineHeight={headlineLineHeight} />

      <Sequence from={0} durationInFrames={aAudioFrames} layout="none">
        <CaptionOverlay
          lines={aCaptionLines}
          audioDurationFrames={aAudioFrames}
          overlayText={overlayText}
          sharpContentBottomY={sharpContentBottomY}
          headlineFontSize={headlineFontSize}
          headlineLineHeight={headlineLineHeight}
        />
        <Audio src={staticFile(aAudio)} />
      </Sequence>

      <Sequence from={aAudioFrames} durationInFrames={totalDurationFrames - aAudioFrames} layout="none">
        <CaptionOverlay
          lines={bCaptionLines}
          audioDurationFrames={bAudioFrames}
          overlayText={overlayText}
          sharpContentBottomY={sharpContentBottomY}
          headlineFontSize={headlineFontSize}
          headlineLineHeight={headlineLineHeight}
        />
        <Audio src={staticFile(bAudio)} />
      </Sequence>
    </AbsoluteFill>
  );
}

// Slide 2 -- 02-interview.jpg, sub-beats 2a/2b. Combined duration = 2a audio
// + 2b audio + 0.4s pad (pad only once, at the end of 2b).
const SLIDE2_A_FRAMES = Math.round(VO02A_S * FPS);
const SLIDE2_B_FRAMES = Math.round(VO02B_S * FPS);
const SLIDE2_TOTAL_FRAMES = Math.round((VO02A_S + VO02B_S + PAD_S) * FPS);

// Slide 3 -- 03-homecoming.jpg, sub-beats 3a/3b. Same structure.
const SLIDE3_A_FRAMES = Math.round(VO03A_S * FPS);
const SLIDE3_B_FRAMES = Math.round(VO03B_S * FPS);
const SLIDE3_TOTAL_FRAMES = Math.round((VO03A_S + VO03B_S + PAD_S) * FPS);

// ---------------------------------------------------------------------------
// Slide sequencing
// ---------------------------------------------------------------------------

const slide1From = 0;
const slide2From = slide1From + slide1WithFrames.durationFrames;
const slide3From = slide2From + SLIDE2_TOTAL_FRAMES;
const slide4From = slide3From + SLIDE3_TOTAL_FRAMES;

export const totalDuration = slide4From + SLIDE4_DURATION_FRAMES;
export { FPS };

export default function DentonPOWQuickStrike() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/CIA-Gun-music.mp3')} volume={0.15} loop />

      <Sequence from={slide1From} durationInFrames={slide1WithFrames.durationFrames} layout="none">
        <SlidePanel slide={slide1WithFrames} isFirst />
      </Sequence>

      <Sequence from={slide2From} durationInFrames={SLIDE2_TOTAL_FRAMES} layout="none">
        <CaptionSwapSlide
          image="slides/Denton-POW/02-interview.jpg"
          sourceWidth={1080}
          sourceHeight={1920}
          motion={STATIC_MOTION}
          panFillMode="static"
          overlayText="HIS EYES SPELLED TORTURE IN MORSE CODE"
          sharpContentBottomY={1350}
          aAudio="audio/denton-pow-vo-02a.mp3"
          aAudioFrames={SLIDE2_A_FRAMES}
          aCaptionLines={['His eyes blinked out', 'the word TORTURE', 'in Morse code.']}
          bAudio="audio/denton-pow-vo-02b.mp3"
          bAudioFrames={SLIDE2_B_FRAMES}
          bCaptionLines={['His mouth said', 'he supported his government.']}
          totalDurationFrames={SLIDE2_TOTAL_FRAMES}
        />
      </Sequence>

      <Sequence from={slide3From} durationInFrames={SLIDE3_TOTAL_FRAMES} layout="none">
        <CaptionSwapSlide
          image="slides/Denton-POW/03-homecoming.jpg"
          sourceWidth={1345}
          sourceHeight={2392}
          motion={STATIC_MOTION}
          overlayText="IT WAS THE FIRST PROOF U.S. NAVAL INTELLIGENCE HAD"
          aAudio="audio/denton-pow-vo-03a.mp3"
          aAudioFrames={SLIDE3_A_FRAMES}
          aCaptionLines={['It was the first confirmation', 'U.S. Naval Intelligence had', 'of POW torture.']}
          bAudio="audio/denton-pow-vo-03b.mp3"
          bAudioFrames={SLIDE3_B_FRAMES}
          bCaptionLines={['He paid for it', 'with more torture,', 'then walked off a plane', 'a free man', 'almost eight years later.']}
          totalDurationFrames={SLIDE3_TOTAL_FRAMES}
        />
      </Sequence>

      <Sequence from={slide4From} durationInFrames={SLIDE4_DURATION_FRAMES} layout="none">
        <Slide4 />
      </Sequence>
    </AbsoluteFill>
  );
}
