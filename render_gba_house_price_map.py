import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "gba_house_price_map_2026_04.png"

W, H = 3200, 2400
S = 1
map_box = (86 * S, 300 * S, 2150 * S, 1540 * S)

city_files = [
    ("广州", "datav_440100_full.json"),
    ("深圳", "datav_440300_full.json"),
    ("珠海", "datav_440400_full.json"),
    ("佛山", "datav_440600_full.json"),
    ("江门", "datav_440700_full.json"),
    ("肇庆", "datav_441200_full.json"),
    ("惠州", "datav_441300_full.json"),
    ("东莞", "datav_441900.json"),
    ("中山", "datav_442000.json"),
    ("香港", "datav_810000_full.json"),
    ("澳门", "datav_820000_full.json"),
]

city_centers = {
    "广州": (113.2644, 23.1291),
    "深圳": (114.0579, 22.5431),
    "珠海": (113.5767, 22.2707),
    "佛山": (113.1214, 23.0215),
    "惠州": (114.4168, 23.1115),
    "东莞": (113.7518, 23.0207),
    "中山": (113.3926, 22.5176),
    "江门": (113.0819, 22.5787),
    "肇庆": (112.4653, 23.0472),
    "香港": (114.1694, 22.3193),
    "澳门": (113.5439, 22.1987),
}

mainland_data = {
    "广州|天河区": (62053, "+4.30%"), "广州|越秀区": (55882, "+4.29%"), "广州|海珠区": (41259, "+4.83%"),
    "广州|荔湾区": (35713, "-1.67%"), "广州|白云区": (32002, "-1.87%"), "广州|黄埔区": (31264, "+9.78%"),
    "广州|番禺区": (29220, "-1.19%"), "广州|南沙区": (18205, "+0.40%"), "广州|花都区": (15870, "-0.95%"),
    "广州|增城区": (13287, "+4.66%"), "广州|从化区": (9776, "+5.59%"),
    "深圳|南山区": (108191, "-0.81%"), "深圳|福田区": (96710, "+10.47%"), "深圳|宝安区": (66369, "+9.71%"),
    "深圳|龙华区": (59458, "-2.43%"), "深圳|罗湖区": (52939, "-1.30%"), "深圳|盐田区": (51840, "-1.38%"),
    "深圳|龙岗区": (41424, "+2.10%"), "深圳|光明区": (36946, "+1.94%"), "深圳|坪山区": (27633, "+10.63%"),
    "珠海|香洲区": (23937, "+2.47%"), "珠海|金湾区": (11704, "-5.40%"), "珠海|斗门区": (8941, "-0.55%"),
    "佛山|南海区": (15812, "+1.75%"), "佛山|禅城区": (14197, "-7.26%"), "佛山|顺德区": (10961, "-2.68%"),
    "佛山|三水区": (7557, "+1.44%"), "佛山|高明区": (7097, "-2.19%"),
    "惠州|惠东县": (11813, "+34.10%"), "惠州|惠城区": (9219, "-7.14%"), "惠州|惠阳区": (8307, "+12.57%"),
    "惠州|博罗县": (5879, "-0.41%"),
    "江门|新会区": (7814, "+3.58%"), "江门|蓬江区": (7275, "-0.78%"), "江门|江海区": (7098, "+4.43%"),
    "江门|鹤山市": (6589, "-4.33%"), "江门|台山市": (5201, "-2.80%"), "江门|开平市": (5092, "-5.07%"),
    "肇庆|端州区": (7745, "-1.72%"), "肇庆|四会市": (5426, "-4.50%"),
    "东莞|东莞市": (19421, "-2.49%"), "中山|中山市": (8479, "-1.77%"),
}

