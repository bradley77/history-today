export const slides = [
  {
    image: '/slides/Gettysburg/01-lee-portrait.jpg',
    duration: 150,
    motionType: 'zoomIn',
    overlayText: 'It Started 28 Days Earlier',
    overlayDelay: 15,
  },
  {
    image: '/slides/Gettysburg/02-fredericksburg.jpg',
    duration: 150,
    motionType: 'panLeft',
    overlayText: 'June 3, 1863',
    overlayDelay: 20,
  },
  {
    image: '/slides/Gettysburg/03-campaign-map.jpg',
    duration: 165,
    motionType: 'zoomIn',
    overlayText: 'A Hundred Miles Into Pennsylvania',
    overlayDelay: 20,
  },
  {
    image: '/slides/Gettysburg/04-ap-hill.jpg',
    duration: 165,
    motionType: 'panRight',
    overlayText: 'Keep The Fires Burning',
    overlayDelay: 20,
  },
  {
    image: '/slides/Gettysburg/05-river-crossing.jpg',
    duration: 165,
    motionType: 'panLeft',
    overlayText: 'Lee Was Already Gone',
    overlayDelay: 15,
  },
  {
    image: '/slides/Gettysburg/06-battlefield-map.jpg',
    duration: 180,
    motionType: 'zoomIn',
    overlayText: 'He Was Aiming At Harrisburg',
    overlayDelay: 20,
  },
  {
    image: '/slides/Gettysburg/07-lee-standing.jpg',
    duration: 195,
    motionType: 'zoomOut',
    overlayText: 'The Union Was Closing Fast',
    overlayDelay: 15,
  },
  {
    image: '/slides/Gettysburg/08-gettysburg-aftermath.jpg',
    duration: 297,
    motionType: 'zoomOut',
    overlayText: 'Three Days. Fifty Thousand Casualties.',
    overlayDelay: 20,
  },
];

export const FPS = 30;
export const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0);
// Total: 1467 frames = 48.9 seconds at 30fps
