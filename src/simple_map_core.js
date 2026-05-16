const fs = require("fs");
const path = require("path");

const DEFAULT_COLORS = ["#2b6cb0", "#4fa3c8", "#8fd0d0", "#f2e6a7", "#f3a05f", "#d95845", "#9e1f2f", "#64152d"];
const DEFAULT_BREAKS = [0, 8000, 12000, 18000, 30000, 50000, 80000, 120000, 180000];

function esc(value) {
  return String(value ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}

function fmt(value) {
  return Number(value).toLocaleString("zh-CN");
}

function fmtWanNumber(value) {
  return Number((Number(value) / 10000).toFixed(1)).toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}

function fmtWanLabel(value) {
  return `${fmtWanNumber(value)}万`;
}

function formatBeijingTime(value) {
  const date = value ? new Date(value) : new Date();
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} 北京时间`;
}

function readGeoFeatures(rootDir, specs) {
  return specs.flatMap(spec => {
    const geo = JSON.parse(fs.readFileSync(path.join(rootDir, spec.file), "utf8"));
    return geo.features.map(feature => {
      const props = feature.properties || {};
      const city = typeof spec.city === "function" ? spec.city(props, feature) : spec.city;
      const name = spec.name ? spec.name(props, feature) : props.name;
      return {
        ...feature,
        properties: {
          ...props,
          city,
          name,
          showName: spec.showName ? spec.showName(props, feature) : false,
        },
      };
    });
  });
}

function walkCoords(geom, fn) {
  const recur = arr => {
    if (typeof arr[0] === "number") fn(arr);
    else for (const x of arr) recur(x);
  };
  recur(geom.coordinates);
}

function mercator([lon, lat]) {
  const rad = lat * Math.PI / 180;
  return [lon, Math.log(Math.tan(Math.PI / 4 + rad / 2)) * 180 / Math.PI];
}

function buildProjection(features, mapBox) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const feature of features) {
    walkCoords(feature.geometry, coord => {
      const [x, y] = mercator(coord);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    });
  }
  const scale = Math.min(mapBox.w / (maxX - minX), mapBox.h / (maxY - minY)) * 0.92;
  const ox = mapBox.x + (mapBox.w - (maxX - minX) * scale) / 2;
  const oy = mapBox.y + (mapBox.h + (maxY - minY) * scale) / 2;
  const project = coord => {
    const [x, y] = mercator(coord);
    return [ox + (x - minX) * scale, oy - (y - minY) * scale];
  };
  const projectedMapBounds = {
    minX: ox,
    minY: oy - (maxY - minY) * scale,
    maxX: ox + (maxX - minX) * scale,
    maxY: oy,
  };
  return { minX, minY, maxX, maxY, scale, ox, oy, project, projectedMapBounds };
}

function geomToPath(geom, project) {
  const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  let d = "";
  for (const poly of polygons) {
    for (const ring of poly) {
      ring.forEach((pt, index) => {
        const [x, y] = project(pt);
        d += `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
      });
      d += "Z";
    }
  }
  return d;
}

function perpendicularDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (!dx && !dy) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / Math.hypot(dx, dy);
}

function simplifyLine(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let splitIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = i;
    }
  }
  if (maxDistance <= tolerance) return [start, end];
  return simplifyLine(points.slice(0, splitIndex + 1), tolerance)
    .slice(0, -1)
    .concat(simplifyLine(points.slice(splitIndex), tolerance));
}

function simplifyRingSequential(points, tolerance) {
  if (points.length <= 8) return points;
  const simplified = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const previous = simplified[simplified.length - 1];
    const point = points[i];
    if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= tolerance) simplified.push(point);
  }
  return simplified.length >= 3 ? simplified : points;
}

