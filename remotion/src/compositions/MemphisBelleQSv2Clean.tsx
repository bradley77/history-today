import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FPS, OSWALD_URL, GOLD, Vignette } from '../shared/QuickStrikeShared';

// Memphis Belle v2 "clean" cut — same footage/timing/voiceover as
// MemphisBelleQSv2, but with the burned-in CaptionOverlay lines and the
// TokyoFirebombing-music.mp3 bed removed. Video + voiceover only.
const END_CARD_FRAMES = 132;
const VOICE_VOLUME = 1.75;
const MAIN_FRAMES = 690;

export { FPS };
export const totalDuration = MAIN_FRAMES + END_CARD_FRAMES;

const mid = (a: number, b: number) => Math.round(((a + b) / 2) * FPS);

// Measured voiced times in the scratch wav (seconds).
const T = {
  l1: { start: 0.191, pause: [0.991, 1.259], end: 4.823 },
  l2: { start: 5.123, pause: [7.721, 7.952], end: 10.262 },
  l3: { start: 10.562, end: 12.348 },
  l4: { start: 12.648, pause: [15.618, 15.837], end: 18.097 },
  l5: { start: 18.397, pause1: [19.246, 19.587], pause2: [21.481, 21.7], end: 22.544 },
};

const CUT_B_END = mid(T.l2.end, T.l3.start);
const CUT_C_END = mid(T.l3.end, T.l4.start);
const CUT_D_END = mid(T.l4.pause[0], T.l4.pause[1]);
const CUT_F_END = mid(T.l5.pause1[0], T.l5.pause1[1]);
const CUT_G_END = mid(T.l5.pause2[0], T.l5.pause2[1]);

type Block = {
  id: string;
  video: string;
  from: number;
  length: number;
  fileFrames: number;
  scale?: [number, number];
  hold?: boolean;
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
  { id: 'D3', video: CLIP('08-longhorn'), from: CUT_C_END + D1 + D2, length: CUT_D_END - (CUT_C_END + D1 + D2), fileFrames: 42, hold: true },
  { id: 'E', video: CLIP('04-belle-parked'), from: CUT_D_END, length: E_LEN, fileFrames: 69 },
  { id: 'F', video: CLIP('10-belle-wide'), from: CUT_D_END + E_LEN, length: CUT_F_END - (CUT_D_END + E_LEN), fileFrames: 52 },
  { id: 'G', video: CLIP('11-belle-closer'), from: CUT_F_END, length: CUT_G_END - CUT_F_END, fileFrames: 78 },
  { id: 'H', video: CLIP('12-belle-nose-late'), from: CUT_G_END, length: MAIN_FRAMES - CUT_G_END, fileFrames: 54 },
];

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

      {/* No burned-in text overlays in the clean cut (reel caption + CaptionOverlay lines both removed). */}

      {/* ONE voice track for the whole section — no music bed. */}
      <Audio src={staticFile('audio/memphis-belle-qs2-vo-01.mp3')} volume={VOICE_VOLUME} />
    </AbsoluteFill>
  );
}

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

export default function MemphisBelleQSv2Clean() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* No top-level music <Audio> in the clean cut. */}

      <Sequence from={0} durationInFrames={MAIN_FRAMES} layout="none">
        <MainSection />
      </Sequence>

      <Sequence from={MAIN_FRAMES} durationInFrames={END_CARD_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
