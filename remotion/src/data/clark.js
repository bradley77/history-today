export const slides = [
  {
    image: '/slides/Clark/01-clark-jeep.jpg',
    duration: 197,
    motionType: 'zoomIn',
    overlayText: 'June 4, 1944',
    overlayDelay: 15,
  },
  {
    image: '/slides/Clark/02-clark-portrait.jpg',
    duration: 266,
    motionType: 'zoomIn',
    overlayText: 'General Mark Clark',
    overlayDelay: 20,
  },
  {
    image: '/slides/Clark/03-clark-generals.jpg',
    duration: 185,
    motionType: 'gentleZoomIn',
    containMode: true,
    overlayText: 'He Changed The Orders',
    overlayDelay: 15,
  },
  {
    image: '/slides/Clark/04-cassino.jpg',
    duration: 171,
    motionType: 'panLeft',
    overlayText: 'Nine Months Through Hell',
    overlayDelay: 15,
  },
  {
    video: '/videos/05-clark-convoy.mp4',
    duration: 300,
    motionType: null,
    overlayText: 'Clark Rode Into Rome',
    overlayDelay: 15,
  },
  {
    image: '/slides/Clark/06-flag-rome.jpg',
    duration: 107,
    motionType: 'zoomIn',
    overlayText: 'The First Axis Capital',
    overlayDelay: 10,
  },
  {
    image: '/slides/Clark/07-dday.jpg',
    duration: 113,
    motionType: 'zoomIn',
    overlayText: 'He Had 48 Hours',
    overlayDelay: 10,
  },
  {
    image: '/slides/Clark/01-clark-jeep.jpg',
    duration: 134,
    motionType: 'zoomIn',
    overlayText: 'Did He Trade Victory For A Photo?',
    overlayDelay: 15,
  },
];

export const FPS = 30;
export const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0);
// Total: 1473 frames = 49.1 seconds at 30fps
// Durations derived from silence-detection on clark-voiceover.mp3
