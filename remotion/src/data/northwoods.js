export const TITLE_CARD_DURATION = 60; // 2 seconds at 30fps
export const FPS = 30;

export const slides = [
  {
    image: '/slides/Northwood/01-memo-cover.jpg',
    duration: 237,
    motionType: 'zoomIn',
    overlayText: 'OPERATION NORTHWOODS — MARCH 13, 1962',
    overlayDelay: 15,
  },
  {
    image: '/slides/Northwood/02-kennedy-joint-chiefs.jpg',
    duration: 185,
    motionType: 'panLeft',
    overlayText: 'KENNEDY AND THE JOINT CHIEFS OF STAFF',
    overlayDelay: 20,
  },
  {
    image: '/slides/Northwood/03-pretexts-list.jpg',
    duration: 135,
    motionType: 'zoomOut',
    overlayText: 'THIRTY-THREE PROPOSED PRETEXTS FOR WAR',
    overlayDelay: 15,
  },
  {
    image: '/slides/Northwood/04-terror-campaign.jpg',
    duration: 274,
    motionType: 'none',
    objectFit: 'contain',
    overlayText: 'Their words. Not ours.',
    overlayDelay: 20,
    overlayYFrac: 0.80,      // top of overlay at 80% down — keeps it below the document body text
  },
  {
    image: '/slides/Northwood/05-lemnitzer-portrait.jpg',
    duration: 111,
    motionType: 'zoomIn',
    overlayText: 'GEN. LYMAN LEMNITZER — CHAIRMAN, JOINT CHIEFS',
    overlayDelay: 15,
  },
  {
    image: '/slides/Northwood/06-kennedy-oval-office.jpg',
    duration: 195,
    motionType: 'panLeft',
    overlayText: 'KENNEDY REJECTED IT. CLASSIFIED FOR 35 YEARS.',
    overlayDelay: 20,
  },
  {
    // Tight crop of the UNCLASSIFIED stamp from the top of the memo cover
    image: '/slides/Northwood/07-memo-cover-crop.jpg',
    duration: 45,
    motionType: 'zoomIn',
    overlayText: null,
    overlayDelay: 0,
  },
  {
    // Black screen CTA hold
    image: null,
    duration: 200,
    motionType: null,
    overlayText: null,
    overlayDelay: 0,
    cta: {
      main: ['This was one program.', 'There were others.'],
      sub: ['Follow the page.', 'Episode 2 drops next week.'],
    },
  },
];

export const slidesDuration = slides.reduce((sum, s) => sum + s.duration, 0);
// slidesDuration: 1382 frames
export const totalDuration = TITLE_CARD_DURATION + slidesDuration;
// totalDuration: 1442 frames = 48.1 seconds at 30fps
