#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { TextDecoder } = require("util");

const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data", "china_house_prices.json");
const SOURCE_URL = "https://m.creprice.cn/";
const CITY_PAGE_CONCURRENCY = 8;
const FANG_CITY_LIST_URL = "https://m.fang.com/city/hotcity.jsp?city=hz&burl=/fangjia";
const FANG_PAGE_CONCURRENCY = 8;
const MOBILE_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

function cleanHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(value) {
  const parsed = Number(cleanHtml(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function normalizeChange(raw) {
  const text = cleanHtml(raw);
  if (!text || text.includes("--")) return "--%";
  const parsed = Number(text.replace("%", "").replace(/[^\d.+-]/g, ""));
  if (!Number.isFinite(parsed)) return text;
  return `${parsed >= 0 ? "+" : ""}${parsed.toFixed(2)}%`;
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    headers: { "user-agent": options.userAgent || "Mozilla/5.0 (compatible; china-house-price-map/1.0)" },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return options.encoding === "gb18030" ? new TextDecoder("gb18030").decode(buffer) : buffer.toString("utf8");
}

function parseRanking(html) {
  const rows = [];
  const rowRe = /<tr[\s\S]*?<td>\s*\d+\s*<\/td>[\s\S]*?<td><a class='blue' href="\/city\/([^"]+)\.html"[^>]*>([^<]+)<\/a><\/td>[\s\S]*?<td><a class='blue' href="\/province\/([^"]+)\.html"[^>]*>([^<]+)<\/a><\/td>[\s\S]*?<td>\s*([\d,]+)\s*<\/td>[\s\S]*?<td>\s*<span[^>]*>([\s\S]*?)<\/span>/g;
  let match;
  while ((match = rowRe.exec(html))) {
    const price = parsePrice(match[5]);
    if (!price) continue;
    rows.push({
      slug: match[1],
      city: cleanHtml(match[2]),
      provinceSlug: match[3],
      province: cleanHtml(match[4]),
      price,
      mom: normalizeChange(match[6]),
    });
  }
  return rows;
}

function parseDistrictRows(html) {
  const rows = [];
  const rowRe = /<tr>[\s\S]*?<td><a class='blue' href="\/district\/([^"?]+)\.html\?city=([^"]+)">([^<]+)<\/a><\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/g;
  let match;
  while ((match = rowRe.exec(html))) {
    const price = parsePrice(match[4]);
    if (!price) continue;
    rows.push({
      code: match[1],
      cityParam: match[2],
      name: cleanHtml(match[3]),
      price,
      mom: normalizeChange(match[5]),
    });
  }
  return rows;
}

function parseFangCityCodes(html) {
  const codes = new Map();
  const re = /href="\/fangjia\/([^/"]+)\/"[^>]*>([^<]+)<\/a>/g;
  let match;
  while ((match = re.exec(html))) {
    const city = cleanHtml(match[2]);
    if (city && !codes.has(city)) codes.set(city, match[1]);
  }
  return codes;
}

function parseFangDistrictRows(html) {
  const rows = [];
  const seen = new Set();
  const hotAreaRe = /<li[^>]*>\s*<a href="https?:\/\/m\.fang\.com\/fangjia\/[^"]+"[^>]*>\s*<h3>([^<]+)<\/h3>[\s\S]*?<div class="price"><span>([\d,]+)<\/span>[^<]*<\/div>\s*<span class="[^"]+">([^<]+)<\/span>/g;
  let match;
  while ((match = hotAreaRe.exec(html))) {
    const name = cleanHtml(match[1]);
    const price = parsePrice(match[2]);
    if (!name || !price || seen.has(name)) continue;
    seen.add(name);
    rows.push({ name, price, mom: normalizeChange(match[3]) });
  }

  const labelStyles = (html.match(/labelStyles=([^"]+)/) || [])[1] || "";
  for (const item of labelStyles.split("|")) {
    const label = item.match(/^([^,]+?)\s+([\d,]+)元\//);
    if (!label) continue;
    const name = cleanHtml(label[1]);
    const price = parsePrice(label[2]);
    if (!name || !price || seen.has(name)) continue;
    seen.add(name);
    rows.push({ name, price, mom: "--%" });
  }
  return rows;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchDistrictData(cityRows) {
  const districtData = {};
  const cityDistrictCounts = {};
  const errors = [];

  await mapWithConcurrency(cityRows, CITY_PAGE_CONCURRENCY, async row => {
    const url = `https://m.creprice.cn/city/${row.slug}.html`;
    try {
      const html = await fetchText(url);
      const districts = parseDistrictRows(html);
      cityDistrictCounts[row.city] = districts.length;
      for (const district of districts) {
        districtData[`${row.city}|${district.name}`] = [district.price, district.mom];
      }
      console.log(`Parsed ${row.city}: ${districts.length} district rows`);
    } catch (error) {
      cityDistrictCounts[row.city] = 0;
      errors.push({ city: row.city, url, error: error.message });
      console.warn(`District rows skipped for ${row.city}: ${error.message}`);
    }
  });

  return { districtData, cityDistrictCounts, errors };
}

async function fetchFangDistrictData(cityRows) {
  const fangData = {};
  const cityDistrictCounts = {};
  const errors = [];
  let cityCodes;
  try {
    const cityListHtml = await fetchText(FANG_CITY_LIST_URL, {
      encoding: "gb18030",
      userAgent: MOBILE_USER_AGENT,
    });
    cityCodes = parseFangCityCodes(cityListHtml);
  } catch (error) {
    errors.push({ source: "fang-city-list", url: FANG_CITY_LIST_URL, error: error.message });
    console.warn(`Fang city list skipped: ${error.message}`);
    return { data: fangData, cityDistrictCounts, errors, cityCodeCount: 0 };
  }

  await mapWithConcurrency(cityRows, FANG_PAGE_CONCURRENCY, async row => {
    const code = cityCodes.get(row.city);
    if (!code) {
      cityDistrictCounts[row.city] = 0;
      return;
    }
    const url = `https://m.fang.com/fangjia/${code}/`;
    try {
      const html = await fetchText(url, { userAgent: MOBILE_USER_AGENT });
      const title = (html.match(/<title>(.*?)<\/title>/i) || [])[1] || "";
      if (!title.includes(row.city)) {
        cityDistrictCounts[row.city] = 0;
        errors.push({ city: row.city, url, error: `title mismatch: ${title}` });
        return;
      }
      const districts = parseFangDistrictRows(html);
      cityDistrictCounts[row.city] = districts.length;
      for (const district of districts) {
        fangData[`${row.city}|${district.name}`] = {
          price: district.price,
          mom: district.mom,
          url,
        };
      }
      if (districts.length) console.log(`Parsed Fang ${row.city}: ${districts.length} district rows`);
    } catch (error) {
      cityDistrictCounts[row.city] = 0;
      errors.push({ city: row.city, url, error: error.message });
      console.warn(`Fang district rows skipped for ${row.city}: ${error.message}`);
    }
  });

  return {
    data: fangData,
    cityDistrictCounts,
    errors,
    cityCodeCount: cityCodes.size,
  };
}

function createDistrictRecord({ price, mom, source, quality, dataLevel, supplemental, url, fetchedAt }) {
  return {
    price,
    mom: mom || "--%",
    source,
    quality,
    dataLevel,
    supplemental: Boolean(supplemental),
    url: url || "",
    fetchedAt,
  };
}

function mergeDistrictRecords(primaryDistrictData, fangDistrictData, fetchedAt) {
  const districtData = {};
  const districtRecords = {};
  const sourceCounts = { creprice: 0, fang: 0 };

  for (const [key, value] of Object.entries(primaryDistrictData || {})) {
    districtData[key] = value;
    districtRecords[key] = createDistrictRecord({
      price: value[0],
      mom: value[1],
      source: "禧泰数据/中国房价行情",
      quality: "区县住宅挂牌均价",
      dataLevel: "district",
      supplemental: false,
      fetchedAt,
    });
    sourceCounts.creprice += 1;
  }

  for (const [key, value] of Object.entries(fangDistrictData || {})) {
    if (districtRecords[key]) continue;
    districtData[key] = [value.price, value.mom];
    districtRecords[key] = createDistrictRecord({
      price: value.price,
      mom: value.mom,
      source: "房天下查房价",
      quality: "区县二手房参考均价（补充口径）",
      dataLevel: "district-supplement",
      supplemental: true,
      url: value.url,
      fetchedAt,
    });
    sourceCounts.fang += 1;
  }

  return { districtData, districtRecords, sourceCounts };
}

async function main() {
  const html = await fetchText(SOURCE_URL);
  const rows = parseRanking(html);
  if (rows.length < 250) throw new Error(`Only parsed ${rows.length} city rows from ${SOURCE_URL}`);
  const districts = await fetchDistrictData(rows);
  const fangDistricts = await fetchFangDistrictData(rows);

  const fetchedAt = new Date().toISOString();
  const mergedDistricts = mergeDistrictRecords(districts.districtData, fangDistricts.data, fetchedAt);
  const payload = {
    schemaVersion: 1,
    fetchedAt,
    updatedAt: fetchedAt,
    metadata: {
      source: "禧泰数据/中国房价行情",
      sourceUrl: SOURCE_URL,
      mainlandPeriod: "全国城市排行页公开最新",
      updateCadence: "weekly",
      coverage: `${rows.length}个城市`,
      districtCoverage: `${Object.keys(mergedDistricts.districtRecords).length}个区县`,
      districtSources: {
        creprice: mergedDistricts.sourceCounts.creprice,
        fang: mergedDistricts.sourceCounts.fang,
      },
    },
    cityStats: rows.map(row => [row.city, row.price, row.mom, row.province]),
    cityData: rows,
    districtData: mergedDistricts.districtData,
    districtRecords: mergedDistricts.districtRecords,
    cityDistrictCounts: districts.cityDistrictCounts,
    fangDistrictData: fangDistricts.data,
    fangCityDistrictCounts: fangDistricts.cityDistrictCounts,
    fangCityCodeCount: fangDistricts.cityCodeCount,
    districtFetchErrors: districts.errors,
    fangDistrictFetchErrors: fangDistricts.errors,
  };

  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Parsed ${rows.length} national city rows`);
  console.log(`Wrote ${path.relative(ROOT, DATA_FILE)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
