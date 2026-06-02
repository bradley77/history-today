import { useCurrentFrame, useVideoConfig, interpolate, Img, AbsoluteFill, Audio, staticFile } from 'remotion';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

const VOICEOVER_DURATION_SECONDS = 40.5;
const TOTAL_FRAMES = VOICEOVER_DURATION_SECONDS * 30; // 1215
const TOTAL_WEIGHT = 10;
const OVERLAY_DELAY = 18;
const VOICEOVER_ENABLED = true;

const SLIDES_DEF = [
  { image: 'slides/madison/01-madison-portrait.jpg',   weight: 1,   kenBurns: 'zoomIn',   overlayText: null,                                                               textPosition: 'bottom' },
  { image: 'slides/madison/02-chesapeake-approach.jpg', weight: 1.5, kenBurns: 'panLeft',  overlayText: 'BRITISH WARSHIPS. AMERICAN SAILORS. KIDNAPPED.',                   textPosition: 'top' },
  { image: 'slides/madison/03-chesapeake-captured.jpg', weight: 1.5, kenBurns: 'zoomIn',   overlayText: 'THEY CALLED IT IMPRESSMENT. AMERICANS CALLED IT KIDNAPPING.',      textPosition: 'top' },
  { image: 'slides/madison/09-manuscript-address-wide.jpg', weight: 1,   kenBurns: 'scrollLeft',  overlayText: 'JUNE 1, 1812. MADISON WROTE CONGRESS A LETTER.',                   textPosition: 'bottom' },
  { image: 'slides/madison/05-manuscript-full.jpg',         weight: 1,   kenBurns: 'panRight',    overlayText: 'NOT AN ORDER. A REQUEST.',                                         textPosition: 'top' },
  { image: 'slides/madison/06-printed-title-page.jpg',  weight: 1.5, kenBurns: 'zoomOut',  overlayText: 'AN IMMEDIATE DECLARATION OF WAR AGAINST GREAT BRITAIN.',           textPosition: 'bottom' },
  { image: 'slides/madison/07-declaration-signed.jpg',  weight: 1.5, kenBurns: 'zoomIn',   overlayText: 'CONGRESS VOTED YES. JUNE 18, 1812.',                               textPosition: 'top' },
  { image: 'slides/madison/08-capitol-burned.jpg',      weight: 1,   kenBurns: 'zoomOut',  overlayText: 'THE BRITISH BURNED WASHINGTON. READ THE FULL STORY. LINK IN BIO.', textPosition: 'bottom' },
];

const slides = (() => {
  let offset = 0;
  return SLIDES_DEF.map((s) => {
    const duration = Math.round((s.weight / TOTAL_WEIGHT) * TOTAL_FRAMES);
    const slide = { ...s, duration, from: offset, overlayDelay: OVERLAY_DELAY };
    offset += duration;
    return slide;
  });
})();

// Music swell keyframes (computed once at module level)
const SLIDE3_FROM      = slides[2].from;
const SLIDE3_END       = SLIDE3_FROM + slides[2].duration;
const LAST_SLIDE_END   = slides[slides.length - 1].from + slides[slides.length - 1].duration;
const MUSIC_FADE_START = LAST_SLIDE_END - 30;

