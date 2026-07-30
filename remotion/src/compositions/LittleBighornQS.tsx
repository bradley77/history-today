import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  FPS,
  OSWALD_URL,
  HARD_CUT_FRAMES,
  SlidePanel,
  CaptionOverlay,
  EndCardCTA,
  GOLD,
  type SlideConfig as SharedSlideConfig,
} from '../shared/QuickStrikeShared';
import { CTA_CONFIG } from '../shared/QuickStrikeConfig';

const PAD_S = 0.4;

// Actual measured VO durations (Kokoro, am_adam @ 0.95, ffprobe-verified
// against the encoded MP3s — see scripts/generateVoiceover-little-bighorn.py).
const SLIDE1_AUDIO_S = 2.048;
const SLIDE2_AUDIO_S = 5.397;
const SLIDE3_AUDIO_S = 5.397;
const SLIDE4_AUDIO_S = 6.955; // re-measured after the "Lookota" pronunciation fix (was 6.976)
const SLIDE5_AUDIO_S = 3.285; // end card VO

type SlideConfig = SharedSlideConfig & {
  sourceWidth: number;
  sourceHeight: number;
};

const SLIDES: SlideConfig[] = [
  {
    id: 'slide1',
    image: 'slides/Little-Big-Horn/01-sitting-bull.jpg',
    audio: 'audio/little-bighorn-01-hook-voiceover.mp3',
    durationInSeconds: SLIDE1_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE1_AUDIO_S,
    // No ContextTag/label on the hook slide, per spec — matches slide1 across
    // every other QS composition that opens cold on the image alone.
    overlayText: 'THEIR GREATEST VICTORY DESTROYED THEM',
    captionLines: ['Their greatest victory destroyed them.'],
    // 3840x5293, aspect 0.725 — portrait single-subject, well below
    // PAN_FILL_ASPECT_THRESHOLD (1.2). Pan-Fill resolves 'static' automatically
    // and applies its own subtle scale-only drift (PAN_FILL_STATIC_SCALE_TO) —
    // no explicit motion or panFillMode override needed.
    sourceWidth: 3840,
    sourceHeight: 5293,
  },
  {
    id: 'slide2',
    image: 'slides/Little-Big-Horn/02-custer.jpg',
    audio: 'audio/little-bighorn-02-outnumbered-voiceover.mp3',
    durationInSeconds: SLIDE2_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE2_AUDIO_S,
    label: 'JUNE 25, 1876',
    overlayText: 'OUTNUMBERED TWO TO ONE',
    captionLines: [
      'Custer split his force in three, expecting eight hundred warriors.',
      'There were nearly two thousand.',
    ],
    // 1476x1846, aspect 0.799 — portrait single-subject, below the pan
    // threshold. Pan-Fill resolves 'static' automatically (subtle scale-only
    // drift), matching the "minimal drift" call for this slide.
    sourceWidth: 1476,
    sourceHeight: 1846,
  },
  {
    id: 'slide3',
    image: 'slides/Little-Big-Horn/03-battlefield.jpg',
    audio: 'audio/little-bighorn-03-killed-voiceover.mp3',
    durationInSeconds: SLIDE3_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE3_AUDIO_S,
    label: 'LAST STAND HILL',
    overlayText: '268 SOLDIERS KILLED',
    captionLines: [
      'Two hundred sixty eight soldiers were killed.',
      'Their greatest victory in the Plains Indian Wars.',
    ],
    // 2952x1998, aspect 1.478 — above PAN_FILL_ASPECT_THRESHOLD (1.2), so
    // 'auto' already resolves 'pan'; set explicitly per spec. baseScale =
    // 1920/1998 ~= 0.961, renderedWidth ~= 2836, panRoomPx ~= 1756, usable pan
    // room (87.5% minus the 50px edge buffer per side) ~= 1537px. At this
    // slide's 5.797s duration (real measured VO + pad) the MAX_PAN_SPEED_PX_PER_SEC
    // (100) speed cap limits the actual sweep to ~580px, well short of the
    // usable room, so the pan stays centered rather than reaching either edge.
    sourceWidth: 2952,
    sourceHeight: 1998,
    panFillMode: 'pan',
    panDirection: 'ltr',
  },
  {
    id: 'slide4',
    image: 'slides/Little-Big-Horn/04-sherman-council.jpg',
    audio: 'audio/little-bighorn-04-backfired-voiceover.mp3',
    durationInSeconds: SLIDE4_AUDIO_S + PAD_S,
    audioDurationSeconds: SLIDE4_AUDIO_S,
    label: 'FORT LARAMIE TREATY, 1868',
    overlayText: 'THE VICTORY BACKFIRED',
    captionLines: [
      'The victory backfired.',
      'Congress sent two thousand more troops and cut off food until the Lakota signed away the Black Hills.',
    ],
    // 3000x2218, aspect 1.353 — above the pan threshold, so 'auto' would pan;
    // forced 'static' instead. This is a formal council/document photo — the
    // legible region (the assembled figures) was pre-selected by the crop
    // itself, and panning a group portrait doesn't reveal anything the way a
    // battlefield's width does. Static keeps the subject readable from frame
    // 0, with Pan-Fill's default subtle static drift applied automatically.
    sourceWidth: 3000,
    sourceHeight: 2218,
    panFillMode: 'static',
  },
];

