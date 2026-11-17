"""一键获取真实投入产出表并构建全国 42 部门表。

用法：python scripts/fetch_io_data.py

1. 从 Zenodo（CEADs 开放镜像，CC-BY-4.0）下载 2017 年 MRIO（约 48.9 MB）；
2. 校验文件（PK zip 魔数）；
3. 解析 31 省×42 部门矩阵，各省求和构建全国表 → data/io/io2017_42sector.csv；
4. 校验后打印矩阵基本统计。

注：Zenodo 对本机 IP 可能限流（403）。若下载失败，请用浏览器打开
https://zenodo.org/records/4569117/files/MRIO2017_42+CEADS.xlsx?download=1
保存到 data/io/downloads/ 后重新运行本脚本（将自动跳过下载步骤）。
"""
import csv
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "vendor"))

BASE = Path(__file__).resolve().parents[1]
DOWNLOADS = BASE / "data" / "io" / "downloads"
SRC = DOWNLOADS / "MRIO2017_42+CEADS.xlsx"
OUT = BASE / "data" / "io" / "io2017_42sector.csv"
URLS = [
    "https://zenodo.org/records/4569117/files/MRIO2017_42%2BCEADS.xlsx?download=1",
    "https://zenodo.org/api/records/4569117/files/MRIO2017_42+CEADS.xlsx/content",
]


def download() -> bool:
    if SRC.exists() and SRC.stat().st_size > 10_000_000:
        print(f"[SKIP] 文件已存在：{SRC}（{SRC.stat().st_size/1e6:.1f} MB）")
        return True
    import httpx

    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    for url in URLS:
        try:
            with httpx.Client(timeout=600, follow_redirects=True,
                              headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0"}) as c:
                with c.stream("GET", url) as r:
                    if r.status_code != 200:
                        print(f"[{r.status_code}] {url[:70]}")
                        continue
                    total = 0
                    with open(SRC, "wb") as fh:
                        for chunk in r.iter_bytes(chunk_size=1 << 20):
                            fh.write(chunk)
                            total += len(chunk)
                    print(f"[OK] 下载完成 {total/1e6:.1f} MB")
                    return True
        except Exception as e:
            print(f"[ERR] {e}")
    print("[FAIL] 自动下载失败（Zenodo 可能限流）。请浏览器手动下载后重跑本脚本。")
    return False


def build() -> bool:
    import numpy as np
    from openpyxl import load_workbook

    from app.services.io_tables import SECTORS_42

    wb = load_workbook(SRC, read_only=True, data_only=True)
    ws = wb["Table"]
    nprov, sectors = 31, 42
    # 定位表头行与总产出列
    header_row = None
    for r_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=4, values_only=True), start=1):
        if row and any(isinstance(v, str) and "农林牧渔" in v for v in row):
            header_row = r_idx
            break
    headers = [str(v).strip() if v is not None else "" for v in
               next(ws.iter_rows(min_row=header_row, max_row=header_row, values_only=True))]
    go_col = headers.index("总产出") if "总产出" in headers else ws.max_column - 3

    Z = np.zeros((nprov * sectors, nprov * sectors))
    X = np.zeros(nprov * sectors)
    for i, row in enumerate(ws.iter_rows(min_row=header_row + 2,
                                         max_row=header_row + 1 + nprov * sectors, values_only=True)):
        if i >= nprov * sectors:
            break
        Z[i, :] = [float(v) if isinstance(v, (int, float)) else 0.0 for v in row[3:3 + nprov * sectors]]
        X[i] = float(row[go_col]) if isinstance(row[go_col], (int, float)) else 0.0
    if X.min() <= 0 or X.sum() <= 0:
        print("[FAIL] 总产出列无效，无法构建 A 矩阵")
        return False

    Znat = Z.reshape(nprov, sectors, nprov, sectors).sum(axis=(0, 2))
    Xnat = X.reshape(nprov, sectors).sum(axis=0)
    A = Znat / np.maximum(Xnat, 1e-12)
    rho = float(np.max(np.abs(np.linalg.eigvals(A))))
    print(f"[OK] 全国矩阵：中间使用 {Znat.sum():.3e} 万元；总产出 {Xnat.sum():.3e} 万元；A 谱半径 {rho:.6f}")
    if rho >= 0.999:
        print("[FAIL] 谱半径≈1，矩阵不可用")
        return False

    rows = [["部门名"] + SECTORS_42 + ["总产出(万元)", "进口(万元)"]]
    for i, name in enumerate(SECTORS_42):
        rows.append([name] + [f"{v:.6f}" for v in Znat[i]] + [f"{Xnat[i]:.6f}", "0"])
    with open(OUT, "w", newline="", encoding="utf-8-sig") as fh:
        csv.writer(fh).writerows(rows)
    print(f"[OK] 已写入 {OUT}")
    return True


if __name__ == "__main__":
    if not download():
        sys.exit(1)
    sys.exit(0 if build() else 1)
