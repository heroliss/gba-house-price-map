#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "gba_house_prices.json");

const CITY_PAGES = [
  { name: "广州", url: "https://m.creprice.cn/city/gz.html" },
  { name: "深圳", url: "https://m.creprice.cn/city/sz.html" },
  { name: "珠海", url: "https://m.creprice.cn/city/zh.html" },
  { name: "佛山", url: "https://m.creprice.cn/city/fs.html" },
  { name: "江门", url: "https://m.creprice.cn/city/jm.html" },
  { name: "肇庆", url: "https://m.creprice.cn/city/zq.html" },
  { name: "惠州", url: "https://m.creprice.cn/city/huizhou.html" },
  { name: "东莞", url: "https://m.creprice.cn/city/dg.html" },
  { name: "中山", url: "https://m.creprice.cn/city/zhongshan.html" },
];

const GEO_FILES = [
  ["datav_440100.json", "https://geo.datav.aliyun.com/areas_v3/bound/440100.json"],
  ["datav_440100_full.json", "https://geo.datav.aliyun.com/areas_v3/bound/440100_full.json"],
  ["datav_440300.json", "https://geo.datav.aliyun.com/areas_v3/bound/440300.json"],
  ["datav_440300_full.json", "https://geo.datav.aliyun.com/areas_v3/bound/440300_full.json"],
  ["datav_440400.json", "https://geo.datav.aliyun.com/areas_v3/bound/440400.json"],
  ["datav_440400_full.json", "https://geo.datav.aliyun.com/areas_v3/bound/440400_full.json"],
  ["datav_440600.json", "https://geo.datav.aliyun.com/areas_v3/bound/440600.json"],
  ["datav_440600_full.json", "https://geo.datav.aliyun.com/areas_v3/bound/440600_full.json"],
  ["datav_440700.json", "https://geo.datav.aliyun.com/areas_v3/bound/440700.json"],
  ["datav_440700_full.json", "https://geo.datav.aliyun.com/areas_v3/bound/440700_full.json"],
  ["datav_441200.json", "https://geo.datav.aliyun.com/areas_v3/bound/441200.json"],
  ["datav_441200_full.json", "https://geo.datav.aliyun.com/areas_v3/bound/441200_full.json"],
  ["datav_441300.json", "https://geo.datav.aliyun.com/areas_v3/bound/441300.json"],
  ["datav_441300_full.json", "https://geo.datav.aliyun.com/areas_v3/bound/441300_full.json"],
  ["datav_441900.json", "https://geo.datav.aliyun.com/areas_v3/bound/441900.json"],
  ["datav_442000.json", "https://geo.datav.aliyun.com/areas_v3/bound/442000.json"],
  ["datav_810000.json", "https://geo.datav.aliyun.com/areas_v3/bound/810000.json"],
  ["datav_810000_full.json", "https://geo.datav.aliyun.com/areas_v3/bound/810000_full.json"],
  ["datav_820000.json", "https://geo.datav.aliyun.com/areas_v3/bound/820000.json"],
  ["datav_820000_full.json", "https://geo.datav.aliyun.com/areas_v3/bound/820000_full.json"],
];

function cleanHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(value) {
  const parsed = Number(cleanHtml(value).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid price value: ${value}`);
  }
  return Math.round(parsed);
}

function normalizeChange(raw, className = "") {
  const original = cleanHtml(raw);
  if (!original || original.includes("--")) return "--%";

  const hasDownSignal = /[▼↓]/.test(original) || /\bgreen\b/i.test(className);
  const stripped = original.replace(/[▲▼↑↓]/g, "").replace("%", "").trim();
  const parsed = Number(stripped.replace(/[^\d.+-]/g, ""));
  if (!Number.isFinite(parsed)) return original;

  const value = stripped.startsWith("-")
    ? parsed
    : hasDownSignal && !stripped.startsWith("+")
      ? -Math.abs(parsed)
      : parsed;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; gba-house-price-map/1.0)",
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1200));
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError.message}`);
}

