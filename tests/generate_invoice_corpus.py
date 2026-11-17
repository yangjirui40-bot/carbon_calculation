"""真实发票测试集生成器：模拟印章遮挡/折痕/污损/旋转/褪色/噪点等工业票据噪声。

python -m tests.generate_invoice_corpus [--count 8]
输出：tests/fixtures/corpus/*.png + ground_truth.json（每张图的字段真值与是否应触发纠偏）
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\simsun.ttc",
]

CORPUS_DIR = BACKEND / "tests" / "fixtures" / "corpus"


def _draw_invoice(draw, font_big, font_mid, params: dict) -> None:
    d = draw
    d.text((250, 30), "增值税专用发票", font=font_big, fill=(0, 0, 0))
    d.text((40, 90), "发票号码", font=font_mid, fill=(0, 0, 0))
    d.text((180, 90), params["invoice_no"], font=font_mid, fill=(0, 0, 0))
    d.text((40, 140), "开票日期", font=font_mid, fill=(0, 0, 0))
    d.text((180, 140), "2026-10-15", font=font_mid, fill=(0, 0, 0))
    d.text((40, 190), "购买方名称", font=font_mid, fill=(0, 0, 0))
    d.text((220, 190), "湖南湘芯传感器制造有限公司", font=font_mid, fill=(0, 0, 0))
    d.text((40, 240), "销售方名称", font=font_mid, fill=(0, 0, 0))
    d.text((220, 240), "湘芯电子元件有限公司", font=font_mid, fill=(0, 0, 0))
    d.text((40, 300), "数量", font=font_mid, fill=(0, 0, 0))
    d.text((130, 300), str(params["quantity"]), font=font_mid, fill=(0, 0, 0))
    d.text((240, 300), "单价", font=font_mid, fill=(0, 0, 0))
    d.text((330, 300), f"{params['unit_price']:.2f}", font=font_mid, fill=(0, 0, 0))
    d.text((480, 300), "税率", font=font_mid, fill=(0, 0, 0))
    d.text((560, 300), "13%", font=font_mid, fill=(0, 0, 0))
    d.text((40, 370), "不含税金额", font=font_mid, fill=(0, 0, 0))
    d.text((220, 370), f"{params['ex']:.2f}", font=font_mid, fill=(0, 0, 0))
    d.text((40, 420), "税额", font=font_mid, fill=(0, 0, 0))
    d.text((130, 420), f"{params['tx']:.2f}", font=font_mid, fill=(0, 0, 0))
    d.text((300, 420), "价税合计", font=font_mid, fill=(0, 0, 0))
    d.text((450, 420), f"{params['total']:.2f}", font=font_mid, fill=(0, 0, 0))


def _add_noise(img, mode: str, rng: random.Random):
    from PIL import Image, ImageDraw, ImageFilter

    if mode == "clean":
        return img
    if mode == "stamp":
        # 红色圆形印章（部分遮挡右下角金额区域边缘）
        from PIL import Image as _Image
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        cx, cy = 560, 470
        d.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], outline=(210, 40, 40, 210), width=8)
        d.ellipse([cx - 52, cy - 52, cx + 52, cy + 52], outline=(210, 40, 40, 150), width=3)
        return _Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    if mode == "fold":
        d = ImageDraw.Draw(img)
        for _ in range(2):
            x = rng.randint(150, 650)
            d.line([(x, 0), (x, 560)], fill=(120, 120, 120), width=rng.choice([2, 3, 4]))
        return img.filter(ImageFilter.GaussianBlur(0.4))
    if mode == "stain":
        d = ImageDraw.Draw(img)
        for _ in range(4):
            x, y = rng.randint(50, 700), rng.randint(50, 500)
            r = rng.randint(20, 55)
            d.ellipse([x - r, y - r, x + r, y + r], fill=(96, 70, 44))
        return img
    if mode == "rotate":
        return img.rotate(rng.uniform(1.5, 3.0), expand=True, fillcolor=(255, 255, 255))
    if mode == "faded":
        from PIL import ImageEnhance
        img = ImageEnhance.Brightness(img).enhance(0.55)
        return ImageEnhance.Contrast(img).enhance(0.75)
    if mode == "noise":
        import random as _r
        px = img.load()
        w, h = img.size
        for _ in range(int(w * h * 0.012)):
            px[_r.randint(0, w - 1), _r.randint(0, h - 1)] = _r.choice([(0, 0, 0), (160, 160, 160)])
        return img
    if mode == "perspective":
        # 手机拍摄的轻微透视畸变
        w, h = img.size
        coeffs = (1 - 0.045, 0.002, 0.003, -0.01, 1 - 0.03, 0.001, 0.00012, 0.00009)
        return img.transform((w, h), Image.PERSPECTIVE, coeffs, fillcolor=(255, 255, 255))
    if mode == "stamp_over_amount":
        # 印章压住"价税合计"金额（工业票据常见噪声，考验 POMDP 纠偏与人工复核）
        from PIL import Image as _Image
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        cx, cy = 500, 445
        d.ellipse([cx - 62, cy - 62, cx + 62, cy + 62], outline=(200, 30, 30, 235), width=10)
        d.ellipse([cx - 44, cy - 44, cx + 44, cy + 44], outline=(200, 30, 30, 170), width=4)
        d.line([(cx - 50, cy), (cx + 50, cy)], fill=(200, 30, 30, 150), width=6)
        return _Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    if mode == "faded_fold":
        d = ImageDraw.Draw(img)
        for _ in range(2):
            x = rng.randint(150, 650)
            d.line([(x, 0), (x, 560)], fill=(140, 140, 140), width=3)
        from PIL import ImageEnhance
        img = ImageEnhance.Brightness(img).enhance(0.72)
        return ImageEnhance.Contrast(img).enhance(0.82)
    return img


def generate(count: int = 8) -> dict:
    from PIL import Image, ImageDraw, ImageFont

    font_path = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
    if font_path is None:
        raise RuntimeError("未找到中文字体")
    big = ImageFont.truetype(font_path, 34)
    mid = ImageFont.truetype(font_path, 26)

    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    rng = random.Random(20261117)
    modes = ["clean", "stamp", "fold", "stain", "rotate", "faded", "noise", "inconsistent",
             "perspective", "stamp_over_amount", "faded_fold"]

    truth: dict = {}
    quantities = [500, 800, 1000, 1500]
    prices = [8.5, 10.0, 12.5, 0.62]

    for i, mode in enumerate(modes[:count]):
        q = rng.choice(quantities)
        p = rng.choice(prices)
        ex = round(q * p, 2)
        tx = round(ex * 0.13, 2)
        total = round(ex + tx, 2)
        drawn_total = total
        expect_correction = False
        if mode == "inconsistent":
            drawn_total = round(total + 50, 2)  # 注入错误：价税合计多 50 元
            expect_correction = True

        img = Image.new("RGB", (760, 560), color=(255, 255, 255))
        _draw_invoice(ImageDraw.Draw(img), big, mid, {
            "invoice_no": f"0577665{i}", "quantity": q, "unit_price": p,
            "ex": ex, "tx": tx, "total": drawn_total,
        })
        img = _add_noise(img, mode, rng)
        fname = f"invoice_{mode}.png"
        img.save(CORPUS_DIR / fname)

        truth[fname] = {
            "mode": mode,
            "doc_type": "invoice",
            "fields": {
                "total_amount": total, "tax_amount": tx, "tax_exclusive_amount": ex,
                "quantity": float(q), "unit_price": p, "tax_rate": 0.13,
                "invoice_date": "2026-10-15",
            },
            "expect_correction": expect_correction,
        }

    (CORPUS_DIR / "ground_truth.json").write_text(
        json.dumps(truth, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] 生成 {len(truth)} 张噪声发票测试图 → {CORPUS_DIR}")
    return truth


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=11)
    generate(ap.parse_args().count)
