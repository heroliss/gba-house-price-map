const fs = require("fs");
const path = require("path");
const outputDir = process.argv[2] ? path.resolve(process.argv[2]) : __dirname;
const OUT_SVG = path.join(outputDir, "gba_house_price_map_2026_04.svg");
const OUT_PNG = path.join(outputDir, "gba_house_price_map_2026_04.png");
const OUT_HTML = path.join(outputDir, "gba_house_price_map_2026_04.html");
const OUT_INTERACTIVE = path.join(outputDir, "index.html");

const cityFiles = [
  ["广州", "datav_440100_full.json"],
  ["深圳", "datav_440300_full.json"],
  ["珠海", "datav_440400_full.json"],
  ["佛山", "datav_440600_full.json"],
  ["江门", "datav_440700_full.json"],
  ["肇庆", "datav_441200_full.json"],
  ["惠州", "datav_441300_full.json"],
  ["东莞", "datav_441900.json"],
  ["中山", "datav_442000.json"],
  ["香港", "datav_810000_full.json"],
  ["澳门", "datav_820000_full.json"],
];

const cityCenters = {
  广州: [113.2644, 23.1291],
  深圳: [114.0579, 22.5431],
  珠海: [113.5767, 22.2707],
  佛山: [113.1214, 23.0215],
  惠州: [114.4168, 23.1115],
  东莞: [113.7518, 23.0207],
  中山: [113.3926, 22.5176],
  江门: [113.0819, 22.5787],
  肇庆: [112.4653, 23.0472],
  香港: [114.1694, 22.3193],
  澳门: [113.5439, 22.1987],
};

const mainlandData = {
  "广州|天河区": [62053, "+4.30%"], "广州|越秀区": [55882, "+4.29%"], "广州|海珠区": [41259, "+4.83%"],
  "广州|荔湾区": [35713, "-1.67%"], "广州|白云区": [32002, "-1.87%"], "广州|黄埔区": [31264, "+9.78%"],
  "广州|番禺区": [29220, "-1.19%"], "广州|南沙区": [18205, "+0.40%"], "广州|花都区": [15870, "-0.95%"],
  "广州|增城区": [13287, "+4.66%"], "广州|从化区": [9776, "+5.59%"],
  "深圳|南山区": [108191, "-0.81%"], "深圳|福田区": [96710, "+10.47%"], "深圳|宝安区": [66369, "+9.71%"],
  "深圳|龙华区": [59458, "-2.43%"], "深圳|罗湖区": [52939, "-1.30%"], "深圳|盐田区": [51840, "-1.38%"],
  "深圳|龙岗区": [41424, "+2.10%"], "深圳|光明区": [36946, "+1.94%"], "深圳|坪山区": [27633, "+10.63%"],
  "珠海|香洲区": [23937, "+2.47%"], "珠海|金湾区": [11704, "-5.40%"], "珠海|斗门区": [8941, "-0.55%"],
  "佛山|南海区": [15812, "+1.75%"], "佛山|禅城区": [14197, "-7.26%"], "佛山|顺德区": [10961, "-2.68%"],
  "佛山|三水区": [7557, "+1.44%"], "佛山|高明区": [7097, "-2.19%"],
  "惠州|惠东县": [11813, "+34.10%"], "惠州|惠城区": [9219, "-7.14%"], "惠州|惠阳区": [8307, "+12.57%"],
  "惠州|博罗县": [5879, "-0.41%"],
  "江门|新会区": [7814, "+3.58%"], "江门|蓬江区": [7275, "-0.78%"], "江门|江海区": [7098, "+4.43%"],
  "江门|鹤山市": [6589, "-4.33%"], "江门|台山市": [5201, "-2.80%"], "江门|开平市": [5092, "-5.07%"],
  "肇庆|端州区": [7745, "-1.72%"], "肇庆|四会市": [5426, "-4.50%"],
  "东莞|东莞市": [19421, "-2.49%"], "中山|中山市": [8479, "-1.77%"],
  "东莞|南城区": [25803, "+12.08%"], "东莞|大朗镇": [25578, "+5.50%"], "东莞|塘厦镇": [25305, "-0.63%"],
  "东莞|东城区": [24491, "-1.00%"], "东莞|寮步镇": [23097, "+0.08%"], "东莞|厚街镇": [22848, "-6.50%"],
  "东莞|大岭山镇": [22578, "-1.57%"], "东莞|长安镇": [22481, "-9.06%"], "东莞|虎门镇": [19514, "+6.64%"],
  "东莞|万江区": [19072, "-3.68%"], "东莞|樟木头镇": [17649, "+4.46%"], "东莞|清溪镇": [16589, "-5.05%"],
  "东莞|石碣镇": [15675, "-0.16%"], "东莞|沙田镇": [15190, "-0.27%"], "东莞|凤岗镇": [14436, "-2.34%"],
  "东莞|常平镇": [13655, "+8.59%"], "东莞|黄江镇": [12772, "+19.99%"], "东莞|横沥镇": [11737, "+2.44%"],
  "东莞|桥头镇": [11472, "+5.71%"],
  "中山|东区": [11643, "+3.58%"], "中山|南朗镇": [11386, "-3.18%"], "中山|西区": [9023, "+0.05%"],
  "中山|石岐区": [8983, "-4.39%"], "中山|坦洲镇": [8687, "+0.35%"], "中山|火炬开发区": [8611, "+2.53%"],
  "中山|南区": [8187, "+4.20%"], "中山|沙溪镇": [8169, "-8.88%"], "中山|三乡镇": [8097, "-2.80%"],
  "中山|东凤镇": [7819, "-1.71%"], "中山|港口镇": [7623, "-4.15%"], "中山|东升镇": [7142, "+1.49%"],
  "中山|横栏镇": [6797, "-2.44%"], "中山|板芙镇": [6063, "+1.03%"], "中山|三角镇": [5747, "-1.66%"],
};

