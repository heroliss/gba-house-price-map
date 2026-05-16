#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  createInteractiveMap,
  readGeoFeatures,
  formatBeijingTime,
  buildProjection,
  bestLabelPoint,
  cleanName,
  colorFor,
  geomToSimplifiedPath,
} = require("./src/simple_map_core");
const {
  TOPIC_MAPS,
  createPriceLookup,
  loadChinaFeatures,
  loadChinaOutlines,
  topicLinksHtml,
} = require("./src/china_map_shared");

const ROOT = path.resolve(__dirname);
const DATA_FILE = path.join(ROOT, "data", "china_house_prices.json");
const GBA_DATA_FILE = path.join(ROOT, "data", "gba_house_prices.json");
const JJJ_DATA_FILE = path.join(ROOT, "data", "jjj_house_prices.json");
const LAYER_DIR = path.join(ROOT, "data", "layers");
const OUT_HTML = path.join(ROOT, "china.html");
const OUT_INDEX = path.join(ROOT, "index.html");

const MAP_BOX = { x: 56, y: 112, w: 1220, h: 1100 };
const COLORS = ["#2b6cb0", "#4fa3c8", "#8fd0d0", "#f2e6a7", "#f3a05f", "#d95845", "#9e1f2f", "#64152d"];
const BREAKS = [0, 8000, 12000, 18000, 30000, 50000, 80000, 120000, 180000];