function geomToSimplifiedPath(geom, project, tolerance = 0) {
  if (!tolerance) return geomToPath(geom, project);
  const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  let d = "";
  for (const poly of polygons) {
    for (const ring of poly) {
      const projected = ring.map(project);
      const hasClosingPoint = projected.length > 2
        && Math.hypot(projected[0][0] - projected[projected.length - 1][0], projected[0][1] - projected[projected.length - 1][1]) < 1e-6;
      const openRing = hasClosingPoint ? projected.slice(0, -1) : projected;
      const simplified = simplifyRingSequential(openRing, tolerance);
      const points = simplified.length >= 3 ? simplified : openRing;
      points.forEach(([x, y], index) => {
        d += `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
      });
      d += "Z";
    }
  }
  return d;
}

function signedArea(points) {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += (points[j][0] * points[i][1]) - (points[i][0] * points[j][1]);
  }
  return sum / 2;
}

function ringCentroid(points) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const cross = points[j][0] * points[i][1] - points[i][0] * points[j][1];
    a += cross;
    cx += (points[j][0] + points[i][0]) * cross;
    cy += (points[j][1] + points[i][1]) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    const avg = points.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    return [avg[0] / points.length, avg[1] / points.length];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
  }
  return inside;
}

function distToSegment(point, a, b) {
  const [x, y] = point;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(x - a[0], y - a[1]);
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

function minDistToRing(point, ring) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    best = Math.min(best, distToSegment(point, ring[j], ring[i]));
  }
  return best;
}

function bestLabelPoint(feature, project) {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  let bestRing = null;
  let bestArea = 0;
  for (const poly of polygons) {
    if (!poly?.[0]) continue;
    const ring = poly[0].map(project);
    const area = Math.abs(signedArea(ring));
    if (area > bestArea) {
      bestArea = area;
      bestRing = ring;
    }
  }
  if (!bestRing) return [0, 0, { w: 1, h: 1 }];
  const xs = bestRing.map(p => p[0]);
  const ys = bestRing.map(p => p[1]);
  const bbox = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  const candidates = [ringCentroid(bestRing), [(bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2]];
  for (let ix = 1; ix < 10; ix++) {
    for (let iy = 1; iy < 10; iy++) {
      candidates.push([bbox.minX + (bbox.maxX - bbox.minX) * ix / 10, bbox.minY + (bbox.maxY - bbox.minY) * iy / 10]);
    }
  }
  let best = candidates.find(p => pointInRing(p, bestRing)) || candidates[0];
  let bestScore = -Infinity;
  for (const p of candidates) {
    if (!pointInRing(p, bestRing)) continue;
    const score = minDistToRing(p, bestRing);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return [Number(best[0].toFixed(2)), Number(best[1].toFixed(2)), {
    w: Number((bbox.maxX - bbox.minX).toFixed(2)),
    h: Number((bbox.maxY - bbox.minY).toFixed(2)),
  }];
}

function cleanName(name) {
  return String(name || "").replace(/市辖区$/, "").replace(/[区县市]$/g, "");
}

function pathBounds(d) {
  const values = [...String(d || "").matchAll(/-?\d+(?:\.\d+)?/g)].map(match => Number(match[0]));
  if (values.length < 2) return null;
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let i = 0; i < values.length - 1; i += 2) {
    bounds.minX = Math.min(bounds.minX, values[i]);
    bounds.maxX = Math.max(bounds.maxX, values[i]);
    bounds.minY = Math.min(bounds.minY, values[i + 1]);
    bounds.maxY = Math.max(bounds.maxY, values[i + 1]);
  }
  return Number.isFinite(bounds.minX) ? bounds : null;
}

function mergeBounds(items) {
  const source = items.map(item => item.bounds).filter(Boolean);
  if (!source.length) return null;
  return source.reduce((acc, bounds) => ({
    minX: Math.min(acc.minX, bounds.minX),
    minY: Math.min(acc.minY, bounds.minY),
    maxX: Math.max(acc.maxX, bounds.maxX),
    maxY: Math.max(acc.maxY, bounds.maxY),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function colorFor(value, breaks, colors) {
  if (!value) return "#eef2f0";
  for (let i = 0; i < breaks.length - 1; i++) {
    if (value >= breaks[i] && value < breaks[i + 1]) return colors[i];
  }
  return colors[colors.length - 1];
}

function legendLabel(index, breaks, colors) {
  if (index === 0) return `<${fmtWanNumber(breaks[1])}万`;
  if (index === colors.length - 1) return `${fmtWanNumber(breaks[index])}万+`;
  return `${fmtWanNumber(breaks[index])}-${fmtWanNumber(breaks[index + 1])}万`;
}

function createInteractiveMap(config) {
  const width = config.width || 1800;
  const height = config.height || 1320;
  const mapBox = config.mapBox || { x: 64, y: 198, w: 1120, h: 920 };
  const colors = config.colors || DEFAULT_COLORS;
  const breaks = config.breaks || DEFAULT_BREAKS;
  const features = config.features;
  const outlines = config.outlines || [];
  const pathSimplifyTolerance = config.pathSimplifyTolerance || 0;
  const projection = buildProjection(features, mapBox);
  const mapViewPadding = 82;
  const mapViewBox = {
    x: Math.max(0, projection.projectedMapBounds.minX - mapViewPadding),
    y: Math.max(0, projection.projectedMapBounds.minY - mapViewPadding),
    w: Math.min(width, projection.projectedMapBounds.maxX + mapViewPadding) - Math.max(0, projection.projectedMapBounds.minX - mapViewPadding),
    h: Math.min(height, projection.projectedMapBounds.maxY + mapViewPadding) - Math.max(0, projection.projectedMapBounds.minY - mapViewPadding),
  };
  const getRecord = config.getRecord;
  const regions = features.map((feature, index) => {
    const record = getRecord(feature.properties.city, feature.properties.name);
    const price = record?.price || null;
    const [cx, cy, labelBox] = bestLabelPoint(feature, projection.project);
    const label = cleanName(feature.properties.name);
    const d = geomToSimplifiedPath(feature.geometry, projection.project, pathSimplifyTolerance);
    return {
      id: `r${index}`,
      city: feature.properties.city,
      name: feature.properties.name,
      label,
      price,
      mom: record?.mom || "",
      source: record?.source || "",
      quality: record?.quality || "",
      supplemental: Boolean(record?.supplemental),
      d,
      bounds: pathBounds(d),
      fill: colorFor(price, breaks, colors),
      cx,
      cy,
      labelMinScale: Number(Math.max(1.8, Math.min(5.2, ((label.length + 5) * 7) / Math.max(10, Math.min(labelBox.w, labelBox.h * 2)))).toFixed(2)),
    };
  });
  const cityBoundaries = outlines.map((feature, index) => ({ id: `c${index}`, d: geomToSimplifiedPath(feature.geometry, projection.project, pathSimplifyTolerance) }));
  const cityLabels = Object.entries(config.labelCenters || {}).map(([label, coord]) => {
    const [x, y] = projection.project(coord);
    return { label, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.pageTitle)}</title>
<style>
  :root { --ink:#1b2c33; --muted:#63767d; --line:#dbe6e3; --brand:#2f89a6; --overlay-opacity:.60; --label-scale:1.08; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:"Microsoft YaHei","Noto Sans CJK SC",Arial,sans-serif; color:var(--ink); background:linear-gradient(135deg,#f7faf8,#f4f0e8); }
  .app { min-height:100vh; display:grid; grid-template-columns:minmax(720px,1fr) 430px; gap:18px; padding:24px; }
  .mapShell,.side { min-width:0; background:rgba(255,255,255,.86); border:1px solid var(--line); border-radius:14px; box-shadow:0 18px 38px rgba(37,70,80,.10); }
  .mapShell { position:relative; overflow:hidden; min-height:calc(100vh - 48px); overscroll-behavior:contain; }
  header { position:absolute; z-index:3; left:26px; top:22px; pointer-events:none; }
  h1 { margin:0; font-size:34px; letter-spacing:0; }
  header p { margin:8px 0 0; color:var(--muted); font-size:14px; }
  .toolbar { position:absolute; right:18px; top:18px; z-index:4; display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
  .presetBar { position:absolute; z-index:4; left:26px; top:104px; display:flex; gap:7px; flex-wrap:wrap; max-width:min(640px,calc(100% - 360px)); }
  button,.mapNav,input { border:1px solid var(--line); background:#fff; color:var(--ink); border-radius:8px; font:inherit; }
  button,.mapNav { height:36px; padding:8px 12px; cursor:pointer; text-decoration:none; line-height:18px; }
  button:hover,.mapNav:hover { border-color:#9fcac6; }
  button.active,.mapNav.active { border-color:#2f89a6; background:#edf7f6; color:#1f6677; font-weight:800; }
  svg { width:100%; height:calc(100vh - 48px); display:block; cursor:grab; touch-action:none; user-select:none; }
  svg.dragging { cursor:grabbing; }
  #viewport { will-change:transform; }
  .regionSeal { fill:none; stroke-width:1.1; pointer-events:none; opacity:.92; vector-effect:non-scaling-stroke; stroke-linejoin:round; stroke-linecap:round; }
  .detailDataset { transition:opacity .16s; }
  .detailDataset.hidden { display:none; }
  #priceOverlay { transition:opacity .15s; }
  .mapTilesOn #priceOverlay { opacity:var(--overlay-opacity); }
  .region { stroke:rgba(255,255,255,.92); stroke-width:.85; vector-effect:non-scaling-stroke; transition:opacity .15s; }
  svg.dragging .region { pointer-events:none; }
  .cityBoundary { fill:none; stroke:#153f49; stroke-width:2.1; vector-effect:non-scaling-stroke; pointer-events:none; opacity:.7; }
  .highlightPath { fill:none; pointer-events:none; vector-effect:non-scaling-stroke; stroke-linejoin:round; stroke-linecap:round; }
  #hoverHighlight { stroke:#ffd15c; stroke-width:3.2; opacity:.95; }
  #selectedHighlight { fill:rgba(22,183,168,.18); stroke:#0ba99d; stroke-width:4; opacity:1; }
  #selectedPulse { stroke:#0ba99d; stroke-width:8; opacity:.22; animation:selectedPulse 1.8s ease-in-out infinite; }
  @keyframes selectedPulse { 0%,100%{opacity:.12;stroke-width:5} 50%{opacity:.30;stroke-width:8} }
  .dimmed { opacity:.18; }
  .cityLabel { font-size:calc(17px * var(--label-scale)); font-weight:900; fill:#0c5261; paint-order:stroke; stroke:rgba(255,255,255,.88); stroke-width:4.4px; pointer-events:none; }
  .detailLabel { display:none; font-size:calc(8.4px * var(--label-scale)); font-weight:800; fill:#25363d; paint-order:stroke; stroke:rgba(255,255,255,.94); stroke-width:2px; pointer-events:none; }
  .mapShell.isMoving .detailLabel,.mapShell.isMoving .cityLabel { display:none!important; }
  .mapShell.isMoving #detailBoundaries { display:none; }
  .mapShell.isMoving .cityBoundary { opacity:.25; }
  .mapShell.isMoving .region { stroke-opacity:0; transition:none; }
  .tileBuffer { opacity:0; transition:opacity .16s ease; }
  .tileBuffer.active { opacity:1; }
  .tileImage { opacity:.78; }
  .legend,.tileAttribution,.overlayControl { position:absolute; z-index:4; background:rgba(255,255,255,.84); border:1px solid var(--line); }
  .legend { left:26px; bottom:22px; border-radius:12px; padding:12px 14px; }
  .legendTitle { font-weight:800; margin-bottom:8px; }
  .swatches { display:flex; gap:6px; align-items:center; }
  .swatch { width:58px; height:16px; border-radius:4px; }
  .legendLabels { display:grid; grid-template-columns:repeat(${colors.length},58px); gap:6px; margin-top:6px; color:var(--muted); font-size:10.5px; white-space:nowrap; }
  .tileAttribution { right:18px; bottom:16px; display:none; border-radius:8px; padding:5px 8px; color:var(--muted); font-size:11px; }
  .mapTilesOn .tileAttribution { display:block; }
  .overlayControl { right:18px; top:62px; display:none; align-items:center; gap:8px; width:272px; padding:8px 10px; border-radius:10px; font-size:12px; font-weight:800; }
  .mapTilesOn .overlayControl { display:flex; }
  .overlayControl input { flex:1; accent-color:var(--brand); }
  .tooltip { position:fixed; z-index:10; min-width:190px; padding:10px 12px; background:#11262e; color:#fff; border-radius:10px; box-shadow:0 12px 32px rgba(0,0,0,.22); transform:translate(12px,12px); pointer-events:none; display:none; }
  .tooltip strong { display:block; font-size:16px; margin-bottom:4px; }
  .tooltip span { color:#cfe0df; font-size:13px; }
  .side { padding:22px; overflow:auto; max-height:calc(100vh - 48px); }
  .side h2 { margin:0 0 6px; font-size:24px; }
  .caption,.notes { color:var(--muted); font-size:13px; line-height:1.7; }
  .search { width:100%; height:40px; padding:0 12px; margin:14px 0; }
  .sortBar { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
  .sortBar button { height:32px; padding:0 8px; font-size:13px; }
  .settingsBar { display:grid; grid-template-columns:auto 1fr auto; gap:10px; align-items:center; margin-bottom:14px; padding:9px 11px; border:1px solid var(--line); border-radius:10px; background:#f7fbfa; font-size:13px; font-weight:800; }
  .settingsBar input { width:100%; accent-color:var(--brand); }
  .settingsBar span { min-width:42px; text-align:right; color:var(--muted); font-weight:700; }
  .selected { min-height:104px; border:1px solid var(--line); background:#f7fbfa; border-radius:10px; padding:14px; margin-bottom:16px; }
  .selected .name { font-size:20px; font-weight:900; }
  .selected .price { color:#173864; font-size:28px; font-weight:900; margin-top:6px; }
  .selected .meta { color:var(--muted); margin-top:4px; }
  .rows { display:grid; gap:6px; }
  .row { display:grid; grid-template-columns:1fr auto auto; gap:10px; align-items:center; padding:9px 10px; border-radius:8px; cursor:pointer; }
  .row:hover,.row.active { background:#edf6f4; }
  .row b { font-size:14px; }
  .row .price { color:#173864; font-weight:800; }
  .up { color:#087b60; } .down { color:#bd4c45; }
  .notes { margin-top:18px; border-top:1px solid var(--line); padding-top:14px; font-size:12px; }
  @media (max-width:1100px){ .app{grid-template-columns:1fr}.mapShell{min-height:72vh}svg{height:72vh}.side{max-height:none} }
  @media (max-width:760px){ .app{padding:6px;gap:8px;max-width:100vw;overflow:hidden}.mapShell{min-height:82svh;border-radius:10px}header{left:8px;top:8px;max-width:calc(100% - 146px);padding:7px 9px;border:1px solid rgba(219,230,227,.9);border-radius:10px;background:rgba(255,255,255,.72);backdrop-filter:blur(8px)}h1{font-size:17px;line-height:1.1}header p{display:none}.presetBar{left:8px;right:8px;top:51px;max-width:none;overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px}.presetBar button{height:30px;white-space:nowrap;font-size:12px;padding:0 9px}.toolbar{left:auto;right:8px;top:8px;width:121px;display:grid;grid-template-columns:repeat(2,58px);gap:5px}.toolbar button,.toolbar .mapNav{width:58px;height:32px;padding:7px 0;font-size:12px;text-align:center;justify-content:center}.toolbar #toggleTiles{width:121px;grid-column:1/3}.overlayControl{left:8px;right:8px;top:auto;bottom:80px;width:auto;padding:6px 8px;font-size:11px}svg{height:82svh}.cityLabel{font-size:calc(17px * var(--label-scale));stroke-width:4.8px}.detailLabel{font-size:calc(11px * var(--label-scale));stroke-width:2.9px}.legend{left:8px;right:8px;bottom:8px;padding:8px;border-radius:10px}.swatch{width:auto;flex:1;min-width:0;height:12px}.legendLabels{grid-template-columns:repeat(${colors.length},1fr);gap:4px;font-size:8.4px}.side{padding:14px;border-radius:10px}.sortBar{grid-template-columns:repeat(2,1fr)} }
</style>
</head>
<body>
<main class="app">
  <section class="mapShell">
    <header><h1>${esc(config.title)}</h1><p>${esc(config.subtitle)}</p><p>${esc(config.updateLine)}</p></header>
    ${config.showPresetButtons === false ? "" : `<div class="presetBar">${(config.viewPresets || []).map(preset => `<button class="presetButton" data-preset="${esc(preset.id)}">${esc(preset.label)}</button>`).join("")}</div>`}
    <div class="toolbar">${(config.navLinks || []).map(link => `<a class="mapNav${link.active ? " active" : ""}" href="${esc(link.href)}" data-short="${esc(link.shortLabel || link.label)}">${esc(link.label)}</a>`).join("")}<button id="zoomIn">+</button><button id="zoomOut">-</button><button id="reset">重置</button><button id="toggleLabels">文字</button><button id="toggleTiles">底图</button></div>
    <div class="overlayControl"><label for="overlayOpacity">房价图层</label><input id="overlayOpacity" type="range" min="0" max="100" value="${config.overlayOpacity ?? 60}"><span id="overlayOpacityValue">${config.overlayOpacity ?? 60}%</span></div>
    <svg id="map" viewBox="${mapViewBox.x.toFixed(2)} ${mapViewBox.y.toFixed(2)} ${mapViewBox.w.toFixed(2)} ${mapViewBox.h.toFixed(2)}" preserveAspectRatio="xMidYMid meet">
      <g id="viewport">
        <g id="tileLayerA" class="tileBuffer active"></g><g id="tileLayerB" class="tileBuffer"></g>
        <g id="priceOverlay"><g id="regionSeals">${regions.map(r => `<path class="regionSeal" d="${r.d}" fill="${r.fill}" stroke="${r.fill}"></path>`).join("")}</g><g id="regionLayer">${regions.map(r => `<path id="${r.id}" class="region" data-city="${esc(r.city)}" data-name="${esc(r.name)}" d="${r.d}" fill="${r.fill}"></path>`).join("")}</g><g id="detailLayer"></g></g>
        <g id="cityBoundaries">${cityBoundaries.map(r => `<path id="${r.id}" class="cityBoundary" d="${r.d}"></path>`).join("")}</g>
        <g id="detailBoundaries"></g>
        <g id="highlightLayer"><path id="selectedPulse" class="highlightPath"></path><path id="selectedHighlight" class="highlightPath"></path><path id="hoverHighlight" class="highlightPath"></path></g>
        <g id="cityLabels">${cityLabels.map(item => `<text class="cityLabel" x="${item.x}" y="${item.y}" text-anchor="middle">${esc(item.label)}</text>`).join("")}</g>
        <g id="detailLabels">${regions.filter(r => r.price).map(r => `<text class="detailLabel" x="${r.cx}" y="${r.cy}" data-min-scale="${r.labelMinScale}" text-anchor="middle">${esc(r.label)} ${fmtWanLabel(r.price)}</text>`).join("")}</g><g id="dynamicLabels"></g>
      </g>
    </svg>
    <div class="legend"><div class="legendTitle">住宅均价（万/㎡）</div><div class="swatches">${colors.map(c => `<span class="swatch" style="background:${c}"></span>`).join("")}</div><div class="legendLabels">${colors.map((_, i) => `<span>${legendLabel(i, breaks, colors)}</span>`).join("")}</div></div>
    <div class="tileAttribution">地图 © 高德地图</div>
  </section>
  <aside class="side">
    <h2>${esc(config.sideTitle || "区域数据")}</h2>
    <p class="caption">${esc(config.caption || "")}</p>
    <input id="search" class="search" placeholder="搜索城市或区县">
    <div class="sortBar"><button data-sort="priceDesc" class="active">价格高</button><button data-sort="priceAsc">价格低</button><button data-sort="momDesc">涨幅高</button><button data-sort="momAsc">跌幅高</button><button data-sort="city">按城市</button><button data-sort="name">按名称</button></div>
    <div class="settingsBar"><label for="labelScale">地图文字</label><input id="labelScale" type="range" min="85" max="165" value="108"><span id="labelScaleValue">108%</span></div>
    <div id="selected" class="selected"><div class="name">点击或悬停地图区域</div><div class="meta">可查看房价、环比和数据口径。</div></div>
    <div id="rows" class="rows"></div>
    <div class="notes">${config.notesHtml || ""}</div>
  </aside>
</main>
<div id="tooltip" class="tooltip"></div>
<script>
const regions=${JSON.stringify(regions)};
const viewPresets=${JSON.stringify(config.viewPresets || [])};
const detailSources=${JSON.stringify(config.detailSources || [])};
let places=[...regions];
let placeById=new Map(places.map(place=>[place.id,place]));
const svg=document.getElementById('map'),viewport=document.getElementById('viewport'),mapShell=document.querySelector('.mapShell');
const tileBuffers=[document.getElementById('tileLayerA'),document.getElementById('tileLayerB')];
const detailLayer=document.getElementById('detailLayer'),detailBoundaries=document.getElementById('detailBoundaries'),dynamicLabels=document.getElementById('dynamicLabels');
const overlayOpacityInput=document.getElementById('overlayOpacity'),overlayOpacityValue=document.getElementById('overlayOpacityValue');
const labelScaleInput=document.getElementById('labelScale'),labelScaleValue=document.getElementById('labelScaleValue');
const hoverHighlight=document.getElementById('hoverHighlight'),selectedHighlight=document.getElementById('selectedHighlight'),selectedPulse=document.getElementById('selectedPulse');
const tooltip=document.getElementById('tooltip'),selected=document.getElementById('selected'),rows=document.getElementById('rows'),search=document.getElementById('search'),cityLabels=document.getElementById('cityLabels');
let regionEls=Array.from(document.querySelectorAll('.region'));
let labelEls=Array.from(document.querySelectorAll('.detailLabel,.cityLabel')).map(el=>({el,x:Number(el.getAttribute('x')),y:Number(el.getAttribute('y'))}));
let detailLabelEls=Array.from(document.querySelectorAll('.detailLabel')).map(el=>({el,minScale:Number(el.dataset.minScale||2.2)}));
const sortButtons=Array.from(document.querySelectorAll('.sortBar button')),collator=new Intl.Collator('zh-Hans-CN');
let state={scale:1,x:0,y:0},dragging=false,last=null,activePointers=new Map(),pinch=null,tapCandidate=null,activeId=null,labelsVisible=true,sortMode='priceDesc',tilesVisible=false,overlayOpacity=Number(overlayOpacityInput.value)/100,labelScale=Number(labelScaleInput.value)/100,lastTileKey='',pendingTileKey='',tileLoadToken=0,activeTileBuffer=0,rowEls=[],renderFrame=0,renderForceLabels=false,renderImmediateTiles=false,renderDeferHeavy=false,lastRenderedScale=0,tileUpdateTimer=0,labelSettleTimer=0,viewportSettleTimer=0,tooltipPlaceId='',detailDatasetEls=[];
const loadedDetailSources=new Set(),loadingDetailSources=new Set();
const minScale=.7,maxScale=${Number(config.maxScale || 60)},maxDetailLoadsPerPass=${Number(config.maxDetailLoadsPerPass || 3)},projection=${JSON.stringify({ minX: projection.minX, minY: projection.minY, maxX: projection.maxX, maxY: projection.maxY, scale: projection.scale, ox: projection.ox, oy: projection.oy })},mapBounds=${JSON.stringify(projection.projectedMapBounds)};
function fmt(value){return Number(value).toLocaleString('zh-CN')} function fmtWan(value){return Number((Number(value)/10000).toFixed(1)).toLocaleString('zh-CN',{maximumFractionDigits:1})+'万'}
function applyOverlayOpacity(){document.documentElement.style.setProperty('--overlay-opacity',overlayOpacity.toFixed(2));overlayOpacityValue.textContent=Math.round(overlayOpacity*100)+'%'} function applyLabelScale(){document.documentElement.style.setProperty('--label-scale',labelScale.toFixed(2));labelScaleValue.textContent=Math.round(labelScale*100)+'%'} function applyCityLabelVisibility(){cityLabels.style.display=labelsVisible&&state.scale<2.55?'':'none'}
function clientToSvg(clientX,clientY){const pt=svg.createSVGPoint();pt.x=clientX;pt.y=clientY;return pt.matrixTransform(svg.getScreenCTM().inverse())} function svgToContent(point){return{x:(point.x-state.x)/state.scale,y:(point.y-state.y)/state.scale}}
function svgVisibleBox(){const rect=svg.getBoundingClientRect();const corners=[clientToSvg(rect.left,rect.top),clientToSvg(rect.right,rect.top),clientToSvg(rect.right,rect.bottom),clientToSvg(rect.left,rect.bottom)];return{minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minY:Math.min(...corners.map(p=>p.y)),maxY:Math.max(...corners.map(p=>p.y))}}
function svgCenterPoint(){const rect=svg.getBoundingClientRect();return clientToSvg(rect.left+rect.width/2,rect.top+rect.height/2)}
function clampValue(value,min,max){return Math.max(min,Math.min(max,value))} function clampPan(){const view=svgVisibleBox(),viewW=view.maxX-view.minX,viewH=view.maxY-view.minY,padX=Math.min(90,viewW*.16),padY=Math.min(90,viewH*.16),mapW=(mapBounds.maxX-mapBounds.minX)*state.scale,mapH=(mapBounds.maxY-mapBounds.minY)*state.scale,centerX=(view.minX+view.maxX-(mapBounds.minX+mapBounds.maxX)*state.scale)/2,centerY=(view.minY+view.maxY-(mapBounds.minY+mapBounds.maxY)*state.scale)/2;state.x=mapW<=viewW-padX*2?centerX:clampValue(state.x,view.maxX-padX-mapBounds.maxX*state.scale,view.minX+padX-mapBounds.minX*state.scale);state.y=mapH<=viewH-padY*2?centerY:clampValue(state.y,view.maxY-padY-mapBounds.maxY*state.scale,view.minY+padY-mapBounds.minY*state.scale)}
function mercatorToLat(y){return (Math.atan(Math.exp(y*Math.PI/180))*2-Math.PI/2)*180/Math.PI} function svgToLonLat(x,y){const lon=(x-projection.ox)/projection.scale+projection.minX,mercY=projection.minY+(projection.oy-y)/projection.scale;return[lon,mercatorToLat(mercY)]} function projectLonLat(lon,lat){const rad=lat*Math.PI/180,mercY=Math.log(Math.tan(Math.PI/4+rad/2))*180/Math.PI;return{x:projection.ox+(lon-projection.minX)*projection.scale,y:projection.oy-(mercY-projection.minY)*projection.scale}} function lonToTileX(lon,z){return Math.floor((lon+180)/360*Math.pow(2,z))} function latToTileY(lat,z){const rad=lat*Math.PI/180;return Math.floor((1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*Math.pow(2,z))} function tileXToLon(x,z){return x/Math.pow(2,z)*360-180} function tileYToLat(y,z){const n=Math.PI-2*Math.PI*y/Math.pow(2,z);return Math.atan(Math.sinh(n))*180/Math.PI} function tileUrl(x,y,z){const sub=((x+y)%4)+1;return 'https://webrd0'+sub+'.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x='+x+'&y='+y+'&z='+z}
function clearTiles(){tileLoadToken+=1;lastTileKey='';pendingTileKey='';tileBuffers.forEach((b,i)=>{b.innerHTML='';b.classList.toggle('active',i===activeTileBuffer)})} function swapTileBuffer(nextIndex,tileKey,markup){const next=tileBuffers[nextIndex],prev=tileBuffers[activeTileBuffer];next.innerHTML=markup;next.classList.add('active');prev.classList.remove('active');activeTileBuffer=nextIndex;lastTileKey=tileKey;pendingTileKey='';setTimeout(()=>{if(tileBuffers[activeTileBuffer]!==prev)prev.innerHTML=''},180)} function preloadTileUrls(urls,token,onReady){if(!urls.length){onReady();return}let done=false,loaded=0;const finish=()=>{if(done||token!==tileLoadToken)return;loaded+=1;if(loaded>=urls.length){done=true;onReady()}};urls.forEach(url=>{const image=new Image();image.decoding='async';image.onload=finish;image.onerror=finish;image.src=url});setTimeout(()=>{if(done||token!==tileLoadToken)return;done=true;onReady()},1800)}
function visibleContentBounds(){const view=svgVisibleBox();const corners=[{x:view.minX,y:view.minY},{x:view.maxX,y:view.minY},{x:view.maxX,y:view.maxY},{x:view.minX,y:view.maxY}].map(svgToContent);return{minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minY:Math.min(...corners.map(p=>p.y)),maxY:Math.max(...corners.map(p=>p.y))}}
function intersects(a,b){return a.minX<=b.maxX&&a.maxX>=b.minX&&a.minY<=b.maxY&&a.maxY>=b.minY}
function updateTiles(){if(!tilesVisible){if(lastTileKey||pendingTileKey)clearTiles();return}const b=visibleContentBounds(),nw=svgToLonLat(b.minX,b.minY),se=svgToLonLat(b.maxX,b.maxY),west=Math.max(-180,Math.min(nw[0],se[0])),east=Math.min(180,Math.max(nw[0],se[0])),north=Math.max(-85,Math.min(85,Math.max(nw[1],se[1]))),south=Math.max(-85,Math.min(85,Math.min(nw[1],se[1])));let z=Math.max(8,Math.min(18,Math.round(9.5+Math.log2(state.scale)))),x0=lonToTileX(west,z),x1=lonToTileX(east,z),y0=latToTileY(north,z),y1=latToTileY(south,z);while((x1-x0+1)*(y1-y0+1)>72&&z>7){z-=1;x0=lonToTileX(west,z);x1=lonToTileX(east,z);y0=latToTileY(north,z);y1=latToTileY(south,z)}const n=Math.pow(2,z),xStart=Math.max(0,x0-1),xEnd=Math.min(n-1,x1+1),yStart=Math.max(0,y0-1),yEnd=Math.min(n-1,y1+1),tileKey=[z,xStart,xEnd,yStart,yEnd].join(':');if(tileKey===lastTileKey||tileKey===pendingTileKey)return;pendingTileKey=tileKey;const token=++tileLoadToken,tiles=[],urls=[];for(let x=xStart;x<=xEnd;x++){for(let y=yStart;y<=yEnd;y++){const p1=projectLonLat(tileXToLon(x,z),tileYToLat(y,z)),p2=projectLonLat(tileXToLon(x+1,z),tileYToLat(y+1,z)),url=tileUrl(x,y,z);urls.push(url);tiles.push('<image class="tileImage" href="'+url+'" x="'+p1.x+'" y="'+p1.y+'" width="'+(p2.x-p1.x)+'" height="'+(p2.y-p1.y)+'" preserveAspectRatio="none"></image>')}}const markup=tiles.join(''),nextIndex=activeTileBuffer?0:1;preloadTileUrls(urls,token,()=>{if(token!==tileLoadToken||pendingTileKey!==tileKey||!tilesVisible)return;requestAnimationFrame(()=>swapTileBuffer(nextIndex,tileKey,markup))})}
function requestTileUpdate(immediate=false){if(tileUpdateTimer){clearTimeout(tileUpdateTimer);tileUpdateTimer=0}if(!tilesVisible||immediate){updateTiles();return}tileUpdateTimer=setTimeout(()=>{tileUpdateTimer=0;updateTiles()},90)}
function applyTransform(options={}){clampPan();viewport.setAttribute('transform','translate('+state.x+' '+state.y+') scale('+state.scale+')');if(options.deferHeavy)return;const scaleChanged=!!options.forceLabels||!lastRenderedScale||Math.abs(Math.log(state.scale/lastRenderedScale))>.045;if(scaleChanged){const inverse=1/state.scale;labelEls.forEach(label=>label.el.setAttribute('transform','translate('+label.x+' '+label.y+') scale('+inverse+') translate('+-label.x+' '+-label.y+')'));detailLabelEls.forEach(label=>label.el.style.display=state.scale>=label.minScale?'block':'none');applyCityLabelVisibility();lastRenderedScale=state.scale}updateDetailVisibility();if(!options.skipLoadDetails)maybeLoadDetails();if(tilesVisible||lastTileKey)requestTileUpdate(!!options.immediateTiles)}
function scheduleTransform(options={}){renderForceLabels=renderForceLabels||!!options.forceLabels;renderImmediateTiles=renderImmediateTiles||!!options.immediateTiles;renderDeferHeavy=renderDeferHeavy||!!options.deferHeavy;if(renderFrame)return;renderFrame=requestAnimationFrame(()=>{renderFrame=0;const forceLabels=renderForceLabels,immediateTiles=renderImmediateTiles,deferHeavy=renderDeferHeavy&&!renderForceLabels&&!renderImmediateTiles;renderForceLabels=false;renderImmediateTiles=false;renderDeferHeavy=false;applyTransform({forceLabels,immediateTiles,deferHeavy})})}
function queueLabelSettle(){if(labelSettleTimer)clearTimeout(labelSettleTimer);labelSettleTimer=setTimeout(()=>{labelSettleTimer=0;scheduleTransform({forceLabels:true})},120)}
function setMoving(active){mapShell.classList.toggle('isMoving',!!active)}
function finishViewportMove(){if(viewportSettleTimer){clearTimeout(viewportSettleTimer);viewportSettleTimer=0}setMoving(false);scheduleTransform({forceLabels:true,immediateTiles:true})}
function queueViewportSettle(delay=140){setMoving(true);if(viewportSettleTimer)clearTimeout(viewportSettleTimer);viewportSettleTimer=setTimeout(()=>{viewportSettleTimer=0;finishViewportMove()},delay)}
function zoom(factor,clientX,clientY){const rect=svg.getBoundingClientRect(),anchor=clientToSvg(clientX??(rect.left+rect.width/2),clientY??(rect.top+rect.height/2)),content=svgToContent(anchor),nextScale=Math.max(minScale,Math.min(maxScale,state.scale*factor));state.x=anchor.x-content.x*nextScale;state.y=anchor.y-content.y*nextScale;state.scale=nextScale;scheduleTransform({deferHeavy:true});queueLabelSettle();queueViewportSettle()}
function setHighlightPath(el,r){if(r&&r.d)el.setAttribute('d',r.d);else el.removeAttribute('d')} function setHoverHighlight(r){if(!r||r.id===activeId){setHighlightPath(hoverHighlight,null);return}setHighlightPath(hoverHighlight,r)} function setSelectedHighlight(r){setHighlightPath(selectedHighlight,r);setHighlightPath(selectedPulse,r)}
function bindRegionElement(el){const r=placeById.get(el.id);if(!r)return;el.addEventListener('mousemove',event=>{setHoverHighlight(r);showTip(event,r)});el.addEventListener('mouseleave',()=>{setHoverHighlight(null);hideTip()})}
function registerDetailLabels(container){Array.from(container.querySelectorAll('.detailLabel')).forEach(el=>{labelEls.push({el,x:Number(el.getAttribute('x')),y:Number(el.getAttribute('y'))});detailLabelEls.push({el,minScale:Number(el.dataset.minScale||2.2)})})}
function setDatasetBounds(el,source){el.dataset.minScale=String(source.minScale||3);if(source.bounds){el.dataset.minX=source.bounds.minX;el.dataset.minY=source.bounds.minY;el.dataset.maxX=source.bounds.maxX;el.dataset.maxY=source.bounds.maxY}}
function addDetailDataset(source,payload){if(document.getElementById('detail-'+source.id))return;const group=document.createElementNS('http://www.w3.org/2000/svg','g');group.id='detail-'+source.id;group.classList.add('detailDataset');setDatasetBounds(group,source);group.innerHTML='<g>'+payload.regions.map(r=>'<path id="'+r.id+'" class="region detailRegion" data-city="'+r.city+'" data-name="'+r.name+'" d="'+r.d+'" fill="'+r.fill+'"></path>').join('')+'</g>';detailLayer.appendChild(group);const boundary=document.createElementNS('http://www.w3.org/2000/svg','g');boundary.id='detail-boundary-'+source.id;boundary.classList.add('detailDataset');setDatasetBounds(boundary,source);boundary.innerHTML=payload.outlines.map(r=>'<path class="cityBoundary" d="'+r.d+'"></path>').join('');detailBoundaries.appendChild(boundary);const labels=document.createElementNS('http://www.w3.org/2000/svg','g');labels.id='detail-label-'+source.id;labels.classList.add('detailDataset');setDatasetBounds(labels,source);labels.innerHTML=payload.regions.filter(r=>r.price).map(r=>'<text class="detailLabel" x="'+r.cx+'" y="'+r.cy+'" data-min-scale="'+Math.max(r.labelMinScale,source.labelScale||3.2)+'" text-anchor="middle">'+r.label+' '+fmtWan(r.price)+'</text>').join('');dynamicLabels.appendChild(labels);detailDatasetEls.push(group,boundary,labels);payload.regions.forEach(r=>{places.push(r);placeById.set(r.id,r)});const newRegionEls=Array.from(group.querySelectorAll('.region'));newRegionEls.forEach(bindRegionElement);regionEls=regionEls.concat(newRegionEls);registerDetailLabels(labels);updateDetailVisibility();renderRows(search.value);applyTransform({forceLabels:true,skipLoadDetails:true})}
async function loadDetailSource(source){if(loadedDetailSources.has(source.id)||loadingDetailSources.has(source.id))return;loadingDetailSources.add(source.id);try{const response=await fetch(source.url);if(!response.ok)throw new Error(response.status);const payload=await response.json();loadedDetailSources.add(source.id);addDetailDataset(source,payload)}catch(error){console.warn('detail layer failed',source.id,error)}finally{loadingDetailSources.delete(source.id)}}
function expandedBounds(bounds,ratio=.35){const w=bounds.maxX-bounds.minX,h=bounds.maxY-bounds.minY;return{minX:bounds.minX-w*ratio,minY:bounds.minY-h*ratio,maxX:bounds.maxX+w*ratio,maxY:bounds.maxY+h*ratio}}
function datasetVisible(el,bounds){if(state.scale<Number(el.dataset.minScale||3))return false;if(!el.dataset.minX)return true;const sourceBounds={minX:Number(el.dataset.minX),minY:Number(el.dataset.minY),maxX:Number(el.dataset.maxX),maxY:Number(el.dataset.maxY)};return intersects(expandedBounds(bounds,.25),sourceBounds)}
function updateDetailVisibility(){const bounds=visibleContentBounds();detailDatasetEls.forEach(el=>el.classList.toggle('hidden',!datasetVisible(el,bounds)))}
function sourceDistance(source,bounds){if(!source.bounds)return 0;const cx=(bounds.minX+bounds.maxX)/2,cy=(bounds.minY+bounds.maxY)/2,sx=(source.bounds.minX+source.bounds.maxX)/2,sy=(source.bounds.minY+source.bounds.maxY)/2;return Math.hypot(cx-sx,cy-sy)}
function maybeLoadDetails(){if(!detailSources.length)return;const bounds=visibleContentBounds();detailSources.filter(source=>!loadedDetailSources.has(source.id)&&!loadingDetailSources.has(source.id)&&state.scale>=source.minScale&&(!source.bounds||intersects(expandedBounds(bounds,.12),source.bounds))).sort((a,b)=>sourceDistance(a,bounds)-sourceDistance(b,bounds)).slice(0,maxDetailLoadsPerPass).forEach(loadDetailSource)}
function focusContentPoint(x,y,scale){const center=svgCenterPoint();state.scale=Math.max(minScale,Math.min(maxScale,scale));state.x=center.x-x*state.scale;state.y=center.y-y*state.scale;applyTransform({forceLabels:true,immediateTiles:true})}
function focusLonLat(lon,lat,scale){const p=projectLonLat(lon,lat);focusContentPoint(p.x,p.y,scale)}
function applyPreset(id){const preset=viewPresets.find(item=>item.id===id);if(!preset)return;document.querySelectorAll('.presetButton').forEach(button=>button.classList.toggle('active',button.dataset.preset===id));focusLonLat(preset.center[0],preset.center[1],preset.scale||3.5)}
function pointerDistance(a,b){return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)} function pointerMidpoint(a,b){return{clientX:(a.clientX+b.clientX)/2,clientY:(a.clientY+b.clientY)/2}} function beginPinch(){const points=[...activePointers.values()];if(points.length<2){pinch=null;return}tapCandidate=null;const center=pointerMidpoint(points[0],points[1]),anchor=clientToSvg(center.clientX,center.clientY);pinch={distance:Math.max(1,pointerDistance(points[0],points[1])),scale:state.scale,content:svgToContent(anchor)}}
function endPointer(event){const candidate=tapCandidate&&tapCandidate.pointerId===event.pointerId?tapCandidate:null,isTap=!!(candidate&&candidate.id&&activePointers.size===1&&!candidate.moved&&Math.hypot(event.clientX-candidate.clientX,event.clientY-candidate.clientY)<=7);if(activePointers.has(event.pointerId)){activePointers.delete(event.pointerId);try{svg.releasePointerCapture(event.pointerId)}catch(_){}}if(activePointers.size===1){const [remaining]=activePointers.values();last=clientToSvg(remaining.clientX,remaining.clientY);dragging=true;pinch=null}else{dragging=false;pinch=null;svg.classList.remove('dragging');finishViewportMove()}if(candidate){tapCandidate=null;if(isTap)selectRegion(candidate.id)}}
function selectRegion(id,center=false){activeId=id;hideTip();regionEls.forEach(el=>el.classList.toggle('active',el.id===id));rowEls.forEach(el=>el.classList.toggle('active',el.dataset.id===id));const r=placeById.get(id);if(!r)return;setSelectedHighlight(r);setHoverHighlight(null);selected.innerHTML='<div class="name">'+r.city+' '+r.name+'</div>'+(r.price?'<div class="price">'+fmt(r.price)+' 元/㎡</div><div class="meta">约 '+fmtWan(r.price)+'/㎡ · 环比 '+r.mom+'</div><div class="meta">'+(r.source||'公开挂牌均价')+'</div>':'<div class="meta">暂无单列房价数据。</div>');if(center){focusContentPoint(r.cx,r.cy,Math.max(state.scale,2.8))}}
function showTip(event,r){tooltip.style.display='block';tooltip.style.left=event.clientX+'px';tooltip.style.top=event.clientY+'px';if(tooltipPlaceId!==r.id){tooltipPlaceId=r.id;tooltip.innerHTML='<strong>'+r.city+' '+r.name+'</strong>'+(r.price?'<span>'+fmt(r.price)+' 元/㎡ · 约 '+fmtWan(r.price)+' · 环比 '+r.mom+'</span>':'<span>暂无单列房价数据</span>')}} function hideTip(){tooltip.style.display='none';tooltipPlaceId=''}
regionEls.forEach(bindRegionElement);
svg.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY<0?1.16:.86,event.clientX,event.clientY)},{passive:false});
svg.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();setMoving(true);hideTip();if(svg.setPointerCapture)svg.setPointerCapture(event.pointerId);const target=event.target.closest?event.target.closest('.region'):null;tapCandidate=target?{id:target.id,pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,moved:false}:null;activePointers.set(event.pointerId,{clientX:event.clientX,clientY:event.clientY});if(activePointers.size>=2){dragging=false;beginPinch()}else{dragging=true;last=clientToSvg(event.clientX,event.clientY)}svg.classList.add('dragging')});
window.addEventListener('pointermove',event=>{if(activePointers.has(event.pointerId))activePointers.set(event.pointerId,{clientX:event.clientX,clientY:event.clientY});if(tapCandidate&&tapCandidate.pointerId===event.pointerId&&Math.hypot(event.clientX-tapCandidate.clientX,event.clientY-tapCandidate.clientY)>7)tapCandidate.moved=true;if(activePointers.size>=2){event.preventDefault();tapCandidate=null;const points=[...activePointers.values()],center=pointerMidpoint(points[0],points[1]),anchor=clientToSvg(center.clientX,center.clientY);if(!pinch)beginPinch();const nextScale=Math.max(minScale,Math.min(maxScale,pinch.scale*pointerDistance(points[0],points[1])/pinch.distance));state.x=anchor.x-pinch.content.x*nextScale;state.y=anchor.y-pinch.content.y*nextScale;state.scale=nextScale;scheduleTransform({deferHeavy:true});queueLabelSettle();queueViewportSettle();return}if(!dragging)return;event.preventDefault();const point=clientToSvg(event.clientX,event.clientY);state.x+=point.x-last.x;state.y+=point.y-last.y;last=point;scheduleTransform({deferHeavy:true});queueViewportSettle()});
window.addEventListener('pointerup',endPointer);window.addEventListener('pointercancel',endPointer);window.addEventListener('resize',()=>scheduleTransform({forceLabels:true,immediateTiles:true}));
document.getElementById('zoomIn').onclick=()=>zoom(1.22);document.getElementById('zoomOut').onclick=()=>zoom(.82);document.getElementById('reset').onclick=()=>{state={scale:1,x:0,y:0};document.querySelectorAll('.presetButton').forEach(button=>button.classList.remove('active'));finishViewportMove()};document.getElementById('toggleLabels').onclick=()=>{labelsVisible=!labelsVisible;applyCityLabelVisibility()};document.getElementById('toggleTiles').onclick=event=>{tilesVisible=!tilesVisible;event.currentTarget.classList.toggle('active',tilesVisible);mapShell.classList.toggle('mapTilesOn',tilesVisible);requestTileUpdate(true)};document.querySelectorAll('.presetButton').forEach(button=>button.addEventListener('click',()=>applyPreset(button.dataset.preset)));overlayOpacityInput.addEventListener('input',()=>{overlayOpacity=Number(overlayOpacityInput.value)/100;applyOverlayOpacity()});labelScaleInput.addEventListener('input',()=>{labelScale=Number(labelScaleInput.value)/100;applyLabelScale()});
function momValue(value){const parsed=Number(String(value||'0').replace('%',''));return Number.isFinite(parsed)?parsed:0} function sortPlaces(list){return list.sort((a,b)=>sortMode==='priceAsc'?a.price-b.price:sortMode==='momDesc'?momValue(b.mom)-momValue(a.mom):sortMode==='momAsc'?momValue(a.mom)-momValue(b.mom):sortMode==='city'?collator.compare(a.city+a.name,b.city+b.name):sortMode==='name'?collator.compare(a.name,b.name):b.price-a.price)}
function renderRows(filter=''){const q=filter.trim().toLowerCase(),main=sortPlaces(places.filter(r=>r.price).filter(r=>!q||(r.city+r.name).toLowerCase().includes(q))),visibleRows=main.slice(0,q?650:360);rows.innerHTML=visibleRows.map(r=>'<div class="row" data-id="'+r.id+'"><b>'+r.city+' '+r.name+'</b><span class="price">'+fmt(r.price)+'</span><span class="'+(String(r.mom).startsWith('+')?'up':String(r.mom).startsWith('-')?'down':'')+'">'+r.mom+'</span></div>').join('');rowEls=Array.from(rows.querySelectorAll('.row'));rowEls.forEach(row=>row.onclick=()=>selectRegion(row.dataset.id,true));regionEls.forEach(el=>{const r=placeById.get(el.id),match=!q||(r.city+r.name).toLowerCase().includes(q);el.classList.toggle('dimmed',!match)})} sortButtons.forEach(button=>button.addEventListener('click',()=>{sortMode=button.dataset.sort;sortButtons.forEach(item=>item.classList.toggle('active',item===button));renderRows(search.value)}));search.addEventListener('input',()=>renderRows(search.value));renderRows();applyOverlayOpacity();applyLabelScale();applyTransform({forceLabels:true,immediateTiles:true});const initialPreset=new URLSearchParams(location.search).get('view');if(initialPreset)setTimeout(()=>applyPreset(initialPreset),80);
</script>
</body>
</html>`;
}

module.exports = {
  createInteractiveMap,
  readGeoFeatures,
  formatBeijingTime,
  buildProjection,
  bestLabelPoint,
  cleanName,
  colorFor,
  pathBounds,
  mergeBounds,
  geomToSimplifiedPath,
};
