#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { TextDecoder } = require("util");

const ROOT = path.resolve(__dirname, "..");
const { normalizeCity, comparableRecord, clampEstimateRatio } = require(path.join(ROOT, "src", "china_map_shared"));
const DATA_FILE = path.join(ROOT, "data", "china_house_prices.json");
const SOURCE_URL = "https://m.creprice.cn/";
const CITY_PAGE_CONCURRENCY = 8;
const FANG_CITY_LIST_URL = "https://m.fang.com/city/hotcity.jsp?city=hz&burl=/fangjia";
const FANG_PAGE_CONCURRENCY = 8;
const CITYHOUSE_CITY_LIST_URL = "https://www.cityhouse.com.cn/city.html";
const CITYHOUSE_PAGE_CONCURRENCY = 2;
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

function parseCityhouseCityCodes(html) {
  const codes = new Map();
  const re = /href="https?:\/\/([a-z0-9-]+)\.cityhouse\.com\.cn\/?"[^>]*>([^<]+)<\/a>/g;
  let match;
  while ((match = re.exec(html))) {
    const city = cleanHtml(match[2]);
    const key = normalizeCity(city);
    if (key && !codes.has(key)) codes.set(key, match[1]);
  }
  return codes;
}

function parseCityhouseNewSummary(html) {
  const marker = "新盘均价";
  const index = html.indexOf(marker);
  if (index < 0) return null;
  const snippet = html.slice(Math.max(0, index - 160), index + 360);
  const match = snippet.match(/<span[^>]*>([\d,.]+)<\/span>\s*([^<（(]*)[（(]([^）)]+)[）)]/);
  if (!match) return null;
  const raw = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const unit = cleanHtml(match[2]);
  const price = unit.includes("万") ? Math.round(raw * 10000) : Math.round(raw);
  return {
    price,
    mom: "--%",
    period: cleanHtml(match[3]),
  };
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

async function fetchCityhouseNewCityData(cityRows) {
  const data = {};
  const cityCounts = {};
  const errors = [];
  let cityCodes;
  try {
    const html = await fetchText(CITYHOUSE_CITY_LIST_URL, {
      userAgent: "Mozilla/5.0 (compatible; china-house-price-map/1.0)",
    });
    cityCodes = parseCityhouseCityCodes(html);
  } catch (error) {
    errors.push({ source: "cityhouse-city-list", url: CITYHOUSE_CITY_LIST_URL, error: error.message });
    console.warn(`Cityhouse city list skipped: ${error.message}`);
    return { data, cityCounts, errors, cityCodeCount: 0 };
  }

  let blocked = false;
  await mapWithConcurrency(cityRows, CITYHOUSE_PAGE_CONCURRENCY, async row => {
    if (blocked) {
      cityCounts[row.city] = 0;
      return;
    }
    const code = cityCodes.get(normalizeCity(row.city));
    if (!code) {
      cityCounts[row.city] = 0;
      return;
    }
    const url = `https://${code}.cityhouse.com.cn/ha/`;
    try {
      const html = await fetchText(url, {
        userAgent: "Mozilla/5.0 (compatible; china-house-price-map/1.0)",
      });
      const summary = parseCityhouseNewSummary(html);
      if (!summary?.price) {
        cityCounts[row.city] = 0;
        return;
      }
      data[row.city] = {
        ...summary,
        url,
      };
      cityCounts[row.city] = 1;
      console.log(`Parsed Cityhouse new ${row.city}: ${summary.price}`);
    } catch (error) {
      cityCounts[row.city] = 0;
      if (/^(403|456)\b/.test(error.message)) {
        blocked = true;
        errors.push({ source: "cityhouse-blocked", city: row.city, url, error: error.message });
        console.warn(`Cityhouse new prices skipped: ${error.message}`);
      } else {
        errors.push({ city: row.city, url, error: error.message });
        console.warn(`Cityhouse new price skipped for ${row.city}: ${error.message}`);
      }
    }
  });

  return {
    data,
    cityCounts,
    errors,
    cityCodeCount: cityCodes.size,
  };
}

function median(values) {
  const filtered = values.filter(value => value >= 0.55 && value <= 1.8);
  if (!filtered.length) return null;
  const sorted = [...filtered].sort((a, b) => a - b);
  const trim = sorted.length >= 12 ? Math.floor(sorted.length * 0.1) : 0;
  const sample = trim ? sorted.slice(trim, sorted.length - trim) : sorted;
  if (!sample.length) return null;
  return sample[Math.floor(sample.length / 2)];
}

function buildCityRecords(cityRows, cityhouseNewData, fetchedAt) {
  const cityRecords = {};
  const cityRowByCity = new Map(cityRows.map(row => [row.city, row]));
  const ratiosByProvince = new Map();
  const nationalRatios = [];
  for (const row of cityRows) {
    const newItem = cityhouseNewData[row.city];
    const ratio = newItem?.price ? clampEstimateRatio(newItem.price / row.price) : null;
    if (ratio) {
      nationalRatios.push(ratio);
      const provinceKey = normalizeCity(row.province);
      if (!ratiosByProvince.has(provinceKey)) ratiosByProvince.set(provinceKey, []);
      ratiosByProvince.get(provinceKey).push(ratio);
    }
    cityRecords[row.city] = comparableRecord({
      price: newItem?.price || row.price,
      mom: newItem?.mom || row.mom,
      source: newItem ? "城市房网" : "禧泰数据/中国房价行情",
      quality: newItem ? `城市新盘均价（${newItem.period || "公开最新"}）` : "城市住宅挂牌均价",
      dataLevel: "city",
      province: row.province,
      newPrice: newItem?.price || null,
      newSource: newItem ? "城市房网" : "",
      newQuality: newItem ? `城市新盘均价（${newItem.period || "公开最新"}）` : "",
      resalePrice: row.price,
      resaleMom: row.mom,
      resaleSource: "禧泰数据/中国房价行情",
      resaleQuality: "城市住宅挂牌均价",
      hasEstimateRatio: Boolean(ratio),
      estimateSampleCount: ratio ? 1 : 0,
      url: newItem?.url || "",
      fetchedAt,
    }, ratio || 1, ratio ? "按同城新房/二手配对样本估算" : "暂无同城新房样本，暂按 1:1 近似估算");
  }

  const provinceRatios = new Map([...ratiosByProvince]
    .map(([province, values]) => [province, { ratio: median(values), count: values.filter(value => value >= 0.55 && value <= 1.8).length }])
    .filter(([, summary]) => summary.ratio && summary.count >= 3));
  const nationalSummary = {
    ratio: nationalRatios.length >= 10 ? median(nationalRatios) : null,
    count: nationalRatios.filter(value => value >= 0.55 && value <= 1.8).length,
  };
  const ratioForCity = city => {
    const row = cityRowByCity.get(city);
    const cityRecord = row ? cityRecords[row.city] : null;
    if (cityRecord?.newPrice && cityRecord?.resalePrice && !cityRecord.newPriceEstimated) {
      return { ratio: clampEstimateRatio(cityRecord.newPrice / cityRecord.resalePrice), basis: "按同城新房/二手配对样本估算", hasEvidence: true, count: 1 };
    }
    const provinceSummary = row ? provinceRatios.get(normalizeCity(row.province)) : null;
    if (provinceSummary?.ratio) return { ratio: provinceSummary.ratio, basis: `按同省 ${provinceSummary.count} 个新房/二手配对样本估算`, hasEvidence: true, count: provinceSummary.count };
    if (nationalSummary.ratio) return { ratio: nationalSummary.ratio, basis: `按全国 ${nationalSummary.count} 个新房/二手配对样本估算`, hasEvidence: true, count: nationalSummary.count };
    return {
      ratio: 1,
      basis: "暂无足够新房与二手配对样本，暂不估算新房参考价",
      hasEvidence: false,
      count: 0,
    };
  };

  for (const row of cityRows) {
    const current = cityRecords[row.city];
    if (!current || current.newPrice) continue;
    const ratio = ratioForCity(row.city);
    cityRecords[row.city] = comparableRecord({
      ...current,
      hasEstimateRatio: ratio.hasEvidence,
      estimateSampleCount: ratio.count,
      estimateBasis: ratio.basis,
    }, ratio.ratio, ratio.basis);
  }

  return {
    cityRecords,
    ratioForCity,
    cityhouseMatched: Object.keys(cityhouseNewData).length,
    nationalRatio: nationalSummary.ratio || 1,
    nationalRatioSampleCount: nationalSummary.count,
  };
}

function createComparableDistrictRecord({ price, mom, source, quality, dataLevel, supplemental, url, fetchedAt, ratio, basis }) {
  return comparableRecord({
    price,
    mom,
    source,
    quality,
    dataLevel,
    supplemental,
    url,
    fetchedAt,
    resalePrice: price,
    resaleMom: mom,
    resaleSource: source,
    resaleQuality: quality,
    hasEstimateRatio: Boolean(ratio && basis && !basis.includes("暂无")),
    }, ratio, basis);
}

function mergeDistrictRecords(primaryDistrictData, fangDistrictData, fetchedAt, ratioForCity) {
  const districtData = {};
  const districtRecords = {};
  const sourceCounts = { creprice: 0, fang: 0 };

  for (const [key, value] of Object.entries(primaryDistrictData || {})) {
    const [city] = key.split("|");
    const ratio = ratioForCity(city);
    const record = createComparableDistrictRecord({
      price: value[0],
      mom: value[1],
      source: "禧泰数据/中国房价行情",
      quality: "区县住宅挂牌均价",
      dataLevel: "district",
      supplemental: false,
      ratio: ratio.ratio,
      basis: ratio.basis,
      fetchedAt,
    });
    districtData[key] = [record.price, record.mom];
    districtRecords[key] = record;
    sourceCounts.creprice += 1;
  }

  for (const [key, value] of Object.entries(fangDistrictData || {})) {
    if (districtRecords[key]) continue;
    const [city] = key.split("|");
    const ratio = ratioForCity(city);
    const record = createComparableDistrictRecord({
      price: value.price,
      mom: value.mom,
      source: "房天下查房价",
      quality: "区县二手房参考均价（补充口径）",
      dataLevel: "district-supplement",
      supplemental: true,
      url: value.url,
      ratio: ratio.ratio,
      basis: ratio.basis,
      fetchedAt,
    });
    districtData[key] = [record.price, record.mom];
    districtRecords[key] = record;
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
  const cityhouseNew = await fetchCityhouseNewCityData(rows);

  const fetchedAt = new Date().toISOString();
  const cityComparable = buildCityRecords(rows, cityhouseNew.data, fetchedAt);
  const mergedDistricts = mergeDistrictRecords(districts.districtData, fangDistricts.data, fetchedAt, cityComparable.ratioForCity);
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
        cityhouseNewCity: cityComparable.cityhouseMatched,
      },
      defaultPriceType: "resale",
      estimateRule: cityComparable.cityhouseMatched
        ? "默认展示二手/挂牌价；有真实新房样本时在详情中并列显示，缺新房样本时仅在同城、同省或全国配对样本足够时估算新房参考价"
        : "默认展示二手/挂牌价；本次未抓到稳定新房样本，暂不强行估算新房参考价",
      newToResaleRatio: cityComparable.nationalRatio,
      newToResaleRatioSampleCount: cityComparable.nationalRatioSampleCount,
    },
    cityStats: rows.map(row => [row.city, cityComparable.cityRecords[row.city]?.price || row.price, cityComparable.cityRecords[row.city]?.mom || row.mom, row.province]),
    cityData: rows,
    cityRecords: cityComparable.cityRecords,
    districtData: mergedDistricts.districtData,
    districtRecords: mergedDistricts.districtRecords,
    cityDistrictCounts: districts.cityDistrictCounts,
    fangDistrictData: fangDistricts.data,
    fangCityDistrictCounts: fangDistricts.cityDistrictCounts,
    fangCityCodeCount: fangDistricts.cityCodeCount,
    cityhouseNewCityData: cityhouseNew.data,
    cityhouseNewCityCounts: cityhouseNew.cityCounts,
    cityhouseCityCodeCount: cityhouseNew.cityCodeCount,
    districtFetchErrors: districts.errors,
    fangDistrictFetchErrors: fangDistricts.errors,
    cityhouseNewFetchErrors: cityhouseNew.errors,
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
