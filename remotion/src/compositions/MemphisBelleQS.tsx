import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FPS, OSWALD_URL, HARD_CUT_FRAMES, GOLD, Vignette, ContextTag, CaptionOverlay } from '../shared/QuickStrikeShared';

// Memphis Belle — FRONT-family WWII Quick Strike. 5 video slides (National
// Archives Memphis Belle outtakes, Reel 17 / NAID 65930) plus the standard
// silent CTA end card, built on the QuickStrikeShared engine's primitives
// (Vignette/ContextTag/GoldLowerThird) but with a LOCAL multi-clip video
// panel (see MultiClipVideoPanel below) — QuickStrikeShared has no video
// slide component of its own (locked/consume-only, same situation
// DoolittleRaidQS/IaDrangValleyQS were in), and this composition additionally
// needs MULTIPLE clips back-to-back within a single slide, which no existing
// video composition does (Doolittle/IaDrang are one-clip-per-slide).
//
// Locked decisions from the build brief:
//   - Voice: the cloned Chatterbox narrator (base ChatterboxTTS, am_michael
//     reference clip, exaggeration=0.4, cfg_weight=0.5, temperature=0.75,
//     seed=301 — see out/voice-auditions/scorecard.md and
//     make_voiceover_narrator.py). NOT Kokoro, NOT the despotism-ref voice
//     grant-butcher uses.
//   - Script/audio: 7 sentences (make_voiceover_narrator.py's SENTENCES),
//     synthesized once to out/sentences/01.wav..07.wav — NOT re-rendered for
//     this composition. Grouped into 5 SLIDES exactly per Brad's mapping:
//     [1], [2], [3], [4+5+6], [7]. Each slide's mp3
//     (audio/memphis-belle-qs-vo-0{1..5}.mp3) is those sentence wavs
//     concatenated sample-accurate with a 6000-sample (0.25s @ 24kHz) pause
//     between sentences and after the slide's last sentence, EXCEPT slide 5,
//     which gets a 9600-sample (0.4s) tail instead — the same pause
//     convention make_voiceover_narrator.py uses for the full-VO take, just
//     re-grouped into 5 files instead of 1. Converted to mp3 with the same
//     bundled ffmpeg every generateVoiceover-*.py script uses.
//     CAVEAT: LAME mp3 encoding adds a fixed ~30-50ms encoder priming/padding
//     artifact (confirmed by isolated test — every mp3 this ffmpeg produces
//     ffprobes measurably longer than its source wav; NOT fixable with -t,
//     which only caps encoded source duration, not the format's inherent
//     encoder/decoder delay). So each slide's mp3 file, probed alone, reads
//     ~1-1.5 frames longer than the slide's VIDEO-driven duration below.
//     Harmless in practice: durationInFrames on each slide's Sequence comes
//     from the VIDEO track (see next point), and Remotion clips the nested
//     <Audio> to that Sequence boundary regardless of the mp3's own probed
//     length — flagged here rather than silently ignored, per Brad's ask.
//   - Timing is VIDEO-locked, not audio-locked (the reverse of every other
//     composition on this engine, which locks to VO+pad). Brad supplied the
//     clips already cut to exact native frame counts that sum, per slide,
//     to the same totals the audio grouping above produces (131 / 133 / 69 /
//     343 / 129 — verified via ffprobe against the actual files in
//     public/videos/memphis_belle/ before writing this file: nb_frames
//     131/79/54/69/85/258/42/42/45, all exact matches). SLIDE_DURATIONS
//     below is that video-side total, used for every Sequence's
//     durationInFrames — NOT recomputed from audio.
//   - Clips play at native length — no playbackRate stretching (unlike
//     Doolittle's video slides), per explicit instruction. 05-tally-freeze.mp4
//     and 06-tally-pan.mp4 are back-to-back with a zero-frame gap; both clips
//     already carry their own held-last-frame padding baked in (06 holds its
//     final frame for its last 24 frames) — no cross-fade or code-level
//     sync trick needed, the files themselves already join cleanly frame 85
//     -> frame 86 (slide-local).
//   - Framing: clips are 1440x1080 (4:3 landscape) on this composition's
//     1080x1920 vertical canvas — the same non-matching-aspect-ratio
//     situation Doolittle/IaDrang solved with a blur-border-fill treatment
//     (dimmed+blurred cover-fit copy behind a width:100%/height:auto
//     fit-to-width foreground copy of the same clip). Ported here as
//     MultiClipVideoPanel/ClipLayer below (QuickStrikeShared has no shared
//     video component to import, same situation those two files were in —
//     duplicated locally, not a new shared-engine change). Fit-to-WIDTH
//     (never crop the sides) is a hard requirement for 05/06 specifically —
//     the full bomb-tally row must stay on screen for the "twenty-four
//     bombs" line to be true on screen; width:100%/height:auto guarantees
//     that by construction (nothing above/below is ever cropped, only
//     letterboxed by the blurred background).
//   - Text: (1) slide 3 ContextTag "Memphis Belle"; (2) slide 5 plain-text
//     "Other B-17s from the same reel" caption (GoldLowerThird removed);
//     plus burned-in CaptionOverlay phrase cues (written forms).
//   - Music: TokyoFirebombing-music.mp3, looped, full duration, at MUSIC_VOLUME;
//     voice at VOICE_VOLUME (both matched to Hancock's Line / Khe Sanh levels,
//     see the constants). No sound effects.
//   - PAUSE TIGHTENING: slide mp3s 1, 3 and 4 were rebuilt from tight sentence
//     WAVs (out/sentences-tight/; originals kept in out/sentences-tight/
//     orig-slide-mp3/) and slide durations shortened by trimming each slide's
//     LAST clip tail (trimAfter) so every boundary has ~0.29-0.31 s true
//     silence. Slide frame counts 131/133/69/343/129 -> 125/128/61/333/124;
//     the 05/06 join is untouched.
//   - End card: KheSanhQuickStrike's TALLY24 keyword card (see EndCard), 132
//     frames, music continues under it, no VO.
// Same length as KheSanhQuickStrike's keyword end card (4.411 s -> 132 frames).
const END_CARD_FRAMES = 132;

