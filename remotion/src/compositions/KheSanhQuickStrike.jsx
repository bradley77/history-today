import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FPS, GOLD, KenBurnsImage, Vignette, useGoldOverlay } from '../shared/QuickStrikeShared';

const SLUG = "khe-sanh-quick-strike";

const SLIDES = [
  {
    id: "slide1",
    image: 'slides/KheSanh/01-lbj-sandtable.jpg',
    audio: `audio/${SLUG}-vo-01.mp3`,
    durationInSeconds: 5.200,
    overlayLines: ["THE PRESIDENT MADE HIS", "GENERALS SIGN A PLEDGE", "TO HOLD IT"],
    contextLabel: "WHITE HOUSE SITUATION ROOM — FEB. 1968",
    kenBurns: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
  {
    id: "slide2",
    image: 'slides/KheSanh/02-ordnance.jpg',
    audio: `audio/${SLUG}-vo-02.mp3`,
    durationInSeconds: 4.155,
    overlayLines: ["200 MARINES DIED HOLDING IT", "FOR 77 DAYS"],
    contextLabel: "KHE SANH, VIETNAM — 1968",
    kenBurns: { scaleFrom: 1.06, scaleTo: 1.0, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
  {
    id: "slide3",
    image: 'slides/KheSanh/03-hill680.jpg',
    audio: `audio/${SLUG}-vo-03.mp3`,
    durationInSeconds: 7.675,
    overlayLines: ["FOUR MONTHS LATER THEY", "DEMOLISHED IT AND WALKED AWAY"],
    contextLabel: "KHE SANH COMBAT BASE — JULY 1968",
    kenBurns: { scaleFrom: 1.0, scaleTo: 1.06, txFrom: 0, txTo: 0, tyFrom: 0, tyTo: 0 },
  },
];

const CTA_AUDIO = `audio/${SLUG}-vo-04.mp3`;
const CTA_DURATION_SECONDS = 4.411;
const CTA_TRIGGER_WORD = "RECON";
const CTA_SUBTITLE = "Comment RECON for a free declassified Vietnam document";

export { FPS };

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
}));

const END_CARD_FRAMES = Math.round(CTA_DURATION_SECONDS * FPS);

const slidesDuration = slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0);
export const totalDuration = slidesDuration + END_CARD_FRAMES;

// NOT QuickStrikeShared's GoldLowerThird: this file's overlay renders a
// variable number of uppercase lines with dynamic font sizing (not a single
// fixed-size headline in a boxed background), so it stays local.
function SlidePanel({ slide }) {
  const frame = useCurrentFrame();
  const { durationFrames, kenBurns, overlayLines, contextLabel } = slide;

  const { ruleWidth, textOpacity } = useGoldOverlay(frame, 8);

  const fontSize = overlayLines.length >= 3 ? 36 : 42;

  return (
    <AbsoluteFill>
      <KenBurnsImage image={slide.image} frame={frame} durationFrames={durationFrames} motion={kenBurns} />
      <Vignette />

      {/* Context label — top-left */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          padding: '32px 36px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            color: '#e8e0cc',
            fontFamily: 'Georgia, serif',
            fontSize: 18,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            textShadow: '0 1px 4px rgba(0,0,0,0.9)',
          }}
        >
          {contextLabel}
        </div>
      </AbsoluteFill>

      {/* Gold animated rules + centered lower-third overlay */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 40px 140px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ width: '100%', maxWidth: 900 }}>
          {/* Top rule */}
          <div
            style={{
              height: 3,
              background: GOLD,
              width: `${ruleWidth}%`,
              marginBottom: 16,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />

          {/* Text lines */}
          {overlayLines.map((line, i) => (
            <div
              key={i}
              style={{
                opacity: textOpacity,
                color: '#fff',
                fontFamily: 'Georgia, serif',
                fontSize,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1.25,
                textShadow: '0 2px 8px rgba(0,0,0,0.85)',
                textAlign: 'center',
                marginBottom: i < overlayLines.length - 1 ? 6 : 0,
              }}
            >
              {line}
            </div>
          ))}

          {/* Bottom rule */}
          <div
            style={{
              height: 3,
              background: GOLD,
              width: `${ruleWidth}%`,
              marginTop: 16,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
        </div>
      </AbsoluteFill>

      {/* Per-slide audio */}
      <Audio src={staticFile(slide.audio)} startFrom={0} />
    </AbsoluteFill>
  );
}

// Kept local, not migrated to QuickStrikeShared's EndCardCTA: this end card's
// trigger word + subtitle layout (no "Comment" label, 96px trigger, gold
// Georgia subtitle) wasn't part of the requested EndCardCTA migration scope
// (Lincoln/Tokyo/Sherman only), so its exact existing look stays untouched.
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

        {/* Trigger word */}
        <div
          style={{
            opacity: textOpacity,
            color: '#fff',
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

        {/* Subtitle */}
        <div
          style={{
            opacity: textOpacity,
            color: GOLD,
            fontFamily: 'Georgia, serif',
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: '0.05em',
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

export default function KheSanhQuickStrike() {
  let offset = 0;

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {slidesWithFrames.map((slide, i) => {
        const start = offset;
        offset += slide.durationFrames;
        return (
          <Sequence key={slide.id} from={start} durationInFrames={slide.durationFrames} layout="none">
            <SlidePanel slide={slide} />
          </Sequence>
        );
      })}

      <Audio src={staticFile('audio/KheSanh-music.mp3')} volume={0.15} loop />

      {/* End card */}
      <Sequence from={slidesDuration} durationInFrames={END_CARD_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
