// Slide durations are derived from per-segment Kokoro timing measurements,
// scaled proportionally so the total equals the combined voiceover MP3 (1662 frames = 55.4s).
export const slides = [
  {
    type: 'video',
    src: 'videos/D_Day_Beach.mp4',
    duration: 136, // measured: 4.52s
    overlayText: 'The night before D-Day, Eisenhower wrote a letter no one was supposed to read.',
    overlayDelay: 10,
  },
  {
    image: 'slides/Eisenhower/02-into-jaws-of-death.jpg',
    duration: 206, // measured: 7.30s scaled
    motionType: 'zoomIn',
    objectPosition: '40% center',  // soldiers in center-left are the focal point, not the ramp
    transformOrigin: '40% 50%',    // match Ken Burns anchor to the same focal point
    overlayText: 'June 6, 1944. The largest invasion in history.',
    overlayDelay: 15,
  },
  {
    image: 'slides/Eisenhower/03-ike-101st-airborne.jpg',
    duration: 254, // measured: 8.96s scaled
    motionType: 'panLeft',
    overlayText: 'He walked among the paratroopers the night before they jumped.',
    overlayDelay: 15,
  },
  {
    image: 'slides/Eisenhower/04-ike-at-desk.jpg',
    duration: 222, // measured: 7.83s scaled
    motionType: 'zoomIn',
    overlayText: 'A fake army under Patton kept Germany looking the wrong way.',
    overlayDelay: 15,
  },
  {
    image: 'slides/Eisenhower/05-failure-letter.jpg',
    duration: 197, // measured: 6.95s scaled
    motionType: 'zoomIn',
    wordByWord: true,
    overlayText: 'If any blame or fault attaches to the attempt, it is mine alone.',
    overlayDelay: 75, // gold rules appear just before word reveal starts
  },
  {
    image: 'slides/Eisenhower/06-aerial-beach.jpg',
    duration: 313, // measured: 11.07s scaled
    motionType: 'zoomOut',
    overlayText: 'On Omaha Beach, 27 of 32 tanks sank before reaching shore.',
    overlayDelay: 10,
  },
  {
    image: 'slides/Eisenhower/07-letter-rediscovered.jpg',
    duration: 180, // measured: 6.38s scaled
    motionType: 'panLeft',
    overlayText: 'Five weeks later, he found the note still in his wallet.',
    overlayDelay: 15,
  },
  {
    image: 'slides/Eisenhower/05-failure-letter.jpg',
    duration: 154, // measured: 5.48s scaled
    motionType: 'zoomIn',
    overlayText: 'Follow the page for more history they never taught you.',
    overlayDelay: 20,
  },
];

export const FPS = 30;
export const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0);
// Total: 1662 frames = 55.4s — matches d-day-eisenhower-letter-1944-voiceover.mp3 exactly
