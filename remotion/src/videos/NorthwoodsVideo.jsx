import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
} from 'remotion';
import SeriesTitleCard from '../components/SeriesTitleCard';
import { slides, TITLE_CARD_DURATION } from '../data/northwoods';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';

const slidesWithOffsets = slides.map((slide, i) => ({
  ...slide,
  from: slides.slice(0, i).reduce((sum, s) => sum + s.duration, 0),
}));

const getKenBurnsTransform = (motionType, localFrame, duration, zoomEndScale) => {
  switch (motionType) {
    case 'none':
      return 'scale(1)';
    case 'zoomOut': {
      const startScale = zoomEndScale !== undefined ? 1.0 + (zoomEndScale - 1.0) : 1.08;
      const scale = interpolate(localFrame, [0, duration], [startScale, 1.0], { extrapolateRight: 'clamp' });
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
      const endScale = zoomEndScale !== undefined ? zoomEndScale : 1.08;
      const scale = interpolate(localFrame, [0, duration], [1.0, endScale], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
  }
};

function NorthwoodsSlides() {
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
  const transform = getKenBurnsTransform(activeSlide.motionType, localFrame, activeSlide.duration, activeSlide.zoomEndScale);

  // Hard cut flash between slides — first slide opens clean
  const cutOpacity = activeSlideIndex === 0
    ? 1
    : interpolate(localFrame, [0, 4], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // Fade out on last slide
  const isLastSlide = activeSlideIndex === slidesWithOffsets.length - 1;
  const closeFade = isLastSlide
    ? interpolate(localFrame, [activeSlide.duration - 20, activeSlide.duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

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

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Audio src={staticFile('audio/northwoods-voiceover.mp3')} />
      <Audio src={staticFile('audio/northwoods.mp3')} volume={0.2} />
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/* Image layer */}
      {activeSlide.image && (() => {
        // Slide 4 (04-terror-campaign.jpg) is a landscape document — it must NOT be
        // scaled or it clips on both edges. Bypass the shared transform entirely.
        const isLandscapeDoc = activeSlide.image.includes('04-terror-campaign');
        return (
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              overflow: 'hidden',
              opacity: finalOpacity,
            }}
          >
            <Img
              src={staticFile(activeSlide.image)}
              style={{
                position: 'absolute',
                width: '100%', height: '100%',
                objectFit: isLandscapeDoc ? 'contain' : (activeSlide.objectFit || 'cover'),
                objectPosition: activeSlide.objectPosition || 'center center',
                transform: isLandscapeDoc ? 'scale(1.0)' : transform,
              }}
            />
          </div>
        );
      })()}

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.72) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom gradient */}
      <div
        style={{
          position: 'absolute',
          bottom: 0, left: 0, width: '100%', height: '35%',
          background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.75))',
          pointerEvents: 'none',
        }}
      />

      {/* CTA block — static, centered, gold, no animation */}
      {activeSlide.cta && (
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingLeft: 64,
            paddingRight: 64,
          }}
        >
          {activeSlide.cta.main.map((line) => (
            <p
              key={line}
              style={{
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 68,
                fontWeight: 700,
                color: '#C9A84C',
                margin: 0,
                lineHeight: 1.2,
                textAlign: 'center',
                letterSpacing: '0.01em',
              }}
            >
              {line}
            </p>
          ))}
          <div style={{ height: 32 }} />
          {activeSlide.cta.sub.map((line) => (
            <p
              key={line}
              style={{
                fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
                fontSize: 40,
                fontWeight: 700,
                color: '#C9A84C',
                margin: 0,
                lineHeight: 1.3,
                textAlign: 'center',
                letterSpacing: '0.04em',
                opacity: 0.8,
              }}
            >
              {line}
            </p>
          ))}
        </AbsoluteFill>
      )}

      {/* Overlay text */}
      {activeSlide.overlayText && (
        <div
          style={{
            position: 'absolute',
            ...(activeSlide.overlayYFrac !== undefined
              ? { top: Math.round(height * activeSlide.overlayYFrac) }
              : { bottom: Math.round(height * 0.12) }),
            left: 0, right: 0,
            opacity: overlayOpacity,
            paddingLeft: 48, paddingRight: 48,
          }}
        >
          <div
            style={{
              height: 3,
              width: `${ruleWidth}%`,
              backgroundColor: '#C9A84C',
              marginBottom: 16,
              marginLeft: 'auto', marginRight: 'auto',
            }}
          />
          <div
            style={{
              backgroundColor: 'rgba(0,0,0,0.60)',
              paddingTop: 24, paddingBottom: 24,
              paddingLeft: 40, paddingRight: 40,
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
              marginLeft: 'auto', marginRight: 'auto',
            }}
          />
        </div>
      )}
    </AbsoluteFill>
  );
}

export default function NorthwoodsVideo() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Sequence from={0} durationInFrames={TITLE_CARD_DURATION}>
        <SeriesTitleCard />
      </Sequence>
      <Sequence from={TITLE_CARD_DURATION}>
        <NorthwoodsSlides />
      </Sequence>
    </AbsoluteFill>
  );
}
