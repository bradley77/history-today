import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FPS, OSWALD_URL, GOLD, Vignette, CaptionOverlay } from '../shared/QuickStrikeShared';

// Memphis Belle v2 — a NEW composition (MemphisBelleQS is untouched). One
// continuous 690-frame section (single voice track + footage, no slide
// boundaries, so no black fade-ins between lines) followed by the TALLY24 end
// card copied from MemphisBelleQS.
//
//   - Voice: ONE track, audio/memphis-belle-qs2-vo-01.mp3 (out/memphis-belle-v2/
//     leveled/voiceover_scratch.wav, 23.023 s, 44.1 kHz mono 128k mp3 like the
//     earlier slide mp3s; sentences leveled to their median LUFS), at VOICE_VOLUME.
//   - Music: TokyoFirebombing-music.mp3 at 0.16, looped, one top-level <Audio>
//     over the whole video incl. the end card — exactly MemphisBelleQS's wiring
//     (that composition has no ducking and no fades, so neither does this one).
//   - Footage cuts (see BLOCKS) land on the midpoint of the MEASURED silence
//     between lines / at comma pauses (-45 dBFS, 5 ms RMS windows on the scratch
//     wav). Clips are never re-cut: tails are trimmed with trimAfter only.
//   - Captions: CaptionOverlay (same style as MemphisBelleQS), one cue per phrase,
//     timed from the measured voiced start/end of each phrase.
//   - Slow push-in on every use of 05-tally-freeze (1.00 -> 1.03, centred; the
//     bomb row stays inside the frame at 1.03). 06-tally-pan starts at 1.03 and
//     eases back to 1.00 so the 05 -> 06 join shows no jump.
const END_CARD_FRAMES = 132;
const VOICE_VOLUME = 1.75;
const MUSIC_VOLUME = 0.16;
const MAIN_FRAMES = 690;

export { FPS };
export const totalDuration = MAIN_FRAMES + END_CARD_FRAMES;

const f = (s: number) => Math.round(s * FPS);
// Cut on the midpoint of a measured silence [a, b] (seconds).
const mid = (a: number, b: number) => Math.round(((a + b) / 2) * FPS);

// Measured voiced times in the scratch wav (seconds).
const T = {
  l1: { start: 0.191, pause: [0.991, 1.259], end: 4.823 },
  l2: { start: 5.123, pause: [7.721, 7.952], end: 10.262 },
  l3: { start: 10.562, end: 12.348 },
  l4: { start: 12.648, pause: [15.618, 15.837], end: 18.097 },
  l5: { start: 18.397, pause1: [19.246, 19.587], pause2: [21.481, 21.7], end: 22.544 },
};

const CUT_B_END = mid(T.l2.end, T.l3.start); // after line 2
const CUT_C_END = mid(T.l3.end, T.l4.start); // after line 3
const CUT_D_END = mid(T.l4.pause[0], T.l4.pause[1]); // line 4 comma pause
const CUT_F_END = mid(T.l5.pause1[0], T.l5.pause1[1]); // after "later,"
const CUT_G_END = mid(T.l5.pause2[0], T.l5.pause2[1]); // after "twenty-fifth,"

type Block = {
  id: string;
  video: string;
  from: number;
  length: number;
  // Source frames in the clip file; trimAfter is applied when length < this.
  fileFrames: number;
  scale?: [number, number]; // push-in from -> to across the block
  hold?: boolean; // hold the clip's last frame for the whole block
};

const CLIP = (name: string) => `videos/memphis_belle/${name}.mp4`;
const A_LEN = 85;
const D1 = 42;
const D2 = 42;
const E_LEN = 69;

const BLOCKS: Block[] = [
  { id: 'A', video: CLIP('05-tally-freeze'), from: 0, length: A_LEN, fileFrames: 85, scale: [1.0, 1.03] },
  { id: 'B', video: CLIP('06-tally-pan'), from: A_LEN, length: CUT_B_END - A_LEN, fileFrames: 258, scale: [1.03, 1.0] },
  { id: 'C', video: CLIP('05-tally-freeze'), from: CUT_B_END, length: CUT_C_END - CUT_B_END, fileFrames: 85, scale: [1.0, 1.03] },
  { id: 'D1', video: CLIP('07-good-time-cholly'), from: CUT_C_END, length: D1, fileFrames: 42 },
  { id: 'D2', video: CLIP('08-longhorn'), from: CUT_C_END + D1, length: D2, fileFrames: 42 },
  // D3: last-frame hold of 08-longhorn (its frame 41) instead of a trimmed 09.
  { id: 'D3', video: CLIP('08-longhorn'), from: CUT_C_END + D1 + D2, length: CUT_D_END - (CUT_C_END + D1 + D2), fileFrames: 42, hold: true },
  { id: 'E', video: CLIP('04-belle-parked'), from: CUT_D_END, length: E_LEN, fileFrames: 69 },
  { id: 'F', video: CLIP('10-belle-wide'), from: CUT_D_END + E_LEN, length: CUT_F_END - (CUT_D_END + E_LEN), fileFrames: 52 },
  { id: 'G', video: CLIP('11-belle-closer'), from: CUT_F_END, length: CUT_G_END - CUT_F_END, fileFrames: 78 },
  { id: 'H', video: CLIP('12-belle-nose-late'), from: CUT_G_END, length: MAIN_FRAMES - CUT_G_END, fileFrames: 54 },
];

