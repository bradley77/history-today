import { staticFile } from 'remotion';

// ─── Edit these two sections for each new article video ──────────────────────
//
// voiceoverDurationSeconds: set this to the length of your voiceover MP3.
//   totalDuration = ceil(seconds * 30) frames. Root.jsx uses this directly.
//
// slides: use weight (relative screen time) instead of fixed frame counts.
//   A weight:2 slide gets twice the runtime of a weight:1 slide.
//   focalPoint: objectPosition for cover slides, ignored for blurBackground slides.
//   blurBackground: true for landscape images — shows full image over a blurred fill.
//
// ─────────────────────────────────────────────────────────────────────────────

const voiceoverDurationSeconds = 157;

const _slides = [
  {
    image: staticFile('slides/wwii-memorial-2004-02.jpg'),
    weight: 1,
    kenBurns: 'zoomIn',
    focalPoint: { x: '50%', y: '50%' },
    text: null,
    textPosition: null,
  },
  {
    image: staticFile('slides/wwii-memorial-2004-02.jpg'),
    weight: 2,
    kenBurns: 'panLeft',
    focalPoint: { x: '50%', y: '50%' },
    text: '4,048 STARS. EACH ONE = 100 AMERICANS.',
    textPosition: 'top',
  },
  {
    image: staticFile('slides/wwii-memorial-2004-03.jpg'),
    weight: 2,
    kenBurns: 'zoomIn',
    blurBackground: true,
    text: null,
    textPosition: null,
  },
  {
    image: staticFile('slides/wwii-memorial-2004-04.jpg'),
    weight: 2,
    kenBurns: 'zoomOut',
    blurBackground: true,
    text: '17 YEARS. ONE QUESTION. ONE VETERAN.',
    textPosition: 'top',
  },
  {
    image: staticFile('slides/wwii-memorial-2004-01.jpg'),
    weight: 1,
    kenBurns: 'zoomIn',
    focalPoint: { x: '50%', y: '40%' },
    text: null,
    textPosition: null,
  },
];

// ─── Derived values — do not edit below this line ────────────────────────────

export const totalDuration = Math.ceil(voiceoverDurationSeconds * 30);

const totalWeight = _slides.reduce((sum, s) => sum + s.weight, 0);

let _assigned = 0;
const slidesWithDuration = _slides.map((slide, i) => {
  const duration =
    i === _slides.length - 1
      ? totalDuration - _assigned
      : Math.round((slide.weight / totalWeight) * totalDuration);
  _assigned += duration;
  return { ...slide, duration };
});

export const config = {
  voiceoverDurationSeconds,
  voiceover: staticFile('audio/voiceover.mp3'),
  music: staticFile('audio/music.mp3'),
  musicVolume: 0.18,
  musicFadeInFrames: 30,
  musicFadeOutFrames: 60,
  sfx: [],
  slides: slidesWithDuration,
};
