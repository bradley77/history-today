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
  spring,
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

// "Considered" spring, not a bouncy one — damping raised well past
// Remotion's default (10) so the camera settles into the next keyframe
// without overshooting past it, per Remotion's own docs guidance for a
// no-bounce spring. Only the damping is tuned; mass/stiffness stay at
// Remotion's defaults.
const CAMERA_SPRING_CONFIG = { damping: 200 };

function sampleKeyframes(
  frame: number,
  keyframes: CameraKeyframe[],
  fps: number
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

  let t: number;
  if (b.easing === "spring") {
    // spring() instead of interpolate()'s easing param — driven by an
    // actual mass/damping/stiffness simulation rather than a fixed curve,
    // so the move accelerates/settles like something with inertia rather
    // than mechanically tracing the same easeInOut S-curve every time.
    // durationInFrames ties it to this specific keyframe pair's window so
    // it reaches (approximately) 1 by the time `b.frame` arrives, same
    // contract as the interpolate()-based path below.
    t = spring({
      frame: frame - a.frame,
      fps,
      durationInFrames: b.frame - a.frame,
      config: CAMERA_SPRING_CONFIG,
    });
  } else {
    const easing =
      b.easing === "easeInOut" ? Easing.inOut(Easing.ease) : Easing.linear;

    t = interpolate(frame, [a.frame, b.frame], [0, 1], {
      easing,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

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

// --- backdrop/map layout ------------------------------------------------
//
// STRUCTURAL CHANGE (was: emergent from camera tilt/zoom math). Three
// rounds of tuning individual keyframes' tilt/zoom (and then perspective)
// only ever moved backdrop coverage a few percentage points (36.5% ->
// 33.9%) because the map's screen footprint was never actually GUARANTEED
// — it was just whatever fell out of that frame's particular rotateX +
// scale + translate combination. Any keyframe using a low zoom (the wide
// "reveal" shots deliberately go below 1.0 to fit widely-separated
// locations in frame) could still open up an arbitrarily large backdrop
// void above the map.
//
// New approach: the backdrop is now a FIXED-HEIGHT band pinned to the top
// of the frame, sized independently of the camera. The map renders into
// a separate viewport sized to exactly fill the remainder, and the
// tilted map plane inside that viewport is guaranteed (not just usually)
// to cover its own viewport edge-to-edge, via a computed minimum scale
// floor (see minCoverageScale below) that keyframe zoom values can exceed
// (to zoom in further) but can no longer fall below. tilt/zoom still
// control how dramatic the 3D read is and how tight the framing is
// *within* that guaranteed footprint — they just can't shrink the
// footprint itself anymore.
const BACKDROP_HEIGHT_PERCENT = 14; // reserved band height, within the requested 12-15% range
const MAP_VIEWPORT_HEIGHT_PERCENT = 100 - BACKDROP_HEIGHT_PERCENT;

// Tried scaling this down proportionally to the shorter map viewport
// (3200 * 0.86 ≈ 2752), reasoning that CSS perspective is an absolute
// pixel distance and a shorter container would otherwise get relatively
// "more generous" (less foreshortening) than before. Rendering proved
// that reasoning wrong in practice: at 2752 the keystone wedge that the
// 1600->3200 perspective bump (previous round) had fixed came back,
// visibly worse than before this round even started. Left at the flat
// 3200 tuned then — no scaling — since that's what actually held up
// under rendering.
const MAP_PERSPECTIVE = 3200;

// Minimum scale needed for the map plane to still cover its own viewport
// edge-to-edge, given this frame's tilt AND pan offset.
//
// FIRST attempt at this (tilt alone, via 1/cos(tiltDeg)) failed real
// rendering: the opening shot (tilt only 14°, but panned well off-center
// — cam.y=14, i.e. 36 points from the 50-center) still showed a huge gap
// even at zoom 1.7, far above that formula's ~1.1 floor. Root cause turned
// out to be transform ORDER, not tilt: the original transform was
// `rotateX(tilt) scale(zoom) translate(...)`, and CSS composes that
// right-to-left — translate is applied FIRST (as a fraction of the box's
// own static size), and THEN scale multiplies that already-applied
// offset by zoom too. So a keyframe panned far off-center got its pan
// distance ADDITIONALLY amplified by zoom, requiring a much bigger scale
// to still cover the viewport than tilt foreshortening alone would ever
// suggest (confirmed by rendering: the math below matched the actual
// measured gap almost exactly). Reordered the transform below to
// `rotateX(tilt) translate(...) scale(zoom)` instead — translate's
// percentage always resolves against the static box size regardless of
// where it sits in the transform list, so this ordering makes the pan
// offset a FIXED distance unaffected by zoom, which is also the more
// intuitive semantics (pan to a map coordinate, then zoom — not zoom
// changing how far a pan of "50-x%" actually moves).
//
// With that reorder, the coverage math for a plane panned by fraction f
// (of its own height/width, i.e. (50-cam.x)/100 or (50-cam.y)/100) is
// s >= 1 + 2*|f| to keep that axis fully covered (derived from where the
// plane's edge — a fixed distance from center — ends up after translate
// then scale, both centered on the box's own middle). Combined with the
// simpler 1/cos(tiltDeg) requirement for rotateX foreshortening (which
// only affects the Y axis).
//
// SECOND round of rendering (after the reorder) showed THIS combined
// formula still isn't exact — it correctly predicted the opening shot's
// requirement almost to the pixel (validating the pan-amplification fix),
// but still under-covered Saunders Field's steep-tilt beat (46°) at its
// authored zoom 1.9, leaving a visible sliver. Tuned COVERAGE_SAFETY_MARGIN
// empirically against actual renders rather than keep hand-deriving
// perspective's non-linear correction term (got it wrong twice already):
// 1.1/1.2/1.33 all still left a gap or hairline sliver at Saunders Field,
// 1.4 looked clean on a VISUAL check — but that check turned out to be
// invalid (see below), so it shipped with a real bug.
//
// THIRD round: a follow-up bug report ("checkerboard between backdrop and
// map") turned out to be exactly this same gap, still present at margin
// 1.4, at multiple keyframes (1190, 1548, 1714, 1963) — the "visual check"
// that approved 1.4 had rendered mapViewportStyle with an opaque DEBUG
// background color to visualize its bounds, and that same opaque color
// was silently papering over the real transparency gap I was supposed to
// be checking for, so "looks fully covered" was actually just "the debug
// fill is covering it." Re-verified properly this time by scanning the
// rendered PNGs' actual alpha channel (a transparent/uncovered pixel is
// unambiguous, unlike a screenshot glanced at) across all 13 camera
// keyframes AND 16 mid-transition frames spanning the whole episode — 1.4
// failed at 4 of those, 1.7 passed all 29 on that check alone.
//
// But 1.7 created its OWN regression: it pushed beat 1's effectiveZoom so
// high (that beat has both a shallow tilt AND a large y-pan, so panFloorY
// dominates and gets multiplied by whatever margin sits here) that the
// grant-column unit's path — authored assuming something closer to the
// original ~1.7 zoom — panned mostly outside the frame for large stretches
// of beat 1. Settled on 1.3 as the actual value: high enough to meaningfully
// shrink the gap, low enough not to crop unit content that was placed
// assuming a less aggressive floor, and — critically — the mapViewportStyle
// backstop below covers whatever residual gap 1.3 still leaves (confirmed:
// zero transparent pixels across all 29 frames with 1.3 + the backstop).
// This margin is still an empirical fit, not a proof; the backstop is what
// actually makes "no checkerboard, ever" a guarantee rather than a hope.
const COVERAGE_SAFETY_MARGIN = 1.3;
function minCoverageScale(tiltDeg: number, camX: number, camY: number): number {
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const tiltFloor = 1 / Math.cos(tiltRad);
  const fx = Math.abs(50 - camX) / 100;
  const fy = Math.abs(50 - camY) / 100;
  const panFloorY = 1 + 2 * fy;
  const panFloorX = 1 + 2 * fx;
  return Math.max(tiltFloor, panFloorY, panFloorX) * COVERAGE_SAFETY_MARGIN;
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
  const { width, height, fps } = useVideoConfig();

  const cam = sampleKeyframes(frame, scene.camera, fps);

  // The guarantee: keyframe zoom can still zoom IN past this (tighter
  // framing), it just can no longer take the plane's on-screen footprint
  // below what's needed to fill the map viewport — see minCoverageScale
  // above for the derivation and BattleMapScene fix notes for the render
  // testing that validated it.
  const effectiveZoom = Math.max(
    cam.zoom,
    minCoverageScale(cam.tilt, cam.x, cam.y)
  );

  // Backdrop is a dark radial gradient rather than flat black — a pure
  // #000 void behind the title card read as a rendering glitch rather
  // than atmosphere.
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
  //
  // This now lives on a FIXED-HEIGHT band (backdropStyle, below), not the
  // full frame — a structural change from the perspective-tuning round
  // that preceded this one. See the "backdrop/map layout" block above
  // sampleKeyframes for why: no amount of tilt/zoom/perspective tuning on
  // the emergent-footprint approach could get past marginal, imperceptible
  // gains (36.5% -> 33.9%), so the map's footprint is now guaranteed by
  // structure instead of chased through keyframe math.
  const backdropStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: `${BACKDROP_HEIGHT_PERCENT}%`,
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

  // Map viewport — sized to exactly fill the frame minus the backdrop
  // band, regardless of camera. `perspective` lives here now (not on the
  // outer frame) since this is the direct parent of the rotated plane —
  // see MAP_PERSPECTIVE above for why its value stayed at the flat 3200
  // tuned last round rather than scaling with the new smaller container.
  //
  // backgroundImage below is a BACKSTOP, not the primary coverage
  // mechanism (that's minCoverageScale/effectiveZoom above) — it's what
  // paints if the tilted plane ever falls short of this box regardless,
  // so a shortfall reads as "a sliver more of the same wood table" rather
  // than transparency/checkerboard. Added after a real coverage bug
  // shipped past the tilt/zoom math once already (see minCoverageScale's
  // comment) — the math is an empirical fit, not a guarantee, so this
  // exists as a second line of defense rather than trusting it alone a
  // second time. Same wood-table texture as backdropStyle, so a visible
  // sliver of it blends with the band above instead of introducing a new
  // texture seam of its own.
  const mapViewportStyle: React.CSSProperties = {
    position: "absolute",
    top: `${BACKDROP_HEIGHT_PERCENT}%`,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    perspective: MAP_PERSPECTIVE,
    // Same darkening vignette as backdropStyle's own (transparent-black,
    // `normal` blend) layered over the wood photo — plain wood-table.jpg
    // alone is noticeably lighter/more saturated than the backdrop band
    // above it (which has this same vignette darkening it), so a visible
    // backstop sliver without it read as a mismatched second texture
    // rather than "more of the same table."
    backgroundImage:
      "radial-gradient(ellipse 120% 90% at 50% -20%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0.85) 100%), " +
      `url("${staticFile("/textures/wood-table.jpg")}")`,
    backgroundBlendMode: "normal, normal",
    backgroundSize: "100% 100%, cover",
    backgroundPosition: "center, center",
    backgroundRepeat: "no-repeat, no-repeat",
  };

  // Seam shadow — was a child of the tilted inner layer (so it could
  // track the map's own top edge as camera tilt/zoom moved it around).
  // Now that the map/backdrop seam sits at the SAME fixed y position
  // every frame (the top of mapViewportStyle), this can be a plain,
  // camera-independent overlay straddling that boundary instead —
  // simpler, and no longer at risk of being clipped by mapViewport's
  // overflow:hidden the way a shadow bleeding out of the tilted layer
  // would be.
  const seamShadowStyle: React.CSSProperties = {
    position: "absolute",
    top: `${BACKDROP_HEIGHT_PERCENT}%`,
    left: 0,
    right: 0,
    height: "6%",
    transform: "translateY(-50%)",
    background:
      "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0) 100%)",
    pointerEvents: "none",
  };

  const innerStyle: React.CSSProperties = {
    transformStyle: "preserve-3d",
    // translate BEFORE scale (was: scale then translate) — see
    // minCoverageScale's comment above for why: translate's percentage is
    // always relative to the box's static size regardless of order, so
    // putting it before scale keeps pan a fixed distance instead of one
    // that gets amplified by zoom.
    transform: `rotateX(${cam.tilt}deg) translate(${50 - cam.x}%, ${
      50 - cam.y
    }%) scale(${effectiveZoom})`,
    transformOrigin: "center center",
    width: "100%",
    height: "100%",
    position: "relative",
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={backdropStyle} />

      <div style={seamShadowStyle} />

      <div style={mapViewportStyle}>
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
                  // Counter-scale by 1/effectiveZoom: unit boxes/labels are
                  // plain CSS pixels (60x24, fontSize 18) inside the SAME
                  // tilted/scaled plane as the map, so their on-screen size
                  // otherwise tracks whatever effectiveZoom that beat's
                  // camera happens to be at — and effectiveZoom varies a
                  // lot beat to beat (roughly 1.6-2.9x, see minCoverageScale
                  // above), which is exactly why grant-column (beat 1,
                  // shallow-tilt/high-pan beat with an unusually high
                  // effectiveZoom) rendered visibly bigger than Ewell/
                  // Warren/Hill/Getty/Hancock despite identical box/label
                  // CSS — it was never a per-unit style divergence, just
                  // whichever beat's zoom happened to be active. This
                  // neutralizes that, so every unit's box+label renders at
                  // the same on-screen size regardless of camera zoom (a
                  // little residual difference from tilt's own foreshortening
                  // is expected and correct — that's the actual 3D-table
                  // effect, not a bug).
                  transform: `translate(-50%, -50%) scale(${1 / effectiveZoom})`,
                  transformOrigin: "center center",
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
      </div>

      {/* Title card — now rendered INSIDE the fixed backdrop band (was: a
          full-frame sibling relying on the wide shot's emergent leftover
          space and an 8%-of-full-frame paddingTop). The band is guaranteed
          to exist at a known size every frame now, so this just centers
          within it instead of guessing at padding against a variable-sized
          void. Styled like the existing map labels (bold, near-white,
          text-shadow halo, all-caps) for visual consistency. */}
      {scene.titleCard && (() => {
        const { lines, enterFrame, exitFrame } = scene.titleCard;
        const opacity = fadeIn(frame, enterFrame) * fadeOut(frame, exitFrame);
        if (opacity <= 0) return null;
        return (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: `${BACKDROP_HEIGHT_PERCENT}%`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
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
          </div>
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
