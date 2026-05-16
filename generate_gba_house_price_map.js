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

const cityOutlineFiles = [
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

let mainlandData = {
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

const townPointDefs = [
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
];

let cityStats = [
  ["深圳", 70736, "+3.55%"], ["广州", 38612, "+6.04%"], ["珠海", 20138, "+3.50%"],
  ["东莞", 19421, "-2.49%"], ["佛山", 12828, "+0.71%"], ["中山", 8479, "-1.77%"],
  ["惠州", 8297, "+4.12%"], ["江门", 6984, "+0.94%"], ["肇庆", 6799, "+2.35%"],
];

let hkStats = [
  ["港岛", "159.72", "+3.03%", "1,359宗"],
  ["九龙", "154.74", "+1.80%", "3,710宗"],
  ["新界东", "171.06", "+1.11%", "1,187宗"],
  ["新界西", "140.35", "+0.62%", "1,246宗"],
];

let macauStats = [
  ["住宅楼价指数", "188.9", "按季 -1.5%"],
  ["现货住宅指数", "201.2", "按季 -1.7%"],
  ["住宅楼花指数", "240.3", "按季 +0.6%"],
];

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

function loadWeeklyData() {
  const metadata = {
    mainlandPeriod: "2026年4月挂牌",
    fetchedAt: null,
    hkPeriod: "2026/05/08公开最新",
    macauPeriod: "2026年第一季",
    source: "内置静态数据",
  };
  const dataPath = path.join(__dirname, "data", "gba_house_prices.json");
  if (!fs.existsSync(dataPath)) return metadata;
  try {
    const weekly = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    if (weekly.mainlandData) mainlandData = { ...mainlandData, ...weekly.mainlandData };
    if (Array.isArray(weekly.cityStats) && weekly.cityStats.length) cityStats = weekly.cityStats;
    if (Array.isArray(weekly.hkStats) && weekly.hkStats.length) hkStats = weekly.hkStats;
    if (Array.isArray(weekly.macauStats) && weekly.macauStats.length) macauStats = weekly.macauStats;
    return { ...metadata, ...weekly.metadata, fetchedAt: weekly.fetchedAt || weekly.updatedAt || metadata.fetchedAt };
  } catch (error) {
    console.warn(`Could not load weekly data override: ${error.message}`);
    return metadata;
  }
}

const dataMetadata = loadWeeklyData();
dataMetadata.generatedAt = new Date().toISOString();
const mainlandPeriodText = dataMetadata.mainlandPeriod || "2026年4月挂牌";
const fetchedAtText = dataMetadata.fetchedAt ? formatBeijingTime(dataMetadata.fetchedAt) : "手动整理";
const generatedAtText = formatBeijingTime(dataMetadata.generatedAt);
const hkPeriodText = dataMetadata.hkPeriod || "公开最新";
const macauPeriodText = dataMetadata.macauPeriod || "公开最新";

const supplementalData = {
  "香港|中西区": { price: 148000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03分区与面积类别均价按 1 HKD≈0.92 RMB 粗略折算，Centadata分区指数用于区域差异校准" },
  "香港|湾仔区": { price: 145000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03港岛均价折算，按区域强弱微调" },
  "香港|东区": { price: 135000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03港岛均价折算，按区域强弱微调" },
  "香港|南区": { price: 138000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03港岛均价折算，按区域强弱微调" },
  "香港|油尖旺区": { price: 140000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03九龙均价折算，按区域强弱微调" },
  "香港|九龙城区": { price: 136000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03九龙均价折算，按区域强弱微调" },
  "香港|深水埗区": { price: 124000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03九龙均价折算，按区域强弱微调" },
  "香港|黄大仙区": { price: 122000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03九龙均价折算，按区域强弱微调" },
  "香港|观塘区": { price: 126000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03九龙均价折算，按区域强弱微调" },
  "香港|荃湾区": { price: 105000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03新界均价折算，按区域强弱微调" },
  "香港|屯门区": { price: 92000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03新界西均价折算，按区域强弱微调" },
  "香港|元朗区": { price: 93000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03新界西均价折算，按区域强弱微调" },
  "香港|葵青区": { price: 98000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03新界西均价折算，按区域强弱微调" },
  "香港|离岛区": { price: 85000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03新界西均价折算，按区域强弱微调" },
  "香港|北区": { price: 105000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03新界东均价折算，按区域强弱微调" },
  "香港|大埔区": { price: 116000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03新界东均价折算，按区域强弱微调" },
  "香港|沙田区": { price: 121000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03新界东均价折算，按区域强弱微调" },
  "香港|西贡区": { price: 125000, mom: "估算", source: "香港差估署/RVD + Centadata", quality: "私人住宅均价折算", note: "RVD 2026-03新界东均价折算，按区域强弱微调" },
  "澳门|花地玛堂区": { price: 59000, mom: "-1.5%", source: "澳门统计暨普查局", quality: "住宅楼价指数折算", note: "澳门2026Q1住宅楼价指数，半岛/路氹指数用于区域差异校准" },
  "澳门|花王堂区": { price: 60000, mom: "-1.5%", source: "澳门统计暨普查局", quality: "住宅楼价指数折算", note: "澳门2026Q1住宅楼价指数，半岛/路氹指数用于区域差异校准" },
  "澳门|望德堂区": { price: 62000, mom: "-1.5%", source: "澳门统计暨普查局", quality: "住宅楼价指数折算", note: "澳门2026Q1住宅楼价指数，半岛/路氹指数用于区域差异校准" },
  "澳门|风顺堂区": { price: 65000, mom: "-1.5%", source: "澳门统计暨普查局", quality: "住宅楼价指数折算", note: "澳门2026Q1住宅楼价指数，半岛/路氹指数用于区域差异校准" },
  "澳门|大堂区": { price: 66000, mom: "-1.5%", source: "澳门统计暨普查局", quality: "住宅楼价指数折算", note: "澳门2026Q1住宅楼价指数，半岛/路氹指数用于区域差异校准" },
  "澳门|嘉模堂区": { price: 69000, mom: "-2.3%", source: "澳门统计暨普查局", quality: "住宅楼价指数折算", note: "澳门2026Q1住宅楼价指数，半岛/路氹指数用于区域差异校准" },
  "澳门|路凼填海区": { price: 72000, mom: "-2.3%", source: "澳门统计暨普查局", quality: "住宅楼价指数折算", note: "澳门2026Q1住宅楼价指数，半岛/路氹指数用于区域差异校准" },
  "澳门|圣方济各堂区": { price: 64000, mom: "-2.3%", source: "澳门统计暨普查局", quality: "住宅楼价指数折算", note: "澳门2026Q1住宅楼价指数，半岛/路氹指数用于区域差异校准" },
  "中山|小榄镇": { price: 7900, mom: "-0.89%", source: "房天下查房价", quality: "二手房参考均价", note: "2026-05二手房参考均价；与主数据来源不同，用※标记" },
  "中山|古镇镇": { price: 7819, mom: "-0.86%", source: "房天下查房价", quality: "二手房参考均价", note: "2026-05二手房参考均价；与主数据来源不同，用※标记" },
  "中山|南头镇": { price: 7121, mom: "-0.75%", source: "房天下查房价", quality: "二手房参考均价", note: "2026-05二手房参考均价；与主数据来源不同，用※标记" },
  "中山|黄圃镇": { price: 6087, mom: "-0.67%", source: "房天下查房价", quality: "二手房参考均价", note: "2026-05二手房参考均价；与主数据来源不同，用※标记" },
  "中山|民众镇": { price: 6284, mom: "+0.16%", source: "房天下查房价", quality: "二手房参考均价", note: "2026-05二手房参考均价；与主数据来源不同，用※标记" },
  "中山|民众街道": { price: 6284, mom: "+0.16%", source: "房天下查房价", quality: "二手房参考均价", note: "沿用民众镇页面口径，匹配现行街道边界" },
  "中山|阜沙镇": { price: 6017, mom: "-0.74%", source: "房天下查房价", quality: "二手房参考均价", note: "2026-05二手房参考均价；与主数据来源不同，用※标记" },
  "中山|大涌镇": { price: 5637, mom: "-0.67%", source: "房天下查房价", quality: "二手房参考均价", note: "2026-05二手房参考均价；与主数据来源不同，用※标记" },
  "中山|神湾镇": { price: 5869, mom: "+0.63%", source: "房天下查房价", quality: "二手房参考均价", note: "2026-05二手房参考均价；与主数据来源不同，用※标记" },
  "中山|五桂山街道": { price: 11720, mom: "-0.98%", source: "房天下查房价", quality: "二手房参考均价", note: "2026-04二手房参考均价；房天下仍使用五桂山镇名称，匹配街道边界" },
};

function getPriceRecord(city, name) {
  const key = `${city}|${name}`;
  const primary = mainlandData[key];
  if (primary) {
    return {
      price: primary[0],
      mom: primary[1],
      source: "禧泰数据/中国房价行情",
      quality: "住宅挂牌均价",
      note: mainlandPeriodText,
      supplemental: false,
    };
  }
  const extra = supplementalData[key];
  if (!extra) return null;
  return { ...extra, supplemental: true };
}

function allPriceEntries() {
  const keys = new Set([...Object.keys(mainlandData), ...Object.keys(supplementalData)]);
  return [...keys]
    .map(key => {
      const [city, name] = key.split("|");
      const record = getPriceRecord(city, name);
      return record ? [key, record] : null;
    })
    .filter(Boolean);
}

function sourceMark(record) {
  return record?.supplemental ? "※" : "";
}

const townPoints = townPointDefs.map(([city, name, lon, lat], index) => {
  const record = getPriceRecord(city, name);
  return { id: `p${index}`, city, name, lon, lat, price: record?.price || null, mom: record?.mom || "", source: record?.source || "", supplemental: Boolean(record?.supplemental) };
});

const W = 1800;
const H = 1320;
const mapBox = { x: 64, y: 198, w: 1120, h: 920 };
const breaks = [0, 8000, 12000, 18000, 30000, 50000, 80000, 120000, 180000];
const colors = ["#2b6cb0", "#4fa3c8", "#8fd0d0", "#f2e6a7", "#f3a05f", "#d95845", "#9e1f2f", "#64152d"];

function legendLabel(index) {
  if (index === 0) return `<${fmtWanNumber(breaks[1])}万`;
  if (index === colors.length - 1) return `${fmtWanNumber(breaks[index])}万+`;
  return `${fmtWanNumber(breaks[index])}-${fmtWanNumber(breaks[index + 1])}万`;
}

function polygonBbox(poly) {
  const coords = poly.flat(1);
  const lons = coords.map(pt => pt[0]);
  const lats = coords.map(pt => pt[1]);
  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

function polygonGroupCenter(polygons) {
  const coords = polygons.flat(2);
  const lons = coords.map(pt => pt[0]);
  const lats = coords.map(pt => pt[1]);
  return [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}

function splitShenzhenFunctionalAreas(feature) {
  if (feature.properties.name !== "龙岗区" || feature.geometry.type !== "MultiPolygon") return [feature];
  const longgang = [];
  const dapeng = [];
  for (const poly of feature.geometry.coordinates) {
    const bbox = polygonBbox(poly);
    if (bbox.maxLon > 114.42 && bbox.minLat < 22.56) dapeng.push(poly);
    else longgang.push(poly);
  }
  if (!longgang.length || !dapeng.length) return [feature];
  return [
    {
      ...feature,
      properties: { ...feature.properties, center: polygonGroupCenter(longgang) },
      geometry: { type: "MultiPolygon", coordinates: longgang },
    },
    {
      ...feature,
      properties: { ...feature.properties, name: "大鹏新区", sourceName: "龙岗区", level: "functional", showName: true, center: polygonGroupCenter(dapeng) },
      geometry: { type: "MultiPolygon", coordinates: dapeng },
    },
  ];
}

function readGeo(city, file) {
  const geo = JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8"));
  const features = [];
  for (const f of geo.features) {
    f.properties.city = city;
    if (city === "东莞") f.properties.name = "东莞市";
    if (city === "中山") f.properties.name = "中山市";
    features.push(...(city === "深圳" ? splitShenzhenFunctionalAreas(f) : [f]));
  }
  return features;
}

function readCityOutline(city, file) {
  const sourcePath = path.join(__dirname, file);
  if (!fs.existsSync(sourcePath)) return [];
  const geo = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  return geo.features.map(f => ({
    ...f,
    properties: { ...f.properties, city, name: city },
  }));
}

function cleanAdminName(name) {
  return name
    .replace(/街道办事处$/, "街道")
    .replace(/高技术产业开发区$/, "开发区")
    .replace(/新区$/, "")
    .replace(/街道|镇|区|市|园区/g, "");
}

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
    while (unused.length && guard++ < 500) {
      const end = pointKey(ring[ring.length - 1]);
      const start = pointKey(ring[0]);
      if (end === start) break;
      const idx = unused.findIndex(seg => pointKey(seg[0]) === end || pointKey(seg[seg.length - 1]) === end);
      if (idx === -1) break;
      const next = unused.splice(idx, 1)[0];
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
  const sourcePath = path.join(__dirname, file);
  if (!fs.existsSync(sourcePath)) return [];
  const osm = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  return osm.elements
    .filter(el => el.type === "relation" && el.tags?.boundary === "administrative" && el.tags?.admin_level === "8")
    .map(el => {
      const segments = el.members
        .filter(m => m.type === "way" && m.role === "outer" && Array.isArray(m.geometry))
        .map(m => m.geometry.map(p => [p.lon, p.lat]));
      const rings = stitchRings(segments);
      if (!rings.length) return null;
      const name = townDisplayName(city, el.tags.name);
      const labelNode = el.members.find(m => m.role === "label" && Number.isFinite(m.lon) && Number.isFinite(m.lat));
      return {
        type: "Feature",
        properties: {
          adcode: el.id,
          city,
          name,
          sourceName: el.tags.name,
          level: "town",
          centroid: labelNode ? [labelNode.lon, labelNode.lat] : [(el.bounds.minlon + el.bounds.maxlon) / 2, (el.bounds.minlat + el.bounds.maxlat) / 2],
        },
        geometry: { type: "MultiPolygon", coordinates: rings.map(ring => [ring]) },
      };
    })
    .filter(Boolean);
}

const baseFeatures = cityFiles.flatMap(([city, file]) => readGeo(city, file));
const townBoundaryFeatures = [
  ...readOsmTownBoundaries("东莞", "osm_dongguan_boundaries.json"),
  ...readOsmTownBoundaries("中山", "osm_zhongshan_boundaries.json"),
];
const features = baseFeatures
  .filter(f => !["东莞", "中山"].includes(f.properties.city))
  .concat(townBoundaryFeatures);
const cityOutlineFeatures = cityOutlineFiles.flatMap(([city, file]) => readCityOutline(city, file));

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
const projectedMapBounds = {
  minX: ox,
  minY: oy - (maxY - minY) * scale,
  maxX: ox + (maxX - minX) * scale,
  maxY: oy,
};
const mapViewPadding = 82;
const mapViewBox = {
  x: Math.max(0, projectedMapBounds.minX - mapViewPadding),
  y: Math.max(0, projectedMapBounds.minY - mapViewPadding),
  w: Math.min(W, projectedMapBounds.maxX + mapViewPadding) - Math.max(0, projectedMapBounds.minX - mapViewPadding),
  h: Math.min(H, projectedMapBounds.maxY + mapViewPadding) - Math.max(0, projectedMapBounds.minY - mapViewPadding),
};

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
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToSegment(point, a, b) {
  const x = point[0], y = point[1];
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

function bestLabelPoint(f) {
  const geom = f.geometry;
  const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
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
  if (!bestRing) return centroidOfFeature(f);
  const xs = bestRing.map(p => p[0]);
  const ys = bestRing.map(p => p[1]);
  const bbox = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  const candidates = [ringCentroid(bestRing), [(bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2]];
  const steps = 10;
  for (let ix = 1; ix < steps; ix++) {
    for (let iy = 1; iy < steps; iy++) {
      candidates.push([
        bbox.minX + (bbox.maxX - bbox.minX) * ix / steps,
        bbox.minY + (bbox.maxY - bbox.minY) * iy / steps,
      ]);
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
    score: Number(bestScore.toFixed(2)),
  }];
}

function centroidOfFeature(f) {
  const c = f.properties.centroid || f.properties.center || cityCenters[f.properties.city];
  return project(c);
}

function colorFor(v) {
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

function fmtWanNumber(v) {
  return Number((Number(v) / 10000).toFixed(1)).toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}

function fmtWanLabel(v) {
  return `${fmtWanNumber(v)}万`;
}

const topDistricts = allPriceEntries()
  .map(([k, record]) => {
    const [city, name] = k.split("|");
    return { city, name, price: record.price, mom: record.mom, supplemental: record.supplemental };
  })
  .sort((a, b) => b.price - a.price)
  .slice(0, 12);
const maxCityPrice = Math.max(...cityStats.map(([, price]) => price), 1);

const sourceNotes = [
  `主数据：禧泰数据/中国房价行情，内地住宅挂牌均价，${mainlandPeriodText}；最近抓取 ${fetchedAtText}。`,
  "※补充：香港按差估署RVD私宅均价与Centadata分区指数折算；澳门按统计暨普查局住宅楼价指数折算；中山缺口镇街用房天下二手房参考均价。",
  "城市边界：深色线为9+2城市范围；白线为区县/镇街边界。大鹏新区按功能区从龙岗区面中单列。"
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
    .label { font-size: 20px; font-weight: 900; fill: #0e5261; paint-order: stroke; stroke: rgba(255,255,255,.88); stroke-width: 5px; stroke-linejoin: round; }
    .price { font-size: 14px; font-weight: 800; fill: #26383f; paint-order: stroke; stroke: rgba(255,255,255,.9); stroke-width: 3.4px; }
    .supplement { fill: #6f2f5f; }
    .panelTitle { font-size: 26px; font-weight: 800; fill: #1c2f36; }
    .num { font-size: 26px; font-weight: 800; fill: #173864; }
  </style>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<path d="M0 1040 C330 980 520 1110 860 1040 S1390 910 1800 1020 L1800 1320 L0 1320Z" fill="#e8f1ec" opacity=".78"/>
<text x="64" y="82" font-size="44" font-weight="900">粤港澳大湾区房价地图</text>
<text x="64" y="122" class="small">9+2 城市，区县/镇街可得数据；面内标签单位：万/㎡，※为补充口径</text>
<text x="64" y="154" class="tiny">数据更新：内地 ${esc(mainlandPeriodText)}；港澳 ${esc(hkPeriodText)} / ${esc(macauPeriodText)}。抓取：${esc(fetchedAtText)}；生成：${esc(generatedAtText)}</text>
<g filter="url(#softShadow)"><rect x="38" y="178" width="1180" height="990" rx="20" fill="#ffffff" opacity=".84"/></g>
<rect x="38" y="178" width="1180" height="990" rx="20" fill="#ffffff" opacity=".7" stroke="#dbe6e3"/>
`;

for (const f of features) {
  const key = `${f.properties.city}|${f.properties.name}`;
  const record = getPriceRecord(f.properties.city, f.properties.name);
  svg += `<path d="${geomToPath(f.geometry)}" fill="${colorFor(record?.price)}" stroke="#ffffff" stroke-width="1.15" opacity="${record ? 0.96 : 0.64}"/>`;
}

for (const f of cityOutlineFeatures) {
  svg += `<path d="${geomToPath(f.geometry)}" fill="none" stroke="#163f49" stroke-width="2.6" opacity=".72"/>`;
}

for (const [city, center] of Object.entries(cityCenters)) {
  const [x, y] = project(center);
  svg += `<text x="${x}" y="${y}" class="label" text-anchor="middle">${esc(city)}</text>`;
}

for (const f of features) {
  const key = `${f.properties.city}|${f.properties.name}`;
  const record = getPriceRecord(f.properties.city, f.properties.name);
  if (!record && !f.properties.showName) continue;
  const [x, y] = centroidOfFeature(f);
  if (record && record.price < 9000 && !["东莞市", "中山市"].includes(f.properties.name)) continue;
  const label = `${cleanAdminName(f.properties.name)}${record ? ` ${fmtWanLabel(record.price)}${sourceMark(record)}` : ""}`;
  svg += `<text x="${x}" y="${y + 18}" class="price${record?.supplemental ? " supplement" : ""}" text-anchor="middle">${esc(label)}</text>`;
}

const lx = 80, ly = 1062;
svg += `<g>
<text x="${lx}" y="${ly - 24}" font-size="22" font-weight="800">色阶：住宅均价（万/㎡）</text>`;
for (let i = 0; i < colors.length; i++) {
  const x = lx + i * 92;
  const label = legendLabel(i);
  svg += `<rect x="${x}" y="${ly}" width="82" height="22" rx="4" fill="${colors[i]}"/><text x="${x}" y="${ly + 46}" class="tiny">${label}</text>`;
}
svg += `</g>`;

svg += `<g transform="translate(1246 178)" filter="url(#softShadow)"><rect width="508" height="990" rx="20" fill="#ffffff"/></g>
<g transform="translate(1246 178)">
<rect width="508" height="990" rx="20" fill="#ffffff" stroke="#dbe6e3"/>
<text x="34" y="58" class="panelTitle">城市均价排行</text>
<text x="34" y="88" class="tiny">内地9市，住宅挂牌均价</text>`;
cityStats.forEach(([city, price, mom], i) => {
  const y = 128 + i * 52;
  const w = 260 * price / maxCityPrice;
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
  svg += `<text x="${x}" y="${y}" font-size="18" font-weight="800">${i + 1}. ${d.city}${d.name.replace(d.city, "")}${d.supplemental ? "※" : ""}</text><text x="${x}" y="${y + 21}" class="tiny">${fmt(d.price)} 元/㎡ ${d.mom}</text>`;
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
  const record = getPriceRecord(f.properties.city, f.properties.name);
  const price = record?.price || null;
  const mom = record?.mom || "";
  const [cx, cy, labelBox] = bestLabelPoint(f);
  const cleanName = cleanAdminName(f.properties.name);
  const minLabelScale = price
    ? Math.max(2.0, Math.min(5.5, ((cleanName.length + 4) * 7) / Math.max(10, Math.min(labelBox.w, labelBox.h * 2))))
    : f.properties.showName
      ? 2.1
    : 99;
  return {
    id: `r${index}`,
    city: f.properties.city,
    name: f.properties.name,
    label: cleanName,
    price,
    mom,
    source: record?.source || "",
    quality: record?.quality || "",
    note: record?.note || "",
    supplemental: Boolean(record?.supplemental),
    showName: Boolean(f.properties.showName),
    d: geomToPath(f.geometry),
    cx: Number(cx.toFixed(2)),
    cy: Number(cy.toFixed(2)),
    labelMinScale: Number(minLabelScale.toFixed(2)),
    fill: colorFor(price),
  };
});
const interactiveCityBoundaries = cityOutlineFeatures.map((f, index) => ({
  id: `c${index}`,
  city: f.properties.city,
  d: geomToPath(f.geometry),
}));
const interactivePoints = [];

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
    --overlay-opacity: .62;
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
  .mapShell { position: relative; overflow: hidden; min-height: calc(100vh - 48px); overscroll-behavior: contain; }
  header { position: absolute; z-index: 3; left: 26px; top: 22px; pointer-events: none; }
  h1 { margin: 0; font-size: 34px; letter-spacing: 0; }
  header p { margin: 8px 0 0; color: var(--muted); font-size: 14px; }
  header .updateLine { margin-top: 5px; font-size: 12px; color: #63767a; }
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
  button.active { border-color: #2f89a6; background: #edf7f6; color: #1f6677; font-weight: 800; }
  svg { width: 100%; height: calc(100vh - 48px); display: block; cursor: grab; touch-action: none; user-select: none; }
  svg.dragging { cursor: grabbing; }
  .region { stroke: #fff; stroke-width: 1.2; vector-effect: non-scaling-stroke; transition: opacity .15s, stroke-width .15s, filter .15s, fill-opacity .15s; }
  .region:hover, .region.active { stroke: #102a33; stroke-width: 2.8; filter: drop-shadow(0 5px 8px rgba(25,55,65,.25)); }
  .mapTilesOn .region { fill-opacity: var(--overlay-opacity); stroke-opacity: .88; }
  .mapTilesOn .cityLabel, .mapTilesOn .detailLabel { stroke: rgba(255,255,255,.95); }
  .cityBoundary { fill: none; stroke: #153f49; stroke-width: 2.1; vector-effect: non-scaling-stroke; pointer-events: none; opacity: .7; }
  .mapTilesOn .cityBoundary { stroke-opacity: .86; }
  .townPoint { stroke: #fff; stroke-width: 2; vector-effect: non-scaling-stroke; cursor: pointer; filter: drop-shadow(0 3px 5px rgba(25,55,65,.25)); }
  .townPoint:hover, .townPoint.active { stroke: #102a33; stroke-width: 3; }
  .dimmed { opacity: .18; }
  .cityLabel { font-size: 17px; font-weight: 900; fill: #0c5261; paint-order: stroke; stroke: rgba(255,255,255,.88); stroke-width: 4.4px; pointer-events: none; }
  .detailLabel { display: none; font-size: 8.2px; font-weight: 800; fill: #25363d; paint-order: stroke; stroke: rgba(255,255,255,.94); stroke-width: 2px; pointer-events: none; }
  .detailLabel.supplementalLabel { fill: #6f2f5f; }
  .tileImage { opacity: .78; }
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
  .swatches { display: flex; gap: 6px; align-items: center; }
  .swatch { width: 58px; height: 16px; border-radius: 4px; }
  .legendLabels { display: grid; grid-template-columns: repeat(${colors.length}, 58px); gap: 6px; margin-top: 6px; color: var(--muted); font-size: 10.5px; white-space: nowrap; }
  .tileAttribution {
    position: absolute;
    right: 18px;
    bottom: 16px;
    z-index: 4;
    display: none;
    background: rgba(255,255,255,.82);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 5px 8px;
    color: var(--muted);
    font-size: 11px;
  }
  .mapTilesOn .tileAttribution { display: block; }
  .overlayControl {
    position: absolute;
    right: 18px;
    top: 62px;
    z-index: 4;
    display: none;
    align-items: center;
    gap: 8px;
    width: 272px;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: rgba(255,255,255,.88);
    box-shadow: 0 10px 24px rgba(37, 70, 80, .10);
    color: var(--ink);
    font-size: 12px;
    font-weight: 800;
  }
  .mapTilesOn .overlayControl { display: flex; }
  .overlayControl input { flex: 1; accent-color: var(--brand); }
  .overlayControl span { min-width: 34px; text-align: right; color: var(--muted); font-weight: 700; }
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
  .sortBar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }
  .sortBar button {
    height: 32px;
    padding: 0 8px;
    font-size: 13px;
  }
  .sortBar button.active {
    border-color: #2f89a6;
    background: #edf7f6;
    color: #1f6677;
    font-weight: 800;
  }
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
  .sourceMark { color: #7d3569; font-weight: 900; margin-left: 3px; }
  .up { color: #087b60; }
  .down { color: #bd4c45; }
  .notes { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 14px; color: var(--muted); font-size: 12px; line-height: 1.7; }
  @media (max-width: 1100px) {
    .app { grid-template-columns: 1fr; }
    .mapShell { min-height: 72vh; }
    svg { height: 72vh; }
    .side { max-height: none; }
  }
  @media (max-width: 760px) {
    .app { padding: 8px; gap: 10px; }
    .mapShell { min-height: 72svh; border-radius: 10px; }
    header { left: 12px; right: 12px; top: 12px; }
    h1 { font-size: 23px; line-height: 1.15; }
    header p { margin-top: 5px; font-size: 12px; line-height: 1.35; max-width: calc(100vw - 48px); }
    header .updateLine { font-size: 11px; }
    .toolbar {
      left: 12px;
      right: 12px;
      top: 96px;
      justify-content: flex-start;
      flex-wrap: wrap;
      gap: 6px;
    }
    button { height: 32px; padding: 0 9px; font-size: 13px; }
    .overlayControl {
      left: 12px;
      right: 12px;
      top: 168px;
      width: auto;
    }
    svg { height: 72svh; }
    .legend { left: 12px; bottom: 12px; padding: 10px; border-radius: 10px; max-width: calc(100vw - 40px); }
    .swatch { width: 36px; }
    .legendLabels { grid-template-columns: repeat(${colors.length}, 36px); gap: 5px; font-size: 9px; }
    .tileAttribution { right: 12px; bottom: 10px; font-size: 10px; }
    .side { padding: 14px; border-radius: 10px; }
    .sortBar { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>
<main class="app">
  <section class="mapShell">
    <header>
      <h1>粤港澳大湾区房价地图</h1>
      <p>拖拽移动，滚轮缩放；悬停或点击区县查看详细数据</p>
      <p class="updateLine">内地数据：${esc(mainlandPeriodText)}；最近抓取：${esc(fetchedAtText)}</p>
    </header>
    <div class="toolbar">
      <button id="zoomIn">放大</button>
      <button id="zoomOut">缩小</button>
      <button id="reset">重置</button>
      <button id="toggleLabels">城市名</button>
      <button id="toggleTiles">真实地图</button>
    </div>
    <div class="overlayControl" id="overlayControl">
      <label for="overlayOpacity">房价图层</label>
      <input id="overlayOpacity" type="range" min="0" max="100" value="62">
      <span id="overlayOpacityValue">62%</span>
    </div>
    <svg id="map" viewBox="${mapViewBox.x.toFixed(2)} ${mapViewBox.y.toFixed(2)} ${mapViewBox.w.toFixed(2)} ${mapViewBox.h.toFixed(2)}" aria-label="粤港澳大湾区房价地图">
      <g id="viewport">
        <g id="tileLayer"></g>
        ${interactiveRegions.map(r => `<path id="${r.id}" class="region" data-city="${esc(r.city)}" data-name="${esc(r.name)}" data-price="${r.price ?? ""}" data-mom="${esc(r.mom)}" data-source="${esc(r.source)}" d="${r.d}" fill="${r.fill}"></path>`).join("\n")}
        <g id="cityBoundaries">
          ${interactiveCityBoundaries.map(r => `<path id="${r.id}" class="cityBoundary" d="${r.d}"></path>`).join("\n")}
        </g>
        <g id="cityLabels">
          ${Object.entries(cityCenters).map(([city, center]) => {
            const [x, y] = project(center);
            return `<text class="cityLabel" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${esc(city)}</text>`;
          }).join("\n")}
        </g>
        <g id="detailLabels">
          ${interactiveRegions.filter(r => r.price || r.showName).map(r => `<text class="detailLabel${r.supplemental ? " supplementalLabel" : ""}" x="${r.cx}" y="${r.cy}" data-min-scale="${r.labelMinScale}" text-anchor="middle">${esc(r.label)}${r.price ? ` ${fmtWanLabel(r.price)}${r.supplemental ? "※" : ""}` : ""}</text>`).join("\n")}
          ${interactivePoints.filter(p => p.price).map(p => `<text class="detailLabel${p.supplemental ? " supplementalLabel" : ""}" x="${p.x}" y="${p.y - 12}" text-anchor="middle">${esc(p.name.replace(/[区县市镇]/g, ""))} ${fmtWanLabel(p.price)}${p.supplemental ? "※" : ""}</text>`).join("\n")}
        </g>
        <g id="townPoints">
          ${interactivePoints.map(p => `<circle id="${p.id}" class="townPoint" data-city="${esc(p.city)}" data-name="${esc(p.name)}" data-price="${p.price ?? ""}" data-mom="${esc(p.mom)}" cx="${p.x}" cy="${p.y}" r="6" fill="${p.fill}"></circle>`).join("\n")}
        </g>
      </g>
    </svg>
    <div class="legend">
      <div class="legendTitle">住宅均价（万/㎡）</div>
      <div class="swatches">${colors.map(c => `<span class="swatch" style="background:${c}"></span>`).join("")}</div>
      <div class="legendLabels">${colors.map((_, index) => `<span>${esc(legendLabel(index))}</span>`).join("")}</div>
    </div>
    <div class="tileAttribution">地图 © OpenStreetMap contributors</div>
  </section>
  <aside class="side">
    <h2>区县/城市数据</h2>
    <p class="caption">主数据为 ${esc(mainlandPeriodText)}住宅挂牌均价；※为不同来源补充估算。东莞/中山按镇街边界呈现。</p>
    <input id="search" class="search" placeholder="搜索城市或区县，如 南山、广州、东莞">
    <div class="sortBar" aria-label="排序">
      <button data-sort="priceDesc" class="active">价格高</button>
      <button data-sort="priceAsc">价格低</button>
      <button data-sort="momDesc">涨幅高</button>
      <button data-sort="momAsc">跌幅高</button>
      <button data-sort="city">按城市</button>
      <button data-sort="name">按名称</button>
    </div>
    <div id="selected" class="selected">
      <div class="name">点击或悬停地图区域</div>
      <div class="meta">可查看房价、环比和数据口径。</div>
    </div>
    <div id="rows" class="rows"></div>
    <div class="notes">
      <b>更新：</b>GitHub Actions 每周一 04:00（北京时间）尝试拉取内地数据；页面生成 ${esc(generatedAtText)}。<br>
      <b>※口径：</b>香港按差估署RVD私宅均价与Centadata分区指数折算；澳门按统计暨普查局住宅楼价指数折算；中山缺口镇街用房天下二手房参考均价。<br>
      <b>边界：</b>深色线为城市范围，白线为区县/镇街边界；东莞、中山没有县级区划，已按 OSM 镇街边界展示。<br>
      <b>深圳：</b>大鹏新区是功能区，已从龙岗区面中单列；房价源未单列时显示边界但不进列表。<br>
      <b>底图：</b>阿里云 DataV.GeoAtlas 与 OSM 边界，真实地图来自 OpenStreetMap。
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
const mapShell = document.querySelector('.mapShell');
const tileLayer = document.getElementById('tileLayer');
const overlayOpacityInput = document.getElementById('overlayOpacity');
const overlayOpacityValue = document.getElementById('overlayOpacityValue');
const tooltip = document.getElementById('tooltip');
const selected = document.getElementById('selected');
const rows = document.getElementById('rows');
const search = document.getElementById('search');
let state = { scale: 1, x: 0, y: 0 };
let dragging = false;
let last = null;
let activePointers = new Map();
let pinch = null;
let activeId = null;
let labelsVisible = true;
let sortMode = 'priceDesc';
let tilesVisible = false;
let overlayOpacity = Number(overlayOpacityInput.value) / 100;
const projection = {
  minX: ${minX},
  minY: ${minY},
  maxX: ${maxX},
  maxY: ${maxY},
  scale: ${scale},
  ox: ${ox},
  oy: ${oy}
};
const mapBounds = ${JSON.stringify(projectedMapBounds)};

function fmt(value) {
  return Number(value).toLocaleString('zh-CN');
}
function fmtWan(value) {
  return Number((Number(value) / 10000).toFixed(1)).toLocaleString('zh-CN', { maximumFractionDigits: 1 }) + '万/㎡';
}
function applyOverlayOpacity() {
  document.documentElement.style.setProperty('--overlay-opacity', overlayOpacity.toFixed(2));
  overlayOpacityValue.textContent = Math.round(overlayOpacity * 100) + '%';
}
function applyCityLabelVisibility() {
  const cityLabels = document.getElementById('cityLabels');
  cityLabels.style.display = labelsVisible && state.scale < 2.55 ? '' : 'none';
}
function clientToSvg(clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
function svgToContent(point) {
  return {
    x: (point.x - state.x) / state.scale,
    y: (point.y - state.y) / state.scale,
  };
}
function svgVisibleBox() {
  const rect = svg.getBoundingClientRect();
  const corners = [
    clientToSvg(rect.left, rect.top),
    clientToSvg(rect.right, rect.top),
    clientToSvg(rect.right, rect.bottom),
    clientToSvg(rect.left, rect.bottom),
  ];
  return {
    minX: Math.min(...corners.map(p => p.x)),
    maxX: Math.max(...corners.map(p => p.x)),
    minY: Math.min(...corners.map(p => p.y)),
    maxY: Math.max(...corners.map(p => p.y)),
  };
}
function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function clampPan() {
  const view = svgVisibleBox();
  const viewW = view.maxX - view.minX;
  const viewH = view.maxY - view.minY;
  const padX = Math.min(90, viewW * 0.16);
  const padY = Math.min(90, viewH * 0.16);
  const mapW = (mapBounds.maxX - mapBounds.minX) * state.scale;
  const mapH = (mapBounds.maxY - mapBounds.minY) * state.scale;
  const centerX = (view.minX + view.maxX - (mapBounds.minX + mapBounds.maxX) * state.scale) / 2;
  const centerY = (view.minY + view.maxY - (mapBounds.minY + mapBounds.maxY) * state.scale) / 2;
  if (mapW <= viewW - padX * 2) {
    state.x = centerX;
  } else {
    state.x = clampValue(
      state.x,
      view.maxX - padX - mapBounds.maxX * state.scale,
      view.minX + padX - mapBounds.minX * state.scale
    );
  }
  if (mapH <= viewH - padY * 2) {
    state.y = centerY;
  } else {
    state.y = clampValue(
      state.y,
      view.maxY - padY - mapBounds.maxY * state.scale,
      view.minY + padY - mapBounds.minY * state.scale
    );
  }
}
function mercatorToLat(y) {
  return (Math.atan(Math.exp(y * Math.PI / 180)) * 2 - Math.PI / 2) * 180 / Math.PI;
}
function svgToLonLat(x, y) {
  const lon = (x - projection.ox) / projection.scale + projection.minX;
  const mercY = projection.minY + (projection.oy - y) / projection.scale;
  return [lon, mercatorToLat(mercY)];
}
function projectLonLat(lon, lat) {
  const rad = lat * Math.PI / 180;
  const mercY = Math.log(Math.tan(Math.PI / 4 + rad / 2)) * 180 / Math.PI;
  return {
    x: projection.ox + (lon - projection.minX) * projection.scale,
    y: projection.oy - (mercY - projection.minY) * projection.scale,
  };
}
function lonToTileX(lon, z) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, z));
}
function latToTileY(lat, z) {
  const rad = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, z));
}
function tileXToLon(x, z) {
  return x / Math.pow(2, z) * 360 - 180;
}
function tileYToLat(y, z) {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
  return Math.atan(Math.sinh(n)) * 180 / Math.PI;
}
function visibleContentBounds() {
  const view = svgVisibleBox();
  const corners = [
    { x: view.minX, y: view.minY },
    { x: view.maxX, y: view.minY },
    { x: view.maxX, y: view.maxY },
    { x: view.minX, y: view.maxY },
  ].map(svgToContent);
  return {
    minX: Math.min(...corners.map(p => p.x)),
    maxX: Math.max(...corners.map(p => p.x)),
    minY: Math.min(...corners.map(p => p.y)),
    maxY: Math.max(...corners.map(p => p.y)),
  };
}
function updateTiles() {
  if (!tilesVisible) {
    tileLayer.innerHTML = '';
    return;
  }
  const b = visibleContentBounds();
  const nw = svgToLonLat(b.minX, b.minY);
  const se = svgToLonLat(b.maxX, b.maxY);
  const west = Math.max(-180, Math.min(nw[0], se[0]));
  const east = Math.min(180, Math.max(nw[0], se[0]));
  const north = Math.max(-85, Math.min(85, Math.max(nw[1], se[1])));
  const south = Math.max(-85, Math.min(85, Math.min(nw[1], se[1])));
  let z = Math.max(8, Math.min(14, Math.round(9.5 + Math.log2(state.scale))));
  let x0 = lonToTileX(west, z), x1 = lonToTileX(east, z);
  let y0 = latToTileY(north, z), y1 = latToTileY(south, z);
  while ((x1 - x0 + 1) * (y1 - y0 + 1) > 72 && z > 7) {
    z -= 1;
    x0 = lonToTileX(west, z); x1 = lonToTileX(east, z);
    y0 = latToTileY(north, z); y1 = latToTileY(south, z);
  }
  const n = Math.pow(2, z);
  const tiles = [];
  for (let x = Math.max(0, x0 - 1); x <= Math.min(n - 1, x1 + 1); x++) {
    for (let y = Math.max(0, y0 - 1); y <= Math.min(n - 1, y1 + 1); y++) {
      const lon1 = tileXToLon(x, z);
      const lon2 = tileXToLon(x + 1, z);
      const lat1 = tileYToLat(y, z);
      const lat2 = tileYToLat(y + 1, z);
      const p1 = projectLonLat(lon1, lat1);
      const p2 = projectLonLat(lon2, lat2);
      tiles.push('<image class="tileImage" href="https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png" x="' + p1.x + '" y="' + p1.y + '" width="' + (p2.x - p1.x) + '" height="' + (p2.y - p1.y) + '" preserveAspectRatio="none"></image>');
    }
  }
  tileLayer.innerHTML = tiles.join('');
}
function applyTransform() {
  clampPan();
  viewport.setAttribute('transform', 'translate(' + state.x + ' ' + state.y + ') scale(' + state.scale + ')');
  const inverse = 1 / state.scale;
  document.querySelectorAll('.detailLabel, .cityLabel').forEach(label => {
    const x = Number(label.getAttribute('x'));
    const y = Number(label.getAttribute('y'));
    label.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + inverse + ') translate(' + -x + ' ' + -y + ')');
  });
  document.querySelectorAll('.detailLabel').forEach(label => {
    const min = Number(label.dataset.minScale || 2.2);
    label.style.display = state.scale >= min ? 'block' : 'none';
  });
  applyCityLabelVisibility();
  updateTiles();
}
function zoom(factor, clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const anchor = clientToSvg(clientX ?? (rect.left + rect.width / 2), clientY ?? (rect.top + rect.height / 2));
  const content = svgToContent(anchor);
  const nextScale = Math.max(0.7, Math.min(7, state.scale * factor));
  state.x = anchor.x - content.x * nextScale;
  state.y = anchor.y - content.y * nextScale;
  state.scale = nextScale;
  applyTransform();
}
function pointerDistance(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
function pointerMidpoint(a, b) {
  return {
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2,
  };
}
function beginPinch() {
  const points = [...activePointers.values()];
  if (points.length < 2) {
    pinch = null;
    return;
  }
  const center = pointerMidpoint(points[0], points[1]);
  const anchor = clientToSvg(center.clientX, center.clientY);
  pinch = {
    distance: Math.max(1, pointerDistance(points[0], points[1])),
    scale: state.scale,
    content: svgToContent(anchor),
  };
}
function endPointer(event) {
  if (activePointers.has(event.pointerId)) {
    activePointers.delete(event.pointerId);
    if (svg.releasePointerCapture) {
      try { svg.releasePointerCapture(event.pointerId); } catch (_) {}
    }
  }
  if (activePointers.size === 1) {
    const [remaining] = activePointers.values();
    last = clientToSvg(remaining.clientX, remaining.clientY);
    dragging = true;
    pinch = null;
  } else {
    dragging = false;
    pinch = null;
    svg.classList.remove('dragging');
  }
}
function selectRegion(id, center = false) {
  activeId = id;
  hideTip();
  document.querySelectorAll('.region').forEach(el => el.classList.toggle('active', el.id === id));
  document.querySelectorAll('.townPoint').forEach(el => el.classList.toggle('active', el.id === id));
  document.querySelectorAll('.row').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  const r = places.find(item => item.id === id);
  if (!r) return;
  const isMainland = !['香港', '澳门'].includes(r.city);
  const sourceLine = r.source ? (r.supplemental ? '※ ' : '') + r.source + (r.quality ? ' · ' + r.quality : '') : '暂无单列口径';
  selected.innerHTML = '<div class="name">' + r.city + ' ' + r.name + '</div>' +
    (r.price ? '<div class="price">' + fmt(r.price) + ' 元/㎡</div><div class="meta">约 ' + fmtWan(r.price) + ' · 环比 ' + r.mom + '</div><div class="meta">' + sourceLine + '</div>' : isMainland ? '<div class="meta">暂无单列房价数据；已按功能区或镇街边界展示。</div>' : '<div class="meta">暂无可比房价估算。</div>');
  if (center) {
    state.scale = Math.max(state.scale, 2.3);
    const cx = r.cx ?? r.x;
    const cy = r.cy ?? r.y;
    const rect = svg.getBoundingClientRect();
    const centerPoint = clientToSvg(rect.left + rect.width / 2, rect.top + rect.height / 2);
    state.x = centerPoint.x - cx * state.scale;
    state.y = centerPoint.y - cy * state.scale;
    applyTransform();
  }
}
function showTip(event, r) {
  tooltip.style.display = 'block';
  tooltip.style.left = event.clientX + 'px';
  tooltip.style.top = event.clientY + 'px';
  const sourceLine = r.source ? ' · ' + (r.supplemental ? '※' : '') + r.source : '';
  tooltip.innerHTML = '<strong>' + r.city + ' ' + r.name + '</strong>' +
    (r.price ? '<span>' + fmt(r.price) + ' 元/㎡ · 约 ' + fmtWan(r.price) + ' · 环比 ' + r.mom + sourceLine + '</span>' : !['香港', '澳门'].includes(r.city) ? '<span>暂无单列房价数据，已单列边界</span>' : '<span>暂无可比房价估算</span>');
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
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  if (svg.setPointerCapture) svg.setPointerCapture(event.pointerId);
  activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
  if (activePointers.size >= 2) {
    dragging = false;
    beginPinch();
  } else {
    dragging = true;
    last = clientToSvg(event.clientX, event.clientY);
  }
  svg.classList.add('dragging');
});
window.addEventListener('pointermove', event => {
  if (activePointers.has(event.pointerId)) {
    activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
  }
  if (activePointers.size >= 2) {
    event.preventDefault();
    const points = [...activePointers.values()];
    const center = pointerMidpoint(points[0], points[1]);
    const anchor = clientToSvg(center.clientX, center.clientY);
    if (!pinch) beginPinch();
    const nextScale = Math.max(0.7, Math.min(7, pinch.scale * pointerDistance(points[0], points[1]) / pinch.distance));
    state.x = anchor.x - pinch.content.x * nextScale;
    state.y = anchor.y - pinch.content.y * nextScale;
    state.scale = nextScale;
    applyTransform();
    return;
  }
  if (!dragging) return;
  event.preventDefault();
  const point = clientToSvg(event.clientX, event.clientY);
  state.x += point.x - last.x;
  state.y += point.y - last.y;
  last = point;
  applyTransform();
});
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);
document.getElementById('zoomIn').onclick = () => zoom(1.22);
document.getElementById('zoomOut').onclick = () => zoom(0.82);
document.getElementById('reset').onclick = () => {
  state = { scale: 1, x: 0, y: 0 };
  applyTransform();
};
document.getElementById('toggleLabels').onclick = () => {
  labelsVisible = !labelsVisible;
  applyCityLabelVisibility();
};
document.getElementById('toggleTiles').onclick = event => {
  tilesVisible = !tilesVisible;
  event.currentTarget.classList.toggle('active', tilesVisible);
  mapShell.classList.toggle('mapTilesOn', tilesVisible);
  updateTiles();
};
overlayOpacityInput.addEventListener('input', () => {
  overlayOpacity = Number(overlayOpacityInput.value) / 100;
  applyOverlayOpacity();
});
function momValue(value) {
  const parsed = Number(String(value || '0').replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
function sortPlaces(list) {
  const collator = new Intl.Collator('zh-Hans-CN');
  return list.sort((a, b) => {
    if (sortMode === 'priceAsc') return a.price - b.price;
    if (sortMode === 'momDesc') return momValue(b.mom) - momValue(a.mom);
    if (sortMode === 'momAsc') return momValue(a.mom) - momValue(b.mom);
    if (sortMode === 'city') return collator.compare(a.city + a.name, b.city + b.name);
    if (sortMode === 'name') return collator.compare(a.name, b.name);
    return b.price - a.price;
  });
}
function renderRows(filter = '') {
  const q = filter.trim().toLowerCase();
  const main = sortPlaces(places
    .filter(r => r.price)
    .filter(r => !q || (r.city + r.name).toLowerCase().includes(q)));
  rows.innerHTML = main.map(r => '<div class="row" data-id="' + r.id + '">' +
    '<b>' + r.city + ' ' + r.name + (r.supplemental ? '<span class="sourceMark">※</span>' : '') + '</b><span class="price">' + fmt(r.price) + '</span><span class="' + (String(r.mom).startsWith('+') ? 'up' : String(r.mom).startsWith('-') ? 'down' : '') + '">' + r.mom + '</span></div>').join('');
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
document.querySelectorAll('.sortBar button').forEach(button => {
  button.addEventListener('click', () => {
    sortMode = button.dataset.sort;
    document.querySelectorAll('.sortBar button').forEach(item => item.classList.toggle('active', item === button));
    renderRows(search.value);
  });
});
search.addEventListener('input', () => renderRows(search.value));
renderRows();
applyOverlayOpacity();
applyTransform();
</script>
</body>
</html>`;

fs.writeFileSync(OUT_INTERACTIVE, interactiveHtml, "utf8");
console.log(`Wrote ${OUT_SVG}`);
console.log(`Wrote ${OUT_HTML}`);
console.log(`Wrote ${OUT_INTERACTIVE}`);
console.log(`Render target ${OUT_PNG}`);
