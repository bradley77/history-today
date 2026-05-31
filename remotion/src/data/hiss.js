import { staticFile } from 'remotion';

export const slides = [
  {
    image: '/slides/Hiss/01-alger-hiss-testimony.jpg',
    duration: 150,
    motionType: 'zoomIn',
    overlayText: 'The most trusted man in Washington was a Soviet spy.',
    overlayDelay: 15,
  },
  {
    image: '/slides/Hiss/02-state-department.jpg',
    duration: 150,
    motionType: 'panLeft',
    overlayText: 'Executive Office Building. Washington, D.C.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Hiss/03-whittaker-chambers.jpg',
    duration: 150,
    motionType: 'zoomIn',
    overlayText: 'The accuser.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Hiss/04-hiss-huac-subpoena.jpg',
    duration: 150,
    motionType: 'panRight',
    overlayText: 'HUAC Subpoena — August 18, 1948',
    overlayDelay: 20,
  },
  {
    image: '/slides/Hiss/05-pumpkin-papers-canisters.jpg',
    duration: 165,
    motionType: 'panLeft',
    overlayText: 'Inside a hollowed-out pumpkin.',
    overlayDelay: 15,
  },
  {
    image: '/slides/Hiss/06-nixon-stripling-pumpkin-papers.jpg',
    duration: 150,
    motionType: 'zoomIn',
    overlayText: 'Nixon made his career on this moment.',
    overlayDelay: 20,
  },
  {
    image: '/slides/Hiss/07-fbi-hiss-intelligence-chart.jpg',
    duration: 150,
    motionType: 'zoomOut',
    overlayText: 'The FBI had a file on him for years.',
    overlayDelay: 15,
  },
  {
    image: '/slides/Hiss/08-alger-hiss-testimony.jpg',
    duration: 195,
    motionType: 'zoomOut',
    overlayText: 'Was he guilty? Read the full story. Link in bio.',
    overlayDelay: 20,
  },
];

export const FPS = 30;
export const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0);
// Total: 1260 frames = 42 seconds at 30fps
