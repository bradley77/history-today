import { geoMercator } from 'd3-geo';

const MAP_CONFIG = {
  center: [-1.2, 50.1],
  zoom: 8.5,
  width: 1216,
  height: 1920,
};

function zoomToScale(zoom) {
  return (256 * Math.pow(2, zoom)) / (2 * Math.PI);
}

export function createProjection(config = MAP_CONFIG) {
  const scale = zoomToScale(config.zoom);
  return geoMercator()
    .scale(scale)
    .center(config.center)
    .translate([config.width / 2, config.height / 2]);
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
  const config = { center: [-1.2, 49.8], zoom: 7.0, width: 1216, height: 1920 };
  const projection = createProjection(config);

  const points = {
    portsmouth:       projection([-1.0875, 50.8058]),
    piccadillyCircus: projection([-1.25, 50.50]),
    utahBeach:        projection([-1.1903, 49.4197]),
    omahaBeach:       projection([-0.8588, 49.3714]),
    swordBeach:       projection([-0.2958, 49.3047]),
    caen:             projection([-0.3676, 49.1828]),
  };

  console.log('=== D-DAY COORDINATE DEBUG ===');
  Object.entries(points).forEach(([name, [x, y]]) => {
    console.log(`${name}: x=${Math.round(x)}, y=${Math.round(y)}`);
  });
  console.log('Canvas size: 1216 x 1920');
  console.log('Points in range: x should be 0-1216, y should be 0-1920');
}
