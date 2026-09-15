// BattleMapConfig.ts
// Data shapes for the animated battle-map scene.
// Same pattern as QuickStrikeConfig.ts: one shared engine, per-battle data files.

export type CameraKeyframe = {
  frame: number;       // absolute frame number in the composition
  x: number;            // pan position, in % of map width (0-100)
  y: number;            // pan position, in % of map height (0-100)
  zoom: number;          // 1 = fit width, >1 = zoomed in
  tilt: number;         // degrees of rotateX for the "table" perspective (try 35-50)
  // "spring" drives the transition into this keyframe with Remotion's
  // spring() (mass/damping/stiffness simulation) instead of interpolate()
  // with a fixed easing curve — see sampleKeyframes() in BattleMapScene.tsx.
  easing?: "linear" | "easeInOut" | "spring";
};

export type UnitBlock = {
  id: string;
  side: "union" | "confederate" | "allied" | "axis" | "neutral";
  // Position is in % of map width/height so it's resolution-independent
  path: { frame: number; x: number; y: number; rotation: number }[];
  enterFrame: number;   // frame it fades/slides in
  exitFrame?: number;   // optional frame it fades out
  label?: string;
};

export type PortraitCallout = {
  id: string;
  name: string;
  imageSrc: string;
  x: number;            // % position, anchor point the callout points to
  y: number;
  enterFrame: number;
  exitFrame?: number;
};

export type MapLabel = {
  id: string;
  text: string;
  x: number;
  y: number;
  enterFrame: number;
  exitFrame?: number;
  style?: "town" | "river" | "region";
};

export type TitleCard = {
  lines: string[];
  enterFrame: number;
  exitFrame: number;
};

// A brief full-frame end-card CTA appended as a tail after the scene's
// main content — reuses the ANIMATION and LAYOUT conventions of
// QuickStrikeShared.tsx's EndCardCTA (fade-in text, a drawing accent
// rule, centered stack) rather than inventing a new pattern, but with
// this file's own text treatment (halo/shadow, warm off-white) instead of
// EndCardCTA's black-background/gold Quick-Strike identity, and a plain
// `lines` array instead of EndCardCTA's fixed "Comment [TRIGGER]" shape,
// since this card isn't a "Comment X" prompt. `startFrame` is normally
// the scene's PREVIOUS totalDurationInFrames (i.e. this card is the added
// tail) — the map content fades out as this card fades in (see
// BattleMapSceneComponent), and `totalDurationInFrames` on BattleMapScene
// needs to be extended by at least `durationInFrames` to actually show it.
export type EndCard = {
  lines: string[];
  startFrame: number;
  durationInFrames: number;
};

// A brief flash/pulse at a map coordinate, timed to a specific frame —
// meant for collision moments (two opposing units meeting). Duration is
// fixed by the engine (see IMPACT_DURATION_FRAMES in BattleMapScene.tsx),
// not configurable per-impact, to keep this data shape minimal until a
// real use case needs otherwise.
export type ImpactFlash = {
  x: number;
  y: number;
  frame: number;
};

// A brief white/gold "look here" pulse at a map coordinate, timed to when
// the VO actually speaks that place name — same shape/timing contract as
// ImpactFlash (duration fixed by the engine, see
// NARRATION_HIGHLIGHT_DURATION_FRAMES in BattleMapScene.tsx), but a
// separate type from ImpactFlash since it's visually and semantically
// distinct: a narration cue, not a combat moment. `frame` should be
// derived from real forced-alignment word timestamps (that beat's
// startFrame + the word's offset within the clip), not estimated.
export type NarrationHighlight = {
  x: number;
  y: number;
  frame: number;
};

// A brief glow along a road/route (a named place mentioned in narration
// that's a path, not a single point — "the Orange Turnpike", "the Orange
// Plank Road") rather than a location. `points` is the road's waypoints,
// % of map width/height, same convention as everything else here.
// `highlightFrame` is when the VO speaks that road's name (again, from
// real forced-alignment timestamps). A single road can appear more than
// once in the narration (e.g. the Plank Road is mentioned in three
// separate beats) — each mention gets its own RoadPath entry reusing the
// same `points`, rather than the type trying to hold multiple frames.
export type RoadPath = {
  points: { x: number; y: number }[];
  highlightFrame: number;
};

// One segment of the persistent time-of-day ticker (see timeTicker on
// BattleMapScene). REWORKED from an earlier stepping-clock design (exact
// times like "7:00 AM" interpolating through a few steps per leg) — that
// claimed more chronological precision than the history actually
// supports. Now just a flat period label ("MAY 5 — MORNING") held for a
// contiguous frame range, no interpolation at all — see getTickerLabel in
// BattleMapScene.tsx. Entries are expected to be contiguous and in order
// (one entry's endFrame == the next's startFrame) — the engine doesn't
// re-sort or validate this.
export type TimeTickerEntry = {
  label: string; // e.g. "MAY 5 — MORNING"
  startFrame: number;
  endFrame: number;
};

