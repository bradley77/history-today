import { staticFile } from 'remotion';

// ─── Edit this file for each new article video ───────────────────────────────
//
// duration: frames at 30fps  (90 = 3 s, 112 = 3.7 s, 120 = 4 s)
// title / subtitle: set to null to hide the overlay on that slide
// audio: set to null to disable background music
//
// Total frames must equal the durationInFrames in Root.jsx (default 900 = 30 s)
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  slides: [
    {
      image: staticFile('slides/slide-01.png'),
      title: 'Slide One Title',
      subtitle: 'Optional subtitle',
      duration: 112,
    },
    {
      image: staticFile('slides/slide-02.png'),
      title: 'Slide Two Title',
      subtitle: null,
      duration: 112,
    },
    {
      image: staticFile('slides/slide-03.png'),
      title: 'Slide Three Title',
      subtitle: 'Optional subtitle',
      duration: 112,
    },
    {
      image: staticFile('slides/slide-04.png'),
      title: 'Slide Four Title',
      subtitle: null,
      duration: 112,
    },
    {
      image: staticFile('slides/slide-05.png'),
      title: 'Slide Five Title',
      subtitle: 'Optional subtitle',
      duration: 112,
    },
    {
      image: staticFile('slides/slide-06.png'),
      title: 'Slide Six Title',
      subtitle: null,
      duration: 112,
    },
    {
      image: staticFile('slides/slide-07.png'),
      title: 'Slide Seven Title',
      subtitle: 'Optional subtitle',
      duration: 112,
    },
    {
      image: staticFile('slides/slide-08.png'),
      title: 'Slide Eight Title',
      subtitle: null,
      duration: 116,
    },
  ],
  // Set to staticFile('audio/background.mp3') when you have an audio file
  audio: null,
  audioVolume: 0.3,
};

export const totalDuration = config.slides.reduce((sum, s) => sum + s.duration, 0);
