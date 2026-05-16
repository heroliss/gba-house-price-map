#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createInteractiveMap, readGeoFeatures, formatBeijingTime } = require("./src/simple_map_core");

const ROOT = path.resolve(__dirname);
const OUT_HTML = path.join(ROOT, "jingjinji.html");
const DATA_FILE = path.join(ROOT, "data", "jjj_house_prices.json");

const HEBEI_CITIES = [
  ["石家庄市", "130100"],
  ["唐山市", "130200"],
  ["秦皇岛市", "130300"],
  ["邯郸市", "130400"],
  ["邢台市", "130500"],
  ["保定市", "130600"],
  ["张家口市", "130700"],
  ["承德市", "130800"],
  ["沧州市", "130900"],
  ["廊坊市", "131000"],
  ["衡水市", "131100"],
];

const cityCenters = {
  北京: [116.4074, 39.9042],
  天津: [117.2009, 39.0842],
  石家庄: [114.5149, 38.0428],
  唐山: [118.1802, 39.6309],
  秦皇岛: [119.6005, 39.9354],
  邯郸: [114.5391, 36.6256],
  邢台: [114.5048, 37.0706],
  保定: [115.4646, 38.8745],
  张家口: [114.8863, 40.7689],
  承德: [117.9634, 40.9515],
  沧州: [116.8575, 38.3106],
  廊坊: [116.6838, 39.5383],
  衡水: [115.6689, 37.7393],
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Missing ${path.relative(ROOT, DATA_FILE)}. Run scripts/update-jjj-data.js first.`);
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function buildFeatures() {
  const specs = [
    { city: "北京", file: "data/geo/datav_110000_full.json" },
    { city: "天津", file: "data/geo/datav_120000_full.json" },
    ...HEBEI_CITIES.map(([city, code]) => ({
      city,
      file: `data/geo/datav_${code}_full.json`,
    })),
  ];
  return readGeoFeatures(ROOT, specs);
}

function buildOutlines() {
  const specs = [
    { city: "北京", file: "data/geo/datav_110000.json" },
    { city: "天津", file: "data/geo/datav_120000.json" },
    ...HEBEI_CITIES.map(([city, code]) => ({
      city,
      file: `data/geo/datav_${code}.json`,
    })),
    { city: "河北", file: "data/geo/datav_130000.json" },
  ];
  return readGeoFeatures(ROOT, specs);
}

function createRecordGetter(data) {
  const table = data.mainlandData || {};
  return (city, name) => {
    const direct = table[`${city}|${name}`];
    if (direct) {
      return {
        price: direct[0],
        mom: direct[1],
        source: "禧泰数据/中国房价行情",
        quality: "区县住宅挂牌均价",
      };
    }

    const cityAverage = table[`河北|${city}`];
    if (cityAverage) {
      return {
        price: cityAverage[0],
        mom: cityAverage[1],
        source: "禧泰数据/中国房价行情",
        quality: "城市住宅挂牌均价，用于该市区县底色",
        supplemental: true,
      };
    }

    return null;
  };
}

function main() {
  const data = loadData();
  const generatedAt = new Date().toISOString();
  const period = data.metadata?.mainlandPeriod || "公开最新";
  const fetchedAt = formatBeijingTime(data.fetchedAt || data.updatedAt || generatedAt);
  const generatedAtText = formatBeijingTime(generatedAt);
  const features = buildFeatures();
  const outlines = buildOutlines();
  const html = createInteractiveMap({
    pageTitle: "京津冀房价交互地图",
    title: "京津冀房价地图",
    subtitle: "拖拽移动，滚轮或双指缩放；点击区县查看详细数据",
    updateLine: `数据：${period}；最近抓取：${fetchedAt}`,
    sideTitle: "京津冀区域数据",
    caption: "北京、天津为区县住宅挂牌均价；河北展示区县边界，房价采用所在城市均价。",
    width: 1800,
    height: 1320,
    mapBox: { x: 72, y: 164, w: 1180, h: 1020 },
    features,
    outlines,
    labelCenters: cityCenters,
    getRecord: createRecordGetter(data),
    navLinks: [
      { href: "index.html", label: "大湾区" },
      { href: "jingjinji.html", label: "京津冀", active: true },
    ],
    notesHtml: `
      <b>更新：</b>GitHub Actions 每周一 04:00（北京时间）尝试拉取数据；页面生成 ${generatedAtText}。<br>
      <b>口径：</b>北京、天津使用禧泰数据/中国房价行情区县住宅挂牌均价；河北目前抓取源区县行不完整，先用城市住宅挂牌均价为区县着色，列表中同市区县数值相同属正常。<br>
      <b>边界：</b>白线为区县/县级边界，深色线为城市范围；底图为高德中文瓦片，可开启并调整房价图层透明度。
    `,
  });
  fs.writeFileSync(OUT_HTML, html, "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUT_HTML)} (${features.length} regions, ${outlines.length} outlines)`);
}

main();