// One rolling closed-caption chunk (roughly 3-6 words), timed to real
// forced-alignment word timestamps — NOT one giant caption per beat (a
// beat's VO can run up to ~29s, unreadable as a single block) and not
// evenly-spaced guesses. `text` is the locked script's actual words for
// this chunk (not Whisper's raw phonetic transcription, which mangles
// names like "Ewell" -> "UL" and "Rapidan" -> "rapiden" — only the
// timestamps come from the transcription; the displayed words are
// cross-referenced back against the real script). See WildernessScene.ts
// for the full derivation.
export type CaptionChunk = {
  text: string;
  startFrame: number;
  endFrame: number;
};

// One per-beat Kokoro VO clip, placed on the composition's own timeline.
// Replaces the old single global `audioSrc` — a multi-beat scene like
// Wilderness Episode 1 has one measured clip per beat rather than one
// track for the whole scene, so each clip needs its own start/duration
// (see BattleMapSceneComponent, which renders one <Sequence><Audio/></Sequence>
// per beat instead of a single global audio element).
export type Beat = {
  id: string;
  audioSrc: string;        // Kokoro TTS track, same as Quick Strike per-slide pattern
  startFrame: number;      // absolute frame this beat's audio starts on
  durationInFrames: number; // measured via ffprobe, + pad — see per-scene data file
};

export type BattleMapScene = {
  mapImageSrc: string;      // large Pillow-prepped map, e.g. 3600x2400
  totalDurationInFrames: number;
  camera: CameraKeyframe[];
  units: UnitBlock[];
  portraits: PortraitCallout[];
  labels: MapLabel[];
  beats: Beat[];            // per-beat VO clips — see Beat above
  // Optional opening/section card rendered above the tilted map plane, in
  // the backdrop area — meant for a wide establishing shot where the map
  // doesn't fill the whole frame (see BattleMapSceneComponent).
  titleCard?: TitleCard;
  // Optional collision-moment flashes. Engine support only for now — no
  // scene currently populates this (see BattleMapSceneComponent for the
  // render logic).
  impacts?: ImpactFlash[];
  // Optional narration-synced "look here" pulses at named locations —
  // see NarrationHighlight above.
  narrationHighlights?: NarrationHighlight[];
  // Optional narration-synced glows along named roads — see RoadPath
  // above.
  roadHighlights?: RoadPath[];
  // Optional persistent time-of-day ticker rendered in the backdrop band
  // — see TimeTickerEntry above.
  timeTicker?: TimeTickerEntry[];
  // Optional rolling closed captions, rendered as a fixed screen overlay
  // at the bottom of the map viewport — see CaptionChunk above.
  captions?: CaptionChunk[];
  // Optional background music bed, looped under the whole scene — same
  // pattern as every Quick Strike composition's own music track (e.g.
  // TokyoFirebombing-music.mp3, Gettysburg-Day1-music.mp3): one track,
  // volume 0.15, looped, independent of the per-beat VO Sequences.
  musicSrc?: string;
  // Optional full-frame end-card CTA tail — see EndCard above.
  endCard?: EndCard;
};

// Example: Battle of Franklin opening push, ~3 camera moves
export const exampleFranklinScene: BattleMapScene = {
  mapImageSrc: "/maps/wilderness-1864.jpg",
  totalDurationInFrames: 450, // 15s at 30fps
  camera: [
    { frame: 0, x: 50, y: 40, zoom: 1.0, tilt: 40 },
    { frame: 180, x: 55, y: 45, zoom: 1.4, tilt: 40, easing: "easeInOut" },
    { frame: 420, x: 58, y: 48, zoom: 1.7, tilt: 40, easing: "easeInOut" },
  ],
  units: [
    {
      id: "schofield-corps",
      side: "union",
      label: "Schofield",
      enterFrame: 30,
      path: [
        { frame: 30, x: 62, y: 30, rotation: 0 },
        { frame: 200, x: 58, y: 35, rotation: 10 },
      ],
    },
  ],
  portraits: [
    {
      id: "schofield-portrait",
      name: "Schofield",
      imageSrc: "/portraits/schofield.jpg",
      x: 62,
      y: 22,
      enterFrame: 20,
    },
  ],
  labels: [
    { id: "franklin-town", text: "FRANKLIN", x: 50, y: 40, enterFrame: 0, style: "town" },
  ],
  beats: [],
};
