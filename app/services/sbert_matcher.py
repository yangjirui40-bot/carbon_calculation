"""SBERT 语义对齐（物料名称 -> 国民经济部门 -> 排放因子）的轻量实现。

说明：生产环境的 SBERT 使用孪生网络将物料名与部门描述映射为稠密向量后计算余弦相似度。
本模块在不依赖重型模型的前提下，以字符 n-gram TF-IDF 向量 + 余弦相似度实现同一“语义对齐”目标，
并保留可插拔的 SBERT 后端接口。若安装了 sentence-transformers，可启用真实嵌入。
"""
from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass, field


@dataclass
class SectorDef:
    category: str
    name_zh: str
    description: str = ""
    keywords: list[str] = field(default_factory=list)
    factor_id: str | None = None

    def signature(self) -> str:
        return " ".join([self.name_zh, self.description, *self.keywords])


# 演示部门目录：覆盖电子元器件 / PCB 材料 / 包装材料，可扩展至 153 个国民经济部门。
SECTOR_CATALOG: list[SectorDef] = [
    SectorDef(
        category="electronic_components",
        name_zh="电子元器件",
        description="电子元器件制造、半导体、集成电路",
        keywords=[
            "电阻", "电容", "电感", "芯片", "集成电路", "IC", "晶圆", "单晶硅片", "硅片",
            "半导体", "传感器", "二极管", "三极管", "连接器", "继电器", "晶振", "存储器",
            "微处理器", "电子元件", "元器件", "被动元件", "MOSFET", "IGBT",
        ],
        factor_id="DEMO_EEIO_01",
    ),
    SectorDef(
        category="pcb_materials",
        name_zh="印制电路板及材料",
        description="印制电路板、覆铜板、PCB 基板材料制造",
        keywords=[
            "PCB", "电路板", "印制电路", "覆铜板", "基板", "铜箔", "FR4", "环氧树脂",
            "焊料", "焊锡", "阻焊", "绿油", "玻纤布", "压合", "钻孔", "线路板", "多层板",
        ],
        factor_id="DEMO_EEIO_02",
    ),
    SectorDef(
        category="packaging_materials",
        name_zh="包装材料",
        description="包装箱、包装盒、缓冲材料制造",
        keywords=[
            "包装", "纸盒", "纸箱", "瓦楞", "泡棉", "气泡膜", "珍珠棉", "胶带", "标签",
            "托盘", "薄膜", "封箱", "打包", "内衬", "卡纸", "说明书", "塑封",
        ],
        factor_id="DEMO_EEIO_03",
    ),
    SectorDef(
        category="electricity",
        name_zh="外购电力",
        description="外购电力能源",
        keywords=["电费", "电力", "电", "kWh", "用电", "国网", "电费单", "电量"],
        factor_id="DEMO_ELEC_01",
    ),
    SectorDef(
        category="diesel_combustion",
        name_zh="柴油燃烧",
        description="柴油、燃油直接燃烧",
        keywords=["柴油", "燃油", "汽油", "柴油耗用", "油耗", "柴油用量"],
        factor_id="DEMO_DIESEL_01",
    ),
]


def _ngrams(text: str, n: int = 2) -> Counter:
    text = text.lower().strip()
    if not text:
        return Counter()
    # 中文字符按单字、英文按字符 n-gram 切分，兼顾中英物料名。
    toks = []
    for ch in text:
        if ch.isspace() or ch in "，。、；：（）()[]{}【】,.-_/":
            continue
        toks.append(ch)
    grams = []
    for i in range(len(toks)):
        grams.append(toks[i])
        if n >= 2 and i + 1 < len(toks):
            grams.append("".join(toks[i : i + n]))
    return Counter(grams)


def _cosine(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    dot = sum(a[k] * b[k] for k in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def match_material(
    material_name: str,
    catalog: list[SectorDef] | None = None,
    threshold: float = 0.12,
) -> dict:
    """返回物料名称的最佳部门匹配结果。

    优先使用真实 SBERT 嵌入模型（bge-small-zh）计算语义余弦相似度；
    模型未就绪时回退到字符 n-gram TF-IDF 余弦相似度（轻量实现，接口一致）。
    """
    catalog = catalog or SECTOR_CATALOG

    # 真实 SBERT 语义对齐
    try:
        from .ai import sbert as sb

        engine = sb._get_engine()
        if engine is not None:
            res = engine.match(
                material_name,
                [
                    {"category": s.category, "name_zh": s.name_zh,
                     "description": s.description, "factor_id": s.factor_id}
                    for s in catalog
                ],
            )
            if res:
                return res
    except Exception:  # noqa: BLE001
        pass

    # 轻量回退：字符 n-gram TF-IDF + 余弦相似度
    q = _ngrams(material_name)
    candidates = []
    for sec in catalog:
        sim = _cosine(q, _ngrams(sec.signature()))
        candidates.append(
            {
                "category": sec.category,
                "name_zh": sec.name_zh,
                "factor_id": sec.factor_id,
                "similarity": round(sim, 6),
            }
        )
    candidates.sort(key=lambda x: x["similarity"], reverse=True)
    best = candidates[0]
    matched = best["similarity"] >= threshold
    return {
        "material_name": material_name,
        "matched": matched,
        "matched_category": best["category"] if matched else None,
        "matched_factor_id": best["factor_id"] if matched else None,
        "confidence": best["similarity"],
        "candidates": candidates[:5],
    }


__all__ = ["SECTOR_CATALOG", "SectorDef", "match_material"]
