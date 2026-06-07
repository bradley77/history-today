import { geoMercator } from 'd3-geo';

const MAP_CONFIG = {
  center: [-1.0, 50.2],
  zoom: 8.2,
  width: 1216,
  height: 1920,
  yOffset: -380,
};

function zoomToScale(zoom) {
  return (256 * Math.pow(2, zoom)) / (2 * Math.PI);
}

export function createProjection(config = MAP_CONFIG) {
  const scale = zoomToScale(config.zoom);
  const yOffset = config.yOffset || 0;
  return geoMercator()
    .scale(scale)
    .center(config.center)
    .translate([config.width / 2, (config.height / 2) + yOffset]);
}

export function toPixel(lngLat, config = MAP_CONFIG) {
  const projection = createProjection(config);
  return projection(lngLat);
}

export function routeToSVGPath(waypoints, config = MAP_CONFIG) {
  const projection = createProjection(config);
  const pixels = waypoints.map(pt => projection(pt));
  return pixels.reduce((path, [x, y], i) => {
    return path + (i === 0 ? `M ${x},${y}` : ` L ${x},${y}`);
  }, '');
}

export function routeToBezierPath(waypoints, config = MAP_CONFIG) {
  const projection = createProjection(config);
  const pixels = waypoints.map(pt => projection(pt));

  if (pixels.length < 2) return '';

  let path = `M ${pixels[0][0]},${pixels[0][1]}`;

  for (let i = 1; i < pixels.length; i++) {
    const prev = pixels[i - 1];
    const curr = pixels[i];

    // Control points for smooth curve
    const cpX1 = prev[0] + (curr[0] - prev[0]) * 0.25;
    const cpY1 = prev[1] + (curr[1] - prev[1]) * 0.1;
    const cpX2 = prev[0] + (curr[0] - prev[0]) * 0.75;
    const cpY2 = curr[1] - (curr[1] - prev[1]) * 0.1;

    path += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${curr[0]},${curr[1]}`;
  }

  return path;
}

export function debugCoordinates() {
  const config = { center: [-1.0, 50.8], zoom: 8.2, width: 1216, height: 1920 };
  const projection = createProjection(config);

  // Test what lat/lng corresponds to specific pixel positions on our map
  const inverse = projection.invert;

  const points = {
    portsmouth:       projection([-1.0875, 50.8058]),
    southampton:      projection([-1.4044, 50.9097]),
    weymouth:         projection([-2.4572, 50.6136]),
    piccadillyCircus: projection([-1.25, 50.50]),
    utahBeach:        projection([-1.1903, 49.4197]),
    omahaBeach:       projection([-0.8588, 49.3714]),
    goldBeach:        projection([-0.5994, 49.3414]),
    junoBeach:        projection([-0.4572, 49.3272]),
    swordBeach:       projection([-0.2958, 49.3047]),
    caen:             projection([-0.3676, 49.1828]),
  };

  console.log('=== CALIBRATION DEBUG ===');
  console.log('Canvas: 1216 x 1920');
  console.log('Top 20% = y < 384, Bottom 20% = y > 1536');
  Object.entries(points).forEach(([name, [x, y]]) => {
    const xPct = Math.round((x / 1216) * 100);
    const yPct = Math.round((y / 1920) * 100);
    console.log(`${name}: pixel(${Math.round(x)}, ${Math.round(y)}) = ${xPct}% across, ${yPct}% down`);
  });
}
