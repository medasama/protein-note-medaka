"""日本食品標準成分表（八訂）増補2023年 の Excel から、ツール用の foods.json を作る。

使い方: python3 -I build_foods.py <成分表xlsx> <出力foods.json> [rates.json]

出力形式（容量を抑えるため配列）:
  {"source": {...}, "groups": [...], "foods": [[code, groupIndex, name, protein, flag, mlToG], ...]}
  protein : 可食部100gあたりの「たんぱく質」(PROT-) g。
  flag    : 0=収載値, 1=推定値（成分表で括弧付き）, 2=微量(Tr)
  mlToG   : 備考に「100 mL： X g」の記載がある食品の X（100mLあたりの重さ）。なければ null
  rate    : 調理による重量変化率(%)（第1章の表。extract_rates.py で作る）。なければ null
"""
import json
import re
import sys

import openpyxl

src, out = sys.argv[1], sys.argv[2]
rates = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}
wb = openpyxl.load_workbook(src, read_only=True)
rows = list(wb["表全体"].iter_rows(values_only=True))

header_ids = rows[11]
COL_PROT = header_ids.index("PROT-")
COL_NOTE = 61  # 備考列（成分識別子行には名前が無い）
assert COL_PROT == 9, COL_PROT

groups = [s.split("類", 1)[0] + "類" if False else s for s in wb.sheetnames[1:]]
group_names = [re.sub(r"^\d+", "", g) for g in groups]

ml_re = re.compile(r"100\s*mL\s*[：:]\s*([\d.]+)\s*g")


def parse_protein(v):
    if v is None:
        return None, None
    if isinstance(v, (int, float)):
        return float(v), 0
    s = str(v).strip()
    if s in ("-", ""):
        return None, None
    est = s.startswith("(") and s.endswith(")")
    inner = s.strip("()")
    if inner == "Tr":
        return 0.0, 2
    try:
        return float(inner), 1 if est else 0
    except ValueError:
        raise ValueError(f"unexpected protein value: {v!r}")


foods = []
skipped = []
for r in rows[12:]:
    if not r[1]:
        continue
    code = str(r[1])
    gi = int(r[0]) - 1
    name = str(r[3]).replace("　", " ").strip()
    p, flag = parse_protein(r[COL_PROT])
    if p is None:
        skipped.append((code, name))
        continue
    note = r[COL_NOTE] if len(r) > COL_NOTE else None
    ml = None
    if isinstance(note, str):
        m = ml_re.search(note.replace("　", " "))
        if m:
            ml = float(m.group(1))
    # 推定値かつ値が0（"(0)"）は「微量でもなく推定で0」→ 0扱い・推定フラグ
    foods.append([code, gi, name, round(p, 1), flag, ml, rates.get(code)])

data = {
    "source": {
        "title": "日本食品標準成分表（八訂）増補2023年",
        "publisher": "文部科学省 科学技術・学術審議会 資源調査分科会",
        "file": "第2章（データ）Excel 2026年3月27日掲載版",
        "column": "たんぱく質（PROT-）可食部100g当たり",
        "rate": "第1章 調理方法の概要及び重量変化率表（電子書籍PDF 2026年3月27日掲載版）",
    },
    "groups": group_names,
    "foods": foods,
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

print("foods:", len(foods), "skipped(no value):", len(skipped))
print("with mL note:", sum(1 for x in foods if x[5]))
print("estimated:", sum(1 for x in foods if x[4] == 1), "trace:", sum(1 for x in foods if x[4] == 2))
for s in skipped[:10]:
    print("  skip", s)
