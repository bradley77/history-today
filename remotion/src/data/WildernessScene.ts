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

// Germanna Ford crossing — same coordinate already used for grant-column's
// path start below (was inlined there; promoted to a named constant here
// so the narration highlight and the unit path both point at the same
// verified spot instead of two copies of the same magic numbers). Verified
// against the map where the Germanna Plank Road and a river tributary
// converge at the top border (see the original inline comment, preserved
// on grant-column's path below).
const germannaFord = { x: 61.1, y: 6 };

// Road waypoints for the narration-synced road-highlight sweeps (see
// roadHighlights below). Percentages of the 7720x6250 working map. Western
// points are rough estimates — same confidence tier as ewellStart/
// hillStart above, not pixel-mapped. Eastern points reuse this file's
// already-verified named anchors (saundersField, turnpikeGermannaJunction,
// brockRoadJunction).
const turnpikePath = [
  { x: 18, y: 34 }, // rough, near Ewell's start
  { x: 29.5, y: 32.2 }, // Saunders Field — verified
  { x: 35, y: 28.5 }, // interpolated midpoint
  { x: 42.2, y: 25.6 }, // Wilderness Tavern/Germanna junction — verified
];

const plankRoadPath = [
  { x: 20, y: 50 }, // rough, near Hill's start
  { x: 49.2, y: 60 }, // rough midpoint, low confidence
  { x: 61.5, y: 53.6 }, // Brock Road junction — verified
];

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
  // 3585 (beats[9].startFrame + beats[9].durationInFrames) + 120 (4s end-
  // card tail, see endCard below) = 3705. The main content itself is
  // still exactly 3585 frames — everything after that is the added CTA
  // tail, not a change to the episode's own pacing.
  totalDurationInFrames: 3705,

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
    // movement in the episode: barely-there zoom drift and a 1-point y
    // drift across nearly 29s, versus every other beat's much faster
    // push-ins.
    //
    // tilt 18 -> 14, zoom 1.45/1.5/1.55 -> 1.7/1.75/1.8 (wide-shot framing
    // pass): rendered stills at this exact frame across tilt {18,14,10} x
    // zoom {1.45,1.7,1.9} to find what actually shrinks the backdrop —
    // confirmed the perspective fix from last round solved a DIFFERENT
    // problem (steep/off-center keystone wedge) and does nothing for this
    // shot's shortfall, which is the tilted plane's own far edge running
    // out of map before the frame does. Measured the map/backdrop border
    // row at each combo: tilt alone barely moved it (18->14 saved ~1%
    // of frame height, 18->10 ~1.7%), while zoom did the real work
    // (1.45->1.9 saved ~5% of frame height on its own). Landed on the
    // MODERATE combo (14/1.7), not the most aggressive one (10/1.9):
    // tilt 10 rendered visibly flat — the map's top edge went nearly
    // level, losing the "tilted table" read entirely — while tilt 14
    // still shows clear convergence. Zoom 1.9 would put this establishing
    // shot at the SAME zoom as the Saunders Field arrival push-in (a
    // beat this shot is supposed to read as wider than), so capped it at
    // 1.7 instead — a real reduction over 1.45 without fully erasing the
    // gap to the tighter push-in beats. Kept the beat's own "barely-there
    // breathing zoom" shape (same +0.05/+0.05 step pattern), just shifted
    // up.
    { frame: 0, x: rapidanBend.x, y: rapidanBend.y + 6, zoom: 1.7, tilt: 14 },
    { frame: 431, x: rapidanBend.x, y: rapidanBend.y + 5, zoom: 1.75, tilt: 14, easing: "easeInOut" },
    { frame: 862, x: rapidanBend.x, y: rapidanBend.y + 6, zoom: 1.8, tilt: 14, easing: "easeInOut" },

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
    //
    // zoom raised 1.0 -> 1.35 (framing pass): this was the one keyframe in
    // the episode still functioning as a "wide resting shot" between beats
    // that isn't one of the three deliberate wide moments (opening
    // establishing shot, Hancock's arrival reveal, final nightfall/
    // cliffhanger) — it just parked the camera at map-fitting zoom for an
    // ordinary beat-to-beat transition. Tilt stays at 42 since 1.35 is
    // comfortably above the ~1.2 threshold where steep tilt used to open a
    // gap above the map.
    { frame: 1190, x: turnpikeGermannaJunction.x, y: turnpikeGermannaJunction.y, zoom: 1.35, tilt: 42, easing: "easeInOut" },

    // 3. The collision, 7 AM — push toward Saunders Field (0:39.7–0:51.6)
    // easing: spring (was easeInOut) — this push carries real narrative
    // weight (armies about to collide), so it gets the physical/inertial
    // camera move instead of the mechanical S-curve.
    { frame: 1548, x: saundersField.x, y: saundersField.y, zoom: 1.3, tilt: 44, easing: "spring" },

    // 4. Saunders Field breaks open — arrive early, then hold (0:51.6–1:05.4)
    // Proportionally reaches its zoomed-in framing at the same ~58% point
    // into this beat as the original design (was 120/300 frames in a
    // 300-frame beat; now 166/415 in a 415-frame beat), then holds static
    // through the back half — Ewell/Warren's converging unit movement
    // carries the visible motion here instead of the camera also zooming.
    { frame: 1714, x: saundersField.x, y: saundersField.y, zoom: 1.9, tilt: 46, easing: "easeInOut" }, // arrive
    { frame: 1963, x: saundersField.x, y: saundersField.y, zoom: 1.9, tilt: 46, easing: "easeInOut" }, // hold (unchanged endpoint)

    // 5. Second collision — Plank Road — pan south (1:05.4–1:19.8)
    // easing: spring (was easeInOut) — same reasoning as Saunders Field
    // above: another collision-beat camera move, given the physical feel.
    { frame: 2393, x: hillStart.x + 8, y: hillStart.y, zoom: 1.4, tilt: 44, easing: "spring" },

    // 6. Race for Brock Road — push toward the junction (1:19.8–1:28.1)
    // easing: spring (was easeInOut) — this is the "race" beat, so a
    // spring's accelerate-then-settle feel suits the urgency better than
    // a mechanical easeInOut curve.
    { frame: 2643, x: brockRoadJunction.x, y: brockRoadJunction.y, zoom: 1.6, tilt: 45, easing: "spring" },

    // 7. Getty holds — static tension hold (1:28.1–1:32.7)
    { frame: 2782, x: brockRoadJunction.x, y: brockRoadJunction.y, zoom: 1.8, tilt: 45 },

    // 8. Hancock arrives — pull back to reveal the whole battlefield (1:32.7–1:44.0)
    // Recentered/widened from a Brock-Road/Tavern-only midpoint to the
    // bounding-box center of Saunders Field + Wilderness Tavern + Brock
    // Road (x: (29.5+61.5)/2=45.5, y: (30.1+53.6)/2=41.85), at a zoom low
    // enough to fit that whole span. tilt dropped from 40 to 18, now 14
    // (wide-shot framing pass — see beat 1 above for the tilt/zoom test
    // this came from): this zoom is now below the ~1.2 threshold where
    // the steeper push-in tilt leaves a gap above the map (same rule
    // applied to the wide shots at the start/end of the scene).
    //
    // zoom deliberately NOT raised to 1.7/1.9 here, unlike beat 1 above —
    // this 0.95 is load-bearing: it's the specific value that fits the
    // whole Saunders/Tavern/Brock-Road bounding box in frame, which is the
    // entire point of this reveal. Pushing it toward the beat-1 test
    // values would crop the bounding box and defeat the shot. Only the
    // tilt reduction (which is location-independent) carries over here.
    // easing: spring (was easeInOut) — Hancock's reveal is the biggest
    // single camera move in the episode (push-in framing all the way out
    // to the whole-battlefield wide shot); a spring's inertial settle
    // sells the pull-back as a considered reveal rather than a mechanical
    // zoom-out.
    { frame: 3120, x: 45.5, y: 41.85, zoom: 0.95, tilt: 14, easing: "spring" },

    // 9. Nightfall — slow pull back to wide (1:44.0–1:55.7)
    // tilt 18 -> 14, zoom unchanged — same reasoning as Hancock's reveal
    // above: 0.95 is what fits wildernessTavern's wide framing, so only
    // the tilt (location-independent) carries over from the beat-1 test.
    { frame: 3418, x: wildernessTavern.x, y: wildernessTavern.y, zoom: 0.95, tilt: 14, easing: "easeInOut" },

    // 10. Cliffhanger — hold wide (1:55.7–1:59.5)
    { frame: 3585, x: wildernessTavern.x, y: wildernessTavern.y, zoom: 0.95, tilt: 14 },
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
        // Germanna Ford crossing (see germannaFord above — this was the
        // inline literal it was promoted from). y raised from the
        // crossing's raw 1.7 to 6 — at 1.7 the unit box+label straddled
        // the seam between the map's physical top edge and the dark
        // backdrop above it during the wide establishing shot, rendering
        // with part of the block floating in the backdrop void. y: 6
        // gives enough clearance to sit fully on the map at this beat's
        // framing while still reading as "near the top of the map, close
        // to the river" rather than already deep in the interior.
        { frame: 80, x: germannaFord.x, y: germannaFord.y, rotation: -25 },
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
    // Same crowding problem as wilderness-tavern-label/saunders-field-label
    // above, just not caught until it was actually rendered at this beat:
    // exitFrame was 3120 — hundreds of frames past hill-corps/getty-division's
    // own path waypoint AT this exact coordinate (frame 2643, same frame the
    // Brock Road impact flash fires), so "BROCK ROAD" sat on screen
    // overlapping both units' own name labels all the way through Getty's
    // hold and right up to Hancock's arrival.
    //
    // UNLIKE the other two, retiming alone doesn't fix this one — verified
    // by actually rendering, not assumed. Saunders Field worked because
    // ewell-corps/warren-corps don't exist at all until frame 1190 (their
    // enterFrame), giving the label a long, genuinely empty window. Here,
    // hill-corps has been travelling toward this exact coordinate since
    // frame 1963 (430 frames before this label can even enter — Brock Road
    // isn't in the camera's view any earlier than beat 6's start, 2393) and
    // is already close enough that the label overlaps it within ~12 frames
    // of entering (confirmed at frame 2405, still mid-fade-in) — there's no
    // clean timing window available at all at this label's original (x,y).
    // Fixed with a small position offset instead (y +6, same kind of small
    // nudge hill-corps/getty-division's OWN positions already use to avoid
    // stacking on each other and the raw junction coordinate) so the label
    // sits below the unit cluster rather than through it, combined with the
    // same exit-before-arrival timing tightening used above (2643 - 45 =
    // 2598) to also shorten how long it lingers once Getty's hold begins.
    { id: "brock-road-label", text: "BROCK ROAD", x: brockRoadJunction.x, y: brockRoadJunction.y + 6, enterFrame: 2393, exitFrame: 2598, style: "town" },
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

  // Narration-synced "look here" highlights and road-highlight sweeps.
  // Frames below come from real forced-alignment word timestamps run
  // against each beat's actual VO clip (openai-whisper, word_timestamps=
  // true — faster-whisper, the tool already used for Quick Strike's
  // burned-in captions, fails to load in this environment: its `av`
  // dependency hits a blocked native DLL under this machine's Application
  // Control policy, same failure already documented in
  // generateVoiceover-eisenhower-photographed-evidence.py; openai-whisper
  // shells out to ffmpeg instead of linking `av`, so it doesn't hit that
  // block), not estimated from reading pace. Method: transcribed each of
  // the 10 clips with word-level timestamps, then cross-referenced the
  // locked LINES script (see generateVoiceover-wilderness-ep1.py) against
  // those timestamps to find each target word's start time, converted to
  // an absolute frame via that beat's startFrame + round(start_seconds *
  // 30fps):
  //   - vo-01 (startFrame 0): "rapiden" [sic, Whisper's phonetic spelling
  //     of Rapidan] at 21.200s -> frame 636; "Germana" [sic] at 21.820s
  //     -> frame 655; "Eles Fords" [sic] at 22.460s -> frame 674
  //   - vo-02 (startFrame 862): "Orange" (Turnpike) at 3.060s -> frame
  //     954; "Orange" (Plank Road) at 4.880s -> frame 1008
  //   - vo-03 (startFrame 1190): "Saunders" at 5.120s -> frame 1344
  //   - vo-05 (startFrame 1963): "Orange" (Plank Road) at 2.740s -> frame
  //     2045
  //   - vo-08 (startFrame 2782): "Plank" at 7.500s -> frame 3007 (this
  //     mention is just "the Plank Road", no "Orange" — matches the
  //     locked script exactly, not a transcription gap)
  narrationHighlights: [
    // "Germanna" (vo-01) — the ford crossing itself, same verified
    // coordinate as grant-column's path start.
    { x: germannaFord.x, y: germannaFord.y, frame: 655 },
    // "Ely's Fords" (vo-01, ~674) deliberately SKIPPED — per instructions,
    // Ely's Ford is confirmed not present on this map at all, so there's
    // no coordinate to highlight.
    //
    // "Rapidan" (vo-01, ~636) deliberately SKIPPED — flagging the
    // reasoning rather than silently omitting it: the Rapidan is a river,
    // not a point, and it's already visible winding across the top of the
    // frame during this exact beat (the opening establishing shot) without
    // a call-out. A single-point highlight on "the river" would have to
    // pick an arbitrary spot along it (rapidanBend, used for the camera
    // keyframe above, is a camera framing target, not a map location the
    // VO is pointing at) — that felt more like a guess than the other
    // highlights below, all of which sit on a specific named place or a
    // real road. Judgment call: left out. Easy to add back with
    // { x: rapidanBend.x, y: rapidanBend.y, frame: 636 } if it reads as
    // missing once this cuts together with the VO.
    { x: saundersField.x, y: saundersField.y, frame: 1344 }, // "Saunders Field" (vo-03)
  ],

  roadHighlights: [
    { points: turnpikePath, highlightFrame: 954 }, // "Orange Turnpike" (vo-02)
    // "Orange Plank Road" / "the Plank Road" — mentioned in three separate
    // beats (vo-02, vo-05, vo-08); each gets its own sweep along the same
    // path rather than trying to cram multiple frames into one entry.
    { points: plankRoadPath, highlightFrame: 1008 }, // vo-02
    { points: plankRoadPath, highlightFrame: 2045 }, // vo-05
    { points: plankRoadPath, highlightFrame: 3007 }, // vo-08
  ],

  // Time-of-day ticker. REWORKED from an earlier stepping-clock design
  // (exact times like "7:00 AM"/"1:00 PM" advancing through interpolated
  // steps) — that claimed more chronological precision than the history
  // actually supports, so this is now five flat period labels instead.
  // Frame boundaries are the beats' own startFrame values already in the
  // `beats` array above, not new/invented numbers — each label's range
  // just spans however many beats it covers:
  //   MAY 4, 1864       -> beat 1 only              (0 to beat 2's 862)
  //   MAY 5 — MORNING    -> beats 2-3 (contact)      (862 to beat 4's 1548)
  //   MAY 5 — MIDDAY     -> beat 4 (Saunders assault) (1548 to beat 5's 1963)
  //   MAY 5 — AFTERNOON  -> beats 5-8 (Plank Road)    (1963 to beat 9's 3120)
  //   MAY 5 — EVENING    -> beats 9-10 (nightfall)    (3120 to totalDurationInFrames)
  timeTicker: [
    { label: "MAY 4, 1864", startFrame: 0, endFrame: 862 },
    { label: "MAY 5 — MORNING", startFrame: 862, endFrame: 1548 },
    { label: "MAY 5 — MIDDAY", startFrame: 1548, endFrame: 1963 },
    { label: "MAY 5 — AFTERNOON", startFrame: 1963, endFrame: 3120 },
    { label: "MAY 5 — EVENING", startFrame: 3120, endFrame: 3585 },
  ],

  // Rolling closed captions. Same forced-alignment run as the narration
  // highlights (Part 1 of that earlier task — openai-whisper,
  // word_timestamps=true, against each beat's real VO clip; see the
  // narrationHighlights comment above for why openai-whisper rather than
  // faster-whisper in this environment), but consumed differently: every
  // word's timestamp is used (not just the handful of named-location
  // words), cross-referenced back against the locked LINES script in
  // generateVoiceover-wilderness-ep1.py so the displayed text is the
  // correct spelling (Whisper mis-transcribes several words phonetically
  // — "Ewell" -> "UL", "Rapidan" -> "rapiden", "Germanna" -> "Germana",
  // "corps" -> "core" — only the TIMING comes from the transcription).
  // Words are grouped into 3-6 word rolling chunks, breaking at
  // punctuation where the resulting chunk is already at least 3 words
  // long (natural pauses), otherwise capped at 6 words — not evenly-sized
  // guesses. Each chunk's startFrame/endFrame come directly from its
  // first/last word's real timestamp (that beat's startFrame + round(
  // seconds * 30fps)), so a few frames of natural silence between chunks
  // is expected and correct (the caption bar simply isn't shown then —
  // see getActiveCaption in BattleMapScene.tsx), not a bug to smooth over.
  captions: [
    // vo-01
    { text: "People assume the opening clash between", startFrame: 0, endFrame: 52 },
    { text: "Grant's and Lee's armies was a", startFrame: 52, endFrame: 100 },
    { text: "battle of brilliant maneuver.", startFrame: 100, endFrame: 131 },
    { text: "It was not.", startFrame: 157, endFrame: 173 },
    { text: "It was a battle where neither", startFrame: 194, endFrame: 222 },
    { text: "side could see the other clearly,", startFrame: 222, endFrame: 265 },
    { text: "where cavalry and artillery were severely", startFrame: 284, endFrame: 337 },
    { text: "limited, and where numbers and even", startFrame: 337, endFrame: 398 },
    { text: "good generalship were harder to use", startFrame: 398, endFrame: 449 },
    { text: "than either commander expected.", startFrame: 449, endFrame: 490 },
    { text: "On May fourth,", startFrame: 523, endFrame: 542 },
    { text: "eighteen sixty four,", startFrame: 553, endFrame: 617 },
    { text: "Grant's army crosses the Rapidan at", startFrame: 617, endFrame: 674 },
    { text: "Germanna and Ely's Fords,", startFrame: 674, endFrame: 719 },
    { text: "moving quickly through the Wilderness toward", startFrame: 719, endFrame: 782 },
    { text: "open ground before Lee can block", startFrame: 782, endFrame: 839 },
    { text: "the way.", startFrame: 839, endFrame: 848 },
    // vo-02
    { text: "Lee lets Grant cross.", startFrame: 862, endFrame: 891 },
    { text: "Then he sends Ewell down the", startFrame: 917, endFrame: 954 },
    { text: "Orange Turnpike and Hill down the", startFrame: 954, endFrame: 1008 },
    { text: "Orange Plank Road,", startFrame: 1008, endFrame: 1038 },
    { text: "ordering them to block the Union", startFrame: 1056, endFrame: 1092 },
    { text: "advance while Longstreet races to join", startFrame: 1092, endFrame: 1157 },
    { text: "them.", startFrame: 1157, endFrame: 1163 },
    // vo-03
    { text: "Around seven in the morning,", startFrame: 1190, endFrame: 1220 },
    { text: "May fifth, Ewell's advance makes contact", startFrame: 1226, endFrame: 1294 },
    { text: "with Warren's Fifth Corps near Saunders", startFrame: 1294, endFrame: 1351 },
    { text: "Field. Neither side expected to find", startFrame: 1351, endFrame: 1441 },
    { text: "the other so soon.", startFrame: 1441, endFrame: 1472 },
    { text: "The surprise is mutual.", startFrame: 1490, endFrame: 1521 },
    // vo-04
    { text: "Meade orders Warren to attack.", startFrame: 1548, endFrame: 1591 },
    { text: "But Warren's corps is still tangled", startFrame: 1608, endFrame: 1650 },
    { text: "in the woods,", startFrame: 1650, endFrame: 1673 },
    { text: "stretched out over miles,", startFrame: 1673, endFrame: 1716 },
    { text: "struggling to form a proper line.", startFrame: 1728, endFrame: 1775 },
    { text: "When the attack finally comes,", startFrame: 1797, endFrame: 1846 },
    { text: "thousands of Union soldiers disappear into", startFrame: 1859, endFrame: 1925 },
    { text: "the trees.", startFrame: 1925, endFrame: 1936 },
    // vo-05
    { text: "At the same time,", startFrame: 1963, endFrame: 1989 },
    { text: "Hill's column pushes east on the", startFrame: 1997, endFrame: 2045 },
    { text: "Orange Plank Road and runs into", startFrame: 2045, endFrame: 2108 },
    { text: "the Fifth New York Cavalry.", startFrame: 2108, endFrame: 2151 },
    { text: "Outnumbered, the troopers fall back fighting,", startFrame: 2173, endFrame: 2243 },
    { text: "buying just enough time for Getty's", startFrame: 2256, endFrame: 2315 },
    { text: "division to reach the crossroads first.", startFrame: 2315, endFrame: 2367 },
    // vo-06
    { text: "If Hill reaches the junction first,", startFrame: 2393, endFrame: 2439 },
    { text: "he can isolate Hancock's corps from", startFrame: 2457, endFrame: 2508 },
    { text: "the rest of the army.", startFrame: 2508, endFrame: 2534 },
    { text: "Getty's division is rushed to intercept", startFrame: 2563, endFrame: 2614 },
    { text: "him.", startFrame: 2614, endFrame: 2625 },
    // vo-07
    { text: "Getty reaches the crossroads just ahead", startFrame: 2643, endFrame: 2699 },
    { text: "of Hill. His division digs in.", startFrame: 2699, endFrame: 2761 },
    // vo-08
    { text: "Hancock's Second Corps reinforces Getty,", startFrame: 2782, endFrame: 2848 },
    { text: "and the isolated stand becomes a", startFrame: 2868, endFrame: 2922 },
    { text: "full Union defensive line.", startFrame: 2922, endFrame: 2972 },
    { text: "Along the Plank Road,", startFrame: 2996, endFrame: 3023 },
    { text: "the fighting becomes a brutal back", startFrame: 3035, endFrame: 3082 },
    { text: "and forth.", startFrame: 3082, endFrame: 3095 },
    // vo-09
    { text: "After dark, the fighting finally fades.", startFrame: 3120, endFrame: 3178 },
    { text: "Neither army has broken.", startFrame: 3201, endFrame: 3232 },
    { text: "In the dense woods,", startFrame: 3259, endFrame: 3280 },
    { text: "fires begin to spread through the", startFrame: 3280, endFrame: 3331 },
    { text: "brush, burning among the dead and", startFrame: 3331, endFrame: 3387 },
    { text: "wounded.", startFrame: 3387, endFrame: 3393 },
    // vo-10
    { text: "At first light,", startFrame: 3418, endFrame: 3435 },
    { text: "both armies will attack again.", startFrame: 3435, endFrame: 3482 },
    { text: "Neither Grant nor Lee has won", startFrame: 3500, endFrame: 3544 },
    { text: "anything yet.", startFrame: 3544, endFrame: 3565 },
  ],

  beats,

  // Background music bed — same track/volume/loop convention already used
  // across the Gettysburg Quick Strike episodes (GettysburgDay1QS,
  // GettysburgDay2QS, GettysburgDay3QS, plus AntietamQS/
  // BattleOfAtlantaQS) via <Audio volume={0.15} loop />.
  musicSrc: "/audio/Gettysburg-Day1-music.mp3",

  // End-card CTA tail — see EndCard's comment in BattleMapConfig.ts and
  // EndCardTail in BattleMapScene.tsx for the visual reasoning. startFrame
  // is the episode's own PREVIOUS totalDurationInFrames (3585, before this
  // tail was added) — the map crossfades out into this card over the 20
  // frames before that, per EndCardTail. 120 frames (4s at 30fps): long
  // enough to read three short lines comfortably (fade-in finishes at
  // frame 12, so ~3.6s of fully-visible hold before the video ends) without
  // dragging past the point of "seen it, ready for it to end."
  endCard: {
    lines: ["THE WILDERNESS", "PART 2 COMING SOON", "FOLLOW FOR MORE"],
    startFrame: 3585,
    durationInFrames: 120,
  },
};
