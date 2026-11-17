"""演示因子加载工具。因子数据本身来自项目提供的业务分类与演示数据表。"""
import csv
from pathlib import Path

def load_factors(path: str | Path) -> dict[str, dict]:
    factors = {}
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            row["value"] = float(row["value"])
            row["is_demo"] = row.get("is_demo", "true").lower() == "true"
            factors[row["factor_id"]] = row
    return factors