const slidesWithFrames = SLIDES.map((s) => ({
  ...s,
  durationFrames: Math.round(s.durationInSeconds * FPS),
  audioDurationFrames: Math.round(s.audioDurationSeconds * FPS),
}));

// ---------------------------------------------------------------------------
// End card — standalone black slide. Trigger word SEVENTHCAV, subline pulled
// from CTA_CONFIG. The on-screen trigger word and the caption both use the
// single string "SEVENTHCAV" (matching the actual FB comment trigger) — only
// the VO audio script (see EndCard below) spells it "seventh cav" as two
// words so Kokoro doesn't mash it into one garbled sound.
// ---------------------------------------------------------------------------
const SLIDE5_DURATION_S = SLIDE5_AUDIO_S + PAD_S;
const SLIDE5_FRAMES = Math.round(SLIDE5_DURATION_S * FPS);
const SLIDE5_AUDIO_FRAMES = Math.round(SLIDE5_AUDIO_S * FPS);

function EndCard() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const likeSaveShareOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <EndCardCTA
        triggerWord="SEVENTHCAV"
        subline={CTA_CONFIG.SEVENTHCAV.subline}
        audio="audio/little-bighorn-05-endcard-voiceover.mp3"
      />

      <CaptionOverlay
        lines={['Comment SEVENTHCAV for the free Little Bighorn PDF.']}
        audioDurationFrames={SLIDE5_AUDIO_FRAMES}
        top={200}
      />

      {/* Silent-viewer text, no VO */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 40px 340px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            opacity: likeSaveShareOpacity,
            color: GOLD,
            fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
            fontSize: 26,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Like. Save. Share.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export const totalDuration =
  slidesWithFrames.reduce((sum, s) => sum + s.durationFrames, 0) + SLIDE5_FRAMES;
export { FPS };

export default function LittleBighornQS() {
  let offset = 0;
  const froms = slidesWithFrames.map((s) => {
    const from = offset;
    offset += s.durationFrames;
    return from;
  });
  const slide5From = offset;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <style>{`@import url('${OSWALD_URL}');`}</style>

      <Audio src={staticFile('audio/lee-resignation-music.mp3')} volume={0.15} loop />

      {slidesWithFrames.map((slide, i) => (
        <Sequence key={slide.id} from={froms[i]} durationInFrames={slide.durationFrames} layout="none">
          <SlidePanel slide={slide} isFirst={i === 0} />
        </Sequence>
      ))}

      <Sequence from={slide5From} durationInFrames={SLIDE5_FRAMES} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