city_stats = [
    ("深圳", 70736, "+3.55%"), ("广州", 38612, "+6.04%"), ("珠海", 20138, "+3.50%"),
    ("东莞", 19421, "-2.49%"), ("佛山", 12828, "+0.71%"), ("中山", 8479, "-1.77%"),
    ("惠州", 8297, "+4.12%"), ("江门", 6984, "+0.94%"), ("肇庆", 6799, "+2.35%"),
]

hk_stats = [
    ("港岛", "159.72", "+3.03%", "1,359宗"),
    ("九龙", "154.74", "+1.80%", "3,710宗"),
    ("新界东", "171.06", "+1.11%", "1,187宗"),
    ("新界西", "140.35", "+0.62%", "1,246宗"),
]

macau_stats = [
    ("住宅楼价指数", "188.9", "按季 -1.5%"),
    ("现货住宅指数", "201.2", "按季 -1.7%"),
    ("住宅楼花指数", "240.3", "按季 +0.6%"),
]

breaks = [0, 8000, 12000, 18000, 30000, 50000, 80000, 120000]
colors = ["#dfece9", "#b9d8cf", "#89c4ba", "#55abae", "#2f89a6", "#225b8f", "#173864"]


def font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/simsun.ttc",
    ]
    for item in candidates:
        if Path(item).exists():
            return ImageFont.truetype(item, size * S)
    return ImageFont.load_default()


F = {
    "title": font(44, True),
    "sub": font(20),
    "tiny": font(17),
    "label": font(18, True),
    "price": font(15, True),
    "panel": font(26, True),
    "num": font(26, True),
    "row": font(21, True),
    "note": font(18),
    "section": font(22, True),
}


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def interp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


img = Image.new("RGB", (W * S, H * S), "#f7faf8")
pix = img.load()
for y in range(H * S):
    for x in range(W * S):
        t = (x / (W * S) + y / (H * S)) / 2
        pix[x, y] = interp(hex_to_rgb("#f7faf8"), hex_to_rgb("#f8f1e9"), t)

draw = ImageDraw.Draw(img, "RGBA")


def rounded_rect(xy, r, fill, outline=None, width=1):
    draw.rounded_rectangle(tuple(int(v * S) for v in xy), radius=int(r * S), fill=fill, outline=outline, width=width * S)


def text(x, y, value, fill="#21313a", f=None, anchor=None, stroke=None, sw=0):
    draw.text((x * S, y * S), value, fill=fill, font=f or F["sub"], anchor=anchor, stroke_width=sw * S, stroke_fill=stroke)


features = []
for city, filename in city_files:
    geo = json.loads((ROOT / filename).read_text(encoding="utf-8"))
    for feat in geo["features"]:
        feat["properties"]["city"] = city
        if city == "东莞":
            feat["properties"]["name"] = "东莞市"
        if city == "中山":
            feat["properties"]["name"] = "中山市"
        features.append(feat)


def walk_coords(coords):
    if isinstance(coords[0], (int, float)):
        yield coords
    else:
        for item in coords:
            yield from walk_coords(item)


def mercator(pt):
    lon, lat = pt
    rad = lat * math.pi / 180
    return lon, math.log(math.tan(math.pi / 4 + rad / 2)) * 180 / math.pi


min_x, min_y, max_x, max_y = 999, 999, -999, -999
for feat in features:
    for coord in walk_coords(feat["geometry"]["coordinates"]):
        x, y = mercator(coord)
        min_x, max_x = min(min_x, x), max(max_x, x)
        min_y, max_y = min(min_y, y), max(max_y, y)

mx, my, mw, mh = map_box
scale = min(mw / (max_x - min_x), mh / (max_y - min_y)) * 0.92
ox = mx + (mw - (max_x - min_x) * scale) / 2
oy = my + (mh + (max_y - min_y) * scale) / 2


def project(pt):
    x, y = mercator(pt)
    return ox + (x - min_x) * scale, oy - (y - min_y) * scale


