// WildernessScene.ts
// Episode 1 data — "The Chance Encounter", May 5, 1864
// Follows the BattleMapScene type from BattleMapConfig.ts, same per-battle
// data file pattern as QuickStrike's per-video data files.
//
// COORDINATE CONFIDENCE NOTES (remove once verified/refined):
// - wildernessTavern, turnpikeGermannaJunction, saundersField, brockRoadJunction
//   are pixel-mapped against the real 1864 Meade map (wilderness-1864.jpg) and
//   cross-checked against modern reference maps. Good confidence.
// - ewellStart and hillStart are rough estimates (west along the Turnpike and
//   Plank Road respectively, off-camera at scene open). Not pixel-mapped yet.
//
// TIMELINE NOTE: every frame number below was rescaled from the original
// first-draft placeholder timeline (0-2520 frames, even-width guessed beats)
// to match the REAL measured Kokoro VO durations for each of the 10 beats
// (see remotion/scripts/generateVoiceover-wilderness-ep1.py + ffprobe).
// Method: for every camera keyframe / unit path waypoint / label enter-exit
// / impact frame, find its proportional position (0.0-1.0) within whichever
// OLD beat window it fell in, then place it at the same proportional
// position within the corresponding NEW (real-duration) beat window. This
// preserves the choreography/pacing already tuned, just fit to real audio.
// Old -> new beat windows:
//   Beat 1:  0-300    -> 0-862     (vo-01, 28.7s — nearly 3x the old window;
//                                    see the added mid-beat camera drift below)
//   Beat 2:  300-540   -> 862-1190   (vo-02)
//   Beat 3:  540-780   -> 1190-1548  (vo-03)
//   Beat 4:  780-1080  -> 1548-1963  (vo-04)
//   Beat 5:  1080-1320 -> 1963-2393  (vo-05)
//   Beat 6:  1320-1620 -> 2393-2643  (vo-06)
//   Beat 7:  1620-1800 -> 2643-2782  (vo-07)
//   Beat 8:  1800-2040 -> 2782-3120  (vo-08)
//   Beat 9:  2040-2340 -> 3120-3418  (vo-09)
//   Beat 10: 2340-2520 -> 3418-3585  (vo-10)

import type { BattleMapScene, Beat } from "../shared/BattleMapConfig";

const FPS = 30;

// Named anchor points, % of map width/height (matches wilderness-1864.jpg)
const wildernessTavern = { x: 50.6, y: 30.1 };
const turnpikeGermannaJunction = { x: 42.2, y: 25.6 };
const saundersField = { x: 29.5, y: 32.2 };
const brockRoadJunction = { x: 61.5, y: 53.6 };

// Rough estimates, not yet pixel-mapped — refine before final render
const ewellStart = { x: 18, y: 34 };
const hillStart = { x: 20, y: 50 };
const rapidanBend = { x: 45, y: 8 };

const beats: Beat[] = [
  { id: "vo-01", audioSrc: "/audio/wilderness-ep1-vo-01.mp3", startFrame: 0, durationInFrames: 862 },
  { id: "vo-02", audioSrc: "/audio/wilderness-ep1-vo-02.mp3", startFrame: 862, durationInFrames: 328 },
  { id: "vo-03", audioSrc: "/audio/wilderness-ep1-vo-03.mp3", startFrame: 1190, durationInFrames: 358 },
  { id: "vo-04", audioSrc: "/audio/wilderness-ep1-vo-04.mp3", startFrame: 1548, durationInFrames: 415 },
  { id: "vo-05", audioSrc: "/audio/wilderness-ep1-vo-05.mp3", startFrame: 1963, durationInFrames: 430 },
  { id: "vo-06", audioSrc: "/audio/wilderness-ep1-vo-06.mp3", startFrame: 2393, durationInFrames: 250 },
  { id: "vo-07", audioSrc: "/audio/wilderness-ep1-vo-07.mp3", startFrame: 2643, durationInFrames: 139 },
  { id: "vo-08", audioSrc: "/audio/wilderness-ep1-vo-08.mp3", startFrame: 2782, durationInFrames: 338 },
  { id: "vo-09", audioSrc: "/audio/wilderness-ep1-vo-09.mp3", startFrame: 3120, durationInFrames: 298 },
  { id: "vo-10", audioSrc: "/audio/wilderness-ep1-vo-10.mp3", startFrame: 3418, durationInFrames: 167 },
];

