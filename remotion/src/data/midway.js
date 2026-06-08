export const slides = [
  {
    image: '/slides/Battle-of-Midway/01-midway-atoll.jpg',
    duration: 165,
    motionType: 'zoomIn',
    overlayText: 'Japan thought the attack was a secret.\nAmerica was already waiting.',
    overlayDelay: 15,
  },
  {
    image: '/slides/Battle-of-Midway/02-yorktown-burning.jpg',
    duration: 150,
    motionType: 'panLeft',
    overlayText: 'June 1942. The entire Pacific War\ncame down to four days.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Battle-of-Midway/03-hiryu-maneuvering.jpg',
    duration: 195,
    motionType: 'zoomOut',
    overlayText: 'A codebreaker in a Pearl Harbor basement\ncracked Japan\'s operational code.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Battle-of-Midway/04-sand-island-burning.jpg',
    duration: 150,
    motionType: 'panRight',
    overlayText: 'Japan hit Midway hard.\nBut they failed to knock out the runway.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Battle-of-Midway/05-dauntless-bombers.jpg',
    duration: 150,
    motionType: 'zoomIn',
    overlayText: 'Then the dive bombers arrived.\nThree carriers destroyed in six minutes.',
    overlayDelay: 15,
  },
  {
    image: '/slides/Battle-of-Midway/06-yorktown-sinking.jpg',
    duration: 195,
    motionType: 'panLeft',
    overlayText: 'America paid a price.\nUSS Yorktown never came home.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Battle-of-Midway/07-hiryu-burning.jpg',
    duration: 180,
    motionType: 'zoomOut',
    overlayText: 'Four Japanese carriers sent.\nNone returned.',
    overlayDelay: 15,
  },
  {
    image: null,
    duration: 201,
    motionType: null,
    overlayText: 'The spy trick that won the Pacific.\nFollow for more history they didn\'t teach you.',
    overlayDelay: 20,
    isCTA: true,
  },
];

export const FPS = 30;
export const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0);
// Total: 1386 frames = 46.2 seconds at 30fps