// Slide 5 text positions (px from top). Captions (CaptionOverlay defaults)
// occupy roughly y 1440-1580; caption text sits above that.
const SLIDE5_CAPTION_TOP = 1290;

// Levels matched to Hancock's Line / Khe Sanh (voice-only -18.7 LUFS): voice
// +3.7 dB over unity (the +4.5 dB voice match was backed off so the mix's true
// peak stays <= -2 dBFS), music bed 0.15 -> 0.16. Audio-only render of the mix:
// see report (about -18.9 LUFS).
const VOICE_VOLUME = 1.53;
const MUSIC_VOLUME = 0.16;



// trimAfter: source frames played (tail trimmed); durationFrames is the Sequence
// length and always equals trimAfter when set.
type ClipRef = { video: string; durationFrames: number; trimAfter?: number };

type SlideConfig = {
  id: string;
  clips: ClipRef[];
  audio: string;
  durationFrames: number;
};

// Video-driven durations (see file header) — NOT derived from audio.
const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    clips: [{ video: 'videos/memphis_belle/01-chaplain.mp4', durationFrames: 125, trimAfter: 125 }],
    audio: 'audio/memphis-belle-qs-vo-01.mp3',
    durationFrames: 125,
  },
  {
    id: 'slide2',
    clips: [
      { video: 'videos/memphis_belle/02-formation.mp4', durationFrames: 79 },
      { video: 'videos/memphis_belle/03-landing.mp4', durationFrames: 49, trimAfter: 49 },
    ],
    audio: 'audio/memphis-belle-qs-vo-02.mp3',
    durationFrames: 128,
  },
  {
    id: 'slide3',
    clips: [{ video: 'videos/memphis_belle/04-belle-parked.mp4', durationFrames: 61, trimAfter: 61 }],
    audio: 'audio/memphis-belle-qs-vo-03.mp3',
    durationFrames: 61,
  },
  {
    id: 'slide4',
    clips: [
      { video: 'videos/memphis_belle/05-tally-freeze.mp4', durationFrames: 85 },
      // Last 24 frames are a held last frame, baked into the source file —
      // intended, not a bug (see file header).
      { video: 'videos/memphis_belle/06-tally-pan.mp4', durationFrames: 248, trimAfter: 248 },
    ],
    audio: 'audio/memphis-belle-qs-vo-04.mp3',
    durationFrames: 333,
  },
  {
    id: 'slide5',
    clips: [
      { video: 'videos/memphis_belle/07-good-time-cholly.mp4', durationFrames: 42 },
      { video: 'videos/memphis_belle/08-longhorn.mp4', durationFrames: 42 },
      { video: 'videos/memphis_belle/09-pie-eyed-piper.mp4', durationFrames: 40, trimAfter: 40 },
    ],
    audio: 'audio/memphis-belle-qs-vo-05.mp3',
    durationFrames: 124,
  },
];

