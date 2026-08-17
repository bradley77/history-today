import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  GOLD,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// Kerry Testimony — RECON Quick Strike (Vietnam).
//
// Locked decisions from the build brief:
//   - No fades anywhere: true cold open at frame 0 (SlidePanel's isFirst
//     prop), 4-frame hard cut on every slide after that.
//   - End card is a deliberate NO-CTA, no-voiceover test against Facebook
//     distribution: black background, hard cut in, no fade out, on-screen
//     text only ("Follow the page..." / "Like. Save. Share."), no trigger
//     word, no EndCardCTA. See EndCard below.
//   - Per-slide audio only (one <Audio> per Sequence, own local frame 0) —
//     no continuous/concatenated VO track. The one continuous <Audio> is
//     background music (hiss-music.mp3, volume 0.15, looped).
const PAD_S = 0.4;

// Actual measured VO durations (Kokoro am_adam/0.95/en-us, ffprobe-verified —
// see scripts/generateVoiceover-kerry-testimony.py). Slide 1 reflects the
// respelled "At twenty-seven, Kerry..." line (regenerated in place after the
// original "twenty-seven-year-old veteran" phrasing ran long, ~5.78s vs.
// ~4.37s here); slide 2-3 are unchanged from the first generation pass.
// Slide 4 was regenerated with a phoneme-injection fix for "testimony"
// (Kokoro/espeak natively reduces it to tˈɛstᵻməni, TES-tuh-muh-nee;
// corrected to tˈɛstɪmˌoʊni, TES-tih-MOH-nee — see
// generateVoiceover-kerry-testimony.py's PHONEME_SUBSTITUTIONS). That
// candidate has NOT been confirmed by ear (no audio playback/STT tooling in
// this environment) — Brad still needs to listen and confirm.
const SLIDE1_AUDIO_S = 4.373;
const SLIDE2_AUDIO_S = 6.613;
const SLIDE3_AUDIO_S = 4.459;
const SLIDE4_AUDIO_S = 4.989;

