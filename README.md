# 粤港澳大湾区房价交互地图

静态站点入口是 `index.html`，可直接通过 GitHub Pages 部署。

## 本地预览

```powershell
cd D:\gba-house-price-map
python -m http.server 8765 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:8765/
```

## 数据口径

- 内地城市：禧泰数据/中国房价行情，住宅挂牌均价；GitHub Actions 每周一 04:00（北京时间）尝试抓取最新页面并重新生成站点。
- 深圳：大鹏新区是功能区，页面将其从龙岗区面中单列；当前房价源未单列大鹏新区时，该区域不参与色阶和排行。
- 东莞、中山：属于不设县级区划的地级市，页面使用 OSM 镇街边界展示；无房价数据的镇街保持浅灰。
- 香港：中原地产 Centadata 分区领先指数与4月成交，2026/05/08更新。
- 澳门：统计暨普查局 2026年第一季住宅楼价指数。
- 底图：阿里云 DataV.GeoAtlas。

手动更新可以在 Actions 页面运行 `Deploy GitHub Pages` 工作流，或本地执行：

```powershell
node scripts\update-weekly-data.js --generate
```

## GitHub Pages 发布

如果 GitHub Actions 的 Pages 部署一直停在 queued，可以改用分支发布：

- Settings → Pages
- Source: Deploy from a branch
- Branch: main
- Folder: /root

站点入口文件是仓库根目录的 `index.html`。
