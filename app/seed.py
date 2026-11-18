"""数据库建库与演示数据种子脚本。运行：python -m app.seed"""
from __future__ import annotations

from datetime import date

from .config import settings
from .database import Base, SessionLocal, engine
from .models import (
    BOMItem,
    BusinessRecord,
    CarbonQuota,
    Company,
    EmissionFactor,
    Product,
    ReductionPlan,
    Supplier,
    SupplyChainEdge,
    User,
)
from .security import hash_password
from .services import load_factors
from .services.billing_service import seed_plans, subscribe
from .services.calculation_service import run_enterprise, run_eiolca, run_product, run_scenario_calc

_CATEGORY_SCOPE = {
    "diesel_combustion": "scope1",
    "electricity": "scope2",
    "electronic_components": "scope3",
    "pcb_materials": "scope3",
    "packaging_materials": "scope3",
}


def _seed_factors(db) -> None:
    if db.query(EmissionFactor).count() > 0:
        _seed_official_factors(db)
        return
    factors = load_factors(settings.factor_csv_path)
    for fid, f in factors.items():
        db.add(EmissionFactor(
            factor_id=f["factor_id"],
            category=f["category"],
            scope=_CATEGORY_SCOPE.get(f["category"], "scope3"),
            value=float(f["value"]),
            unit=f["unit"],
            version=f.get("version", "demo-v1"),
            origin=f.get("origin", ""),
            price_basis=f.get("price_basis") or None,
            is_demo=bool(f.get("is_demo", True)),
            uncertainty_pct=10.0,
            description="演示排放因子（项目设定）",
        ))
    db.commit()
    _seed_official_factors(db)


def _seed_official_factors(db) -> None:
    """写入官方因子（生态环境部/统计局公告口径），幂等。"""
    from .services.factor_library import OFFICIAL_FACTORS

    for f in OFFICIAL_FACTORS:
        existing = db.query(EmissionFactor).filter(EmissionFactor.factor_id == f["factor_id"]).first()
        if existing:
            continue
        db.add(EmissionFactor(**f))
    db.commit()


def _seed_users(db) -> None:
    if db.query(User).count() > 0:
        return
    db.add(User(
        username=settings.FIRST_ADMIN_USERNAME,
        email=settings.FIRST_ADMIN_EMAIL,
        hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD),
        role="admin",
    ))
    db.commit()


def _seed_demo_users(db, company: Company) -> None:
    """与前端交付约定一致的演示账号（企业/审计员/供应商门户）。"""
    demo_users = [
        dict(username="enterprise", email="enterprise@carbonspeed.local", password="enterprise123",
             role="enterprise", company_id=company.id, supplier_id=None),
        dict(username="auditor", email="auditor@carbonspeed.local", password="auditor123",
             role="auditor", company_id=None, supplier_id=None),
        dict(username="supplier", email="supplier@carbonspeed.local", password="supplier123",
             role="supplier", company_id=None, supplier_id="sup-t1-a"),
    ]
    for u in demo_users:
        if db.query(User).filter(User.username == u["username"]).first():
            continue
        db.add(User(
            username=u["username"], email=u["email"],
            hashed_password=hash_password(u["password"]),
            role=u["role"], company_id=u["company_id"], supplier_id=u["supplier_id"],
        ))
    db.commit()


def _seed_company(db) -> Company:
    c = db.query(Company).filter(Company.code == "demo-001").first()
    if not c:
        c = Company(
            code="demo-001", name="湖南湘芯传感器制造有限公司",
            industry="智能传感器制造", region="湖南省长沙市", scale="中型",
            contact_name="张经理", contact_phone="13800000000",
            contact_email="contact@xiangxin.local",
            description="长株潭电子信息制造业中小企业示范企业",
        )
        db.add(c)
        db.commit()
        db.refresh(c)
    return c


def _seed_records(db, company: Company) -> None:
    if db.query(BusinessRecord).filter(BusinessRecord.company_id == company.id).count() > 0:
        return
    records = [
        dict(record_no="r001", period="2026-10", category="diesel_combustion", scope="scope1",
             quantity=40, unit="L", factor_id="DEMO_DIESEL_01"),
        dict(record_no="r002", period="2026-10", category="electricity", scope="scope2",
             quantity=1200, unit="kWh", factor_id="DEMO_ELEC_01"),
        dict(record_no="r003", period="2026-10", category="electronic_components", scope="scope3",
             amount=10000, currency="CNY", factor_id="DEMO_EEIO_01"),
        # 追加历史月度数据，用于驾驶舱时序趋势
        dict(record_no="r004", period="2026-08", category="electricity", scope="scope2",
             quantity=1180, unit="kWh", factor_id="DEMO_ELEC_01"),
        dict(record_no="r005", period="2026-09", category="electricity", scope="scope2",
             quantity=1210, unit="kWh", factor_id="DEMO_ELEC_01"),
        dict(record_no="r006", period="2026-11", category="electricity", scope="scope2",
             quantity=1190, unit="kWh", factor_id="DEMO_ELEC_01"),
    ]
    for r in records:
        db.add(BusinessRecord(company_id=company.id, review_status="confirmed", source="manual", **r))
    db.commit()


