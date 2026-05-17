const path = require("path");
const { readGeoFeatures } = require("./simple_map_core");

const PROVINCES = [
  ["北京", "110000"], ["天津", "120000"], ["河北", "130000"], ["山西", "140000"], ["内蒙古", "150000"],
  ["辽宁", "210000"], ["吉林", "220000"], ["黑龙江", "230000"], ["上海", "310000"], ["江苏", "320000"],
  ["浙江", "330000"], ["安徽", "340000"], ["福建", "350000"], ["江西", "360000"], ["山东", "370000"],
  ["河南", "410000"], ["湖北", "420000"], ["湖南", "430000"], ["广东", "440000"], ["广西", "450000"],
  ["海南", "460000"], ["重庆", "500000"], ["四川", "510000"], ["贵州", "520000"], ["云南", "530000"],
  ["西藏", "540000"], ["陕西", "610000"], ["甘肃", "620000"], ["青海", "630000"], ["宁夏", "640000"],
  ["新疆", "650000"], ["台湾", "710000"], ["香港", "810000"], ["澳门", "820000"],
];

const MUNICIPALITIES = new Set(["110000", "120000", "310000", "500000", "710000", "810000", "820000"]);

const TOPIC_MAPS = [
  {
    id: "yangtze-delta",
    file: "yangtze-delta.html",
    title: "长三角房价地图",
    sideTitle: "长三角城市数据",
    caption: "上海、江苏、浙江、安徽城市级住宅挂牌价；有新房样本时在详情中并列参考。",
    provinces: ["上海", "江苏", "浙江", "安徽"],
    mapBox: { x: 100, y: 120, w: 1120, h: 1040 },
    notes: "长三角专题暂以城市级数据展示；后续可继续补区县级边界和数据。",
  },
  {
    id: "chengyu",
    file: "chengyu.html",
    title: "成渝地区房价地图",
    sideTitle: "成渝城市数据",
    caption: "重庆、四川城市级住宅挂牌价；有新房样本时在详情中并列参考。",
    provinces: ["重庆", "四川"],
    mapBox: { x: 84, y: 116, w: 1160, h: 1040 },
    notes: "成渝专题暂以城市级数据展示，重庆按直辖市整体均价呈现。",
  },
  {
    id: "middle-yangtze",
    file: "middle-yangtze.html",
    title: "长江中游房价地图",
    sideTitle: "长江中游城市数据",
    caption: "湖北、湖南、江西城市级住宅挂牌价；有新房样本时在详情中并列参考。",
    provinces: ["湖北", "湖南", "江西"],
    mapBox: { x: 84, y: 116, w: 1160, h: 1040 },
    notes: "长江中游专题暂以城市级数据展示，适合快速比较武汉、长沙、南昌及周边城市。",
  },
  {
    id: "west-coast",
    file: "west-coast.html",
    title: "海峡西岸房价地图",
    sideTitle: "海峡西岸城市数据",
    caption: "福建城市级住宅挂牌价；有新房样本时在详情中并列参考。",
    provinces: ["福建"],
    mapBox: { x: 110, y: 106, w: 1060, h: 1060 },
    notes: "海峡西岸专题先以福建城市级数据呈现，台湾数据源口径待补充。",
  },
  {
    id: "shandong-peninsula",
    file: "shandong-peninsula.html",
    title: "山东半岛房价地图",
    sideTitle: "山东半岛城市数据",
    caption: "山东城市级住宅挂牌价；有新房样本时在详情中并列参考。",
    provinces: ["山东"],
    mapBox: { x: 90, y: 116, w: 1120, h: 1040 },
    notes: "山东半岛专题先以山东城市级数据呈现，重点观察青岛、济南、烟台、威海等城市。",
  },
];

const ETHNIC_TOKENS = [
  "土家族", "苗族", "侗族", "布依族", "彝族", "回族", "哈尼族", "傣族", "景颇族", "傈僳族",
  "白族", "壮族", "朝鲜族", "藏族", "羌族", "蒙古族", "哈萨克", "柯尔克孜", "黎族", "纳西族",
  "阿昌族", "普米族", "怒族", "独龙族", "裕固族",
];

function normalizeProvince(name) {
  return String(name || "")
    .replace(/特别行政区$/, "")
    .replace(/维吾尔自治区$/, "")
    .replace(/壮族自治区$/, "")
    .replace(/回族自治区$/, "")
    .replace(/自治区$/, "")
    .replace(/[省市]$/, "");
}

