"""生成合成中文采购发票图片，用于真实 OCR 流水线测试。

python -m tests.make_invoice
输出：backend/tests/fixtures/invoice_demo.png
"""
from __future__ import annotations

import io
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\simsun.ttc",
]


def make_invoice(out_path: Path) -> Path:
    from PIL import Image, ImageDraw, ImageFont

    font_path = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
    if font_path is None:
        raise RuntimeError("未找到中文字体")
    big = ImageFont.truetype(font_path, 34)
    mid = ImageFont.truetype(font_path, 26)

    img = Image.new("RGB", (760, 560), color=(255, 255, 255))
    d = ImageDraw.Draw(img)

    d.text((250, 30), "增值税专用发票", font=big, fill=(0, 0, 0))
    d.text((40, 90), "发票号码", font=mid, fill=(0, 0, 0))
    d.text((180, 90), "05776654", font=mid, fill=(0, 0, 0))
    d.text((40, 140), "开票日期", font=mid, fill=(0, 0, 0))
    d.text((180, 140), "2026-10-15", font=mid, fill=(0, 0, 0))
    d.text((40, 190), "购买方名称", font=mid, fill=(0, 0, 0))
    d.text((220, 190), "湖南湘芯传感器制造有限公司", font=mid, fill=(0, 0, 0))
    d.text((40, 240), "销售方名称", font=mid, fill=(0, 0, 0))
    d.text((220, 240), "湘芯电子元件有限公司", font=mid, fill=(0, 0, 0))
    d.text((40, 300), "数量", font=mid, fill=(0, 0, 0))
    d.text((120, 300), "1000", font=mid, fill=(0, 0, 0))
    d.text((240, 300), "单价", font=mid, fill=(0, 0, 0))
    d.text((320, 300), "10.00", font=mid, fill=(0, 0, 0))
    d.text((480, 300), "税率", font=mid, fill=(0, 0, 0))
    d.text((560, 300), "13%", font=mid, fill=(0, 0, 0))
    d.text((40, 370), "不含税金额", font=mid, fill=(0, 0, 0))
    d.text((220, 370), "10000.00", font=mid, fill=(0, 0, 0))
    d.text((40, 420), "税额", font=mid, fill=(0, 0, 0))
    d.text((120, 420), "1300.00", font=mid, fill=(0, 0, 0))
    d.text((300, 420), "价税合计", font=mid, fill=(0, 0, 0))
    d.text((450, 420), "11300.00", font=mid, fill=(0, 0, 0))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    return out_path


if __name__ == "__main__":
    out = BACKEND / "tests" / "fixtures" / "invoice_demo.png"
    p = make_invoice(out)
    print("generated:", p)
    buf = io.BytesIO()
    from PIL import Image
    Image.open(p).save(buf, format="PNG")
    print("bytes:", len(buf.getvalue()))
