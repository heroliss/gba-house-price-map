#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data", "jjj_house_prices.json");

const CITY_PAGES = [
  { scope: "北京", name: "北京", slug: "bj", districts: true },
  { scope: "天津", name: "天津", slug: "tj", districts: true },
  { scope: "河北", name: "石家庄市", slug: "sjz", fallbackPrice: 11800, fallbackMom: "估算" },
  { scope: "河北", name: "唐山市", slug: "ts" },
  { scope: "河北", name: "秦皇岛市", slug: "qhd" },
  { scope: "河北", name: "邯郸市", slug: "hd" },
  { scope: "河北", name: "邢台市", slug: "xt" },
  { scope: "河北", name: "保定市", slug: "bd" },
  { scope: "河北", name: "张家口市", slug: "zjk" },
  { scope: "河北", name: "承德市", slug: "chengde" },
  { scope: "河北", name: "沧州市", slug: "cangzhou" },
  { scope: "河北", name: "廊坊市", slug: "lf" },
  { scope: "河北", name: "衡水市", slug: "hengshui" },
];

function cleanHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(value) {
  const text = cleanHtml(value);
  if (!text || text.includes("--")) return null;
  const parsed = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function normalizeChange(raw, className = "") {
  const original = cleanHtml(raw);
  if (!original || original.includes("--")) return "--%";
  const hasDownSignal = /[▼↓]/.test(original) || /\bgreen\b/i.test(className);
  const stripped = original.replace(/[▲↑▼↓]/g, "").replace("%", "").trim();
  const parsed = Number(stripped.replace(/[^\d.+-]/g, ""));
  if (!Number.isFinite(parsed)) return original;
  const value = stripped.startsWith("-") ? parsed : hasDownSignal && !stripped.startsWith("+") ? -Math.abs(parsed) : parsed;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; house-price-map/1.0)" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function parseCityPage(city, html) {
  const summary = html.match(/<p>[\s\S]*?<span[^>]*cont_tim[^>]*>\s*([^<]+?)\s*<\/span>[\s\S]*?<span class="([^"]*)">([^<]+)<\/span>[\s\S]*?<em class="([^"]*)">([^<]+)<\/em>/);
  const period = summary ? cleanHtml(summary[1]).replace(/[()（）]/g, "") : "2026年4月挂牌";
  const cityPrice = summary ? parsePrice(summary[3]) : null;
  const cityMom = summary ? normalizeChange(summary[5], `${summary[2]} ${summary[4]}`) : "--%";
  const rows = [];
  const rowRe = /<tr>[\s\S]*?<td><a class='blue' href="\/district\/([^"?]+)\.html\?city=([^"]+)">([^<]+)<\/a><\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/g;
  let match;
  while ((match = rowRe.exec(html))) {
    const price = parsePrice(match[4]);
    if (price) rows.push({ name: cleanHtml(match[3]), price, mom: normalizeChange(match[5]) });
  }
  return { city, period, cityPrice, cityMom, rows };
}

async function main() {
  const payload = {
    schemaVersion: 1,
    fetchedAt: new Date().toISOString(),
    mainlandData: {},
    cityStats: [],
    metadata: {
      source: "禧泰数据/中国房价行情",
      updateCadence: "weekly",
      sourceUrls: CITY_PAGES.map(item => `https://m.creprice.cn/city/${item.slug}.html`),
    },
  };
  const periods = [];
  for (const city of CITY_PAGES) {
    const url = `https://m.creprice.cn/city/${city.slug}.html`;
    const parsed = parseCityPage(city, await fetchText(url));
    periods.push(parsed.period);
    if (city.districts) {
      for (const row of parsed.rows) {
        payload.mainlandData[`${city.scope}|${row.name}`] = [row.price, row.mom];
      }
      const price = parsed.cityPrice || Math.round(parsed.rows.reduce((sum, row) => sum + row.price, 0) / parsed.rows.length);
      payload.cityStats.push([city.name, price, parsed.cityMom]);
      console.log(`Parsed ${city.name}: ${parsed.rows.length} districts`);
    } else {
      const price = parsed.cityPrice || city.fallbackPrice;
      const mom = parsed.cityPrice ? parsed.cityMom : city.fallbackMom;
      payload.mainlandData[`${city.scope}|${city.name}`] = [price, mom];
      payload.cityStats.push([city.name.replace(/市$/, ""), price, mom]);
      console.log(`Parsed ${city.name}: ${price}`);
    }
  }
  payload.updatedAt = payload.fetchedAt;
  payload.metadata.mainlandPeriod = [...new Set(periods)].join(" / ");
  payload.cityStats.sort((a, b) => b[1] - a[1]);
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(ROOT, DATA_FILE)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