const townPoints = [
  ["东莞", "南城区", 113.735, 23.008], ["东莞", "东城区", 113.784, 23.032], ["东莞", "万江区", 113.704, 23.044],
  ["东莞", "大朗镇", 113.944, 22.944], ["东莞", "塘厦镇", 114.079, 22.812], ["东莞", "寮步镇", 113.884, 23.003],
  ["东莞", "厚街镇", 113.673, 22.940], ["东莞", "大岭山镇", 113.845, 22.906], ["东莞", "长安镇", 113.803, 22.817],
  ["东莞", "虎门镇", 113.672, 22.820], ["东莞", "樟木头镇", 114.066, 22.956], ["东莞", "清溪镇", 114.164, 22.844],
  ["东莞", "石碣镇", 113.803, 23.104], ["东莞", "沙田镇", 113.582, 22.919], ["东莞", "凤岗镇", 114.142, 22.744],
  ["东莞", "常平镇", 114.000, 22.973], ["东莞", "黄江镇", 114.008, 22.921], ["东莞", "横沥镇", 113.970, 23.027],
  ["东莞", "桥头镇", 114.068, 23.020],
  ["中山", "东区", 113.405, 22.520], ["中山", "南朗镇", 113.535, 22.493], ["中山", "西区", 113.365, 22.526],
  ["中山", "石岐区", 113.382, 22.535], ["中山", "坦洲镇", 113.469, 22.260], ["中山", "火炬开发区", 113.477, 22.560],
  ["中山", "南区", 113.367, 22.486], ["中山", "沙溪镇", 113.332, 22.522], ["中山", "三乡镇", 113.433, 22.353],
  ["中山", "东凤镇", 113.260, 22.690], ["中山", "港口镇", 113.393, 22.590], ["中山", "东升镇", 113.300, 22.625],
  ["中山", "横栏镇", 113.265, 22.535], ["中山", "板芙镇", 113.335, 22.407], ["中山", "三角镇", 113.423, 22.680],
].map(([city, name, lon, lat], index) => {
  const data = mainlandData[`${city}|${name}`];
  return { id: `p${index}`, city, name, lon, lat, price: data?.[0] || null, mom: data?.[1] || "" };
});

const cityStats = [
  ["深圳", 70736, "+3.55%"], ["广州", 38612, "+6.04%"], ["珠海", 20138, "+3.50%"],
  ["东莞", 19421, "-2.49%"], ["佛山", 12828, "+0.71%"], ["中山", 8479, "-1.77%"],
  ["惠州", 8297, "+4.12%"], ["江门", 6984, "+0.94%"], ["肇庆", 6799, "+2.35%"],
];

const hkStats = [
  ["港岛", "159.72", "+3.03%", "1,359宗"],
  ["九龙", "154.74", "+1.80%", "3,710宗"],
  ["新界东", "171.06", "+1.11%", "1,187宗"],
  ["新界西", "140.35", "+0.62%", "1,246宗"],
];