def color_for(price, city):
    if city == "香港":
        return "#e8e4fb"
    if city == "澳门":
        return "#f4e0d6"
    if not price:
        return "#eef2f0"
    for i in range(len(breaks) - 1):
        if breaks[i] <= price < breaks[i + 1]:
            return colors[i]
    return colors[-1]


draw.polygon([(0, 1980 * S), (580 * S, 1880 * S), (980 * S, 2120 * S), (1540 * S, 1980 * S), (2460 * S, 1780 * S), (3200 * S, 1950 * S), (3200 * S, H * S), (0, H * S)], fill="#e8f1ec")
text(86, 112, "粤港澳大湾区房价地图", f=font(64, True), fill="#17272e")
text(86, 186, "9+2 城市，区县/镇街可得数据；主体色阶为内地住宅挂牌均价，单位：元/㎡", f=font(30), fill="#5c6b70")
text(86, 232, "数据更新：内地 2026年4月；香港/澳门 2026年5月公开最新。生成日期：2026-05-15", f=font(24), fill="#66777c")

rounded_rect((48, 278, 2288, 1888), 26, "#ffffffdd", "#dbe6e3", 1)

for feat in features:
    props = feat["properties"]
    key = f"{props['city']}|{props['name']}"
    price = mainland_data.get(key, (None,))[0]
    fill = hex_to_rgb(color_for(price, props["city"])) + (245 if price or props["city"] in ("香港", "澳门") else 170,)
    geom = feat["geometry"]
    polygons = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    for poly in polygons:
        if not poly:
            continue
        ring = [(int(x), int(y)) for x, y in (project(pt) for pt in poly[0])]
        if len(ring) >= 3:
            draw.polygon(ring, fill=fill)
            draw.line(ring + [ring[0]], fill="#ffffff", width=2 * S, joint="curve")

placed_boxes = []


def intersects(a, b):
    return not (a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1])


for city, center in city_centers.items():
    x, y = project(center)
    city_font = font(28, True)
    bbox = draw.textbbox((x, y), city, font=city_font, anchor="mm", stroke_width=4)
    placed_boxes.append((bbox[0] - 8, bbox[1] - 6, bbox[2] + 8, bbox[3] + 6))
    text(x / S, y / S, city, f=city_font, anchor="mm", stroke="#ffffffdd", sw=4)

def try_label(x, y, label, price):
    value = f"{label} {round(price / 1000)}k"
    fnt = font(21, True)
    offsets = [
        (0, 0), (0, -28), (0, 28), (-48, 0), (48, 0),
        (-62, -28), (62, -28), (-62, 28), (62, 28),
        (0, -56), (0, 56), (-96, 0), (96, 0),
    ]
    for dx, dy in offsets:
        bbox = draw.textbbox((x + dx, y + dy), value, font=fnt, anchor="mm", stroke_width=3)
        padded = (bbox[0] - 6, bbox[1] - 4, bbox[2] + 6, bbox[3] + 4)
        if all(not intersects(padded, old) for old in placed_boxes):
            placed_boxes.append(padded)
            if dx or dy:
                draw.line((x, y, x + dx, y + dy), fill="#6f858866", width=1)
            text((x + dx) / S, (y + dy) / S, value, f=fnt, anchor="mm", fill="#30444b", stroke="#ffffffee", sw=3)
            return True
    return False


label_items = []
for feat in features:
    props = feat["properties"]
    if props["city"] in ("香港", "澳门"):
        continue
    key = f"{props['city']}|{props['name']}"
    data = mainland_data.get(key)
    if not data:
        continue
    price = data[0]
    c = props.get("centroid") or props.get("center") or city_centers[props["city"]]
    x, y = project(c)
    label = props["name"].replace("区", "").replace("县", "").replace("市", "").replace("镇", "")
    label_items.append((price, x, y + 26, label))

for price, x, y, label in sorted(label_items, reverse=True):
    try_label(x, y, label, price)

