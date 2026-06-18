import { AbsoluteFill, Audio, Sequence, Img, useCurrentFrame, interpolate, staticFile } from 'remotion';
import { watergateConfig, watergateSlidesWithOffsets } from './data/watergate';

const HARD_CUT_FRAMES = 4;

const WatergateSlide = ({ image, audio, durationInFrames, textHook, fit, containScale, fadeIn, fadeOut }) => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateRight: 'clamp',
  });

  let opacity = 1;
  if (!fadeIn) {
    opacity = interpolate(frame, [0, HARD_CUT_FRAMES], [0, 1], {
      extrapolateRight: 'clamp',
    });
  }

  if (fadeOut) {
    const fadeOutOpacity = interpolate(
      frame,
      [durationInFrames - 20, durationInFrames],
      [1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    opacity = Math.min(opacity, fadeOutOpacity);
  }

  const isContain = fit === 'contain';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Audio src={staticFile(audio)} />

      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          opacity,
          position: 'relative',
        }}
      >
        {isContain && (
          <Img
            src={staticFile(image)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(40px) brightness(0.45)',
              transform: `scale(${scale * 1.15})`,
            }}
          />
        )}

        <Img
          src={staticFile(image)}
          style={{
            position: isContain ? 'absolute' : 'relative',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: isContain ? 'contain' : 'cover',
            transform: `scale(${scale * (containScale || 1)})`,
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 180,
          left: 60,
          right: 60,
        }}
      >
        <div
          style={{
            height: 2,
            background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
            marginBottom: 16,
          }}
        />
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontWeight: 700,
            fontSize: 44,
            color: '#FFFFFF',
            textAlign: 'center',
            textShadow: '0 2px 12px rgba(0,0,0,0.8)',
            lineHeight: 1.2,
          }}
        >
          {textHook}
        </div>
        <div
          style={{
            height: 2,
            background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
            marginTop: 16,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const WatergateVideo = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Audio src={staticFile(watergateConfig.music)} volume={watergateConfig.musicVolume} />

      {watergateSlidesWithOffsets.map((slide, i) => (
        <Sequence key={i} from={slide.from} durationInFrames={slide.durationInFrames}>
          <WatergateSlide
            image={slide.image}
            audio={slide.audio}
            durationInFrames={slide.durationInFrames}
            textHook={slide.textHook}
            fit={slide.fit}
            containScale={slide.containScale}
            fadeIn={slide.fadeIn}
            fadeOut={slide.fadeOut}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