const getKenBurnsTransform = (kenBurns, localFrame, duration) => {
  switch (kenBurns) {
    case 'zoomOut': {
      const scale = interpolate(localFrame, [0, duration], [1.08, 1.0], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
    case 'panLeft': {
      const tx = interpolate(localFrame, [0, duration], [0, -4], { extrapolateRight: 'clamp' });
      return `translateX(${tx}%)`;
    }
    case 'panLeftSubtle': {
      const tx = interpolate(localFrame, [0, duration], [0, -3], { extrapolateRight: 'clamp' });
      return `translateX(${tx}%)`;
    }
    case 'scrollLeft': {
      const tx = interpolate(localFrame, [0, duration], [15, -15], { extrapolateRight: 'clamp' });
      return `translateX(${tx}%)`;
    }
    case 'panRight': {
      const tx = interpolate(localFrame, [0, duration], [0, 4], { extrapolateRight: 'clamp' });
      return `translateX(${tx}%)`;
    }
    case 'zoomInSubtle': {
      const scale = interpolate(localFrame, [0, duration], [1.0, 1.06], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
    case 'zoomIn':
    default: {
      const scale = interpolate(localFrame, [0, duration], [1.0, 1.08], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
  }
};

export default function MadisonVideo() {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  let activeSlide = slides[0];
  let activeSlideIndex = 0;
  for (let i = 0; i < slides.length; i++) {
    if (frame >= slides[i].from) {
      activeSlide = slides[i];
      activeSlideIndex = i;
    }
  }

  const localFrame = frame - activeSlide.from;
  const transform = getKenBurnsTransform(activeSlide.kenBurns, localFrame, activeSlide.duration);

  // Hard cut flash between slides — slide 0 is a cold open, no flash
  const cutOpacity = activeSlideIndex === 0
    ? 1
    : interpolate(localFrame, [0, 4], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // Fade out on last slide
  const isLastSlide = activeSlideIndex === slides.length - 1;
  const closeFade = isLastSlide
    ? interpolate(localFrame, [activeSlide.duration - 20, activeSlide.duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  // Slide 1 cold open: full opacity at frame 0, no fade-in from black
  const finalOpacity = activeSlideIndex === 0 ? 1 : cutOpacity * closeFade;

  const overlayOpacity = activeSlide.overlayText
    ? interpolate(
        localFrame,
        [activeSlide.overlayDelay, activeSlide.overlayDelay + 18],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0;

  const ruleWidth = activeSlide.overlayText
    ? interpolate(
        localFrame,
        [activeSlide.overlayDelay, activeSlide.overlayDelay + 25],
        [0, 100],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0;

  const textAtTop = activeSlide.textPosition === 'top';

  // Slide 3 swell: 0.20 → 0.36 over 20 frames in, hold, 0.36 → 0.20 over 20 frames out
  // Last slide: 0.20 → 0 over final 30 frames
  const musicVolume = interpolate(
    frame,
    [SLIDE3_FROM, SLIDE3_FROM + 20, SLIDE3_END - 20, SLIDE3_END, MUSIC_FADE_START, LAST_SLIDE_END],
    [0.20, 0.36, 0.36, 0.20, 0.20, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {VOICEOVER_ENABLED && (
        <Audio src={staticFile('audio/madison-voiceover.mp3')} />
      )}
      <Audio src={staticFile('audio/music.mp3')} volume={musicVolume} />
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Image layer */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          opacity: finalOpacity,
        }}
      >
        <Img
          src={staticFile(activeSlide.image)}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            transform,
          }}
        />
      </div>

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.72) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top gradient — legibility for top-positioned text */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '35%',
          background: 'linear-gradient(to top, transparent, rgba(0,0,0,0.75))',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom gradient — legibility for bottom-positioned text */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '35%',
          background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.75))',
          pointerEvents: 'none',
        }}
      />

      {/* Overlay text block */}
      {activeSlide.overlayText && (
        <div
          style={{
            position: 'absolute',
            ...(textAtTop
              ? { top: Math.round(height * 0.08) }
              : { bottom: Math.round(height * 0.12) }),
            left: 0,
            right: 0,
            opacity: overlayOpacity,
            paddingLeft: 48,
            paddingRight: 48,
          }}
        >
          <div
            style={{
              height: 3,
              width: `${ruleWidth}%`,
              backgroundColor: '#C9A84C',
              marginBottom: 16,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.60)',
              paddingTop: 24,
              paddingBottom: 24,
              paddingLeft: 40,
              paddingRight: 40,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: 58,
                fontWeight: 700,
                color: '#F5F0E8',
                margin: 0,
                lineHeight: 1.25,
                textShadow: '0 2px 14px rgba(0,0,0,0.95)',
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                letterSpacing: '0.01em',
              }}
            >
              {activeSlide.overlayText}
            </p>
          </div>
          <div
            style={{
              height: 3,
              width: `${ruleWidth}%`,
              backgroundColor: '#C9A84C',
              marginTop: 16,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
        </div>
      )}
    </AbsoluteFill>
  );
}