const macauStats = [
  ["住宅楼价指数", "188.9", "按季 -1.5%"],
  ["现货住宅指数", "201.2", "按季 -1.7%"],
  ["住宅楼花指数", "240.3", "按季 +0.6%"],
];

const W = 1800;
const H = 1320;
const mapBox = { x: 64, y: 198, w: 1120, h: 920 };
const values = Object.values(mainlandData).map(([v]) => v);
const breaks = [0, 8000, 12000, 18000, 30000, 50000, 80000, 120000];
const colors = ["#2b6cb0", "#4fa3c8", "#8fd0d0", "#f2e6a7", "#f3a05f", "#d95845", "#9e1f2f"];

function readGeo(city, file) {
  const geo = JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8"));
  for (const f of geo.features) {
    f.properties.city = city;
    if (city === "东莞") f.properties.name = "东莞市";
    if (city === "中山") f.properties.name = "中山市";
  }
  return geo.features;
}

const features = cityFiles.flatMap(([city, file]) => readGeo(city, file));
const mainland = features.filter(f => !["香港", "澳门"].includes(f.properties.city));

function walkCoords(geom, fn) {
  const recur = arr => {
    if (typeof arr[0] === "number") fn(arr);
    else for (const x of arr) recur(x);
  };
  recur(geom.coordinates);
}

function mercator([lon, lat]) {
  const x = lon;
  const rad = lat * Math.PI / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + rad / 2)) * 180 / Math.PI;
  return [x, y];
}

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const f of features) {
  walkCoords(f.geometry, c => {
    const [x, y] = mercator(c);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  });
}
const scale = Math.min(mapBox.w / (maxX - minX), mapBox.h / (maxY - minY)) * 0.92;
const ox = mapBox.x + (mapBox.w - (maxX - minX) * scale) / 2;
const oy = mapBox.y + (mapBox.h + (maxY - minY) * scale) / 2;

function project(c) {
  const [x, y] = mercator(c);
  return [ox + (x - minX) * scale, oy - (y - minY) * scale];
}

function geomToPath(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  let d = "";
  for (const poly of polys) {
    for (const ring of poly) {
      ring.forEach((pt, i) => {
        const [x, y] = project(pt);
        d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
      });
      d += "Z";
    }
  }
  return d;
}

function centroidOfFeature(f) {
  const c = f.properties.centroid || f.properties.center || cityCenters[f.properties.city];
  return project(c);
}

function colorFor(v, city) {
  if (city === "香港") return "#e8e4fb";
  if (city === "澳门") return "#f4e0d6";
  if (!v) return "#eef2f0";
  for (let i = 0; i < breaks.length - 1; i++) {
    if (v >= breaks[i] && v < breaks[i + 1]) return colors[i];
  }
  return colors[colors.length - 1];
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}

function fmt(v) {
  return Number(v).toLocaleString("zh-CN");
}

const topDistricts = Object.entries(mainlandData)
  .map(([k, [price, mom]]) => {
    const [city, name] = k.split("|");
    return { city, name, price, mom };
  })
  .sort((a, b) => b.price - a.price)
  .slice(0, 12);

const sourceNotes = [
  "内地9市：禧泰数据/中国房价行情，住宅挂牌均价，2026年4月。",
  "香港：中原地产 Centadata，分区领先指数与4月成交，2026/05/08更新。",
  "澳门：澳门统计暨普查局，2026年第一季住宅楼价指数，2026/05/08发布。",
  "底图：阿里云 DataV.GeoAtlas 行政区划边界。港澳因口径不同不纳入元/㎡色阶。"
];