const GBA_FILES = [
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

const GBA_OUTLINE_FILES = [
  ["广州", "datav_440100.json"],
  ["深圳", "datav_440300.json"],
  ["珠海", "datav_440400.json"],
  ["佛山", "datav_440600.json"],
  ["江门", "datav_440700.json"],
  ["肇庆", "datav_441200.json"],
  ["惠州", "datav_441300.json"],
  ["东莞", "datav_441900.json"],
  ["中山", "datav_442000.json"],
  ["香港", "datav_810000.json"],
  ["澳门", "datav_820000.json"],
];

const HEBEI_CITIES = [
  ["石家庄市", "130100"], ["唐山市", "130200"], ["秦皇岛市", "130300"], ["邯郸市", "130400"],
  ["邢台市", "130500"], ["保定市", "130600"], ["张家口市", "130700"], ["承德市", "130800"],
  ["沧州市", "130900"], ["廊坊市", "131000"], ["衡水市", "131100"],
];

const VIEW_PRESETS = [
  { id: "national", label: "全国", center: [104, 35.5], scale: 0.9 },
  { id: "gba", label: "大湾区", center: [113.7, 22.65], scale: 6.2 },
  { id: "jingjinji", label: "京津冀", center: [116.4, 39.35], scale: 4.4 },
  { id: "yangtze-delta", label: "长三角", center: [119.6, 31.2], scale: 5.1 },
  { id: "chengyu", label: "成渝", center: [105.7, 30.35], scale: 5.4 },
  { id: "middle-yangtze", label: "长江中游", center: [113.4, 28.7], scale: 5.0 },
  { id: "west-coast", label: "海峡西岸", center: [118.4, 25.7], scale: 6.2 },
  { id: "shandong-peninsula", label: "山东半岛", center: [118.5, 36.5], scale: 5.0 },
];

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Missing ${path.relative(ROOT, DATA_FILE)}. Run scripts/update-china-data.js first.`);
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function readOptionalJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

function regionBounds(regions) {
  return regions.reduce((acc, r) => ({
    minX: Math.min(acc.minX, r.cx),
    minY: Math.min(acc.minY, r.cy),
    maxX: Math.max(acc.maxX, r.cx),
    maxY: Math.max(acc.maxY, r.cy),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function createLayerPayload(id, features, outlines, projection, getRecord, tolerance = 0.12) {
  const regions = features.map((feature, index) => {
    const city = feature.properties.city;
    const name = feature.properties.name;
    const record = getRecord(city, name);
    const price = record?.price || null;
    const [cx, cy, labelBox] = bestLabelPoint(feature, projection.project);
    const label = cleanName(name);
    return {
      id: `${id}-${index}`,
      city,
      name,
      label,
      price,
      mom: record?.mom || "",
      source: record?.source || "",
      quality: record?.quality || "",
      supplemental: Boolean(record?.supplemental),
      d: geomToSimplifiedPath(feature.geometry, projection.project, tolerance),
      fill: colorFor(price, BREAKS, COLORS),
      cx,
      cy,
      labelMinScale: Number(Math.max(3.2, Math.min(7.5, ((label.length + 5) * 7) / Math.max(10, Math.min(labelBox.w, labelBox.h * 2)))).toFixed(2)),
    };
  });
  return {
    id,
    bounds: regionBounds(regions),
    regions,
    outlines: outlines.map((feature, index) => ({
      id: `${id}-b${index}`,
      d: geomToSimplifiedPath(feature.geometry, projection.project, tolerance),
    })),
  };
}

function writeDetailLayer(filename, payload) {
  fs.mkdirSync(LAYER_DIR, { recursive: true });
  fs.writeFileSync(path.join(LAYER_DIR, filename), `${JSON.stringify(payload)}\n`, "utf8");
}

function buildGbaLayer(projection) {
  const data = readOptionalJson(GBA_DATA_FILE);
  const table = data.mainlandData || {};
  const features = readGeoFeatures(ROOT, GBA_FILES.map(([city, file]) => ({ city, file })));
  const outlines = readGeoFeatures(ROOT, GBA_OUTLINE_FILES.map(([city, file]) => ({ city, file })));
  return createLayerPayload("gba-detail", features, outlines, projection, (city, name) => {
    const direct = table[`${city}|${name}`] || table[`${city}|${name}市`];
    if (!direct) return null;
    return { price: direct[0], mom: direct[1], source: "禧泰数据/中国房价行情", quality: "区县住宅挂牌均价" };
  });
}

function buildJjjLayer(projection) {
  const data = readOptionalJson(JJJ_DATA_FILE);
  const table = data.mainlandData || {};
  const features = readGeoFeatures(ROOT, [
    { city: "北京", file: "data/geo/datav_110000_full.json" },
    { city: "天津", file: "data/geo/datav_120000_full.json" },
    ...HEBEI_CITIES.map(([city, code]) => ({ city, file: `data/geo/datav_${code}_full.json` })),
  ]);
  const outlines = readGeoFeatures(ROOT, [
    { city: "北京", file: "data/geo/datav_110000.json" },
    { city: "天津", file: "data/geo/datav_120000.json" },
    ...HEBEI_CITIES.map(([city, code]) => ({ city, file: `data/geo/datav_${code}.json` })),
    { city: "河北", file: "data/geo/datav_130000.json" },
  ]);
  return createLayerPayload("jjj-detail", features, outlines, projection, (city, name) => {
    const direct = table[`${city}|${name}`];
    if (direct) return { price: direct[0], mom: direct[1], source: "禧泰数据/中国房价行情", quality: "区县住宅挂牌均价" };
    const cityAverage = table[`河北|${city}`];
    if (cityAverage) return { price: cityAverage[0], mom: cityAverage[1], source: "禧泰数据/中国房价行情", quality: "城市住宅挂牌均价，用于该市区县底色", supplemental: true };
    return null;
  });
}

function main() {
  const data = loadData();
  const generatedAt = new Date().toISOString();
  const fetchedAt = formatBeijingTime(data.fetchedAt || data.updatedAt || generatedAt);
  const generatedAtText = formatBeijingTime(generatedAt);
  const features = loadChinaFeatures(ROOT);
  const outlines = loadChinaOutlines(ROOT);
  const projection = buildProjection(features, MAP_BOX);
  const gbaLayer = buildGbaLayer(projection);
  const jjjLayer = buildJjjLayer(projection);
  writeDetailLayer("gba-detail.json", gbaLayer);
  writeDetailLayer("jjj-detail.json", jjjLayer);
  const getRecord = createPriceLookup(data);
  const matched = features.filter(feature => getRecord(feature.properties.city, feature.properties.name)).length;
  const topicLinks = topicLinksHtml();
  const html = createInteractiveMap({
    pageTitle: "全国房价交互地图",
    title: "全国房价地图",
    subtitle: "一张地图渐进细化；放大到重点区域后自动加载区县/镇街边界",
    updateLine: `数据：${data.metadata?.coverage || "全国城市"}；最近抓取：${fetchedAt}`,
    sideTitle: "全国城市数据",
    caption: "全国城市住宅挂牌均价总览；放大到大湾区、京津冀会自动叠加更细边界。",
    width: 1800,
    height: 1320,
    mapBox: MAP_BOX,
    pathSimplifyTolerance: 0.7,
    features,
    outlines,
    getRecord,
    viewPresets: VIEW_PRESETS,
    detailSources: [
      { id: "gba", url: "data/layers/gba-detail.json", minScale: 3.5, labelScale: 3.7, bounds: gbaLayer.bounds },
      { id: "jingjinji", url: "data/layers/jjj-detail.json", minScale: 3.0, labelScale: 3.3, bounds: jjjLayer.bounds },
    ],
    notesHtml: `
      <b>更新：</b>GitHub Actions 每周一 04:00（北京时间）尝试拉取全国城市排行；页面生成 ${generatedAtText}。<br>
      <b>渐进细化：</b>全国初始为城市级；缩放到大湾区或京津冀时自动加载区县/镇街细节图层。<br>
      <b>覆盖：</b>当前全国底图 ${features.length} 个区域，已匹配房价 ${matched} 个；大湾区细节 ${gbaLayer.regions.length} 个区域，京津冀细节 ${jjjLayer.regions.length} 个区域。<br>
      <b>口径：</b>主数据为禧泰数据/中国房价行情城市住宅挂牌均价；香港、澳门使用补充估算并以不同口径标注。<br>
      <b>快捷视角：</b>${topicLinks} 等旧专题入口会自动跳回这张地图并定位到对应区域；后续新增细数据时继续接入同一张地图。
    `,
  });
  fs.writeFileSync(OUT_HTML, html, "utf8");
  fs.writeFileSync(OUT_INDEX, html, "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUT_HTML)} and ${path.relative(ROOT, OUT_INDEX)} (${features.length} regions, ${matched} priced)`);
}

main();
