"""核算路由：企业 Scope 1/2/3、EIO-LCA、产品碳足迹、任务查询（多租户隔离）。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user, tenant_company_id
from ..models import CalculationRun, User
from ..schemas import EIOLCARequest, EnterpriseCalcRequest, ProductCalcRequest
from ..services.calculation_service import run_enterprise, run_eiolca, run_product

router = APIRouter(prefix="/calculations", tags=["核算"])


def _run_dict(r: CalculationRun) -> dict:
    return {
        "run_id": r.run_id, "operation": r.operation, "company_id": r.company_id,
        "product_id": r.product_id, "status": r.status,
        "algorithm_version": r.algorithm_version,
        "factor_versions": r.factor_versions,
        "total_kgco2e": (r.result or {}).get("total_kgco2e") if isinstance(r.result, dict) else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.post("/enterprise")
def calc_enterprise(payload: EnterpriseCalcRequest, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    check_company_access(db, user, payload.company_id, write=True)
    return run_enterprise(db, company_id=payload.company_id, period=payload.period,
                          records=payload.records, factor_set=payload.factor_set)


@router.post("/eiolca")
def calc_eiolca(payload: EIOLCARequest, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    return run_eiolca(db, purchase_vector_cny=payload.purchase_vector_cny, A=payload.A,
                      g=payload.g, sectors=payload.sectors)


@router.post("/product")
def calc_product(payload: ProductCalcRequest, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    return run_product(db, product_id=payload.product_id, product=payload.product,
                       bom_items=payload.bom_items, factor_set=payload.factor_set)


@router.get("")
def list_runs(company_id: int | None = None, operation: str | None = None,
              db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cid = tenant_company_id(user, company_id)
    q = db.query(CalculationRun).order_by(CalculationRun.id.desc())
    if cid:
        q = q.filter(CalculationRun.company_id == cid)
    if operation:
        q = q.filter(CalculationRun.operation == operation)
    return [_run_dict(r) for r in q.limit(200).all()]


@router.get("/{run_id}")
def get_run(run_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = db.query(CalculationRun).filter(CalculationRun.run_id == run_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="核算任务不存在")
    check_company_access(db, user, r.company_id)
    from ..crypto import read_secret
    return {
        "run_id": r.run_id, "operation": r.operation, "company_id": r.company_id,
        "product_id": r.product_id, "status": r.status, "algorithm_version": r.algorithm_version,
        "factor_versions": r.factor_versions, "result": r.result, "warnings": r.warnings,
        "error_message": r.error_message, "request_snapshot": read_secret(r.request_snapshot),
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/{run_id}/uncertainty")
def run_uncertainty(run_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """不确定性分析（ISO 14064/14067）：误差传播 + 95% 置信区间 + 敏感性排名。"""
    r = db.query(CalculationRun).filter(CalculationRun.run_id == run_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="核算任务不存在")
    check_company_access(db, user, r.company_id)
    from ..services import load_factors_from_db
    from ..services.uncertainty import from_run_result

    factors = load_factors_from_db(db)
    result = from_run_result(r.result, factors)
    result["run_id"] = run_id
    result["operation"] = r.operation
    return result


@router.post("/eiolca/table")
def calc_eiolca_table(payload: dict, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    """基于真实 42 部门投入产出表的 EIO-LCA（需 data/io 数据与 g 排放强度清单）。

    请求：{"category_amounts": {"electronic_components": 7000, ...}, "g": [...42 个...]}
    """
    from ..services.io_tables import run_eiolca_42

    category_amounts = payload.get("category_amounts")
    if not category_amounts:
        raise HTTPException(status_code=400, detail="缺少 category_amounts（业务类别->采购金额）")
    try:
        result = run_eiolca_42(category_amounts, g=payload.get("g"))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"success": True, "operation": "eiolca_42", "data": result}
