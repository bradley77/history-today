import { useCurrentFrame, useVideoConfig, interpolate, Img, AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';

const FPS = 30;
const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

type RawSlide = {
  image: string;
  objectPosition: string;
  text: string;
  durationInSeconds: number;
  panFrom?: [number, number];
  panTo?: [number, number];
};

const rawSlides: RawSlide[] = [
  { image: '01-warren-death-trumbull-mfa.jpg',  objectPosition: '20% 30%',      text: 'Two generals begged him to take command. He refused.',        durationInSeconds: 3.621, panFrom: [45, 30], panTo: [20, 30] },
  { image: '02-warren-portrait-copley.jpg',      objectPosition: 'center top',   text: "This man. Boston's busiest doctor.",                          durationInSeconds: 4.069 },
  { image: '03-paul-revere-ride-grant-wood.jpg', objectPosition: 'left center',  text: 'He sent Paul Revere on the most famous ride in history.',     durationInSeconds: 3.280 },
  { image: '05-clinton-battle-map.jpg',          objectPosition: 'center center',text: 'Three days earlier, he outranked every man on this hill.',    durationInSeconds: 4.261 },
  { image: '07-bunker-hill-redcoats-pyle.jpg',   objectPosition: 'center 60%',   text: 'He still picked up a musket and got in line.',               durationInSeconds: 4.325 },
  { image: '06-warren-death-trumbull-yale.jpg',  objectPosition: 'center 30%',   text: 'Twice, the British were thrown back.',                        durationInSeconds: 3.536 },
  { image: '01-warren-death-trumbull-mfa.jpg',   objectPosition: '20% 30%',      text: 'The third time, he ran out of bullets. And luck.',            durationInSeconds: 4.304, panFrom: [20, 30], panTo: [45, 30] },
  { image: '08-bunker-hill-monument-photo.jpg',  objectPosition: 'center center',text: 'His body was unrecognizable. One man still knew who he was.', durationInSeconds: 12.368 },
];

const MOTION_TYPES = ['zoomIn', 'panLeft', 'zoomIn', 'panRight', 'zoomOut', 'panLeft', 'zoomIn', 'zoomOut'] as const;

const slides = rawSlides.map((s, i) => ({
  ...s,
  image: `/slides/Bunker-Hill/${s.image}`,
  duration: Math.round(s.durationInSeconds * FPS),
  motionType: MOTION_TYPES[i],
  overlayDelay: 15,
}));

const slidesWithOffsets = slides.map((slide, i) => ({
  ...slide,
  from: slides.slice(0, i).reduce((sum, s) => sum + s.duration, 0),
}));

export const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0);
// 109+122+98+128+130+106+129+371 = 1193 frames (39.77 s at 30fps)

const getKenBurnsTransform = (motionType: string, localFrame: number, duration: number) => {
  switch (motionType) {
    case 'zoomOut': {
      const scale = interpolate(localFrame, [0, duration], [1.04, 1.0], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
    case 'panLeft': {
      const tx = interpolate(localFrame, [0, duration], [0, -4], { extrapolateRight: 'clamp' });
      return `translateX(${tx}%)`;
    }
    case 'panRight': {
      const tx = interpolate(localFrame, [0, duration], [0, 4], { extrapolateRight: 'clamp' });
      return `translateX(${tx}%)`;
    }
    case 'zoomIn':
    default: {
      const scale = interpolate(localFrame, [0, duration], [1.0, 1.04], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
  }
};

export default function WarrenBunkerHillVideo() {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  let activeSlide = slidesWithOffsets[0];
  let activeSlideIndex = 0;
  for (let i = 0; i < slidesWithOffsets.length; i++) {
    if (frame >= slidesWithOffsets[i].from) {
      activeSlide = slidesWithOffsets[i];
      activeSlideIndex = i;
    }
  }

  const localFrame = frame - activeSlide.from;

  let wrapperTransform: string;
  let imageObjectPosition: string;

  if (activeSlide.panFrom && activeSlide.panTo) {
    wrapperTransform = 'none';
    const xPct = interpolate(localFrame, [0, activeSlide.duration], [activeSlide.panFrom[0], activeSlide.panTo[0]], { extrapolateRight: 'clamp' });
    const yPct = interpolate(localFrame, [0, activeSlide.duration], [activeSlide.panFrom[1], activeSlide.panTo[1]], { extrapolateRight: 'clamp' });
    imageObjectPosition = `${xPct}% ${yPct}%`;
  } else {
    wrapperTransform = getKenBurnsTransform(activeSlide.motionType, localFrame, activeSlide.duration);
    imageObjectPosition = activeSlide.objectPosition;
  }

  // 4-frame hard cut flash between slides; slide 0 opens at full opacity (hard cut)
  const cutOpacity = activeSlideIndex === 0
    ? 1
    : interpolate(localFrame, [0, 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Fade out on last slide only
  const isLastSlide = activeSlideIndex === slidesWithOffsets.length - 1;
  const closeFade = isLastSlide
    ? interpolate(localFrame, [activeSlide.duration - 20, activeSlide.duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  const finalOpacity = cutOpacity * closeFade;

  const overlayOpacity = interpolate(
    localFrame,
    [activeSlide.overlayDelay, activeSlide.overlayDelay + 18],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const ruleWidth = interpolate(
    localFrame,
    [activeSlide.overlayDelay, activeSlide.overlayDelay + 25],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {slidesWithOffsets.map((slide, i) => (
        <Sequence key={`vo-${i}`} from={slide.from} durationInFrames={slide.duration}>
          <Audio src={staticFile(`audio/warren-bunker-hill-vo-${String(i + 1).padStart(2, '0')}.mp3`)} />
        </Sequence>
      ))}
      <Audio src={staticFile('audio/warren-bunker-hill-music.mp3')} volume={0.15} />
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Image layer */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', opacity: finalOpacity }}>
        {/* Oversized transform wrapper: extends 5% beyond clip on every edge so pan
            translations (≤4%) never expose the black container background */}
        <div style={{ position: 'absolute', top: '-5%', left: '-5%', width: '110%', height: '110%', transform: wrapperTransform }}>
          <Img
            src={staticFile(activeSlide.image)}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: imageObjectPosition }}
          />
        </div>
      </div>

      {/* Vignette */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.72) 100%)', pointerEvents: 'none' }} />

      {/* Bottom gradient for text legibility */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '35%', background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.75))', pointerEvents: 'none' }} />

      {/* Overlay text block */}
      <div style={{ position: 'absolute', bottom: Math.round(height * 0.12), left: 0, right: 0, opacity: overlayOpacity, paddingLeft: 48, paddingRight: 48 }}>
        <div style={{ height: 3, width: `${ruleWidth}%`, backgroundColor: '#C9A84C', marginBottom: 16, marginLeft: 'auto', marginRight: 'auto' }} />
        <div style={{ backgroundColor: 'rgba(0,0,0,0.60)', paddingTop: 24, paddingBottom: 24, paddingLeft: 40, paddingRight: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 58, fontWeight: 700, color: '#F5F0E8', margin: 0, lineHeight: 1.25, textShadow: '0 2px 14px rgba(0,0,0,0.95)', fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif", letterSpacing: '0.01em' }}>
            {activeSlide.text}
          </p>
        </div>
        <div style={{ height: 3, width: `${ruleWidth}%`, backgroundColor: '#C9A84C', marginTop: 16, marginLeft: 'auto', marginRight: 'auto' }} />
      </div>
    </AbsoluteFill>
  );
}
