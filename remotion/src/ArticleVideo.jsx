import { AbsoluteFill, Audio, Sequence } from 'remotion';
import { Slide } from './Slide';
import { config } from './data/config';

// Precompute each slide's start frame once
const slidesWithOffsets = config.slides.map((slide, i) => ({
  ...slide,
  from: config.slides.slice(0, i).reduce((sum, s) => sum + s.duration, 0),
}));

export const ArticleVideo = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {config.audio && (
        <Audio src={config.audio} volume={config.audioVolume ?? 0.3} />
      )}

      {slidesWithOffsets.map((slide, i) => (
        <Sequence key={i} from={slide.from} durationInFrames={slide.duration}>
          <Slide
            image={slide.image}
            title={slide.title}
            subtitle={slide.subtitle}
            duration={slide.duration}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