let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f7faf8"/><stop offset="0.58" stop-color="#eef6f4"/><stop offset="1" stop-color="#f8f1e9"/>
  </linearGradient>
  <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#244650" flood-opacity="0.14"/>
  </filter>
  <style>
    text { font-family: "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", Arial, sans-serif; fill: #21313a; }
    .small { font-size: 20px; fill: #5c6b70; }
    .tiny { font-size: 17px; fill: #66777c; }
    .label { font-size: 18px; font-weight: 700; paint-order: stroke; stroke: rgba(255,255,255,.82); stroke-width: 5px; stroke-linejoin: round; }
    .price { font-size: 15px; font-weight: 700; fill: #30444b; paint-order: stroke; stroke: rgba(255,255,255,.88); stroke-width: 4px; }
    .panelTitle { font-size: 26px; font-weight: 800; fill: #1c2f36; }
    .num { font-size: 26px; font-weight: 800; fill: #173864; }
  </style>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<path d="M0 1040 C330 980 520 1110 860 1040 S1390 910 1800 1020 L1800 1320 L0 1320Z" fill="#e8f1ec" opacity=".78"/>
<text x="64" y="82" font-size="44" font-weight="900">粤港澳大湾区房价地图</text>
<text x="64" y="122" class="small">9+2 城市，区县/镇街可得数据；主体色阶为内地住宅挂牌均价，单位：元/㎡</text>
<text x="64" y="154" class="tiny">数据更新：内地 2026年4月；香港/澳门 2026年5月公开最新。生成日期：2026-05-15</text>
<g filter="url(#softShadow)"><rect x="38" y="178" width="1180" height="990" rx="20" fill="#ffffff" opacity=".84"/></g>
<rect x="38" y="178" width="1180" height="990" rx="20" fill="#ffffff" opacity=".7" stroke="#dbe6e3"/>
`;

for (const f of features) {
  const key = `${f.properties.city}|${f.properties.name}`;
  const data = mainlandData[key];
  svg += `<path d="${geomToPath(f.geometry)}" fill="${colorFor(data && data[0], f.properties.city)}" stroke="#ffffff" stroke-width="1.15" opacity="${data || ["香港","澳门"].includes(f.properties.city) ? 0.96 : 0.64}"/>`;
}

for (const [city, center] of Object.entries(cityCenters)) {
  const [x, y] = project(center);
  svg += `<text x="${x}" y="${y}" class="label" text-anchor="middle">${esc(city)}</text>`;
}

for (const f of mainland) {
  const key = `${f.properties.city}|${f.properties.name}`;
  const data = mainlandData[key];
  if (!data) continue;
  const [x, y] = centroidOfFeature(f);
  if (data[0] < 9000 && !["东莞市", "中山市"].includes(f.properties.name)) continue;
  svg += `<text x="${x}" y="${y + 18}" class="price" text-anchor="middle">${esc(f.properties.name.replace(/[区县市镇]/g, ""))} ${Math.round(data[0] / 1000)}k</text>`;
}

const lx = 80, ly = 1062;
svg += `<g>
<text x="${lx}" y="${ly - 24}" font-size="22" font-weight="800">色阶：内地住宅挂牌均价</text>`;
for (let i = 0; i < colors.length; i++) {
  const x = lx + i * 92;
  svg += `<rect x="${x}" y="${ly}" width="82" height="22" rx="4" fill="${colors[i]}"/><text x="${x}" y="${ly + 46}" class="tiny">${i === 0 ? "<8k" : i === colors.length - 1 ? "80k+" : `${breaks[i]/1000}-${breaks[i+1]/1000}k`}</text>`;
}
svg += `</g>`;

svg += `<g transform="translate(1246 178)" filter="url(#softShadow)"><rect width="508" height="990" rx="20" fill="#ffffff"/></g>
<g transform="translate(1246 178)">
<rect width="508" height="990" rx="20" fill="#ffffff" stroke="#dbe6e3"/>
<text x="34" y="58" class="panelTitle">城市均价排行</text>
<text x="34" y="88" class="tiny">内地9市，住宅挂牌均价</text>`;
cityStats.forEach(([city, price, mom], i) => {
  const y = 128 + i * 52;
  const w = 260 * price / 70736;
  svg += `<text x="34" y="${y}" font-size="21" font-weight="800">${city}</text>
  <rect x="116" y="${y - 18}" width="${w.toFixed(1)}" height="18" rx="5" fill="#2f89a6" opacity="${0.95 - i * 0.045}"/>
  <text x="398" y="${y}" font-size="20" font-weight="800" text-anchor="end">${fmt(price)}</text>
  <text x="468" y="${y}" font-size="17" fill="${mom.startsWith("+") ? "#1d8567" : "#b44b42"}" text-anchor="end">${mom}</text>`;
});

svg += `<line x1="34" y1="616" x2="474" y2="616" stroke="#e4ece9"/>
<text x="34" y="660" class="panelTitle">香港最新分区指数</text>
<text x="34" y="690" class="tiny">中原城市分区领先指数；括号为4月成交</text>`;
hkStats.forEach(([region, idx, mom, deals], i) => {
  const y = 728 + i * 44;
  svg += `<text x="34" y="${y}" font-size="20" font-weight="800">${region}</text>
  <text x="162" y="${y}" class="num">${idx}</text>
  <text x="280" y="${y}" font-size="18" fill="#1d8567">${mom}</text>
  <text x="470" y="${y}" class="tiny" text-anchor="end">${deals}</text>`;
});

svg += `<line x1="34" y1="918" x2="474" y2="918" stroke="#e4ece9"/>
<text x="34" y="958" class="panelTitle">澳门最新指数</text>`;
macauStats.forEach(([label, val, change], i) => {
  const y = 998 + i * 42;
  svg += `<text x="34" y="${y}" font-size="19" font-weight="800">${label}</text><text x="260" y="${y}" class="num">${val}</text><text x="470" y="${y}" class="tiny" text-anchor="end">${change}</text>`;
});
svg += `</g>`;

svg += `<g transform="translate(64 1194)">
<text x="0" y="0" font-size="22" font-weight="900">区县高价 Top 12</text>`;
topDistricts.forEach((d, i) => {
  const x = (i % 6) * 186;
  const y = 38 + Math.floor(i / 6) * 42;
  svg += `<text x="${x}" y="${y}" font-size="18" font-weight="800">${i + 1}. ${d.city}${d.name.replace(d.city, "")}</text><text x="${x}" y="${y + 21}" class="tiny">${fmt(d.price)} 元/㎡ ${d.mom}</text>`;
});
svg += `</g>`;

svg += `<g transform="translate(1246 1194)">
<text x="0" y="0" font-size="22" font-weight="900">说明</text>`;
sourceNotes.forEach((s, i) => {
  svg += `<text x="0" y="${34 + i * 28}" class="tiny">${esc(s)}</text>`;
});
svg += `</g></svg>`;

fs.writeFileSync(OUT_SVG, svg, "utf8");
fs.writeFileSync(OUT_HTML, `<!doctype html><meta charset="utf-8"><title>GBA House Price Map</title><style>body{margin:0;background:#f7faf8}svg{display:block;width:${W}px;height:${H}px}</style>${svg}`, "utf8");
const interactiveRegions = features.map((f, index) => {
  const key = `${f.properties.city}|${f.properties.name}`;
  const price = mainlandData[key]?.[0] || null;
  const mom = mainlandData[key]?.[1] || "";
  const [cx, cy] = centroidOfFeature(f);
  return {
    id: `r${index}`,
    city: f.properties.city,
    name: f.properties.name,
    price,
    mom,
    d: geomToPath(f.geometry),
    cx: Number(cx.toFixed(2)),
    cy: Number(cy.toFixed(2)),
    fill: colorFor(price, f.properties.city),
  };
});
const interactivePoints = townPoints.map(p => {
  const [x, y] = project([p.lon, p.lat]);
  return { ...p, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), fill: colorFor(p.price, p.city) };
});

const interactiveHtml = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>粤港澳大湾区房价交互地图</title>
<style>
  :root {
    --ink: #1b2c33;
    --muted: #63767d;
    --line: #dbe6e3;
    --brand: #2f89a6;
    --bg: #f5faf8;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif;
    color: var(--ink);
    background: linear-gradient(135deg, #f7faf8, #f4f0e8);
  }
  .app {
    min-height: 100vh;
    display: grid;
    grid-template-columns: minmax(720px, 1fr) 430px;
    gap: 18px;
    padding: 24px;
  }
  .mapShell, .side {
    background: rgba(255,255,255,.86);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 18px 38px rgba(37, 70, 80, .10);
  }
  .mapShell { position: relative; overflow: hidden; min-height: calc(100vh - 48px); }
  header { position: absolute; z-index: 3; left: 26px; top: 22px; pointer-events: none; }
  h1 { margin: 0; font-size: 34px; letter-spacing: 0; }
  header p { margin: 8px 0 0; color: var(--muted); font-size: 14px; }
  .toolbar {
    position: absolute;
    right: 18px;
    top: 18px;
    z-index: 4;
    display: flex;
    gap: 8px;
  }
  button, input {
    border: 1px solid var(--line);
    background: #fff;
    color: var(--ink);
    border-radius: 8px;
    font: inherit;
  }
  button { height: 36px; padding: 0 12px; cursor: pointer; }
  button:hover { border-color: #9fcac6; }
  svg { width: 100%; height: calc(100vh - 48px); display: block; cursor: grab; }
  svg.dragging { cursor: grabbing; }
  .region { stroke: #fff; stroke-width: 1.2; transition: opacity .15s, stroke-width .15s, filter .15s; }
  .region:hover, .region.active { stroke: #102a33; stroke-width: 2.8; filter: drop-shadow(0 5px 8px rgba(25,55,65,.25)); }
  .townPoint { stroke: #fff; stroke-width: 2; cursor: pointer; filter: drop-shadow(0 3px 5px rgba(25,55,65,.25)); }
  .townPoint:hover, .townPoint.active { stroke: #102a33; stroke-width: 3; }
  .dimmed { opacity: .18; }
  .cityLabel { font-size: 18px; font-weight: 800; paint-order: stroke; stroke: rgba(255,255,255,.86); stroke-width: 5px; pointer-events: none; }
  .detailLabel { display: none; font-size: 13px; font-weight: 800; paint-order: stroke; stroke: rgba(255,255,255,.9); stroke-width: 4px; pointer-events: none; }
  .showDetails .detailLabel { display: block; }
  .legend {
    position: absolute;
    left: 26px;
    bottom: 22px;
    z-index: 4;
    background: rgba(255,255,255,.82);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px 14px;
  }
  .legendTitle { font-weight: 800; margin-bottom: 8px; }
  .swatches { display: flex; gap: 8px; align-items: center; }
  .swatch { width: 46px; height: 16px; border-radius: 4px; }
  .legendLabels { display: flex; gap: 21px; margin-top: 6px; color: var(--muted); font-size: 12px; }
  .tooltip {
    position: fixed;
    z-index: 10;
    min-width: 190px;
    padding: 10px 12px;
    background: #11262e;
    color: #fff;
    border-radius: 10px;
    box-shadow: 0 12px 32px rgba(0,0,0,.22);
    transform: translate(12px, 12px);
    pointer-events: none;
    display: none;
  }
  .tooltip strong { display: block; font-size: 16px; margin-bottom: 4px; }
  .tooltip span { color: #cfe0df; font-size: 13px; }
  .side { padding: 22px; overflow: auto; max-height: calc(100vh - 48px); }
  .side h2 { margin: 0 0 6px; font-size: 24px; }
  .side .caption { color: var(--muted); margin: 0 0 16px; font-size: 13px; }
  .search { width: 100%; height: 40px; padding: 0 12px; margin-bottom: 14px; }
  .selected {
    min-height: 104px;
    border: 1px solid var(--line);
    background: #f7fbfa;
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 16px;
  }
  .selected .name { font-size: 20px; font-weight: 900; }
  .selected .price { color: #173864; font-size: 28px; font-weight: 900; margin-top: 6px; }
  .selected .meta { color: var(--muted); margin-top: 4px; }
  .rows { display: grid; gap: 6px; }
  .row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
    align-items: center;
    padding: 9px 10px;
    border-radius: 8px;
    cursor: pointer;
  }
  .row:hover, .row.active { background: #edf6f4; }
  .row b { font-size: 14px; }
  .row .price { color: #173864; font-weight: 800; }
  .up { color: #087b60; }
  .down { color: #bd4c45; }
  .notes { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 14px; color: var(--muted); font-size: 12px; line-height: 1.7; }
  @media (max-width: 1100px) {
    .app { grid-template-columns: 1fr; }
    .mapShell { min-height: 72vh; }
    svg { height: 72vh; }
    .side { max-height: none; }
  }
</style>
</head>
<body>
<main class="app">
  <section class="mapShell">
    <header>
      <h1>粤港澳大湾区房价地图</h1>
      <p>拖拽移动，滚轮缩放；悬停或点击区县查看详细数据</p>
    </header>
    <div class="toolbar">
      <button id="zoomIn">放大</button>
      <button id="zoomOut">缩小</button>
      <button id="reset">重置</button>
      <button id="toggleLabels">城市名</button>
    </div>
    <svg id="map" viewBox="0 0 ${W} ${H}" aria-label="粤港澳大湾区房价地图">
      <g id="viewport">
        ${interactiveRegions.map(r => `<path id="${r.id}" class="region" data-city="${esc(r.city)}" data-name="${esc(r.name)}" data-price="${r.price ?? ""}" data-mom="${esc(r.mom)}" d="${r.d}" fill="${r.fill}"></path>`).join("\n")}
        <g id="cityLabels">
          ${Object.entries(cityCenters).map(([city, center]) => {
            const [x, y] = project(center);
            return `<text class="cityLabel" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${esc(city)}</text>`;
          }).join("\n")}
        </g>
        <g id="detailLabels">
          ${interactiveRegions.filter(r => r.price).map(r => `<text class="detailLabel" x="${r.cx}" y="${r.cy + 16}" text-anchor="middle">${esc(r.name.replace(/[区县市镇]/g, ""))} ${Math.round(r.price / 1000)}k</text>`).join("\n")}
          ${interactivePoints.filter(p => p.price).map(p => `<text class="detailLabel" x="${p.x}" y="${p.y - 12}" text-anchor="middle">${esc(p.name.replace(/[区县市镇]/g, ""))} ${Math.round(p.price / 1000)}k</text>`).join("\n")}
        </g>
        <g id="townPoints">
          ${interactivePoints.map(p => `<circle id="${p.id}" class="townPoint" data-city="${esc(p.city)}" data-name="${esc(p.name)}" data-price="${p.price ?? ""}" data-mom="${esc(p.mom)}" cx="${p.x}" cy="${p.y}" r="6" fill="${p.fill}"></circle>`).join("\n")}
        </g>
      </g>
    </svg>
    <div class="legend">
      <div class="legendTitle">内地住宅挂牌均价</div>
      <div class="swatches">${colors.map(c => `<span class="swatch" style="background:${c}"></span>`).join("")}</div>
      <div class="legendLabels"><span>&lt;8k</span><span>8-12k</span><span>12-18k</span><span>18-30k</span><span>30-50k</span><span>50-80k</span><span>80k+</span></div>
    </div>
  </section>
  <aside class="side">
    <h2>区县/城市数据</h2>
      <p class="caption">内地为 2026年4月住宅挂牌均价；东莞/中山镇街以点位呈现，港澳为独立公开指数口径。</p>
    <input id="search" class="search" placeholder="搜索城市或区县，如 南山、广州、东莞">
    <div id="selected" class="selected">
      <div class="name">点击或悬停地图区域</div>
      <div class="meta">可查看房价、环比和数据口径。</div>
    </div>
    <div id="rows" class="rows"></div>
    <div class="notes">
      <b>香港：</b>中原 Centadata 分区领先指数，2026/05/08更新。<br>
      <b>澳门：</b>统计暨普查局 2026年第一季住宅楼价指数。<br>
      <b>镇街：</b>东莞、中山没有县级区划，镇街以中心点展示，公开镇街边界未纳入填色。<br>
      <b>底图：</b>阿里云 DataV.GeoAtlas。港澳口径不同，未纳入元/㎡色阶。
    </div>
  </aside>
</main>
<div id="tooltip" class="tooltip"></div>
<script>
const regions = ${JSON.stringify(interactiveRegions)};
const points = ${JSON.stringify(interactivePoints)};
const places = regions.concat(points);
const cityStats = ${JSON.stringify(cityStats)};
const hkStats = ${JSON.stringify(hkStats)};
const macauStats = ${JSON.stringify(macauStats)};
const svg = document.getElementById('map');
const viewport = document.getElementById('viewport');
const tooltip = document.getElementById('tooltip');
const selected = document.getElementById('selected');
const rows = document.getElementById('rows');
const search = document.getElementById('search');
let state = { scale: 1, x: 0, y: 0 };
let dragging = false;
let last = null;
let activeId = null;
let labelsVisible = true;

function fmt(value) {
  return Number(value).toLocaleString('zh-CN');
}
function applyTransform() {
  viewport.setAttribute('transform', 'translate(' + state.x + ' ' + state.y + ') scale(' + state.scale + ')');
  viewport.classList.toggle('showDetails', state.scale >= 2.15);
}
function zoom(factor, cx = svg.clientWidth / 2, cy = svg.clientHeight / 2) {
  const pt = svg.createSVGPoint();
  pt.x = cx; pt.y = cy;
  const before = pt.matrixTransform(svg.getScreenCTM().inverse());
  state.scale = Math.max(0.7, Math.min(7, state.scale * factor));
  state.x = before.x - (before.x - state.x) * factor;
  state.y = before.y - (before.y - state.y) * factor;
  applyTransform();
}
function selectRegion(id, center = false) {
  activeId = id;
  document.querySelectorAll('.region').forEach(el => el.classList.toggle('active', el.id === id));
  document.querySelectorAll('.townPoint').forEach(el => el.classList.toggle('active', el.id === id));
  document.querySelectorAll('.row').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  const r = places.find(item => item.id === id);
  if (!r) return;
  const isMainland = r.price;
  selected.innerHTML = '<div class="name">' + r.city + ' ' + r.name + '</div>' +
    (isMainland ? '<div class="price">' + fmt(r.price) + ' 元/㎡</div><div class="meta">环比 ' + r.mom + ' · 住宅挂牌均价</div>' : '<div class="meta">港澳区域请参考下方独立指数口径。</div>');
  if (center) {
    state.scale = Math.max(state.scale, 2.3);
    const cx = r.cx ?? r.x;
    const cy = r.cy ?? r.y;
    state.x = ${W / 2} - cx * state.scale;
    state.y = ${H / 2} - cy * state.scale;
    applyTransform();
  }
}
function showTip(event, r) {
  tooltip.style.display = 'block';
  tooltip.style.left = event.clientX + 'px';
  tooltip.style.top = event.clientY + 'px';
  tooltip.innerHTML = '<strong>' + r.city + ' ' + r.name + '</strong>' +
    (r.price ? '<span>' + fmt(r.price) + ' 元/㎡ · 环比 ' + r.mom + '</span>' : '<span>港澳独立指数口径，见右侧说明</span>');
}
function hideTip() { tooltip.style.display = 'none'; }
document.querySelectorAll('.region').forEach(el => {
  const r = places.find(item => item.id === el.id);
  el.addEventListener('mousemove', event => showTip(event, r));
  el.addEventListener('mouseleave', hideTip);
  el.addEventListener('click', () => selectRegion(el.id));
});
document.querySelectorAll('.townPoint').forEach(el => {
  const r = places.find(item => item.id === el.id);
  el.addEventListener('mousemove', event => showTip(event, r));
  el.addEventListener('mouseleave', hideTip);
  el.addEventListener('click', () => selectRegion(el.id));
});
svg.addEventListener('wheel', event => {
  event.preventDefault();
  zoom(event.deltaY < 0 ? 1.16 : 0.86, event.clientX, event.clientY);
}, { passive: false });
svg.addEventListener('pointerdown', event => {
  dragging = true;
  last = { x: event.clientX, y: event.clientY };
  svg.classList.add('dragging');
});
window.addEventListener('pointermove', event => {
  if (!dragging) return;
  state.x += event.clientX - last.x;
  state.y += event.clientY - last.y;
  last = { x: event.clientX, y: event.clientY };
  applyTransform();
});
window.addEventListener('pointerup', () => {
  dragging = false;
  svg.classList.remove('dragging');
});
document.getElementById('zoomIn').onclick = () => zoom(1.22);
document.getElementById('zoomOut').onclick = () => zoom(0.82);
document.getElementById('reset').onclick = () => {
  state = { scale: 1, x: 0, y: 0 };
  applyTransform();
};
document.getElementById('toggleLabels').onclick = () => {
  labelsVisible = !labelsVisible;
  document.getElementById('cityLabels').style.display = labelsVisible ? '' : 'none';
};
function renderRows(filter = '') {
  const q = filter.trim().toLowerCase();
  const main = places
    .filter(r => r.price)
    .filter(r => !q || (r.city + r.name).toLowerCase().includes(q))
    .sort((a, b) => b.price - a.price);
  rows.innerHTML = main.map(r => '<div class="row" data-id="' + r.id + '">' +
    '<b>' + r.city + ' ' + r.name + '</b><span class="price">' + fmt(r.price) + '</span><span class="' + (r.mom.startsWith('+') ? 'up' : 'down') + '">' + r.mom + '</span></div>').join('');
  rows.querySelectorAll('.row').forEach(row => {
    row.onclick = () => selectRegion(row.dataset.id, true);
  });
  document.querySelectorAll('.region').forEach(el => {
    const r = places.find(item => item.id === el.id);
    const match = !q || (r.city + r.name).toLowerCase().includes(q);
    el.classList.toggle('dimmed', !match);
  });
  document.querySelectorAll('.townPoint').forEach(el => {
    const r = places.find(item => item.id === el.id);
    const match = !q || (r.city + r.name).toLowerCase().includes(q);
    el.classList.toggle('dimmed', !match);
  });
}
search.addEventListener('input', () => renderRows(search.value));
renderRows();
</script>
</body>
</html>`;

fs.writeFileSync(OUT_INTERACTIVE, interactiveHtml, "utf8");
console.log(`Wrote ${OUT_SVG}`);
console.log(`Wrote ${OUT_HTML}`);
console.log(`Wrote ${OUT_INTERACTIVE}`);
console.log(`Render target ${OUT_PNG}`);
