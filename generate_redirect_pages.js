#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname);

const REDIRECTS = [
  ["gba.html", "gba", "大湾区"],
  ["jingjinji.html", "jingjinji", "京津冀"],
  ["yangtze-delta.html", "yangtze-delta", "长三角"],
  ["chengyu.html", "chengyu", "成渝地区"],
  ["middle-yangtze.html", "middle-yangtze", "长江中游"],
  ["west-coast.html", "west-coast", "海峡西岸"],
  ["shandong-peninsula.html", "shandong-peninsula", "山东半岛"],
];

function htmlFor(view, label) {
  const target = `index.html?view=${encodeURIComponent(view)}`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=${target}">
<title>${label}房价地图</title>
<script>location.replace("${target}");</script>
</head>
<body>
<p>正在打开全国房价地图的${label}视角：<a href="${target}">${target}</a></p>
</body>
</html>
`;
}

for (const [file, view, label] of REDIRECTS) {
  fs.writeFileSync(path.join(ROOT, file), htmlFor(view, label), "utf8");
  console.log(`Wrote redirect ${file} -> ${view}`);
}