const slidesDuration = SLIDES.reduce((sum, s) => sum + s.durationFrames, 0);

export const totalDuration = slidesDuration + END_CARD_FRAMES;
export { FPS };

// Burned-in captions: WRITTEN forms of the 7 spoken sentences, phrase-level cues
// like GrantButcherQS (each sentence's phrases are apportioned by word count
// across that sentence's own audio). Each sentence starts at its slide's start
// frame plus the cumulative samples (sentence + pause) of earlier sentences in
// the same slide, from the tight WAVs in out/sentences-tight/ (24000 Hz).
// U+2011 (non-breaking hyphen) keeps "B-17s" from wrapping as "B-" / "17s".
const SAMPLE_RATE = 24000;
const toFrames = (samples: number) => (samples / SAMPLE_RATE) * FPS;
const SLIDE_STARTS = SLIDES.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SLIDES[i - 1].durationFrames], []);
// Sample counts of the tight sentence WAVs and the pauses used in the slide mp3s.
const L4 = 67463;
const L5 = 125317; // 130357 - 1920 (gap 230->150 ms) - 3120 (lead 250->120 ms)
const L6 = 58727;
const PAUSE_4_5 = 3600; // 150 ms
const PAUSE_5_6 = 6000; // 250 ms
const CAPTIONS: { lines: string[]; from: number; samples: number }[] = [
  { lines: ['Before they flew,', 'a chaplain blessed the planes and the crews.'], from: SLIDE_STARTS[0], samples: 96973 },
  { lines: ['When a formation came back,', 'the bombers peeled off and landed.'], from: SLIDE_STARTS[1], samples: 100213 },
  { lines: ['This is the Memphis Belle.'], from: SLIDE_STARTS[2], samples: 47178 },
  { lines: ['Twenty‑four bombs are painted on her nose.'], from: SLIDE_STARTS[3], samples: L4 },
  {
    lines: ['Yet on May 17, 1943,', 'her crew completed their twenty‑fifth mission.'],
    from: SLIDE_STARTS[3] + toFrames(L4 + PAUSE_4_5),
    samples: L5,
  },
  {
    lines: ["That mission was the plane's twenty‑fourth."],
    from: SLIDE_STARTS[3] + toFrames(L4 + PAUSE_4_5 + L5 + PAUSE_5_6),
    samples: L6,
  },
  { lines: ['Her crew had flown five of those missions', 'in other B‑17s.'], from: SLIDE_STARTS[4], samples: 93847 },
].map((c) => ({ ...c, from: Math.round(c.from) }));

