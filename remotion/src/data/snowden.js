import { staticFile } from 'remotion';

export const slides = [
  {
    image: '/slides/Snowden/01-nsa-headquarters.jpg',
    duration: 215,
    motionType: 'zoomIn',
    overlayText: 'NSA Headquarters — Fort Meade, Maryland.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Snowden/02-snowden-portrait.jpg',
    duration: 250,
    motionType: 'zoomOut',
    overlayText: 'Edward Snowden. Age 29. CIA trained. NSA credentialed.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Snowden/03-clapper-portrait.jpg',
    duration: 290,
    motionType: 'panLeft',
    overlayText: 'James Clapper. Director of National Intelligence. Under oath: "No."',
    overlayDelay: 20,
  },
  {
    image: '/slides/Snowden/04-prism-slide.jpg',
    duration: 255,
    motionType: 'zoomInAggressive',
    transformOrigin: '65% 70%',
    contain: true,
    overlayText: 'PRISM. Top Secret. Nine companies. All your data.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Snowden/05-xkeyscore-slide.jpg',
    duration: 270,
    motionType: 'zoomInAggressive',
    transformOrigin: '25% 50%',
    contain: true,
    containBackground: '#1a1a1a',
    overlayText: 'XKEYSCORE. All internet traffic. Everyone.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Snowden/06-sheremetyevo-airport.jpg',
    duration: 230,
    motionType: 'zoomOut',
    overlayText: 'Sheremetyevo Airport. Moscow. He\'s still there.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Snowden/07-nsa-verdict.jpg',
    duration: 290,
    motionType: 'panLeft',
    overlayText: '2020: Federal court — it was illegal. No one was charged. Follow the channel.',
    overlayDelay: 20,
  },
];

export const FPS = 30;
export const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0);
// Total: 1800 frames = 60 seconds at 30fps
