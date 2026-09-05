import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  GOLD,
  SlidePanel,
  CaptionOverlay,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';

// North Anna — BLUEGRAY-family Civil War Quick Strike. Six slides, no
// separate end card: slide 6 IS the CTA (an ordinary image slide with its
// own overlay), per the same "ordinary slide as closer" pattern
// ThomasChickamaugaQS.tsx uses instead of the standalone black EndCardCTA
// card. No "Comment BLUEGRAY" trigger-word line — not part of this
// composition's locked script, so none was invented.
//
// Locked decisions from the build brief:
//   - True cold open: slide 1 fully visible at full brightness from frame 0,
//     no fade-in. 4-frame hard cut on every slide after that. No fade to
//     black anywhere, including the ending (hard cut on the last frame).
//   - Per-slide audio only (one <Audio> per Sequence via each slide's own
//     local frame 0) — never a concatenated track.
//   - Timing is LOCKED from public/audio/north-anna/timing.json (ffprobe-
//     measured VO + the standard 0.4s pad). Not recalculated here — see
//     SLIDE*_AUDIO_S below, one constant per slide, each commented with the
//     timing.json field it was copied from.
//   - Folder casing mismatch, both used as-is (confirmed on disk): images
//     live under public/slides/North-Anna/ (capitalized), audio under
//     public/audio/north-anna/ (lowercase).
//   - REVISED (per Brad's correction — this build had drifted from the
//     established engine): image slides 1, 3, 4, 6 use the REAL
//     QuickStrikeShared engine, same as every other QuickStrike in the
//     codebase — SlidePanel, which wires up GoldLowerThird (short ALL-CAPS
//     headline in the gold-rule box) + CaptionOverlay (burned-in captions,
//     VO-synced, verbatim to the actual spoken audio, phrase-chunked per the
//     "STANDARD CONVENTION (Aug 2026)" comment in QuickStrikeShared.tsx). An
//     earlier version of this file used a custom TwoBeatOverlay with
//     on-screen text that didn't match the locked VO, so there were no real
//     closed captions and no real GoldLowerThird — reverted; overlayText/
//     captionLines below are written from the actual audio, not paraphrased
//     text that diverges from what's spoken.
//   - Text-card slides (2, 5): QuoteCardPanel — flat navy card, no image, no
//     Pan-Fill. Slide 5's 4-stage internal reveal (quote+attribution, then
//     officer list, then a pause, then the closer line) extends the same
//     2-stage interpolate()-on-one-frame-counter technique already used
//     elsewhere (e.g. SpotsylvaniaBloodyAngleQS's EndCard) out to 4 stages —
//     approved before building. Also carries the REAL shared CaptionOverlay
//     (per Brad's follow-up: muted viewers need closed captions on the text
//     cards too) — separate from the card's own quote/officer-list/closer
//     display copy, which is paraphrased and doesn't match the spoken audio
//     word-for-word. captionLines on these two slides are verbatim,
//     phrase-chunked substrings of the actual VO (same convention as the
//     image slides), timed to audioDurationFrames.
//   - Pan-Fill: all six source images are portrait, aspect 0.562 (checked via
//     PIL), well under PAN_FILL_ASPECT_THRESHOLD (1.2) — every image slide
//     resolves to a static cover-fit regardless of requested category, so
//     slide 4's requested "PAN, tight document crop" and slides 1/3/6's
//     requested "FILL" land on the same treatment. Matches
//     HancocksLineQS/JohnstonShilohQS/SpotsylvaniaBloodyAngleQS's choice of
//     a hand-picked scaleTo 1.03 push-in (STATIC_MOTION below) over the
//     Pan-Fill System's own default 1.05 static drift, for "minimal drift".
//   - Music: no dedicated north-anna track exists yet. Reused
//     lee-resignation-music.mp3 at 0.15 volume, looped — the same choice
//     SpotsylvaniaBloodyAngleQS.tsx (the most recent BLUEGRAY sibling, same
//     Overland Campaign) made. Flagged to Brad to swap if he wants a
//     different bed.

// Every constant below is copied verbatim from
// public/audio/north-anna/timing.json — do not recalculate.
const SLIDE1_AUDIO_S = 4.937;
const SLIDE1_DURATION_S = 5.337;
const SLIDE2_AUDIO_S = 5.146;
const SLIDE2_DURATION_S = 5.546;
const SLIDE3_AUDIO_S = 5.172;
const SLIDE3_DURATION_S = 5.572;
const SLIDE4_AUDIO_S = 5.146;
const SLIDE4_DURATION_S = 5.546;
const SLIDE5_AUDIO_S = 5.46;
const SLIDE5_DURATION_S = 5.86;
const SLIDE6_AUDIO_S = 6.426;
const SLIDE6_DURATION_S = 6.826;

const NAVY = '#1a2332';
const CREAM = '#F5F0E8';
const MUTED = 'rgba(245,240,232,0.55)';