export const wildernessEpisode1: BattleMapScene = {
  mapImageSrc: "/maps/wilderness-1864.jpg",
  totalDurationInFrames: 3585, // matches beats[9].startFrame + beats[9].durationInFrames

  camera: [
    // 1. Setup — Rapidan crossings (0:00–0:28.7)
    // zoom raised from 1.0 and y nudged down from rapidanBend's raw 8 (too
    // close to the map's true top edge at this tilt — the tilted plane ran
    // out of map before filling frame, showing backdrop above it even with
    // the gradient fix). tilt dropped from 40 to 18: the real culprit for
    // the leftover void wasn't zoom, it was a steep rotateX at low zoom not
    // reaching the top of a portrait frame. Shallower tilt here, steeper
    // tilt is reserved for the tighter push-in beats below (Saunders Field,
    // Brock Road, etc.).
    //
    // Beat 1 is now 862 frames (28.7s at 30fps) — nearly 3x what this single
    // slow push was designed for, since the real VO for this beat runs much
    // longer than the placeholder timeline assumed. A straight two-point
    // rescale would leave the camera nearly motionless for 28+ seconds, so
    // this stays at the single rapidanBend location but breaks the one long
    // linear zoom into two shorter eased legs with a small y-nudge at the
    // midpoint — reading as an intentional slow breath rather than a frozen
    // frame, without introducing a second location. Still the slowest
    // movement in the episode: barely-there zoom (1.45->1.5->1.55) and a
    // 1-point y drift across nearly 29s, versus every other beat's much
    // faster push-ins.
    { frame: 0, x: rapidanBend.x, y: rapidanBend.y + 6, zoom: 1.45, tilt: 18 },
    { frame: 431, x: rapidanBend.x, y: rapidanBend.y + 5, zoom: 1.5, tilt: 18, easing: "easeInOut" },
    { frame: 862, x: rapidanBend.x, y: rapidanBend.y + 6, zoom: 1.55, tilt: 18, easing: "easeInOut" },

    // 2. Lee's decision — pan down toward the two roads (0:28.7–0:39.7)
    // Reverted the "cut to Ewell's road, cut to Hill's road" keyframes
    // (ewellStart.x=18/hillStart.x=20, both ~24-30 points from center) —
    // that large an x offset combined with rotateX+perspective produced a
    // visibly skewed trapezoid with a lopsided black gap on one side,
    // instead of a clean cut. turnpikeGermannaJunction.x=42.2 sits much
    // closer to center and has never shown this distortion, so this beat is
    // a single smooth easeInOut move into this framing — the same
    // arrangement that existed before the choreography pass. Punting the
    // two-road glimpse idea to a later pass once this transform's safe
    // x-offset range is understood (see options 1/2 from the
    // camera-choreography round this reverts).
    { frame: 1190, x: turnpikeGermannaJunction.x, y: turnpikeGermannaJunction.y, zoom: 1.0, tilt: 42, easing: "easeInOut" },

    // 3. The collision, 7 AM — push toward Saunders Field (0:39.7–0:51.6)
    { frame: 1548, x: saundersField.x, y: saundersField.y, zoom: 1.3, tilt: 44, easing: "easeInOut" },

    // 4. Saunders Field breaks open — arrive early, then hold (0:51.6–1:05.4)
    // Proportionally reaches its zoomed-in framing at the same ~58% point
    // into this beat as the original design (was 120/300 frames in a
    // 300-frame beat; now 166/415 in a 415-frame beat), then holds static
    // through the back half — Ewell/Warren's converging unit movement
    // carries the visible motion here instead of the camera also zooming.
    { frame: 1714, x: saundersField.x, y: saundersField.y, zoom: 1.9, tilt: 46, easing: "easeInOut" }, // arrive
    { frame: 1963, x: saundersField.x, y: saundersField.y, zoom: 1.9, tilt: 46, easing: "easeInOut" }, // hold (unchanged endpoint)

    // 5. Second collision — Plank Road — pan south (1:05.4–1:19.8)
    { frame: 2393, x: hillStart.x + 8, y: hillStart.y, zoom: 1.4, tilt: 44, easing: "easeInOut" },

    // 6. Race for Brock Road — push toward the junction (1:19.8–1:28.1)
    { frame: 2643, x: brockRoadJunction.x, y: brockRoadJunction.y, zoom: 1.6, tilt: 45, easing: "easeInOut" },

    // 7. Getty holds — static tension hold (1:28.1–1:32.7)
    { frame: 2782, x: brockRoadJunction.x, y: brockRoadJunction.y, zoom: 1.8, tilt: 45 },

    // 8. Hancock arrives — pull back to reveal the whole battlefield (1:32.7–1:44.0)
    // Recentered/widened from a Brock-Road/Tavern-only midpoint to the
    // bounding-box center of Saunders Field + Wilderness Tavern + Brock
    // Road (x: (29.5+61.5)/2=45.5, y: (30.1+53.6)/2=41.85), at a zoom low
    // enough to fit that whole span. tilt dropped from 40 to 18 to match:
    // this zoom is now below the ~1.2 threshold where the steeper push-in
    // tilt leaves a gap above the map (same rule applied to the wide shots
    // at the start/end of the scene).
    { frame: 3120, x: 45.5, y: 41.85, zoom: 0.95, tilt: 18, easing: "easeInOut" },

    // 9. Nightfall — slow pull back to wide (1:44.0–1:55.7)
    { frame: 3418, x: wildernessTavern.x, y: wildernessTavern.y, zoom: 0.95, tilt: 18, easing: "easeInOut" },

    // 10. Cliffhanger — hold wide (1:55.7–1:59.5)
    { frame: 3585, x: wildernessTavern.x, y: wildernessTavern.y, zoom: 0.95, tilt: 18 },
  ],

  units: [
    {
      // Scene-setting unit for beat 1 only — gives the ~29s Rapidan-crossing
      // beat an actual moving element beyond the breathing-zoom camera drift
      // (see camera keyframes above). Distinct from warren-corps/the other
      // named-corps units below: this is Grant's army crossing at Germanna
      // Ford and marching into the Wilderness per the beat-1 narration, not
      // one of the five corps commanders who get their own proper story
      // entrances starting at beat 2 — so it enters/exits entirely within
      // beat 1 and is fully gone before ewell-corps/warren-corps appear.
      id: "grant-column",
      side: "union",
      label: "Army of the Potomac",
      enterFrame: 80, // after the title card (enterFrame 0, exitFrame 776) has had a moment to establish
      exitFrame: 862, // gone by the end of beat 1, before the named-corps units start at frame 1190
      path: [
        // Germanna Ford crossing — verified against the map where the
        // Germanna Plank Road and a river tributary converge at the top
        // border. y raised from the crossing's raw 1.7 to 6 — at 1.7 the
        // unit box+label straddled the seam between the map's physical top
        // edge and the dark backdrop above it during the wide establishing
        // shot, rendering with part of the block floating in the backdrop
        // void. y: 6 gives enough clearance to sit fully on the map at this
        // beat's framing while still reading as "near the top of the map,
        // close to the river" rather than already deep in the interior.
        { frame: 80, x: 61.1, y: 6, rotation: -25 },
        // Marches south/southwest into the Wilderness over the rest of the
        // beat, toward roughly where turnpikeGermannaJunction sits — the
        // "moving quickly through the Wilderness toward open ground"
        // described in the beat-1 narration.
        { frame: 862, x: turnpikeGermannaJunction.x, y: turnpikeGermannaJunction.y, rotation: -25 },
      ],
    },
    {
      id: "ewell-corps",
      side: "confederate",
      label: "Ewell",
      // enterFrame matches the camera's arrival at beat 2 (frame 1190), so
      // Ewell starts fresh at ewellStart the moment it fades in instead of
      // already being mid-transit toward Saunders Field. Mirrors
      // warren-corps below (same enterFrame, same travel window) — both
      // sides converge on Saunders Field in the same span, matching the
      // "collision" beat.
      enterFrame: 1190,
      path: [
        { frame: 1190, x: ewellStart.x, y: ewellStart.y, rotation: 20 },
        { frame: 1548, x: saundersField.x - 3, y: saundersField.y - 1, rotation: 15 },
        { frame: 3418, x: saundersField.x - 3, y: saundersField.y - 1, rotation: 15 },
      ],
    },
    {
      id: "warren-corps",
      side: "union",
      label: "Warren",
      enterFrame: 1190,
      path: [
        { frame: 1190, x: turnpikeGermannaJunction.x - 2, y: turnpikeGermannaJunction.y + 2, rotation: -20 },
        { frame: 1548, x: saundersField.x + 3, y: saundersField.y + 1, rotation: -15 },
        { frame: 3418, x: saundersField.x + 3, y: saundersField.y + 1, rotation: -15 },
      ],
    },
    {
      id: "hill-corps",
      side: "confederate",
      label: "A.P. Hill",
      enterFrame: 1963,
      path: [
        { frame: 1963, x: hillStart.x, y: hillStart.y, rotation: 10 },
        { frame: 2643, x: brockRoadJunction.x - 4, y: brockRoadJunction.y - 1, rotation: 5 },
        { frame: 3418, x: brockRoadJunction.x - 4, y: brockRoadJunction.y - 1, rotation: 5 },
      ],
    },
    {
      id: "getty-division",
      side: "union",
      label: "Getty",
      enterFrame: 2393,
      path: [
        { frame: 2393, x: wildernessTavern.x, y: wildernessTavern.y + 5, rotation: -10 },
        { frame: 2643, x: brockRoadJunction.x + 2, y: brockRoadJunction.y - 2, rotation: -5 },
        { frame: 3418, x: brockRoadJunction.x + 2, y: brockRoadJunction.y - 2, rotation: -5 },
      ],
    },
    {
      id: "hancock-corps",
      side: "union",
      label: "Hancock",
      enterFrame: 3120,
      path: [
        { frame: 3120, x: brockRoadJunction.x + 10, y: brockRoadJunction.y + 6, rotation: -15 },
        { frame: 3418, x: brockRoadJunction.x + 3, y: brockRoadJunction.y + 3, rotation: -10 },
      ],
    },
  ],

  portraits: [],

  labels: [
    // REWORKED after actually rendering a still and seeing "WILDERNESS
    // TAVERN" and Warren's own unit-name label garbled together,
    // unreadable. Root cause: Warren spawns at
    // (turnpikeGermannaJunction.x-2, .y+2) = (40.2, 27.6) — only ~10.4
    // points from wildernessTavern's own (50.6, 30.1), and "WILDERNESS
    // TAVERN" is a long enough string at this font size that its text
    // block's half-width alone already reaches past Warren's spawn point.
    // This plays entirely DURING the camera's approach, before either unit
    // exists, and is fully faded out by the exact frame they spawn — no
    // window where both a unit label and this location label are ever on
    // screen together.
    { id: "wilderness-tavern-label", text: "WILDERNESS TAVERN", x: wildernessTavern.x, y: wildernessTavern.y, enterFrame: 1081, exitFrame: 1190, style: "town" },
    // Fades out during the beat-2→3 approach pan, before Ewell/Warren's
    // unit boxes+labels actually land on this exact coordinate — safely
    // exits well before that.
    { id: "saunders-field-label", text: "SAUNDERS FIELD", x: saundersField.x, y: saundersField.y, enterFrame: 1324, exitFrame: 1503, style: "town" },
    { id: "brock-road-label", text: "BROCK ROAD", x: brockRoadJunction.x, y: brockRoadJunction.y, enterFrame: 2393, exitFrame: 3120, style: "town" },
  ],

  // Fills the backdrop space above the map during the opening establishing
  // shot and fades out shortly before beat 2's push-in starts eating into
  // that backdrop area.
  titleCard: { lines: ["MAY 5, 1864", "THE WILDERNESS"], enterFrame: 0, exitFrame: 776 },

  // Collision-moment flashes. Frames match the existing camera arrival AND
  // unit path arrival for each beat exactly (not new/guessed numbers):
  // - Saunders Field: camera keyframe above arrives at frame 1548, and
  //   ewell-corps/warren-corps both have a path waypoint at frame 1548.
  // - Brock Road: camera keyframe above arrives at frame 2643, and
  //   hill-corps/getty-division both have a path waypoint at frame 2643.
  // Positioned at the named junction coordinate itself (not either unit's
  // own slightly-offset position either side of it), since the flash marks
  // where the two sides meet, not either individual unit.
  impacts: [
    { x: saundersField.x, y: saundersField.y, frame: 1548 },
    { x: brockRoadJunction.x, y: brockRoadJunction.y, frame: 2643 },
  ],

  beats,
};
