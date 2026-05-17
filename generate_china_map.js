#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  createInteractiveMap,
  formatBeijingTime,
  buildProjection,
  bestLabelPoint,
  cleanName,
  colorFor,
  pathBounds,
  mergeBounds,
  geomToSimplifiedPath,
} = require("./src/simple_map_core");
const {
  PROVINCES,
  createPriceLookup,
  loadChinaFeatures,
  loadChinaOutlines,
  normalizeCity,
  comparableRecord,
  clampEstimateRatio,
} = require("./src/china_map_shared");

const ROOT = path.resolve(__dirname);
const DATA_FILE = path.join(ROOT, "data", "china_house_prices.json");
const GBA_DATA_FILE = path.join(ROOT, "data", "gba_house_prices.json");
const JJJ_DATA_FILE = path.join(ROOT, "data", "jjj_house_prices.json");
const LAYER_DIR = path.join(ROOT, "data", "layers");
const CITY_GEO_DIR = path.join(ROOT, "data", "geo", "city");
const OUT_HTML = path.join(ROOT, "china.html");
const OUT_INDEX = path.join(ROOT, "index.html");

const MAP_BOX = { x: 56, y: 112, w: 1220, h: 1100 };
const COLORS = ["#2b6cb0", "#4fa3c8", "#8fd0d0", "#f2e6a7", "#f3a05f", "#d95845", "#9e1f2f", "#64152d"];
const BREAKS = [0, 8000, 12000, 18000, 30000, 50000, 80000, 120000, 180000];

const MUNICIPALITIES = new Set(["110000", "120000", "310000", "500000", "710000", "810000", "820000"]);
const DETAIL_TOLERANCE_BY_PROVINCE = {
  "440000": 0.05,
  "810000": 0.015,
  "820000": 0.003,
};