// ---------------------------------------------------------------------------
// ClipLayer — blur-border-fill treatment for one 4:3 video clip, ported from
// DoolittleRaidQS's BlurBorderFillVideo (QuickStrikeShared.tsx has no video
// slide component — locked/consume-only, same note that file left). No
// playbackRate here (unlike Doolittle) — clips play at native length only,
// per explicit instruction not to speed up/slow down anything.
// ---------------------------------------------------------------------------
function ClipLayer({ video, trimAfter }: { video: string; trimAfter?: number }) {
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <OffthreadVideo
          src={staticFile(video)}
          muted
          trimAfter={trimAfter}
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

      {/* Fit-to-WIDTH, never crop the sides — hard requirement for the
          05/06 bomb-tally clips (the full row must stay visible), and
          applied uniformly to every clip for one consistent look. */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <OffthreadVideo src={staticFile(video)} muted trimAfter={trimAfter} style={{ width: '100%', height: 'auto' }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// MultiClipVideoPanel — one slide's worth of back-to-back native-length
// clips (1 to 3 of them), each its own nested Sequence at a LOCAL frame
// offset within the slide's own Sequence, zero gap between clips (their
// durations already sum to the slide's own durationFrames — see SLIDES
// above). Slide-level hard-cut/cold-open opacity, vignette, audio, and the
// slide-specific text extras (label/caption) all live here, same
// shape as QuickStrikeShared's own SlidePanel/DoolittleRaidQS's
// VideoSlidePanel.
// ---------------------------------------------------------------------------
function MultiClipVideoPanel({ slide, isFirst }: { slide: SlideConfig; isFirst: boolean }) {
  const frame = useCurrentFrame();

  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  let clipOffset = 0;
  const clipsWithOffsets = slide.clips.map((clip) => {
    const from = clipOffset;
    clipOffset += clip.durationFrames;
    return { ...clip, from };
  });

  // Slide 3: "Memphis Belle" label — fades in at local frame 24 (0.8s),
  // held to the end (no fade-out).
  const labelOpacity =
    slide.id === 'slide3'
      ? interpolate(frame, [24, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      {clipsWithOffsets.map((clip) => (
        <Sequence key={clip.video} from={clip.from} durationInFrames={clip.durationFrames} layout="none">
          <ClipLayer video={clip.video} trimAfter={clip.trimAfter} />
        </Sequence>
      ))}

      <Vignette />

      {slide.id === 'slide3' && <ContextTag text="Memphis Belle" position="top-left" opacity={labelOpacity} />}

      {slide.id === 'slide5' && (
        <>
          {/* Plain-text caption (was GoldLowerThird). Sits above the burned-in
              captions (top ~1450). */}
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <p
              style={{
                position: 'absolute',
                top: SLIDE5_CAPTION_TOP,
                left: 40,
                right: 40,
                color: '#F5F0E8',
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 40,
                fontWeight: 700,
                lineHeight: 1.2,
                textAlign: 'center',
                textShadow: '0 2px 14px rgba(0,0,0,0.95)',
                margin: 0,
              }}
            >
              Other B-17s from the same reel
            </p>
          </AbsoluteFill>
        </>
      )}

      <Audio src={staticFile(slide.audio)} volume={VOICE_VOLUME} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// End card — the keyword end card from KheSanhQuickStrike.jsx (RECON), copied
// with its exact styles (that file keeps its own local copy): black, animated
// 3px gold rules above and below, 96px white Georgia bold letter-spaced keyword,
// 28px gold Georgia subline. Text fades in over frames 0-12, rules grow 0->100%
// over frames 8-33. No fade-out. The composition's single top-level looped music
// <Audio> simply continues under the card; Khe Sanh also plays a CTA voiceover
// here, which this composition doesn't have.
// font-variant-numeric: lining-nums is set so "24" matches cap height (in this
// renderer's serif the digits are full-height; verified in the stills).
// The keyword's trailing letter-spacing (0.18em) would leave it 0.09em left of
// center, so it gets an equal paddingLeft to keep equal margins inside the rules.
// ---------------------------------------------------------------------------
const CTA_TRIGGER_WORD = 'TALLY24';
const CTA_SUBTITLE = 'Comment TALLY24 for a free World War II PDF';

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
      <div style={{ width: '80%', maxWidth: 900 }}>
        {/* Top gold rule */}
        <div
          style={{
            height: 3,
            background: GOLD,
            width: `${ruleWidth}%`,
            marginBottom: 36,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />

        {/* Keyword */}
        <div
          style={{
            opacity: textOpacity,
            color: '#fff',
            fontFamily: 'Georgia, serif',
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontVariantNumeric: 'lining-nums',
            paddingLeft: '0.18em',
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          {CTA_TRIGGER_WORD}
        </div>

        {/* Subtitle */}
        <div
          style={{
            opacity: textOpacity,
            color: GOLD,
            fontFamily: 'Georgia, serif',
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: '0.05em',
            fontVariantNumeric: 'lining-nums',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            marginBottom: 36,
          }}
        >
          {CTA_SUBTITLE}
        </div>

        {/* Bottom gold rule */}
        <div
          style={{
            height: 3,
            background: GOLD,
            width: `${ruleWidth}%`,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

export default function MemphisBelleQS() {
  let offset = 0;
  const froms = SLIDES.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });
  const endCardFrom = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Music bed: same as the other Tokyo-bed WWII QS files (0.15, looped, no
          ducking/fade), spanning the whole composition including the end card. */}
      <Audio src={staticFile('audio/TokyoFirebombing-music.mp3')} volume={MUSIC_VOLUME} loop />

      {SLIDES.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <MultiClipVideoPanel slide={slide} isFirst={i === 0} />
        </Sequence>
      ))}

      {CAPTIONS.map((c) => {
        const dur = Math.round(toFrames(c.samples));
        return (
          <Sequence key={c.from} from={c.from} durationInFrames={dur} layout="none">
            <CaptionOverlay lines={c.lines} audioDurationFrames={dur} />
          </Sequence>
        );
      })}

      <Sequence from={endCardFrom} durationInFrames={END_CARD_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
