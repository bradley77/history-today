import { useCurrentFrame, useVideoConfig, interpolate, Img, AbsoluteFill, Audio, staticFile } from 'remotion';
import { OffthreadVideo } from 'remotion';
import { slides } from '../data/eisenhower';

const OSWALD_URL = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';
const CROSSFADE = 15;

// Slide 5 word-by-word quote reveal
const QUOTE_WORDS = ["If", "any", "blame", "or", "fault", "attaches", "to", "the", "attempt,", "it", "is", "mine", "alone."];
const WORD_REVEAL_START = 88; // frames into slide 5 when first word appears
const WORD_INTERVAL = 8;     // frames between each word

const slidesWithOffsets = slides.map((slide, i) => ({
  ...slide,
  from: slides.slice(0, i).reduce((sum, s) => sum + s.duration, 0),
}));

const getKenBurnsTransform = (motionType, localFrame, duration) => {
  switch (motionType) {
    case 'zoomOut': {
      const scale = interpolate(localFrame, [0, duration], [1.08, 1.0], { extrapolateRight: 'clamp' });
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
      const scale = interpolate(localFrame, [0, duration], [1.0, 1.08], { extrapolateRight: 'clamp' });
      return `scale(${scale})`;
    }
  }
};

export default function EisenhowerVideo() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Determine active slide
  let activeSlide = slidesWithOffsets[0];
  let activeSlideIndex = 0;
  for (let i = 0; i < slidesWithOffsets.length; i++) {
    if (frame >= slidesWithOffsets[i].from) {
      activeSlide = slidesWithOffsets[i];
      activeSlideIndex = i;
    }
  }

  const localFrame = frame - activeSlide.from;
  const slide1Duration = slidesWithOffsets[0].duration;
  const isWordByWordSlide = Boolean(activeSlide.wordByWord);

  // Video (slide 1) opacity: full until the cut point, then crossfades to 0 over CROSSFADE frames.
  // Slide 2 image fades in simultaneously, creating a true dissolve.
  const videoOpacity = interpolate(
    frame,
    [slide1Duration, slide1Duration + CROSSFADE],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Image layer opacity:
  //   slide 1 (video): hidden
  //   slide 2: crossfade in over CROSSFADE frames
  //   slides 3+: 4-frame hard cut flash
  const isLastSlide = activeSlideIndex === slidesWithOffsets.length - 1;
  const closeFade = isLastSlide
    ? interpolate(localFrame, [activeSlide.duration - 20, activeSlide.duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const cutOpacity =
    activeSlideIndex === 0
      ? 0
      : activeSlideIndex === 1
        ? interpolate(localFrame, [0, CROSSFADE], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : interpolate(localFrame, [0, 4], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

  const imageOpacity = activeSlideIndex === 0 ? 0 : cutOpacity * closeFade;

  const transform = activeSlide.image
    ? getKenBurnsTransform(activeSlide.motionType, localFrame, activeSlide.duration)
    : 'none';

  // Overlay text fades in after overlayDelay, over 18 frames
  const overlayOpacity = activeSlide.overlayText
    ? interpolate(
        localFrame,
        [activeSlide.overlayDelay, activeSlide.overlayDelay + 18],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0;

  // Gold rule width animates in with overlay text
  const ruleWidth = activeSlide.overlayText
    ? interpolate(
        localFrame,
        [activeSlide.overlayDelay, activeSlide.overlayDelay + 25],
        [0, 100],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0;

  // Per-word opacity for slide 5 word-by-word reveal
  const wordOpacities = isWordByWordSlide
    ? QUOTE_WORDS.map((_, wi) => {
        const wordStart = WORD_REVEAL_START + wi * WORD_INTERVAL;
        return interpolate(localFrame, [wordStart, wordStart + 8], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
      })
    : [];

  const textStyle = {
    fontSize: 58,
    fontWeight: 700,
    color: '#F5F0E8',
    margin: 0,
    lineHeight: 1.25,
    textShadow: '0 2px 14px rgba(0,0,0,0.95)',
    fontFamily: "'Oswald', Impact, 'Arial Black', sans-serif",
    letterSpacing: '0.01em',
    // Ensure text wraps within the container on every slide
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'normal',
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/*
        Audio runs in one continuous, uninterrupted stream from frame 0 to end.
        Both tracks are top-level siblings with no Sequence wrapper — completely
        independent of the visual crossfade logic and the OffthreadVideo lifecycle.
      */}
      <Audio src={staticFile('audio/d-day-eisenhower-letter-1944-voiceover.mp3')} />
      <Audio src={staticFile('audio/d-day-eisenhower-letter-1944-music.mp3')} volume={0.15} />
      <style>{`@import url('${OSWALD_URL}');`}</style>

      {/*
        Slide 1: video layer — opacity-controlled crossfade into slide 2.
        No Sequence wrapper: keeping OffthreadVideo alive for the full composition
        duration avoids any Sequence teardown that can glitch the audio pipeline.
        Visibility is controlled entirely by videoOpacity on the parent div.
      */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: videoOpacity,
        }}
      >
        <OffthreadVideo
          src={staticFile('videos/D_Day_Beach.mp4')}
          volume={0}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
          }}
        />
      </div>

      {/* Slides 2–8: still image layer with Ken Burns */}
      {activeSlide.image && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            opacity: imageOpacity,
          }}
        >
          <Img
            src={staticFile(activeSlide.image)}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: activeSlide.objectPosition || 'center center',
              transformOrigin: activeSlide.transformOrigin || '50% 50%',
              transform,
            }}
          />
        </div>
      )}

      {/* Vignette overlay */}
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

      {/* Bottom gradient for text legibility */}
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
            bottom: Math.round(height * 0.12),
            left: 0,
            right: 0,
            // Word-by-word: outer container stays opaque — gold rules animate via ruleWidth,
            // the dark box fades in independently. Standard slides: fade the whole block.
            opacity: isWordByWordSlide ? 1 : overlayOpacity,
            paddingLeft: 48,
            paddingRight: 48,
            boxSizing: 'border-box',
          }}
        >
          {/* Animated gold rule above text */}
          <div
            style={{
              height: 3,
              width: `${ruleWidth}%`,
              backgroundColor: '#C9A84C',
              marginBottom: 16,
              marginLeft: 'auto',
              marginRight: 'auto',
              // Constrain rules to 90% of composition width so they match text block width
              maxWidth: Math.round(width * 0.9),
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
              // Word-by-word: fade the dark box independently from the word spans
              opacity: isWordByWordSlide ? overlayOpacity : 1,
              // Constrain to 90% composition width, centered — prevents word-by-word
              // text from overflowing the frame at any point during the reveal
              maxWidth: Math.round(width * 0.9),
              marginLeft: 'auto',
              marginRight: 'auto',
              boxSizing: 'border-box',
            }}
          >
            {isWordByWordSlide ? (
              <p style={textStyle}>
                {QUOTE_WORDS.map((word, wi) => (
                  <span
                    key={wi}
                    style={{
                      opacity: wordOpacities[wi],
                      marginRight: wi < QUOTE_WORDS.length - 1 ? '0.22em' : 0,
                    }}
                  >
                    {word}
                  </span>
                ))}
              </p>
            ) : (
              <p style={textStyle}>{activeSlide.overlayText}</p>
            )}
          </div>
          {/* Animated gold rule below text */}
          <div
            style={{
              height: 3,
              width: `${ruleWidth}%`,
              backgroundColor: '#C9A84C',
              marginTop: 16,
              marginLeft: 'auto',
              marginRight: 'auto',
              maxWidth: Math.round(width * 0.9),
            }}
          />
        </div>
      )}
    </AbsoluteFill>
  );
}