def _seed_product(db, company: Company) -> Product:
    p = db.query(Product).filter(Product.product_id == "p001").first()
    if not p:
        p = Product(product_id="p001", product_name="控制板模块", company_id=company.id,
                    output_quantity=1000, product_unit="件",
                    description="智能传感器核心控制板")
        db.add(p)
        db.commit()
        db.refresh(p)
    if db.query(BOMItem).filter(BOMItem.product_id == p.id).count() == 0:
        bom = [
            dict(bom_item_id="b001", material_name="电子元器件", material_amount=7000,
                 matched_category="electronic_components", matched_factor_id="DEMO_EEIO_01", match_confidence=0.98),
            dict(bom_item_id="b002", material_name="PCB基板", material_amount=2000,
                 matched_category="pcb_materials", matched_factor_id="DEMO_EEIO_02", match_confidence=0.96),
            dict(bom_item_id="b003", material_name="包装纸盒", material_amount=1000,
                 matched_category="packaging_materials", matched_factor_id="DEMO_EEIO_03", match_confidence=0.95),
        ]
        for b in bom:
            db.add(BOMItem(product_id=p.id, **b))
        db.commit()
    return p


def _seed_supply_chain(db, company: Company) -> None:
    if db.query(Supplier).filter(Supplier.company_id == company.id).count() > 0:
        return
    suppliers = [
        dict(supplier_id="sup-t1-a", name="硅晶圆供应商A", industry="半导体材料", region="江苏",
             tier=1, carbon_intensity=0.42, annual_emissions=5200, risk_level="yellow"),
        dict(supplier_id="sup-t1-b", name="封装材料供应商B", industry="封装材料", region="广东",
             tier=1, carbon_intensity=0.35, annual_emissions=4100, risk_level="yellow"),
        dict(supplier_id="sup-t2-a", name="上游硅料供应商", industry="硅料", region="新疆",
             tier=2, carbon_intensity=None, annual_emissions=None, risk_level="green"),
        dict(supplier_id="sup-t2-b", name="上游化学品供应商", industry="电子化学品", region="上海",
             tier=2, carbon_intensity=None, annual_emissions=None, risk_level="green"),
        dict(supplier_id="sup-t3-a", name="三级原材料供应商", industry="基础化工", region="山东",
             tier=3, carbon_intensity=None, annual_emissions=None, risk_level="green"),
    ]
    for s in suppliers:
        db.add(Supplier(company_id=company.id, **s))
    db.commit()

    edges = [
        dict(source_id=company.code, target_id="sup-t1-a", relation_type="purchase", amount=800000),
        dict(source_id=company.code, target_id="sup-t1-b", relation_type="purchase", amount=600000),
        dict(source_id="sup-t1-a", target_id="sup-t2-a", relation_type="purchase", amount=400000),
        dict(source_id="sup-t1-a", target_id="sup-t2-b", relation_type="purchase", amount=300000),
        dict(source_id="sup-t1-b", target_id="sup-t2-b", relation_type="purchase", amount=250000),
        dict(source_id="sup-t2-a", target_id="sup-t3-a", relation_type="purchase", amount=180000),
    ]
    for e in edges:
        db.add(SupplyChainEdge(**e))
    db.add(CarbonQuota(company_id=company.id, supplier_id="sup-t1-a", year=2026,
                       allocated_quota=6000, used_quota=5200))
    db.add(CarbonQuota(company_id=company.id, supplier_id="sup-t1-b", year=2026,
                       allocated_quota=4500, used_quota=4100))
    db.add(ReductionPlan(plan_id="plan-001", company_id=company.id, title="一级供应商年度减排5%",
                         target_supplier_id="sup-t1-a", target_reduction_rate=0.05,
                         progress=0.3, status="ongoing", deadline=date(2026, 12, 31)))
    db.commit()


def _run_demo_calculations(db, company: Company, product: Product) -> None:
    if db.query(BusinessRecord).count() and not _has_runs(db):
        run_enterprise(db, company_id=company.id, period="2026-10")
        run_eiolca(db, purchase_vector_cny=[7000, 2000, 1000], company_id=company.id)
        run_product(db, product_id=product.product_id, company_id=company.id)
        run_scenario_calc(db, company_id=company.id, scenario_id="sc001", scenario_name="节电10%",
                          electricity_saving_rate=0.10, procurement_reduction_rate=0.0)
        run_scenario_calc(db, company_id=company.id, scenario_id="sc002", scenario_name="节电15%＋采购减少5%",
                          electricity_saving_rate=0.15, procurement_reduction_rate=0.05)


def _has_runs(db) -> bool:
    from .models import CalculationRun
    return db.query(CalculationRun).count() > 0


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_plans(db)
        _seed_factors(db)
        _seed_users(db)
        company = _seed_company(db)
        _seed_demo_users(db, company)
        subscribe(db, company.id, "pro")
        _seed_records(db, company)
        product = _seed_product(db, company)
        _seed_supply_chain(db, company)
        _run_demo_calculations(db, company, product)
        # 构建 OLAP 星型模型（维度 + 事实表）
        from .services.olap import refresh_olap
        refresh_olap(db)
        print("种子数据完成。管理员 admin/admin123；演示账号 enterprise/enterprise123、auditor/auditor123、supplier/supplier123（sup-t1-a 门户）；OLAP 星型模型已构建")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
