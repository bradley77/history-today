// Echo & Chronicle — Data config for Watergate video
// "The Morning the Post Didn't Know What It Had"
//
// NOTE ON LENGTH: total spoken duration runs ~49.5s, slightly over the
// 42-45s target. Left intentionally untrimmed (same call made on Northwoods,
// which ran 45.5s) because slides 02, 03, and 08 carry the narrative
// backbone (introducing Wills, explaining his absence, the resignation
// closer) and trimming them weakens the story more than the extra seconds
// cost on TikTok/Reels/Shorts, all of which tolerate up to 60s.
//
// Per E&C convention: each slide gets its OWN voiceover file (never one
// continuous track). durationInFrames per slide = actual generated audio
// length + 0.4s pad, converted to frames at 30fps.
//
// FIT MODE: 'cover' crops to fill the 1080x1920 frame (fine for photos).
// 'contain' shrinks the full image into frame with a blurred duplicate
// of itself as background fill, used for document/text-heavy slides
// (security log, address book) where cropping clips real content.

export const watergateConfig = {
  music: 'audio/watergate.mp3',
  musicVolume: 0.15,
  fps: 30,

  slides: [
    {
      image: 'slides/Watergate/01-watergate-complex-exhibit.jpg',
      audio: 'audio/watergate-vo-01.mp3',
      durationInFrames: 146, // 4.48s + 0.4s pad
      kenBurns: 'zoomIn',
      fit: 'cover',
      textHook: "THE BUILDING THAT ENDED A PRESIDENCY",
      textPosition: 'bottom',
      fadeIn: true, // cold open on slide 1 — opacity is 1 from frame 0, NOT a fade from black
      fadeOut: false,
    },
    {
      image: 'slides/Watergate/02-security-log.jpg',
      audio: 'audio/watergate-vo-02.mp3',
      durationInFrames: 206, // 6.46s + 0.4s pad
      kenBurns: 'zoomIn',
      fit: 'contain',
      textHook: "1:47 AM. A SECURITY GUARD WROTE THIS.",
      textPosition: 'bottom',
      fadeIn: false,
      fadeOut: false,
    },
    {
      image: 'slides/Watergate/03-address-book.jpg',
      audio: 'audio/watergate-vo-03.mp3',
      durationInFrames: 228, // 7.21s + 0.4s pad
      kenBurns: 'zoomIn',
      fit: 'contain',
      textHook: "NO PHOTO OF HIM EXISTS IN THE PUBLIC RECORD",
      textPosition: 'bottom',
      fadeIn: false,
      fadeOut: false,
    },
    {
      image: 'slides/Watergate/04-recorder-typewriter-wide.jpg',
      audio: 'audio/watergate-vo-04.mp3',
      durationInFrames: 156, // 4.80s + 0.4s pad
      kenBurns: 'zoomIn',
      fit: 'contain',
      containScale: 1.28,
      textHook: "WHAT THE BURGLARS LEFT BEHIND",
      textPosition: 'bottom',
      fadeIn: false,
      fadeOut: false,
    },
    {
      image: 'slides/Watergate/05-recorder-exhibit-tag.jpg',
      audio: 'audio/watergate-vo-05.mp3',
      durationInFrames: 179, // 5.57s + 0.4s pad
      kenBurns: 'zoomIn',
      fit: 'cover',
      textHook: "EVIDENCE. NOT A PROP.",
      textPosition: 'bottom',
      fadeIn: false,
      fadeOut: false,
    },
    {
      image: 'slides/Watergate/06-chapstick-mics.jpg',
      audio: 'audio/watergate-vo-06.mp3',
      durationInFrames: 202, // 6.34s + 0.4s pad
      kenBurns: 'zoomIn',
      fit: 'cover',
      textHook: "MICROPHONES, HIDDEN IN PLAIN SIGHT",
      textPosition: 'bottom',
      fadeIn: false,
      fadeOut: false,
    },
    {
      image: 'slides/Watergate/07-impeach-protest.jpg',
      audio: 'audio/watergate-vo-07.mp3',
      durationInFrames: 159, // 4.91s + 0.4s pad
      kenBurns: 'zoomIn',
      fit: 'cover',
      textHook: "TWO YEARS LATER, THE COUNTRY KNEW",
      textPosition: 'bottom',
      fadeIn: false,
      fadeOut: false,
    },
    {
      image: 'slides/Watergate/08-nixon-departure.jpg',
      audio: 'audio/watergate-vo-08.mp3',
      durationInFrames: 226, // 7.13s + 0.4s pad
      kenBurns: 'zoomIn',
      fit: 'cover',
      textHook: "WOULD YOU HAVE WALKED AWAY?",
      textPosition: 'bottom',
      fadeIn: false,
      fadeOut: true,
    },
  ],
};

export const watergateSlidesWithOffsets = watergateConfig.slides.map((slide, i) => ({
  ...slide,
  from: watergateConfig.slides
    .slice(0, i)
    .reduce((sum, s) => sum + s.durationInFrames, 0),
}));

export const watergateTotalDuration = watergateConfig.slides.reduce(
  (sum, s) => sum + s.durationInFrames,
  0
); // 1502 frames @ 30fps = 50.07s

// Voiceover lines for reference / regeneration if needed:
// 01: "This building ended a presidency. Not the man inside it. The building itself."
// 02: "At one forty seven in the morning, a guard found tape on a door. He called the police. His name was Frank Wills."
// 03: "You will not see his face in this video. History remembers his call. It forgot his face. So instead, you are seeing what he saw."
// 04: "Inside, police found a tape recorder built to capture every phone call in the office."
// 05: "This exact recorder became Government Exhibit forty seven, the centerpiece of a federal trial."
// 06: "Microphones disguised as lip balm, built to listen to the Democratic Party without anyone noticing."
// 07: "Two years later, the cover up unraveled completely, and the country demanded answers."
// 08: "On August ninth, nineteen seventy four, he became the only president to resign. It started with a guard, and some tape."