function normalizeCity(name) {
  let value = String(name || "")
    .replace(/特别行政区$/, "")
    .replace(/市辖区$/, "")
    .replace(/地区$/, "")
    .replace(/盟$/, "")
    .replace(/[省市县区]$/, "");
  if (value.endsWith("自治州")) {
    let cutAt = -1;
    for (const token of ETHNIC_TOKENS) {
      const index = value.indexOf(token);
      if (index > 0 && (cutAt < 0 || index < cutAt)) cutAt = index;
    }
    if (cutAt > 0) value = value.slice(0, cutAt);
    value = value.replace(/自治州$/, "");
  }
  return value;
}

const DEFAULT_NEW_TO_RESALE_RATIO = 1;

function validPrice(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function clampEstimateRatio(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_NEW_TO_RESALE_RATIO;
  return Math.max(0.45, Math.min(2.2, parsed));
}

function inferMarketKind(record = {}) {
  const text = `${record.priceType || ""} ${record.source || ""} ${record.quality || ""}`.toLowerCase();
  if (/new|新房|新盘|新楼盘/.test(text)) return "new";
  if (/resale|second|二手|挂牌/.test(text)) return "resale";
  return "resale";
}

function hasEstimateEvidence(record = {}, basis = "", ratio = DEFAULT_NEW_TO_RESALE_RATIO) {
  if (record.hasEstimateRatio) return true;
  if (record.estimateSampleCount > 0) return true;
  const text = String(record.estimateBasis || basis || "");
  return Boolean(text && !text.includes("暂无") && !text.includes("1:1")) && ratio !== DEFAULT_NEW_TO_RESALE_RATIO;
}

function comparableRecord(record = {}, ratio = DEFAULT_NEW_TO_RESALE_RATIO, basis = "") {
  const estimateRatio = clampEstimateRatio(ratio);
  const canEstimateNewFromResale = hasEstimateEvidence(record, basis, estimateRatio);
  const basePrice = validPrice(record.price);
  const inferredKind = inferMarketKind(record);
  let newPrice = validPrice(record.newPrice);
  let resalePrice = validPrice(record.resalePrice);
  let newPriceEstimated = Boolean(record.newPriceEstimated);
  let resalePriceEstimated = Boolean(record.resalePriceEstimated);
  const newSource = record.newSource || (!record.newPriceEstimated && inferredKind === "new" ? record.source : "");
  const newQuality = record.newQuality || (!record.newPriceEstimated && inferredKind === "new" ? record.quality : "");
  const resaleSource = record.resaleSource || (!record.resalePriceEstimated && inferredKind === "resale" ? record.source : "");
  const resaleQuality = record.resaleQuality || (!record.resalePriceEstimated && inferredKind === "resale" ? record.quality : "");

  if (!newPrice && basePrice && inferredKind === "new") {
    newPrice = basePrice;
    newPriceEstimated = false;
  }
  if (!resalePrice && basePrice && inferredKind === "resale") {
    resalePrice = basePrice;
    resalePriceEstimated = false;
  }
  if (!newPrice && resalePrice && canEstimateNewFromResale) {
    newPrice = Math.round(resalePrice * estimateRatio);
    newPriceEstimated = true;
  }
  if (!resalePrice && newPrice) {
    resalePrice = Math.round(newPrice / estimateRatio);
    resalePriceEstimated = true;
  }

  const priceType = resalePrice
    ? (resalePriceEstimated ? "resale-estimated" : "resale")
    : newPrice
      ? (newPriceEstimated ? "new-estimated" : "new")
      : "";
  const price = resalePrice || newPrice || basePrice || null;
  const primaryIsResale = Boolean(resalePrice);
  const source = primaryIsResale ? (resaleSource || record.source || "") : (newSource || record.source || "");
  const quality = primaryIsResale ? (resaleQuality || record.quality || "") : (newQuality || record.quality || "");
  const mom = primaryIsResale ? (record.resaleMom || record.mom || "--%") : (record.newMom || record.mom || "--%");
  const estimateUsed = Boolean(newPriceEstimated || resalePriceEstimated || priceType.includes("estimated"));

  return {
    ...record,
    price,
    mom,
    source,
    quality,
    priceType,
    newPrice,
    resalePrice,
    newPriceEstimated,
    resalePriceEstimated,
    estimateRatio: estimateUsed ? Number(estimateRatio.toFixed(3)) : undefined,
    hasEstimateRatio: estimateUsed && (canEstimateNewFromResale || Boolean(record.hasEstimateRatio)),
    estimateBasis: estimateUsed
      ? (record.estimateBasis || basis || (estimateRatio === 1
        ? "暂无同区新房与二手配对样本，按 1:1 近似估算"
        : "按同城或同省新房/二手房价比例估算"))
      : undefined,
    newSource,
    newQuality,
    resaleSource,
    resaleQuality,
  };
}

function specsForProvinces(provinceNames = PROVINCES.map(([name]) => name)) {
  const wanted = new Set(provinceNames.map(normalizeProvince));
  return PROVINCES.filter(([name]) => wanted.has(normalizeProvince(name))).map(([name, code]) => ({
    city: name,
    file: `data/geo/china/datav_${code}${MUNICIPALITIES.has(code) ? "" : "_full"}.json`,
  }));
}

function outlineSpecsForProvinces(provinceNames = PROVINCES.map(([name]) => name)) {
  const wanted = new Set(provinceNames.map(normalizeProvince));
  return PROVINCES.filter(([name]) => wanted.has(normalizeProvince(name))).map(([name, code]) => ({
    city: name,
    file: `data/geo/china/datav_${code}.json`,
  }));
}

function loadChinaFeatures(root, provinceNames) {
  return readGeoFeatures(root, specsForProvinces(provinceNames));
}

function loadChinaOutlines(root, provinceNames) {
  return readGeoFeatures(root, outlineSpecsForProvinces(provinceNames));
}

function createPriceLookup(data) {
  const byProvinceAndCity = new Map();
  const byCity = new Map();
  const duplicateCities = new Set();
  const cityRecords = data.cityRecords || {};
  for (const row of data.cityData || []) {
    const provinceKey = normalizeProvince(row.province);
    const cityKey = normalizeCity(row.city);
    const stored = cityRecords[row.city] || cityRecords[`${row.province}|${row.city}`];
    const record = comparableRecord(stored || {
      price: row.price,
      mom: row.mom,
      source: "禧泰数据/中国房价行情",
      quality: "城市住宅挂牌均价",
      resalePrice: row.price,
      resaleMom: row.mom,
      resaleSource: "禧泰数据/中国房价行情",
      resaleQuality: "城市住宅挂牌均价",
      dataLevel: "city",
      slug: row.slug,
    }, stored?.estimateRatio || data.metadata?.newToResaleRatio || DEFAULT_NEW_TO_RESALE_RATIO);
    record.slug = row.slug;
    byProvinceAndCity.set(`${provinceKey}|${cityKey}`, record);
    if (byCity.has(cityKey)) duplicateCities.add(cityKey);
    else byCity.set(cityKey, record);
  }

  const supplemental = [
    ["香港", "香港", 120000, "估算", "香港差估署/RVD + Centadata", "私人住宅均价折算"],
    ["澳门", "澳门", 60000, "估算", "澳门统计暨普查局", "住宅楼价指数折算"],
  ];
  for (const [province, city, price, mom, source, quality] of supplemental) {
    const record = comparableRecord({ price, mom, source, quality, supplemental: true, priceType: "resale" });
    byProvinceAndCity.set(`${normalizeProvince(province)}|${normalizeCity(city)}`, record);
  }

  return (province, city) => {
    const provinceKey = normalizeProvince(province);
    const cityKey = normalizeCity(city);
    return byProvinceAndCity.get(`${provinceKey}|${cityKey}`)
      || (!duplicateCities.has(cityKey) ? byCity.get(cityKey) : null)
      || null;
  };
}

function topicLinksHtml() {
  return TOPIC_MAPS.map(topic => `<a href="${topic.file}">${topic.title.replace("房价地图", "")}</a>`).join(" · ");
}

module.exports = {
  PROVINCES,
  TOPIC_MAPS,
  normalizeProvince,
  normalizeCity,
  comparableRecord,
  clampEstimateRatio,
  loadChinaFeatures,
  loadChinaOutlines,
  createPriceLookup,
  topicLinksHtml,
};
