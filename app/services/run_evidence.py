"""Write normalized evidence together with the immutable calculation snapshot."""
from __future__ import annotations

from sqlalchemy import func, select

from ..crypto import store_secret
from ..models.evidence import CalculationInput, EmissionResultLine


def persist_lines(db, run, request, result):
    if run.status != "success":
        return
    payload = request["payload"]
    data = result["data"]
    operation = run.operation
    if operation == "eiolca":
        for number, (sector, emissions) in enumerate(data["sector_emissions_kgco2e"].items(), 1):
            db.add(EmissionResultLine(calculation_run_id=run.id, line_no=number,
                                      phase="sector", category=sector, emissions_kgco2e=emissions,
                                      is_demo=data.get("is_demo")))
        return

    if operation == "product":
        kind, inputs = "bom", payload["bom_items"]
    elif operation == "scenario":
        kind, inputs = "baseline", payload["baseline_records"]
    else:
        kind = "ledger" if "ledger_digest" in request or request.get("source") == "ledger" else "inline"
        inputs = payload["records"]
    allocations = data.get("production_allocations", [])
    sources = [
        (kind, item.get("bom_item_id") if kind == "bom" else item.get("id"), item)
        for item in inputs
    ] + [("production_allocation", item["record_no"], item) for item in allocations]
    db.add_all([
        CalculationInput(calculation_run_id=run.id, line_no=number, source_kind=source_kind,
                         source_ref=str(ref or ""),
                         period=item.get("period") if isinstance(item.get("period"), str) else None,
                         document_id=item.get("document_id") if source_kind == "ledger" else None,
                         snapshot=store_secret(item))
        for number, (source_kind, ref, item) in enumerate(sources, 1)
    ])
    db.flush()
    used = [number for number, (_, _, item) in enumerate(sources, 1)
            if number <= len(inputs) and (kind == "bom" or item.get("review_status") == "confirmed")]
    output = data.get("items", [])
    base_count = len(inputs)
    pairs = list(zip(used, output, strict=True))
    phases = {"product": "upstream", "scenario": "projection", "enterprise": "inventory"}
    lines = [(index, phases[operation], item) for index, item in pairs]
    lines.extend(
        (base_count + index, "allocated_production",
         {**item["activity"], "emissions_kgco2e": item["emissions_kgco2e"]})
        for index, item in enumerate(allocations, 1)
    )
    db.add_all([
        EmissionResultLine(
            calculation_run_id=run.id, line_no=number, input_line_no=source,
            phase=phase, scope=item.get("scope"), category=item.get("category"),
            factor_id=item.get("factor_id"), factor_version=item.get("factor_version"),
            emissions_kgco2e=item["emissions_kgco2e"], is_demo=item.get("is_demo"),
        )
        for number, (source, phase, item) in enumerate(lines, 1)
    ])


def evidence_counts(db, run):
    return {
        "inputs": db.scalar(select(func.count()).select_from(CalculationInput)
                            .where(CalculationInput.calculation_run_id == run.id)),
        "results": db.scalar(select(func.count()).select_from(EmissionResultLine)
                             .where(EmissionResultLine.calculation_run_id == run.id)),
    }


def inventory_results(db, run):
    if run.operation != "enterprise":
        return {}, False
    rows = db.execute(
        select(CalculationInput.line_no, EmissionResultLine.emissions_kgco2e)
        .outerjoin(EmissionResultLine, (EmissionResultLine.calculation_run_id == CalculationInput.calculation_run_id)
                   & (EmissionResultLine.input_line_no == CalculationInput.line_no))
        .where(CalculationInput.calculation_run_id == run.id)
    ).all()
    return dict(rows), bool(rows)