// Static cover-fit with minimal push-in — used on every image slide (see
// Pan-Fill note above). Matches the sibling BLUEGRAY files' choice of
// scaleTo 1.03 over Pan-Fill's own default 1.05.
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
// Image slides (1, 3, 4, 6) — real SlidePanel from QuickStrikeShared.
// overlayText is a short ALL-CAPS headline (GoldLowerThird); captionLines
// are verbatim substrings of the actual VO audio, split into 2-3 natural
// phrase chunks per the shared engine's own documented convention.
// ---------------------------------------------------------------------------

const IMAGE_SLIDES: SharedSlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/North-Anna/01-hook-lee.jpg',
    audio: 'audio/north-anna/01-north-anna.mp3',
    durationInSeconds: SLIDE1_DURATION_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    overlayText: 'THE BEST TRAP OF HIS CAREER',
    captionLines: ['Lee built the best trap of his career at North Anna.', "Then he couldn't leave his cot to use it."],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide3',
    image: 'slides/North-Anna/03-hancock-redoubt.jpg',
    audio: 'audio/north-anna/03-north-anna.mp3',
    durationInSeconds: SLIDE3_DURATION_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    overlayText: 'A REDOUBT FALLS IN MINUTES',
    captionLines: ['Hancock takes a redoubt in minutes.', "Hill's attack breaks the Iron Brigade, then collapses."],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide4',
    image: 'slides/North-Anna/04-trap-map-oxford.jpg',
    audio: 'audio/north-anna/04-north-anna.mp3',
    durationInSeconds: SLIDE4_DURATION_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    overlayText: 'AN INVERTED V SPLITS THE ARMY',
    captionLines: ['That night, Lee lays out a trap shaped like an inverted V,', "splitting Grant's army in three."],
    motion: STATIC_MOTION,
  },
  {
    id: 'slide6',
    image: 'slides/North-Anna/06-cta-grant.jpg',
    audio: 'audio/north-anna/06-north-anna.mp3',
    durationInSeconds: SLIDE6_DURATION_S,
    audioDurationSeconds: SLIDE6_AUDIO_S,
    overlayText: 'GRANT ESCAPES THE TRAP',
    captionLines: ['Grant recognizes the trap, pulls out by May 26,', 'and turns toward Cold Harbor.', 'Follow for more.'],
    motion: STATIC_MOTION,
  },
];

const imageSlidesWithFrames = IMAGE_SLIDES.reduce<Record<string, SharedSlideConfig & { durationFrames: number; audioDurationFrames: number }>>(
  (acc, s) => {
    acc[s.id] = {
      ...s,
      durationFrames: Math.round(s.durationInSeconds * FPS),
      audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
    };
    return acc;
  },
  {},
);

// ---------------------------------------------------------------------------
// QuoteCardPanel — flat navy text card (no image, no Pan-Fill), used by
// slides 2 and 5. Slide 2 passes only `quote` + `attributionLines` and gets
// a single-stage reveal (same one-shot rule-draw/text-fade convention as
// GoldLowerThird elsewhere). Slide 5 additionally passes `officerLine` +
// `closerLine`, which turns on the 4-stage sequencing approved for that
// slide: (1) quote + attribution, (2) officer list, (3) a beat pause with no
// new reveal, (4) the divider dot + closer line, fading in last and holding
// to the hard cut. Same technique as the 2-stage reveals already in the
// codebase (plain interpolate() calls on the shared frame counter), just
// carried out to a 4th stage.
// ---------------------------------------------------------------------------

function hardCutOpacity(frame: number, isFirst: boolean) {
  return isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
}

