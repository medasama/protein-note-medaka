"""日本食品標準成分表（八訂）増補2023年 の Excel から、ほかの栄養素（設定でオンにしたときだけ読む）nutri.json を作る。

使い方: python3 -I build_nutri.py <成分表xlsx> <出力nutri.json>

出力形式:
  {"source": {...}, "keys": [...], "foods": {"食品番号": [値, ...]}}
  値は可食部100gあたり。Tr（微量）は 0、「-」（未測定）は null。括弧付き（推定値）はそのまま数値として使う。
  ビオチンは未測定の食品が多い（約半分）ため入れていない。
"""
import json
import sys

import openpyxl

src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, read_only=True)
rows = list(wb["表全体"].iter_rows(values_only=True))
ids = [str(x).strip() if x is not None else None for x in rows[11]]

# [キー, 成分識別子]
COLS = [
    ("salt", "NACL_EQ"), ("fib", "FIB-"), ("ca", "CA"), ("fe", "FE"),
    ("va", "VITA_RAE"), ("vd", "VITD"), ("ve", "TOCPHA"), ("vk", "VITK"),
    ("b1", "THIA"), ("b2", "RIBF"), ("ne", "NE"), ("b6", "VITB6A"), ("b12", "VITB12"),
    ("fol", "FOL"), ("pant", "PANTAC"), ("vc", "VITC"),
]
idx = []
for k, cid in COLS:
    assert cid in ids, cid
    idx.append(ids.index(cid))


def parse(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("†", "")
    if s in ("-", ""):
        return None
    s = s.strip("()")
    if s == "Tr":
        return 0.0
    try:
        return float(s)
    except ValueError:
        raise ValueError(f"unexpected value: {v!r}")


foods = {}
for r in rows[12:]:
    if not r[1]:
        continue
    vals = []
    for i in idx:
        x = parse(r[i])
        vals.append(None if x is None else (int(x) if x == int(x) and abs(x) >= 1 else round(x, 3)))
    foods[str(r[1])] = vals

json.dump({
    "source": {"title": "日本食品標準成分表（八訂）増補2023年", "publisher": "文部科学省 科学技術・学術審議会 資源調査分科会",
               "file": "第2章（データ）Excel 2026年3月27日掲載版", "unit": "可食部100gあたり"},
    "keys": [k for k, _ in COLS],
    "foods": foods,
}, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(foods), "foods")