const townAliases = {
  "东莞|南城街道": "南城区",
  "东莞|东城街道": "东城区",
  "东莞|万江街道": "万江区",
  "中山|东区街道": "东区",
  "中山|西区街道": "西区",
  "中山|南区街道": "南区",
  "中山|石岐街道": "石岐区",
  "中山|南朗街道": "南朗镇",
  "中山|中山港街道": "火炬开发区",
};

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
  if (!regions.length) return null;
  return regions.reduce((acc, r) => ({
    minX: Math.min(acc.minX, r.cx),
    minY: Math.min(acc.minY, r.cy),
    maxX: Math.max(acc.maxX, r.cx),
    maxY: Math.max(acc.maxY, r.cy),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function addPresentField(target, key, value) {
  if (value !== undefined && value !== null && value !== "" && value !== false) target[key] = value;
}

function regionMetadata(record, defaultDataLevel = "") {
  const metadata = {};
  addPresentField(metadata, "mom", record?.mom);
  addPresentField(metadata, "source", record?.source);
  addPresentField(metadata, "quality", record?.quality);
  addPresentField(metadata, "dataLevel", record?.dataLevel || defaultDataLevel);
  addPresentField(metadata, "priceType", record?.priceType);
  addPresentField(metadata, "newPrice", record?.newPrice);
  addPresentField(metadata, "resalePrice", record?.resalePrice);
  addPresentField(metadata, "newPriceEstimated", Boolean(record?.newPriceEstimated));
  addPresentField(metadata, "resalePriceEstimated", Boolean(record?.resalePriceEstimated));
  if (record?.newPriceEstimated || record?.resalePriceEstimated || String(record?.priceType || "").includes("estimated")) {
    addPresentField(metadata, "estimateRatio", record?.estimateRatio);
    addPresentField(metadata, "estimateBasis", record?.estimateBasis);
  }
  addPresentField(metadata, "newSource", record?.newSource);
  addPresentField(metadata, "newQuality", record?.newQuality);
  addPresentField(metadata, "resaleSource", record?.resaleSource);
  addPresentField(metadata, "resaleQuality", record?.resaleQuality);
  addPresentField(metadata, "inherited", Boolean(record?.inheritedCityAverage));
  addPresentField(metadata, "supplemental", Boolean(record?.supplemental));
  return metadata;
}

function createLayerPayload(id, features, outlines, projection, getRecord, tolerance = 0.12) {
  const regions = features.map((feature, index) => {
    const city = feature.properties.city;
    const name = feature.properties.name;
    const record = getRecord(city, name, feature);
    const price = record?.price || null;
    const [cx, cy, labelBox] = bestLabelPoint(feature, projection.project);
    const label = cleanName(name);
    const d = geomToSimplifiedPath(feature.geometry, projection.project, tolerance);
    return {
      id: `${id}-${index}`,
      city,
      name,
      label,
      price,
      ...regionMetadata(record),
      d,
      bounds: pathBounds(d),
      fill: colorFor(price, BREAKS, COLORS),
      cx,
      cy,
      labelMinScale: Number(Math.max(3.2, Math.min(7.5, ((label.length + 5) * 7) / Math.max(10, Math.min(labelBox.w, labelBox.h * 2)))).toFixed(2)),
    };
  });
  return {
    id,
    bounds: mergeBounds(regions) || regionBounds(regions),
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

function townDisplayName(city, osmName) {
  return townAliases[`${city}|${osmName}`] || osmName;
}

function pointKey(pt) {
  return `${pt[0].toFixed(7)},${pt[1].toFixed(7)}`;
}

function stitchRings(segments) {
  const unused = segments
    .filter(seg => seg.length > 1)
    .map(seg => seg.map(pt => [pt[0], pt[1]]));
  const rings = [];
  while (unused.length) {
    const ring = unused.shift();
    let guard = 0;
    while (unused.length && guard++ < 600) {
      const end = pointKey(ring[ring.length - 1]);
      if (end === pointKey(ring[0])) break;
      const index = unused.findIndex(seg => pointKey(seg[0]) === end || pointKey(seg[seg.length - 1]) === end);
      if (index === -1) break;
      const next = unused.splice(index, 1)[0];
      if (pointKey(next[next.length - 1]) === end) next.reverse();
      ring.push(...next.slice(1));
    }
    if (ring.length > 2) {
      if (pointKey(ring[0]) !== pointKey(ring[ring.length - 1])) ring.push(ring[0]);
      rings.push(ring);
    }
  }
  return rings;
}

function readOsmTownBoundaries(city, file) {
  const sourcePath = path.join(ROOT, file);
  if (!fs.existsSync(sourcePath)) return [];
  const osm = readGeo(sourcePath);
  return osm.elements
    .filter(el => el.type === "relation" && el.tags?.boundary === "administrative" && el.tags?.admin_level === "8")
    .map(el => {
      const segments = el.members
        .filter(member => member.type === "way" && member.role === "outer" && Array.isArray(member.geometry))
        .map(member => member.geometry.map(point => [point.lon, point.lat]));
      const rings = stitchRings(segments);
      if (!rings.length) return null;
      const name = townDisplayName(city, el.tags.name);
      const labelNode = el.members.find(member => member.role === "label" && Number.isFinite(member.lon) && Number.isFinite(member.lat));
      return {
        type: "Feature",
        properties: {
          adcode: el.id,
          city,
          name,
          sourceName: el.tags.name,
          level: "town",
          centroid: labelNode ? [labelNode.lon, labelNode.lat] : undefined,
        },
        geometry: { type: "MultiPolygon", coordinates: rings.map(ring => [ring]) },
      };
    })
    .filter(Boolean);
}

function withPlace(feature, province, city, name, extra = {}) {
  return {
    ...feature,
    properties: {
      ...(feature.properties || {}),
      province,
      city,
      name,
      ...extra,
    },
  };
}

function readGeo(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function cityGeoPath(code, suffix = "_full") {
  const preferred = path.join(CITY_GEO_DIR, `datav_${code}${suffix}.json`);
  if (fs.existsSync(preferred)) return preferred;
  const legacy = path.join(ROOT, "data", "geo", `datav_${code}${suffix}.json`);
  return fs.existsSync(legacy) ? legacy : null;
}

function buildSupplementalLookup(table, source, quality) {
  const exact = new Map();
  const normalized = new Map();
  for (const [key, value] of Object.entries(table || {})) {
    const [city, area] = key.split("|");
    if (!city || !area) continue;
    const record = comparableRecord({
      price: value[0],
      mom: value[1],
      source,
      quality,
      resalePrice: value[0],
      resaleMom: value[1],
      resaleSource: source,
      resaleQuality: quality,
      dataLevel: "district",
    });
    exact.set(`${city}|${area}`, record);
    const normalizedKey = `${normalizeCity(city)}|${normalizeCity(area)}`;
    if (!normalized.has(normalizedKey)) normalized.set(normalizedKey, record);
  }
  return (city, name) => exact.get(`${city}|${name}`)
    || exact.get(`${city.replace(/市$/, "")}|${name}`)
    || exact.get(`${city}|${name}市`)
    || normalized.get(`${normalizeCity(city)}|${normalizeCity(name)}`)
    || null;
}

function buildEstimateRatioLookup(chinaData) {
  const byCity = new Map();
  const byProvince = new Map();
  const national = [];
  const cityRowsByName = new Map((chinaData.cityData || []).map(row => [normalizeCity(row.city), row]));
  for (const [key, raw] of Object.entries(chinaData.cityRecords || {})) {
    const cityName = key.includes("|") ? key.split("|").pop() : key;
    const cityKey = normalizeCity(cityName);
    const record = comparableRecord(raw);
    if (!record.newPrice || !record.resalePrice || record.newPriceEstimated || record.resalePriceEstimated) continue;
    const ratio = clampEstimateRatio(record.newPrice / record.resalePrice);
    byCity.set(cityKey, ratio);
    national.push(ratio);
    const province = raw.province || cityRowsByName.get(cityKey)?.province;
    if (province) {
      const provinceKey = normalizeCity(province);
      if (!byProvince.has(provinceKey)) byProvince.set(provinceKey, []);
      byProvince.get(provinceKey).push(ratio);
    }
  }
  const median = values => {
    const filtered = values.filter(value => value >= 0.55 && value <= 1.8);
    if (!filtered.length) return null;
    const sorted = [...filtered].sort((a, b) => a - b);
    const trim = sorted.length >= 12 ? Math.floor(sorted.length * 0.1) : 0;
    const sample = trim ? sorted.slice(trim, sorted.length - trim) : sorted;
    if (!sample.length) return null;
    return sample[Math.floor(sample.length / 2)];
  };
  const provinceMedian = new Map([...byProvince]
    .map(([key, values]) => [key, {
      ratio: median(values),
      count: values.filter(value => value >= 0.55 && value <= 1.8).length,
    }])
    .filter(([, summary]) => summary.ratio && summary.count >= 3));
  const nationalCount = national.filter(value => value >= 0.55 && value <= 1.8).length;
  const nationalMedian = nationalCount >= 10 ? median(national) : null;
  return (city, province) => {
    const cityRatio = byCity.get(normalizeCity(city));
    if (cityRatio) return { ratio: cityRatio, basis: "按同城新房/二手配对样本估算", hasEvidence: true, count: 1 };
    const provinceSummary = provinceMedian.get(normalizeCity(province));
    if (provinceSummary?.ratio) return { ratio: provinceSummary.ratio, basis: `按同省 ${provinceSummary.count} 个新房/二手配对样本估算`, hasEvidence: true, count: provinceSummary.count };
    if (nationalMedian) return { ratio: nationalMedian, basis: `按全国 ${nationalCount} 个新房/二手配对样本估算`, hasEvidence: true, count: nationalCount };
    return {
      ratio: chinaData.metadata?.newToResaleRatio || 1,
      basis: "暂无足够新房与二手配对样本，暂不估算新房参考价",
      hasEvidence: false,
      count: 0,
    };
  };
}

function buildDistrictRecordLookup(chinaData) {
  const records = chinaData.districtRecords || {};
  const ratioFor = buildEstimateRatioLookup(chinaData);
  if (!Object.keys(records).length) {
    return buildSupplementalLookup(
      chinaData.districtData,
      "禧泰数据/中国房价行情",
      "区县住宅挂牌均价",
    );
  }

  const exact = new Map();
  const normalized = new Map();
  for (const [key, value] of Object.entries(records)) {
    const [city, area] = key.split("|");
    if (!city || !area || !value?.price) continue;
    const ratio = ratioFor(city, value.province || "");
    const record = comparableRecord({
      price: value.price,
      mom: value.mom || "--%",
      source: value.source || "公开房价数据",
      quality: value.quality || "区县住宅均价",
      dataLevel: value.dataLevel || "district",
      supplemental: Boolean(value.supplemental),
      url: value.url || "",
      fetchedAt: value.fetchedAt || "",
      hasEstimateRatio: value.hasEstimateRatio || ratio.hasEvidence,
      estimateSampleCount: value.estimateSampleCount || ratio.count,
    }, value.estimateRatio || ratio.ratio, value.estimateBasis || ratio.basis);
    exact.set(`${city}|${area}`, record);
    const normalizedKey = `${normalizeCity(city)}|${normalizeCity(area)}`;
    if (!normalized.has(normalizedKey)) normalized.set(normalizedKey, record);
  }
  return (city, name) => exact.get(`${city}|${name}`)
    || exact.get(`${city.replace(/市$/, "")}|${name}`)
    || exact.get(`${city}|${name}市`)
    || normalized.get(`${normalizeCity(city)}|${normalizeCity(name)}`)
    || null;
}

function createDetailRecordLookup(chinaData) {
  const cityLookup = createPriceLookup(chinaData);
  const nationalDistrictLookup = buildDistrictRecordLookup(chinaData);
  const gbaLookup = buildSupplementalLookup(
    readOptionalJson(GBA_DATA_FILE).mainlandData,
    "禧泰数据/中国房价行情",
    "区县住宅挂牌均价",
  );
  const jjjLookup = buildSupplementalLookup(
    readOptionalJson(JJJ_DATA_FILE).mainlandData,
    "禧泰数据/中国房价行情",
    "区县住宅挂牌均价",
  );

  return (city, name, feature) => {
    const province = feature?.properties?.province || city;
    const direct = nationalDistrictLookup(city, name) || gbaLookup(city, name) || jjjLookup(city, name);
    if (direct) return direct;

    if (feature?.properties?.fallbackCityLevel) {
      return cityLookup(province, name) || cityLookup("", name);
    }

    const cityAverage = cityLookup(province, city) || cityLookup(city, city) || cityLookup("", city);
    return cityAverage ? {
      ...cityAverage,
      quality: cityAverage.priceType === "resale"
        ? "城市住宅挂牌均价，用于区县底色"
        : cityAverage.priceType === "resale-estimated"
          ? "城市住宅挂牌估算均价，用于区县底色"
          : cityAverage.newPriceEstimated
            ? "城市新房估算均价，用于区县底色"
            : "城市新房均价，用于区县底色",
      dataLevel: "city-inherited",
      inheritedCityAverage: true,
      supplemental: true,
    } : null;
  };
}

function loadProvinceDetailFeatures(provinceName, provinceCode) {
  const provinceFull = path.join(ROOT, "data", "geo", "china", `datav_${provinceCode}_full.json`);
  if (!fs.existsSync(provinceFull)) return { features: [], outlines: [] };

  const geo = readGeo(provinceFull);
  const townBoundaryFiles = provinceCode === "440000"
    ? new Map([
      ["东莞市", "osm_dongguan_boundaries.json"],
      ["中山市", "osm_zhongshan_boundaries.json"],
    ])
    : new Map();
  if (MUNICIPALITIES.has(provinceCode)) {
    return {
      features: (geo.features || []).map(feature => withPlace(feature, provinceName, provinceName, feature.properties?.name || provinceName)),
      outlines: [],
    };
  }

  const detailFeatures = [];
  const outlines = [];
  for (const cityFeature of geo.features || []) {
    const props = cityFeature.properties || {};
    const cityName = props.name;
    const cityCode = props.adcode;
    if (!cityName || !cityCode) continue;
    outlines.push(withPlace(cityFeature, provinceName, provinceName, cityName));

    const townBoundaryFile = townBoundaryFiles.get(cityName);
    if (townBoundaryFile) {
      const shortCityName = cityName.replace(/市$/, "");
      const townFeatures = readOsmTownBoundaries(shortCityName, townBoundaryFile);
      if (townFeatures.length) {
        townFeatures.forEach(part => {
          detailFeatures.push(withPlace(part, provinceName, cityName, part.properties?.name || cityName));
        });
        continue;
      }
    }

    const fullPath = cityGeoPath(cityCode, "_full");
    if (!fullPath) {
      detailFeatures.push(withPlace(cityFeature, provinceName, provinceName, cityName, { fallbackCityLevel: true }));
      continue;
    }

    const cityGeo = readGeo(fullPath);
    const cityParts = cityGeo.features || [];
    if (!cityParts.length) {
      detailFeatures.push(withPlace(cityFeature, provinceName, provinceName, cityName, { fallbackCityLevel: true }));
      continue;
    }
    cityParts.forEach(part => {
      detailFeatures.push(withPlace(part, provinceName, cityName, part.properties?.name || cityName));
    });
  }
  return { features: detailFeatures, outlines };
}

function buildProvinceDetailLayers(projection, data) {
  const getRecord = createDetailRecordLookup(data);
  return PROVINCES.map(([provinceName, provinceCode]) => {
    const { features, outlines } = loadProvinceDetailFeatures(provinceName, provinceCode);
    if (!features.length) return null;
    const id = `province-${provinceCode}`;
    const payload = createLayerPayload(id, features, outlines, projection, getRecord, DETAIL_TOLERANCE_BY_PROVINCE[provinceCode] ?? 0.14);
    if (!payload.regions.length) return null;
    const file = `${id}.json`;
    writeDetailLayer(file, payload);
    return {
      id,
      file,
      bounds: payload.bounds,
      regions: payload.regions.length,
      priced: payload.regions.filter(region => region.price).length,
      inherited: payload.regions.filter(region => region.price && region.inherited).length,
      independent: payload.regions.filter(region => region.price && !region.inherited).length,
      supplemental: payload.regions.filter(region => region.price && !region.inherited && region.supplemental).length,
    };
  }).filter(Boolean);
}

function main() {
  const data = loadData();
  const generatedAt = new Date().toISOString();
  const fetchedAt = formatBeijingTime(data.fetchedAt || data.updatedAt || generatedAt);
  const generatedAtText = formatBeijingTime(generatedAt);
  const features = loadChinaFeatures(ROOT);
  const outlines = loadChinaOutlines(ROOT);
  const projection = buildProjection(features, MAP_BOX);
  const detailLayers = buildProvinceDetailLayers(projection, data);
  const getRecord = createPriceLookup(data);
  const matched = features.filter(feature => getRecord(feature.properties.city, feature.properties.name)).length;
  const detailRegionCount = detailLayers.reduce((sum, layer) => sum + layer.regions, 0);
  const detailPricedCount = detailLayers.reduce((sum, layer) => sum + layer.priced, 0);
  const detailIndependentCount = detailLayers.reduce((sum, layer) => sum + layer.independent, 0);
  const detailInheritedCount = detailLayers.reduce((sum, layer) => sum + layer.inherited, 0);
  const detailSupplementalCount = detailLayers.reduce((sum, layer) => sum + layer.supplemental, 0);
  const html = createInteractiveMap({
    pageTitle: "全国房价交互地图",
    title: "全国房价地图",
    subtitle: "一张地图渐进细化；放大后自动加载区县边界和价格标签",
    updateLine: `数据：${data.metadata?.coverage || "全国城市"}；最近抓取：${fetchedAt}`,
    sideTitle: "全国城市数据",
    caption: "默认展示二手/挂牌价；有新房样本时在详情中并列参考，缺挂牌价时才用新房价反推估算。",
    width: 1800,
    height: 1320,
    mapBox: MAP_BOX,
    pathSimplifyTolerance: 0.7,
    features,
    outlines,
    getRecord,
    maxScale: 180,
    maxDetailLoadsPerPass: 3,
    showPresetButtons: false,
    viewPresets: VIEW_PRESETS,
    detailSources: detailLayers.map(layer => ({
      id: layer.id,
      url: `data/layers/${layer.file}`,
      minScale: 13,
      labelScale: 15,
      bounds: layer.bounds,
    })),
    notesHtml: `
      <b>更新：</b>GitHub Actions 每周一 04:00（北京时间）尝试拉取全国城市排行；页面生成 ${generatedAtText}。<br>
      <b>渐进细化：</b>全国初始为城市级；缩放到任意地区时按省份懒加载区县级边界，避免一次性加载过重。<br>
      <b>覆盖：</b>当前全国底图 ${features.length} 个城市级区域，已匹配房价 ${matched} 个；区县级细节 ${detailRegionCount} 个区域，独立区县数据 ${detailIndependentCount} 个（补充来源 ${detailSupplementalCount} 个），沿用市均 ${detailInheritedCount} 个。<br>
      <b>口径：</b>页面默认展示二手/挂牌价，来自禧泰数据/中国房价行情和房天下查房价；真实新房样本优先来自城市房网新盘均价，并在详情中并列显示。缺挂牌价但有新房价时，按同城、同省或全国新房/挂牌配对样本的稳健中位数反推挂牌价。<br>
      <b>说明：</b>标签中的“估”仅表示当前主价由新房价反推估算；“新房”或“新房估算”会在详情里作为参考价显示；“市均”表示该区县暂未抓到独立价格，当前沿用所属城市均价。
    `,
  });
  fs.writeFileSync(OUT_HTML, html, "utf8");
  fs.writeFileSync(OUT_INDEX, html, "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUT_HTML)} and ${path.relative(ROOT, OUT_INDEX)} (${features.length} regions, ${matched} priced)`);
}

main();