function QuoteCardPanel({
  quote,
  attributionLines,
  officerLine,
  closerLine,
  audio,
  captionLines,
  audioDurationFrames,
  isFirst,
}: {
  quote: string;
  attributionLines: string[];
  officerLine?: string;
  closerLine?: string;
  audio: string;
  // Verbatim, phrase-chunked spoken VO — burned in via the real shared
  // CaptionOverlay so the card is followable muted, same as every image
  // slide. Distinct from `quote`/`officerLine`/`closerLine` above, which are
  // the card's own display copy and don't match the audio word-for-word.
  captionLines: string[];
  audioDurationFrames: number;
  isFirst: boolean;
}) {
  const frame = useCurrentFrame();
  const opacity = hardCutOpacity(frame, isFirst);

  // Stage 1 — quote + attribution + its two flanking rules. Same
  // delayFrames=8 / 25-frame rule / 18-frame text convention as
  // GoldLowerThird's own reveal.
  const ruleWidth = interpolate(frame, [8, 33], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const quoteOpacity = interpolate(frame, [8, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Stage 2 — officer list (slide 5 only). Starts once stage 1 has had a
  // beat to be read.
  const listOpacity = interpolate(frame, [55, 73], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Stage 3 — a deliberate pause: 73 -> 108 (35 frames, ~1.17s) with no new
  // reveal, then the divider dot + closer line fade in together and hold to
  // the hard cut.
  const closerOpacity = interpolate(frame, [108, 128], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: NAVY,
        opacity,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        padding: '0 90px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            height: 3,
            width: `${ruleWidth}%`,
            backgroundColor: GOLD,
            marginBottom: 28,
          }}
        />
        <p
          style={{
            opacity: quoteOpacity,
            color: CREAM,
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            fontSize: 46,
            fontWeight: 400,
            lineHeight: 1.35,
            textAlign: 'center',
            margin: '0 0 24px',
          }}
        >
          &ldquo;{quote}&rdquo;
        </p>
        <div
          style={{
            height: 3,
            width: `${ruleWidth}%`,
            backgroundColor: GOLD,
            marginBottom: 28,
          }}
        />
        <div style={{ opacity: quoteOpacity, marginBottom: officerLine ? 36 : 0 }}>
          {attributionLines.map((line, i) => (
            <p
              key={i}
              style={{
                color: MUTED,
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 20,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                textAlign: 'center',
                margin: i === 0 ? 0 : '6px 0 0',
              }}
            >
              {line}
            </p>
          ))}
        </div>

        {officerLine && (
          <p
            style={{
              opacity: listOpacity,
              color: CREAM,
              fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
              fontSize: 30,
              lineHeight: 1.4,
              textAlign: 'center',
              margin: '0 0 32px',
            }}
          >
            {officerLine}
          </p>
        )}

        {closerLine && (
          <div style={{ opacity: closerOpacity, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: GOLD,
                marginBottom: 24,
              }}
            />
            <p
              style={{
                color: GOLD,
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.4,
                textAlign: 'center',
                margin: 0,
              }}
            >
              {closerLine}
            </p>
          </div>
        )}
      </div>

      <CaptionOverlay lines={captionLines} audioDurationFrames={audioDurationFrames} />

      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Slide sequencing
// ---------------------------------------------------------------------------

const slide1Frames = imageSlidesWithFrames.slide1.durationFrames;
const slide2Frames = Math.round(SLIDE2_DURATION_S * FPS);
const slide3Frames = imageSlidesWithFrames.slide3.durationFrames;
const slide4Frames = imageSlidesWithFrames.slide4.durationFrames;
const slide5Frames = Math.round(SLIDE5_DURATION_S * FPS);
const slide6Frames = imageSlidesWithFrames.slide6.durationFrames;

const slide1From = 0;
const slide2From = slide1From + slide1Frames;
const slide3From = slide2From + slide2Frames;
const slide4From = slide3From + slide3Frames;
const slide5From = slide4From + slide4Frames;
const slide6From = slide5From + slide5Frames;

export const totalDuration = slide6From + slide6Frames;
export { FPS };

export default function NorthAnnaQS() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/lee-resignation-music.mp3')} volume={0.15} loop />

      <Sequence from={slide1From} durationInFrames={slide1Frames} layout="none">
        <SlidePanel slide={imageSlidesWithFrames.slide1} isFirst />
      </Sequence>

      <Sequence from={slide2From} durationInFrames={slide2Frames} layout="none">
        <QuoteCardPanel
          quote="This is nothing but a feint."
          attributionLines={['Robert E. Lee, May 23, 1864']}
          audio="audio/north-anna/02-north-anna.mp3"
          captionLines={['Too sick to ride, Lee sees the movement upstream', 'and calls it a feint.', "Hill doesn't move."]}
          audioDurationFrames={Math.round(SLIDE2_AUDIO_S * FPS)}
          isFirst={false}
        />
      </Sequence>

      <Sequence from={slide3From} durationInFrames={slide3Frames} layout="none">
        <SlidePanel slide={imageSlidesWithFrames.slide3} isFirst={false} />
      </Sequence>

      <Sequence from={slide4From} durationInFrames={slide4Frames} layout="none">
        <SlidePanel slide={imageSlidesWithFrames.slide4} isFirst={false} />
      </Sequence>

      <Sequence from={slide5From} durationInFrames={slide5Frames} layout="none">
        <QuoteCardPanel
          quote="We must strike them a blow."
          attributionLines={['Robert E. Lee', 'as recalled by aide Charles Venable']}
          officerLine="Jackson dead. Longstreet wounded. Ewell sick. Hill just failed. Anderson too new to corps command."
          closerLine="His illness didn't decide the battle. It cost him the moment only he could seize."
          audio="audio/north-anna/05-north-anna.mp3"
          captionLines={["By afternoon, Lee can't leave his tent.", 'His aide remembers the words:', 'we must strike them a blow.']}
          audioDurationFrames={Math.round(SLIDE5_AUDIO_S * FPS)}
          isFirst={false}
        />
      </Sequence>

      <Sequence from={slide6From} durationInFrames={slide6Frames} layout="none">
        <SlidePanel slide={imageSlidesWithFrames.slide6} isFirst={false} />
      </Sequence>
    </AbsoluteFill>
  );
}
