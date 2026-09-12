// BattleMapConfig.ts
// Data shapes for the animated battle-map scene.
// Same pattern as QuickStrikeConfig.ts: one shared engine, per-battle data files.

export type CameraKeyframe = {
  frame: number;       // absolute frame number in the composition
  x: number;            // pan position, in % of map width (0-100)
  y: number;            // pan position, in % of map height (0-100)
  zoom: number;          // 1 = fit width, >1 = zoomed in
  tilt: number;         // degrees of rotateX for the "table" perspective (try 35-50)
  easing?: "linear" | "easeInOut";
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