// "Other B-17s from the same reel" shows only while 07/08/09 (block D) are on screen.
const D_FROM = CUT_C_END;
const D_TO = CUT_D_END;
const REEL_CAPTION_TOP = 1290; // above the burned-in captions (~1441-1560), well above 1580

// U+2011 (non-breaking hyphen) in twenty-four / twenty-fifth / B-17s.
const CAPTIONS: { text: string; from: number; to: number }[] = [
  { text: 'In this footage,', from: f(T.l1.start), to: f(T.l1.pause[0]) },
  { text: "twenty‑four bombs are painted on the Memphis Belle's nose.", from: f(T.l1.pause[1]), to: f(T.l1.end) },
  { text: 'Yet on May 17, 1943,', from: f(T.l2.start), to: f(T.l2.pause[0]) },
  { text: 'her crew completed their twenty‑fifth mission.', from: f(T.l2.pause[1]), to: f(T.l2.end) },
  { text: 'So why only twenty‑four?', from: f(T.l3.start), to: f(T.l3.end) },
  { text: 'The crew flew five missions in other B‑17s,', from: f(T.l4.start), to: f(T.l4.pause[0]) },
  { text: 'and the Belle flew five with a different crew.', from: f(T.l4.pause[1]), to: f(T.l4.end) },
  { text: 'Two days later,', from: f(T.l5.start), to: f(T.l5.pause1[0]) },
  { text: 'the Belle flew her own twenty‑fifth,', from: f(T.l5.pause1[1]), to: f(T.l5.pause2[0]) },
  { text: 'without her crew.', from: f(T.l5.pause2[1]), to: f(T.l5.end) },
];

// Blur-border-fill framing as in MemphisBelleQS: dimmed blurred cover-fit copy
// behind a fit-to-WIDTH sharp copy (never crops the sides at scale 1.0).
function ClipLayer({ video, trimAfter, length, scale }: { video: string; trimAfter?: number; length: number; scale?: [number, number] }) {
  const frame = useCurrentFrame();
  const s = scale ? interpolate(frame, [0, length], scale, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
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
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <OffthreadVideo
          src={staticFile(video)}
          muted
          trimAfter={trimAfter}
          style={{ width: '100%', height: 'auto', transform: `scale(${s})` }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function MainSection() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {BLOCKS.map((b) => (
        <Sequence key={b.id} from={b.from} durationInFrames={b.length} layout="none">
          {b.hold ? (
            <Freeze frame={b.fileFrames - 1}>
              <ClipLayer video={b.video} length={b.length} />
            </Freeze>
          ) : (
            <ClipLayer
              video={b.video}
              trimAfter={b.length < b.fileFrames ? b.length : undefined}
              length={b.length}
              scale={b.scale}
            />
          )}
        </Sequence>
      ))}

      <Vignette />

      <Sequence from={D_FROM} durationInFrames={D_TO - D_FROM} layout="none">
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <p
            style={{
              position: 'absolute',
              top: REEL_CAPTION_TOP,
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
      </Sequence>

      {CAPTIONS.map((c) => (
        <Sequence key={c.from} from={c.from} durationInFrames={c.to - c.from} layout="none">
          <CaptionOverlay lines={[c.text]} audioDurationFrames={c.to - c.from} />
        </Sequence>
      ))}

      {/* ONE voice track for the whole section. */}
      <Audio src={staticFile('audio/memphis-belle-qs2-vo-01.mp3')} volume={VOICE_VOLUME} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// End card — copied as-is from MemphisBelleQS (itself the KheSanhQuickStrike
// RECON keyword card): black, animated 3px gold rules above and below, 96px
// white Georgia bold letter-spaced keyword, 28px gold Georgia subline. Text
// fades in over frames 0-12, rules grow 0->100% over frames 8-33. No fade-out;
// the top-level looped music <Audio> continues under it.
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

export default function MemphisBelleQSv2() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/TokyoFirebombing-music.mp3')} volume={MUSIC_VOLUME} loop />

      <Sequence from={0} durationInFrames={MAIN_FRAMES} layout="none">
        <MainSection />
      </Sequence>

      <Sequence from={MAIN_FRAMES} durationInFrames={END_CARD_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
