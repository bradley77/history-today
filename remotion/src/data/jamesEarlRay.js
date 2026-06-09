import { staticFile } from 'remotion';

export const slides = [
  {
    image: '/slides/JamesEarlRay/01-lorraine-motel-balcony.jpg',
    duration: 210,
    motionType: 'zoomIn',
    overlayText: "CONGRESS SAID HE PROBABLY DIDN'T ACT ALONE",
    overlayDelay: 15,
  },
  {
    image: '/slides/JamesEarlRay/02-mlk-portrait.jpg',
    duration: 180,
    motionType: 'zoomOut',
    overlayText: 'APRIL 4, 1968 — MEMPHIS, TENNESSEE',
    overlayDelay: 20,
  },
  {
    image: '/slides/JamesEarlRay/03-ray-mugshot-1955.jpg',
    duration: 180,
    motionType: 'panRight',
    overlayText: 'JAMES EARL RAY — ESCAPED CONVICT',
    overlayDelay: 20,
  },
  {
    image: '/slides/JamesEarlRay/04-eric-starvo-galt-wanted.jpg',
    duration: 210,
    motionType: 'zoomIn',
    overlayText: 'THE FBI WAS HUNTING A GHOST',
    overlayDelay: 15,
  },
  {
    image: '/slides/JamesEarlRay/05-rooming-house-window.jpg',
    duration: 210,
    motionType: 'panLeft',
    overlayText: 'THE VIEW FROM WHERE THE SHOT WAS FIRED',
    overlayDelay: 20,
  },
  {
    image: '/slides/JamesEarlRay/06-ray-wanted-poster.jpg',
    duration: 240,
    motionType: 'zoomOut',
    overlayText: 'SIGNED BY J. EDGAR HOOVER',
    overlayDelay: 20,
  },
  {
    image: '/slides/JamesEarlRay/07-hsca-report-cover.jpg',
    duration: 210,
    motionType: 'panLeft',
    overlayText: '1979 — CONGRESS INVESTIGATED',
    overlayDelay: 15,
  },
  {
    image: '/slides/JamesEarlRay/01-lorraine-motel-balcony.jpg',
    duration: 240,
    motionType: 'zoomOut',
    overlayText: 'LINK IN BIO — FOLLOW FOR MORE',
    overlayDelay: 20,
  },
];

export const FPS = 30;
export const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0);
// Total: 1680 frames = 56 seconds at 30fps