lx, ly = 112, 1720
text(lx, ly - 40, "色阶：内地住宅挂牌均价", f=font(30, True), fill="#1c2f36")
legend_labels = ["<8k", "8-12k", "12-18k", "18-30k", "30-50k", "50-80k", "80k+"]
for i, col in enumerate(colors):
    x = lx + i * 145
    rounded_rect((x, ly, x + 126, ly + 34), 6, col)
    text(x, ly + 72, legend_labels[i], f=font(24), fill="#66777c")

rounded_rect((2350, 278, 3130, 1888), 26, "#ffffffff", "#dbe6e3", 1)
text(2410, 382, "城市均价排行", f=font(38, True), fill="#1c2f36")
text(2410, 424, "内地9市，住宅挂牌均价", f=font(24), fill="#66777c")
for i, (city, price, mom) in enumerate(city_stats):
    y = 492 + i * 72
    bar_w = 390 * price / 70736
    text(2410, y, city, f=font(30, True), fill="#21313a")
    rounded_rect((2552, y - 26, 2552 + bar_w, y), 7, "#2f89a6")
    text(2990, y, f"{price:,}", f=font(28), fill="#173864", anchor="ra")
    text(3090, y, mom, f=font(22), fill="#1d8567" if mom.startswith("+") else "#b44b42", anchor="ra")

draw.line((2410 * S, 1170 * S, 3090 * S, 1170 * S), fill="#e4ece9", width=2 * S)
text(2410, 1240, "香港最新分区指数", f=font(34, True), fill="#1c2f36")
text(2410, 1280, "中原城市分区领先指数；括号为4月成交", f=font(22), fill="#66777c")
for i, (region, idx, mom, deals) in enumerate(hk_stats):
    y = 1342 + i * 62
    text(2410, y, region, f=font(25), fill="#21313a")
    text(2615, y, idx, f=font(34, True), fill="#173864")
    text(2805, y, mom, f=font(23), fill="#1d8567")
    text(3090, y, deals, f=font(22), fill="#66777c", anchor="ra")

draw.line((2410 * S, 1615 * S, 3090 * S, 1615 * S), fill="#e4ece9", width=2 * S)
text(2410, 1686, "澳门最新指数", f=font(34, True), fill="#1c2f36")
for i, (label, val, change) in enumerate(macau_stats):
    y = 1746 + i * 52
    text(2410, y, label, f=font(24), fill="#21313a")
    text(2798, y, val, f=font(32, True), fill="#173864")
    text(3090, y, change, f=font(22), fill="#66777c", anchor="ra")

top = sorted(
    [(k.split("|")[0], k.split("|")[1], v[0], v[1]) for k, v in mainland_data.items()],
    key=lambda x: x[2],
    reverse=True,
)[:12]
text(86, 2055, "区县高价 Top 12", f=font(34, True), fill="#1c2f36")
for i, (city, name, price, mom) in enumerate(top):
    x = 86 + (i % 6) * 345
    y = 2120 + (i // 6) * 70
    text(x, y, f"{i + 1}. {city}{name.replace(city, '')}", f=font(24), fill="#21313a")
    text(x, y + 34, f"{price:,} 元/㎡ {mom}", f=font(21), fill="#66777c")

sources = [
    "内地9市：禧泰数据/中国房价行情，住宅挂牌均价，2026年4月。",
    "香港：中原地产 Centadata，分区指数与4月成交，2026/05/08更新。",
    "澳门：澳门统计暨普查局，2026年第一季住宅楼价指数，2026/05/08发布。",
    "底图：阿里云 DataV.GeoAtlas。港澳口径不同，不纳入元/㎡色阶。",
]
text(2350, 2055, "说明", f=font(34, True), fill="#1c2f36")
for i, s in enumerate(sources):
    text(2350, 2120 + i * 44, s, f=font(22), fill="#66777c")

img = img.resize((W, H), Image.Resampling.LANCZOS)
img.save(OUT)
print(OUT)