type SlideConfig = SharedSlideConfig & {
  sourceWidth: number;
  sourceHeight: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Kerry-Testimony/01-kerry-microphones.jpg',
    audio: 'audio/kerry-testimony-vo-01.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    overlayText: 'APRIL 1971',
    // Caption uses the numeral form of the spoken "twenty-seven" — audio
    // stays spelled out for TTS (generateVoiceover-kerry-testimony.py),
    // on-screen text uses the numeral, per the standing numbers-as-words
    // rule (spell out for TTS, numeral on screen). Word count matches the
    // spoken line exactly ("twenty-seven" / "27" are each one token), so
    // CaptionOverlay's word-count-proportional cue timing isn't skewed.
    captionLines: ['At 27, Kerry testified against the war.', 'The White House fought back.'],
    label: 'JOHN KERRY, VVAW SPOKESMAN',
    // 1080x1920 native, aspect 0.562 — below PAN_FILL_ASPECT_THRESHOLD (1.2),
    // Pan-Fill resolves 'static' automatically (default 1.0->1.05 push-in).
    sourceWidth: 1080,
    sourceHeight: 1920,
  },
  {
    id: 'slide2',
    image: 'slides/Kerry-Testimony/02-colson.jpg',
    audio: 'audio/kerry-testimony-vo-02.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    overlayText: 'THE COUNTER-CAMPAIGN',
    captionLines: [
      "Nixon's White House counsel put it in writing:",
      'destroy this young demagogue before he becomes another Ralph Nader.',
    ],
    label: 'CHARLES COLSON, WHITE HOUSE COUNSEL',
    // 1080x1920 native — same static treatment as slide 1.
    sourceWidth: 1080,
    sourceHeight: 1920,
  },
  {
    id: 'slide3',
    image: 'slides/Kerry-Testimony/03-nixon-portrait.jpg',
    audio: 'audio/kerry-testimony-vo-03.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    overlayText: 'JUNE 16, 1971',
    captionLines: ['Two months later,', 'the president personally met a rival veteran in the Oval Office.'],
    label: 'PRESIDENT RICHARD NIXON',
    // 1080x1920 native — same static treatment as slides 1-2.
    sourceWidth: 1080,
    sourceHeight: 1920,
  },
  {
    id: 'slide4',
    image: 'slides/Kerry-Testimony/04-capitol-mall-PAN.jpg',
    audio: 'audio/kerry-testimony-vo-04.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    overlayText: 'ON THE RECORD',
    captionLines: ['The testimony is in the Congressional Record.', "So is the memo Nixon's counsel wrote."],
    // No label — per brief, no context tag on this slide.
    //
    // 5596x1920 — height already matches CANVAS_HEIGHT, so base_scale =
    // 1920/1920 = 1.0 (native size, no zoom), rendered_w = 5596*1.0 = 5596,
    // pan_room = 5596-1080 = 4516px. That matches the brief's stated "pan
    // room 4516px" exactly; the brief's separately quoted "base_scale 0.625"
    // does not reconcile with a 4516px pan room for a 5596px-wide source
    // (0.625 implies pan_room ~2418px instead) — flagged to Brad, proceeding
    // on the pan-room figure since it's the one that checks out against both
    // the shared Pan-Fill formula and this image's real, verified dimensions
    // (confirmed via PIL: 5596x1920 exactly).
    //
    // At this slide's 160-frame (5.333s) duration, Pan-Fill's speed cap
    // (MAX_PAN_SPEED_PX_PER_SEC=100) limits the actual sweep to ~533px total
    // (~266.7px each side of center) — well under the "conservative, under
    // the full 88%/3974px room" instruction (the uncapped 87.5%-of-room sweep
    // would be 3951.5px total; this comes in around 13.5% of that). The pan
    // is symmetric about the image's true center, and the Capitol dome +
    // front steps sit dead-center in this photo (confirmed by viewing it —
    // the repetitive colonnade wings are what's out at the far left/right
    // edges), so a small centered sweep already IS the bias toward the
    // dome-and-steps the brief asked for, with no manual off-center motion
    // needed.
    //
    // Locked Ken Burns rule (pan >30px requires scale>=1.08): Pan-Fill's pan
    // mode holds scale fixed at baseScale and only translates within the
    // real overflow computed from this exact image's pixels, so it can
    // structurally never reveal the source's raw edge no matter how far it
    // pans — the same invariant the manual-motion scale rule protects by
    // hand is satisfied by construction here, same as documented in
    // AntietamQS.tsx. No additional scale needed despite the ~533px sweep
    // exceeding the old 30px manual-motion threshold.
    sourceWidth: 5596,
    sourceHeight: 1920,
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);

// ---------------------------------------------------------------------------
// End card — NO voiceover, by design (this video is testing a no-CTA hard-cut
// ending against Facebook distribution). Black background, hard cut in (same
// HARD_CUT_FRAMES=4 transition every other slide uses), constant opacity 1
// for the rest — no fade out, ever. Text has its own quick local reveal
// (opacity 0->1 over a few frames), matching every other end card's headline/
// subline reveal in this codebase — that's a text entrance, not a slide-level
// fade, so it doesn't violate the "no fade" rule.
//
// Duration has no VO to time against. 60 frames (2.0s @ 30fps) — Brad's note
// that 40 frames (1.33s) was flashing by too fast, ~0.5-1s more requested.
// History: originally 90 frames (3.0s), sized off TrumanMillionVerdict's
// silent end-card precedent (75 frames / 2.5s, single line) with a
// half-second added for the extra line here; cut to 40 frames in a prior
// revision, now restored partway to 60.
// ---------------------------------------------------------------------------
const END_CARD_FRAMES = 60;

function EndCard() {
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
    <AbsoluteFill style={{ backgroundColor: '#000', opacity, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '80%', maxWidth: 900, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <p
          style={{
            opacity: headlineOpacity,
            color: '#F5F0E8',
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.3,
            textAlign: 'center',
            textShadow: '0 2px 14px rgba(0,0,0,0.95)',
            margin: '0 0 28px',
          }}
        >
          Follow the page for more history they didn't teach you.
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
          Like. Save. Share.
        </p>
      </div>
    </AbsoluteFill>
  );
}

export const totalDuration = slidesDuration + END_CARD_FRAMES;
export { FPS };

export default function KerryTestimonyQS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });
  const endCardFrom = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/hiss-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <SlidePanel slide={slide} isFirst={i === 0} />
        </Sequence>
      ))}

      <Sequence from={endCardFrom} durationInFrames={END_CARD_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
