import { staticFile } from 'remotion';

export const slides = [
  {
    image: '/slides/Korematsu/01-korematsu-portrait.jpg',
    duration: 270,
    motionType: 'zoomIn',
    overlayText: null,
    overlayDelay: 0,
  },
  {
    image: '/slides/Korematsu/02-executive-order-9066.jpg',
    duration: 270,
    motionType: 'panLeft',
    overlayText: 'Signed February 19, 1942',
    overlayDelay: 30,
  },
  {
    image: '/slides/Korematsu/03-arrival-wide.jpg',
    duration: 240,
    motionType: 'zoomOut',
    overlayText: '120,000 people. Ordered to leave.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Korematsu/04-arrival-family.jpg',
    duration: 240,
    motionType: 'panRight',
    overlayText: null,
    overlayDelay: 0,
  },
  {
    image: '/slides/Korematsu/05-barracks-cot.jpg',
    duration: 270,
    motionType: 'zoomIn',
    overlayText: 'This was home now.',
    overlayDelay: 25,
  },
  {
    image: '/slides/Korematsu/06-barracks-family.jpg',
    duration: 240,
    motionType: 'panLeft',
    overlayText: null,
    overlayDelay: 0,
  },
  {
    image: '/slides/Korematsu/07-manzanar-wide.jpg',
    duration: 270,
    motionType: 'zoomOut',
    overlayText: 'The military said it was necessary. Their own report said otherwise.',
    overlayDelay: 30,
  },
  {
    image: '/slides/Korematsu/08-camp-children.jpg',
    duration: 321,
    motionType: 'zoomIn',
    overlayText: '"Don\'t be afraid to speak up." — Fred Korematsu',
    overlayDelay: 20,
  },
];

export const FPS = 30;
export const totalDuration = 2121;