function parseCityHtml(city, html) {
  const title = cleanHtml(html.match(/<title>([^<]+)/)?.[1]);
  const summary = html.match(/<p>\s*平均房价[\s\S]*?<span[^>]*cont_tim[^>]*>（?([^<）]+)）?<\/span>[\s\S]*?<span class="([^"]+)">([\d,]+)<\/span>\s*元\/㎡[\s\S]*?环比：<em class="([^"]+)">([^<]+)<\/em>/);
  if (!summary) throw new Error(`Cannot parse city summary for ${city.name}`);

  const period = cleanHtml(summary[1]).replace(/）$/, "");
  const cityPrice = parsePrice(summary[3]);
  const cityMom = normalizeChange(summary[5], `${summary[2]} ${summary[4]}`);
  const rows = [];
  const rowRe = /<tr>[\s\S]*?<td><a class='blue' href="\/district\/([^"?]+)\.html\?city=([^"]+)">([^<]+)<\/a><\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/g;
  let match;
  while ((match = rowRe.exec(html))) {
    rows.push({
      code: match[1],
      cityParam: match[2],
      name: cleanHtml(match[3]),
      price: parsePrice(match[4]),
      mom: normalizeChange(match[5]),
    });
  }
  if (!rows.length) throw new Error(`No district rows parsed for ${city.name}`);

  return { city: city.name, title, period, cityPrice, cityMom, rows, url: city.url };
}

async function refreshGeoFiles() {
  for (const [filename, url] of GEO_FILES) {
    const target = path.join(ROOT, filename);
    const text = await fetchText(url);
    JSON.parse(text);
    fs.writeFileSync(target, text, "utf8");
    console.log(`Downloaded ${filename}`);
  }
}

async function refreshPrices() {
  const mainlandData = {};
  const cityStats = [];
  const parsedCities = [];

  for (const city of CITY_PAGES) {
    const html = await fetchText(city.url);
    const parsed = parseCityHtml(city, html);
    parsedCities.push(parsed);
    cityStats.push([parsed.city, parsed.cityPrice, parsed.cityMom]);

    if (city.name === "东莞" || city.name === "中山") {
      mainlandData[`${city.name}|${city.name}市`] = [parsed.cityPrice, parsed.cityMom];
    }
    for (const row of parsed.rows) {
      mainlandData[`${city.name}|${row.name}`] = [row.price, row.mom];
    }
    console.log(`Parsed ${parsed.city}: ${parsed.period}, ${parsed.rows.length} rows`);
  }

  cityStats.sort((a, b) => b[1] - a[1]);
  const periods = [...new Set(parsedCities.map(item => item.period))];
  const mainlandPeriod = periods.length === 1 ? periods[0] : periods.join(" / ");
  const fetchedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    fetchedAt,
    updatedAt: fetchedAt,
    mainlandPeriod,
    metadata: {
      source: "禧泰数据/中国房价行情",
      mainlandPeriod,
      fetchedAt,
      hkPeriod: "2026/05/08公开最新",
      macauPeriod: "2026年第一季",
      updateCadence: "weekly",
      sourceUrls: CITY_PAGES.map(item => item.url),
    },
    cityStats,
    mainlandData,
    sources: CITY_PAGES.map(item => ({ name: item.name, url: item.url })),
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(ROOT, DATA_FILE)}`);
}

async function main() {
  const shouldGenerate = process.argv.includes("--generate");
  await refreshGeoFiles();
  await refreshPrices();

  const jjjResult = spawnSync(process.execPath, [path.join(ROOT, "scripts", "update-jjj-data.js")], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (jjjResult.status !== 0) process.exit(jjjResult.status || 1);

  if (shouldGenerate) {
    const result = spawnSync(process.execPath, [path.join(ROOT, "generate_all_maps.js"), ROOT], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
