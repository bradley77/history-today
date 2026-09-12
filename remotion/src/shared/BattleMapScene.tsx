// BattleMapScene.tsx
// Shared engine for animated battle-map compositions.
// Consumes a BattleMapScene data object (see BattleMapConfig.ts) — same
// "locked shared engine, swap the data" pattern as QuickStrikeShared.tsx.
//
// Core trick: the "3D table" look is just a CSS perspective + rotateX on a
// flat image, with the pan/zoom done via translate/scale keyframes. No real
// 3D engine needed.

import React from "react";
import {
  AbsoluteFill,
  Img,
  Audio,
  Sequence,
  interpolate,
  Easing,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {
  BattleMapScene,
  CameraKeyframe,
} from "./BattleMapConfig";
import { FilmGrain } from "../components/FilmGrain";

type PathPoint = { frame: number; x: number; y: number; rotation: number };

// --- helpers -----------------------------------------------------------

function sampleKeyframes(
  frame: number,
  keyframes: CameraKeyframe[]
): CameraKeyframe {
  if (frame <= keyframes[0].frame) return keyframes[0];
  const last = keyframes[keyframes.length - 1];
  if (frame >= last.frame) return last;

  // find the surrounding pair
  let a = keyframes[0];
  let b = keyframes[keyframes.length - 1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (frame >= keyframes[i].frame && frame <= keyframes[i + 1].frame) {
      a = keyframes[i];
      b = keyframes[i + 1];
      break;
    }
  }

  const easing =
    b.easing === "easeInOut" ? Easing.inOut(Easing.ease) : Easing.linear;

  const t = interpolate(frame, [a.frame, b.frame], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return {
    frame,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    zoom: a.zoom + (b.zoom - a.zoom) * t,
    tilt: a.tilt + (b.tilt - a.tilt) * t,
  };
}

function fadeIn(frame: number, enterFrame: number, durationFrames = 15) {
  return interpolate(frame, [enterFrame, enterFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function fadeOut(frame: number, exitFrame?: number, durationFrames = 15) {
  if (exitFrame === undefined) return 1;
  return interpolate(
    frame,
    [exitFrame - durationFrames, exitFrame],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
}

// Position/rotation for a unit's path at an arbitrary frame — factored out
// of the units.map() render loop so it can also be called at several PAST
// frames for the movement-trail dots below, instead of duplicating this
// segment-search logic. `moving` reports whether the bracketing segment
// actually represents displacement (start/end differ) — used to suppress
// the trail during a held/static segment, where every sampled point would
// otherwise land on the exact same spot anyway.
function getPositionOnPath(
  path: PathPoint[],
  atFrame: number
): { x: number; y: number; rotation: number; moving: boolean } {
  const clampedFrame = Math.max(
    path[0].frame,
    Math.min(atFrame, path[path.length - 1].frame)
  );
  let a = path[0];
  let b = path[path.length - 1];
  for (let i = 0; i < path.length - 1; i++) {
    if (clampedFrame >= path[i].frame && clampedFrame <= path[i + 1].frame) {
      a = path[i];
      b = path[i + 1];
      break;
    }
  }
  const t = interpolate(clampedFrame, [a.frame, b.frame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    rotation: a.rotation + (b.rotation - a.rotation) * t,
    moving: a.x !== b.x || a.y !== b.y,
  };
}

// Trail dot count — raised from 5 to 8 for a longer, more visible trail.
const TRAIL_DOT_COUNT = 8;
// REWORKED after actually rendering and looking — the original design
// sampled at FIXED FRAME offsets (frame-8, frame-16, ...), which silently
// produced zero visible trail for every unit in this data set: they all
// move slowly enough (small map-% per second) that the entire lookback
// window covered LESS on-screen distance than the unit's own 60px box, so
// every dot rendered underneath/inside the box itself, completely hidden.
// No opacity/size tweak could fix that — a time-based lookback is just the
// wrong tool when speed varies per unit and per beat (a fast push-in beat
// covers much more screen distance per frame than a slow establishing
// one). Switched to a DISTANCE-based search instead: walk backward frame
// by frame until the position has moved at least TRAIL_MIN_STEP_PERCENT
// (map %) from the previous anchor, so dots are always usefully spread
// out regardless of how fast the unit is actually moving. Bounded by
// TRAIL_MAX_LOOKBACK_FRAMES so a near-stationary unit doesn't search
// arbitrarily far into the past chasing a threshold it'll never reach.
// Bumped for a longer, more visible trail: 8 dots (was 5) each spaced at
// least 1.6 map-% apart (was 1.2), and a wider lookback ceiling (was 240)
// so a slow mover has enough path history available to actually reach 8
// dots when possible, rather than running out early.
const TRAIL_MIN_STEP_PERCENT = 1.6;
const TRAIL_MAX_LOOKBACK_FRAMES = 400;

// Walks backward from `fromFrame` along `path`, collecting up to
// TRAIL_DOT_COUNT points each at least TRAIL_MIN_STEP_PERCENT away (in map
// %) from the previous one. Stops early (returning fewer points) once it
// runs out of path or hits TRAIL_MAX_LOOKBACK_FRAMES — a unit that just
// started moving gets a short trail, not a padded-out one, matching "show
// the trail for the most recent movement" rather than a fixed length
// regardless of how far it's actually traveled.
function getTrailPoints(
  path: PathPoint[],
  fromFrame: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let anchor: { x: number; y: number } = getPositionOnPath(path, fromFrame);
  let searchFrame = fromFrame;
  const earliestFrame = Math.max(
    path[0].frame,
    fromFrame - TRAIL_MAX_LOOKBACK_FRAMES
  );
  for (let i = 0; i < TRAIL_DOT_COUNT; i++) {
    let foundFrame: number | null = null;
    let foundPos: { x: number; y: number } | null = null;
    for (let f = searchFrame - 1; f >= earliestFrame; f--) {
      const p = getPositionOnPath(path, f);
      const dist = Math.hypot(p.x - anchor.x, p.y - anchor.y);
      if (dist >= TRAIL_MIN_STEP_PERCENT) {
        foundFrame = f;
        foundPos = p;
        break;
      }
    }
    if (!foundPos || foundFrame === null) break;
    points.push(foundPos);
    anchor = foundPos;
    searchFrame = foundFrame;
  }
  return points;
}

// Impact flash duration, in frames — raised from 12 to 18 for more presence.
const IMPACT_DURATION_FRAMES = 18;
// How close (map %) a unit's current position needs to be to an active
// impact's (x,y) to get the box scale-punch below — wide enough to catch
// both sides' units, which sit a few % either side of the actual collision
// point (e.g. Ewell/Warren each ~3-4% off Saunders Field itself), without
// being so wide it'd punch units nowhere near the actual collision.
const IMPACT_PROXIMITY_PERCENT = 6;
// How much the box scales up at the peak of its impact punch (1 + this).
const IMPACT_PUNCH_AMOUNT = 0.35;

// --- main component ------------------------------------------------------

export const BattleMapSceneComponent: React.FC<{ scene: BattleMapScene }> = ({
  scene,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const cam = sampleKeyframes(frame, scene.camera);

  // Perspective wrapper gives the "tilted table" depth.
  // The inner layer is what actually pans/zooms — keeping perspective
  // fixed on the outer wrapper avoids warping as you move.
  // Backdrop is a dark radial gradient rather than flat black — at wide/
  // establishing angles the tilted map doesn't fill the frame, and a pure
  // #000 void above it read as a rendering glitch rather than atmosphere.
  // Hue anchored to wilderness-1864.jpg's own sepia tone (sampled: the
  // map's top strip and whole-map pixel average both land on ~RGB(210,
  // 153,81) / #d29951), darkened way down for atmosphere rather than
  // guessed — so the backdrop reads as the same dim world as the map
  // instead of a generic dark-brown backplate stitched behind it.
  // Warm "overhead lamp" highlight layered on top of the base gradient
  // below — same sampled map sepia (#d29951/rgba(210,153,81,…)) as the
  // base, just at low opacity fading to fully transparent so it reads as
  // ambient light pooling near the title card, not a spotlight/glow FX.
  // Values below are a middle-ground starting point — see BattleMapScene
  // fix notes for the softer/stronger alternatives to try once rendered.
  //
  // REWORKED after actually rendering a still and looking at it (see fix
  // notes) — every previous round of this gradient tuned individual stop
  // values while the underlying blend-mode architecture guaranteed a near-
  // black result regardless: stacking an OPAQUE, always-dark "vignette"
  // gradient under `multiply` mathematically caps the maximum brightness
  // at that gradient's own brightest stop (e.g. #4a3a16 is only ~29% of
  // max channel brightness — multiply can never exceed the darker of its
  // two inputs), and then blending faint `soft-light` highlights on TOP of
  // that already-crushed result barely moved the needle. No single stop
  // tweak could ever fix this; it needed a different structure:
  //   1. Wood photo, painted at normal/full brightness (the actual light
  //      source of warmth+texture now, not muddied by multiply beneath it)
  //   2. A darkening vignette using TRANSPARENT black (not opaque brown),
  //      blended `normal` — this reliably darkens toward the edges while
  //      leaving the center close to the wood's own true brightness,
  //      instead of an opaque color that darkens everything uniformly
  //      before any "highlight" is even added.
  //   3+4. The two warm highlights, blended `screen` (guaranteed to ADD
  //      brightness, unlike `soft-light` which can stay muted against a
  //      dark base) — an actual bright pool near the title card, and a
  //      tighter graze near the map's seam.
  // Cover-fit, not tiled: this is a single graded photo (4096x4096), not a
  // seamless repeating pattern, so tiling would show visible seams — same
  // reasoning as the map's own cover-fit.
  const outerStyle: React.CSSProperties = {
    perspective: 1600,
    overflow: "hidden",
    backgroundImage:
      // Seam graze — tight, near the map's top edge.
      "radial-gradient(ellipse 50% 18% at 50% 8%, rgba(255,214,140,0.45) 0%, rgba(255,214,140,0) 70%), " +
      // Main lamp glow — the visible "light pool" near the title card.
      "radial-gradient(ellipse 85% 65% at 50% 18%, rgba(255,214,140,0.5) 0%, rgba(255,214,140,0) 65%), " +
      // Vignette — TRANSPARENT black (not an opaque color), so `normal`
      // blend darkens progressively toward the edges without capping the
      // center's brightness the way the old opaque+multiply version did.
      "radial-gradient(ellipse 120% 90% at 50% 20%, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.88) 100%), " +
      `url("${staticFile("/textures/wood-table.jpg")}")`,
    backgroundBlendMode: "screen, screen, normal, normal",
    backgroundSize: "100% 100%, 100% 100%, 100% 100%, cover",
    backgroundPosition: "center, center, center, center",
    backgroundRepeat: "no-repeat, no-repeat, no-repeat, no-repeat",
  };

  const innerStyle: React.CSSProperties = {
    transformStyle: "preserve-3d",
    transform: `rotateX(${cam.tilt}deg) scale(${cam.zoom}) translate(${
      50 - cam.x
    }%, ${50 - cam.y}%)`,
    transformOrigin: "center center",
    width: "100%",
    height: "100%",
    position: "relative",
  };

  return (
    <AbsoluteFill style={outerStyle}>
      <AbsoluteFill style={innerStyle}>
        {/* Base map layer, prepped in Pillow same as your document pipeline */}
        <Img
          src={staticFile(scene.mapImageSrc)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Contact shadow where the map plane meets the table — a child of
            THIS tilted layer (not the flat backdrop), so it inherits the
            same rotateX/scale/translate as the map and stays perspective-
            correct as the camera moves, instead of a static shape that
            would drift out of alignment. Peaks right at the map's own top
            edge (0%) and feathers both directions — into the map below and
            into the backdrop above — reading as a soft contact shadow
            rather than a hard-edged drop shadow. Intensity below is a
            starting point — see options to try once rendered. */}
        <div
          style={{
            position: "absolute",
            top: "-8%",
            left: 0,
            right: 0,
            height: "16%",
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Town / river / region labels */}
        {scene.labels.map((label) => {
          const opacity =
            fadeIn(frame, label.enterFrame) * fadeOut(frame, label.exitFrame);
          if (opacity <= 0) return null;
          return (
            <div
              key={label.id}
              style={{
                position: "absolute",
                left: `${label.x}%`,
                top: `${label.y}%`,
                transform: "translate(-50%, -50%)",
                opacity,
                color: "white",
                fontWeight: 700,
                fontSize: label.style === "town" ? 36 : 24,
                letterSpacing: 2,
                textShadow: "0 2px 6px rgba(0,0,0,0.8)",
              }}
            >
              {label.text}
            </div>
          );
        })}

        {/* Unit blocks — position interpolated along their path array */}
        {scene.units.map((unit) => {
          const opacity = fadeIn(frame, unit.enterFrame) * fadeOut(frame, unit.exitFrame);
          if (opacity <= 0) return null;

          const { x, y, rotation, moving } = getPositionOnPath(unit.path, frame);

          const color =
            unit.side === "union" || unit.side === "allied"
              ? "#1f4fb0"
              : unit.side === "confederate" || unit.side === "axis"
              ? "#8a1f1f"
              : "#555";

          // Impact scale-punch — a brief scale-up/down pulse on this unit's
          // OWN box when it's near an active impact, so the flash isn't the
          // only thing selling the collision. Finds the nearest active
          // impact (there should only ever be one at a time in practice,
          // but this stays correct if two ever overlapped) within
          // IMPACT_PROXIMITY_PERCENT of this unit's CURRENT position.
          let punchScale = 1;
          for (const impact of scene.impacts ?? []) {
            const t = frame - impact.frame;
            if (t < 0 || t > IMPACT_DURATION_FRAMES) continue;
            if (Math.hypot(x - impact.x, y - impact.y) > IMPACT_PROXIMITY_PERCENT) continue;
            const progress = t / IMPACT_DURATION_FRAMES;
            // Smooth up-then-down pulse (0 at both ends, peak at the
            // midpoint) rather than a linear snap — sin(π·progress) is 0 at
            // progress 0 and 1, and 1 at progress 0.5.
            const pulse = Math.sin(Math.PI * progress);
            punchScale = Math.max(punchScale, 1 + IMPACT_PUNCH_AMOUNT * pulse);
          }

          // Movement trail — a short run of fading dots tracing recent
          // positions, distance-sampled backward along the SAME path (see
          // getTrailPoints — fixed FRAME offsets turned out to render
          // invisibly for slow-moving units, since the whole lookback
          // window covered less on-screen distance than the unit's own
          // box). `moving` short-circuits the search entirely for a unit
          // sitting in a held segment, where it would find nothing anyway.
          const trailPoints = moving ? getTrailPoints(unit.path, frame) : [];

          return (
            <React.Fragment key={unit.id}>
              {/* Trail dots render as siblings, not children, of the unit
                  wrapper below — each one sits at its OWN past (x,y), not
                  relative to the unit's current position. */}
              {trailPoints.map((tp, i) => (
                <div
                  key={`${unit.id}-trail-${i}`}
                  style={{
                    position: "absolute",
                    left: `${tp.x}%`,
                    top: `${tp.y}%`,
                    transform: "translate(-50%, -50%)",
                    // Tapers in both size and opacity toward the tail
                    // (higher i = older = further back along the path).
                    // Bigger head (20px, was 16px) down to a smaller tail
                    // (6px) across the now-8 dots, for a more deliberate
                    // "motion trail" read rather than a uniform row of
                    // same-sized dots fading out.
                    width: 20 - i * 2,
                    height: 20 - i * 2,
                    borderRadius: "50%",
                    background: color,
                    // Peak opacity raised again (0.75→0.85 nearest, floor
                    // 0.1→0.15 farthest) for more presence — confirmed by
                    // rendering last round that a dark navy/maroon dot
                    // needs real opacity to read against this map's busy
                    // tan texture, so pushing further in that direction
                    // rather than back toward the original near-invisible
                    // 0.4 ceiling.
                    opacity:
                      opacity * (0.85 - i * (0.7 / (TRAIL_DOT_COUNT - 1))),
                    pointerEvents: "none",
                  }}
                />
              ))}

              <div
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: "translate(-50%, -50%)",
                  opacity,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 24,
                    background: color,
                    border: "2px solid rgba(0,0,0,0.6)",
                    borderRadius: 3,
                    // punchScale (see above) briefly scales this box up
                    // and back down when an impact lands near it — applied
                    // AFTER rotate so it scales the box's own local frame,
                    // not a distorted post-rotation scale.
                    transform: `rotate(${rotation}deg) scale(${punchScale})`,
                    boxShadow: "0 4px 8px rgba(0,0,0,0.5)",
                  }}
                />
                {/* Unit name, same fade as the box above it — not rotated
                    with the box, so it stays readable regardless of unit
                    heading. */}
                {unit.label && (
                  <div
                    style={{
                      marginTop: 4,
                      color: "#f5f0e8",
                      fontWeight: 700,
                      fontSize: 18,
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                      // Layered halo instead of a background plate: a solid
                      // chip behind the text would read as a modern UI label
                      // pasted onto a period map. Stacking several shadow
                      // passes (tight dark core + wider soft glow) fakes a
                      // thin outline so the text holds up against busy map
                      // texture without adding a graphic element of its own.
                      textShadow:
                        "0 1px 2px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.65), 0 2px 5px rgba(0,0,0,0.8)",
                    }}
                  >
                    {unit.label.toUpperCase()}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        {/* Portrait callouts */}
        {scene.portraits.map((p) => {
          const opacity = fadeIn(frame, p.enterFrame) * fadeOut(frame, p.exitFrame);
          if (opacity <= 0) return null;
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: "translate(-50%, -100%)",
                opacity,
                textAlign: "center",
              }}
            >
              <Img
                src={staticFile(p.imageSrc)}
                style={{
                  width: 90,
                  height: 90,
                  objectFit: "cover",
                  border: "3px solid white",
                  borderRadius: 4,
                  boxShadow: "0 4px 10px rgba(0,0,0,0.6)",
                }}
              />
              <div
                style={{
                  marginTop: 4,
                  color: "#1f4fb0",
                  fontWeight: 800,
                  fontSize: 20,
                  textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                }}
              >
                {p.name.toUpperCase()}
              </div>
            </div>
          );
        })}

        {/* Impact flashes — brief flares at collision moments, positioned
            in map coordinates (like units/labels) so they pan/zoom with
            everything else in this layer. Rendered last in this layer so
            a flash sits visually on top of any unit box at that point,
            not hidden behind it. Engine support only — scene.impacts is
            optional and no data file populates it yet. */}
        {(scene.impacts ?? []).map((impact, i) => {
          const t = frame - impact.frame;
          if (t < 0 || t > IMPACT_DURATION_FRAMES) return null;
          const progress = t / IMPACT_DURATION_FRAMES;
          // Quick rise to peak (~15% into the duration), slower fade over
          // the rest — reads as a flare catching light and settling, not
          // a linear blink on/off. Peak raised 0.8→0.95 for more presence.
          const opacity = interpolate(progress, [0, 0.15, 1], [0, 0.95, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const scale = interpolate(progress, [0, 1], [0.5, 1.6], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          // Secondary outer ring — a distinct "shockwave" pulse, not just
          // a bigger version of the core flash: starts small and mostly
          // transparent, expands FASTER/FARTHER than the core (up to 2.6x
          // vs the core's 1.6x), and its opacity peaks early then fades out
          // well before the core does, so it reads as a wave passing
          // outward rather than a second flash sitting on top of the first.
          const ringOpacity = interpolate(progress, [0, 0.25, 0.85], [0, 0.55, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const ringScale = interpolate(progress, [0, 1], [0.4, 2.6], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <React.Fragment key={`impact-${i}`}>
              {/* Outer shockwave ring — a hollow band (transparent center,
                  transparent past the band) rather than a filled disc, so
                  it doesn't just look like a second, bigger core flash. */}
              <div
                style={{
                  position: "absolute",
                  left: `${impact.x}%`,
                  top: `${impact.y}%`,
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  transform: `translate(-50%, -50%) scale(${ringScale})`,
                  opacity: ringOpacity,
                  background:
                    "radial-gradient(circle, transparent 0%, transparent 58%, rgba(255,190,110,0.8) 66%, rgba(220,120,50,0.4) 74%, rgba(220,120,50,0) 82%)",
                  pointerEvents: "none",
                }}
              />
              {/* Core flash. REWORKED after actually rendering — the
                  original pale warm-white was calibrated assuming a dark
                  background, but impacts sit on top of the (pale tan
                  sepia) MAP itself, where a pale-on-pale flash is nearly
                  invisible (confirmed: at ~55% opacity mid-flash, it was
                  barely perceptible even zoomed in). A bright core still
                  reads as "light," but has a darker, more saturated
                  orange-red ring around it, which is what actually gives
                  it edge contrast against a light map — still a soft
                  flare (nothing hard-edged), not a fireball/burst graphic. */}
              <div
                style={{
                  position: "absolute",
                  left: `${impact.x}%`,
                  top: `${impact.y}%`,
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  transform: `translate(-50%, -50%) scale(${scale})`,
                  opacity,
                  background:
                    "radial-gradient(circle, rgba(255,250,230,1) 0%, rgba(255,210,110,0.9) 20%, rgba(200,80,30,0.55) 45%, rgba(120,40,20,0) 72%)",
                  pointerEvents: "none",
                }}
              />
            </React.Fragment>
          );
        })}
      </AbsoluteFill>

      {/* Title card — rendered as a sibling of the tilted inner AbsoluteFill
          (not inside it), so it sits flat in the backdrop area above the map
          plane instead of getting caught in the rotateX perspective warp.
          Gives the wide establishing shot's leftover backdrop space a job
          instead of sitting empty. Styled like the existing map labels
          (bold, near-white, text-shadow halo, all-caps) for visual
          consistency, just centered near the top of frame rather than
          pinned to a map coordinate. */}
      {scene.titleCard && (() => {
        const { lines, enterFrame, exitFrame } = scene.titleCard;
        const opacity = fadeIn(frame, enterFrame) * fadeOut(frame, exitFrame);
        if (opacity <= 0) return null;
        return (
          <AbsoluteFill
            style={{
              justifyContent: "flex-start",
              alignItems: "center",
              paddingTop: "8%",
              opacity,
              pointerEvents: "none",
            }}
          >
            {lines.map((line, i) => (
              <div
                key={i}
                style={{
                  color: "#f5f0e8",
                  fontWeight: 700,
                  fontSize: 36,
                  letterSpacing: 2,
                  textAlign: "center",
                  // A single soft 6px shadow wasn't enough edge definition
                  // to hold up at a glance — same reinforced multi-layer
                  // dark halo already used for the unit labels below
                  // (tight core + wider glow + directional drop) instead
                  // of just one weak pass.
                  textShadow:
                    "0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.9), 0 0 14px rgba(0,0,0,0.7), 0 3px 10px rgba(0,0,0,0.85)",
                  marginBottom: i < lines.length - 1 ? 8 : 0,
                }}
              >
                {line.toUpperCase()}
              </div>
            ))}
          </AbsoluteFill>
        );
      })()}

      {/* Reuses the same grain overlay ArticleVideo.jsx applies site-wide
          (see components/FilmGrain.jsx) rather than a bespoke texture, so
          this composition's atmosphere matches every other video instead
          of introducing a second, slightly-different noise treatment.
          Renders over the whole frame (map included) — isolating it to
          just the backdrop area isn't practical, since that region's
          shape shifts every frame with cam.tilt/zoom. Opacity raised from
          FilmGrain's own default (0.045, unchanged for every other caller)
          via its existing opacity prop — the default read as essentially
          invisible against this flat backdrop specifically. */}
      <FilmGrain opacity={0.16} />

      {/* One Sequence+Audio per beat, rather than a single global track —
          each beat's Kokoro VO clip has its own measured start/duration
          (see Beat in BattleMapConfig.ts) instead of one track spanning
          the whole scene. */}
      {scene.beats.map((beat) => (
        <Sequence
          key={beat.id}
          from={beat.startFrame}
          durationInFrames={beat.durationInFrames}
        >
          <Audio src={staticFile(beat.audioSrc)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
