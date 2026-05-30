import { AbsoluteFill, Audio, Sequence } from 'remotion';
import { interpolate } from 'remotion';
import { Slide } from './Slide';
import { Vignette } from './components/Vignette';
import { FilmGrain } from './components/FilmGrain';
import { ProgressBar } from './components/ProgressBar';
import { config, totalDuration } from './data/config';

const slidesWithOffsets = config.slides.map((slide, i) => ({
  ...slide,
  from: config.slides.slice(0, i).reduce((sum, s) => sum + s.duration, 0),
}));

export const ArticleVideo = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Voiceover */}
      {config.voiceover && (
        <Audio src={config.voiceover} volume={1} />
      )}

      {/* Background music with fade in and fade out */}
      {config.music && (
        <Audio
          src={config.music}
          volume={(f) =>
            interpolate(
              f,
              [
                0,
                config.musicFadeInFrames,
                totalDuration - config.musicFadeOutFrames,
                totalDuration,
              ],
              [0, config.musicVolume, config.musicVolume, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            )
          }
        />
      )}

      {/* Sound effects — each fires at its specified frame */}
      {config.sfx?.map((sfx, i) => (
        <Sequence key={i} from={sfx.frame} durationInFrames={90}>
          <Audio src={sfx.file} volume={sfx.volume} />
        </Sequence>
      ))}

      {/* Slides */}
      {slidesWithOffsets.map((slide, i) => (
        <Sequence key={i} from={slide.from} durationInFrames={slide.duration}>
          <Slide
            image={slide.image}
            text={slide.text}
            textPosition={slide.textPosition}
            kenBurns={slide.kenBurns}
            duration={slide.duration}
            focalPoint={slide.focalPoint}
            blurBackground={slide.blurBackground}
          />
        </Sequence>
      ))}

      {/* Global overlays — sit above all slides */}
      <Vignette />
      <FilmGrain />
      <ProgressBar />
    </AbsoluteFill>
  );
};
