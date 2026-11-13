"""日本食品標準成分表（八訂）増補2023年 第1章（電子書籍PDF）の
「調理方法の概要及び重量変化率表」から、食品番号→重量変化率(%) を取り出す。

使い方: python3 -I extract_rates.py <第1章PDF> <出力rates.json>
必要: pip install pymupdf
各行の先頭（左端）にある5桁の食品番号と、同じ高さの右端列の数値を対応づける。
括弧付きの2行目の値（衣を除いた値など）は使わない。
"""
import json
import re
import sys

import pymupdf

src, out = sys.argv[1], sys.argv[2]
doc = pymupdf.open(src)
rates = {}
for page in doc:
    text = page.get_text()
    if '重量変化率' not in text or not re.search(r'\n\d{5}\n', text):
        continue
    words = page.get_text('words')
    width = page.rect.width
    for w in words:
        if not (re.fullmatch(r'\d{5}', w[4]) and w[0] < width * 0.12):
            continue
        y = (w[1] + w[3]) / 2
        cands = [v for v in words if v[0] > width * 0.8 and abs((v[1] + v[3]) / 2 - y) < 4
                 and re.fullmatch(r'\d+(\.\d+)?', v[4])]
        if cands:
            rates[w[4]] = float(max(cands, key=lambda v: v[0])[4])
json.dump(rates, open(out, 'w'), ensure_ascii=False, indent=0)
print('rates:', len(rates))
