"""产品碳足迹（PCF）演示计算模块。

严格按当前业务需求：读取产品 BOM，匹配物料类别与演示排放因子，
计算采购上游排放估算及单位产品分摊。
注意：本模块当前只覆盖 BOM 采购上游的金额法估算，不代表完整生命周期评价。
"""
from __future__ import annotations
from models.core import CalculationError, validate_factor, _number

class ProductCarbonError(ValueError):
    pass

def calculate_product_carbon(
    product: dict,
    bom_items: list[dict],
    factors: dict[str, dict],
) -> dict:
    """计算单个产品 BOM 上游排放及单位产品分摊。"""
    product_id = product.get("product_id")
    product_name = product.get("product_name")
    output_quantity = _number(product.get("output_quantity"), "output_quantity")
    if output_quantity <= 0:
        raise ProductCarbonError("产品产出数量必须大于 0")
    product_unit = product.get("product_unit")
    if not product_unit:
        raise ProductCarbonError("缺少产品产出单位")
    if not bom_items:
        raise ProductCarbonError("BOM 明细不能为空")

    seen_ids = set()
    item_results = []
    total = 0.0
    co2_only = set()

    for item in bom_items:
        bom_id = item.get("bom_item_id")
        if not bom_id:
            raise ProductCarbonError("BOM 明细缺少 bom_item_id")
        if bom_id in seen_ids:
            raise ProductCarbonError(f"BOM 明细编号重复：{bom_id}")
        seen_ids.add(bom_id)

        category = item.get("matched_category")
        factor_id = item.get("matched_factor_id")
        if not category or not factor_id:
            raise ProductCarbonError(f"BOM 明细 {bom_id} 尚未完成类别/因子匹配")
        if factor_id not in factors:
            raise ProductCarbonError(f"BOM 明细 {bom_id} 找不到因子：{factor_id}")
        factor = factors[factor_id]
        try:
            validate_factor(factor)
        except CalculationError as exc:
            raise ProductCarbonError(str(exc)) from exc
        if factor.get("category") != category:
            raise ProductCarbonError(f"BOM 明细 {bom_id} 的因子类别不匹配")
        factor_unit = factor.get("unit")
        if factor_unit not in ("kgCO2e/CNY", "kgCO2/CNY"):
            raise ProductCarbonError(f"BOM 明细 {bom_id} 因子量纲必须为 kgCO2e/CNY 或 kgCO2/CNY")
        if factor_unit == "kgCO2/CNY":
            co2_only.add(factor_id)

        amount = _number(item.get("material_amount"), f"{bom_id}.material_amount")
        if item.get("currency", "CNY") != "CNY":
            raise ProductCarbonError(f"BOM 明细 {bom_id} 首版仅支持 CNY")
        emissions = amount * float(factor["value"])
        total += emissions
        item_results.append({
            "bom_item_id": bom_id,
            "material_name": item.get("material_name"),
            **({"assembly_path": item["assembly_path"]} if item.get("assembly_path") else {}),
            "category": category,
            "material_amount_cny": amount,
            "factor_id": factor_id,
            "factor_version": factor["version"],
            "factor_unit": factor_unit,
            "factor_kgco2e_per_cny": float(factor["value"]),
            "emissions_kgco2e": round(emissions, 8),
            "is_demo": bool(factor.get("is_demo", True)),
        })

    total = round(total, 8)
    per_unit = round(total / output_quantity, 8)
    return {
        "product_id": product_id,
        "product_name": product_name,
        "output_quantity": output_quantity,
        "product_unit": product_unit,
        "total_upstream_emissions_kgco2e": total,
        "unit_product_emissions_kgco2e": per_unit,
        "unit_label": f"kgCO2e/{product_unit}",
        "items": item_results,
        "factor_versions": sorted({x["factor_version"] for x in item_results}),
        "boundary": "BOM采购上游排放估算；不包含完整生命周期各阶段",
        "is_demo": any(item["is_demo"] for item in item_results),
        "warnings": [
            "结果仅覆盖当前BOM明细对应的采购上游排放估算。",
            "该结果是独立产品核算，不得直接加到企业Scope 1/2/3总账。",
            *[f"研究因子 {factor_id} 仅覆盖 CO₂，按 CO₂ 的当量系数 1 汇总，其他温室气体未纳入。"
              for factor_id in sorted(co2_only)],
        ],
    }
