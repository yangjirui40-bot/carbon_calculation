"""Tenant administration, organization resolution, and frozen boundary provenance."""
from fastapi import HTTPException

from ..deps import check_company_access
from ..models.inventory import InventoryPeriod
from ..models.organization import ActivityLocation, BoundaryMember, LegalEntity, OrgUnit, ReportingBoundary, ReportingPeriod, Site, TenantMember


def is_company_admin(db, user, company_id):
    if user.role == "admin":
        return True
    if user.role != "enterprise" or user.company_id != company_id:
        return False
    return db.query(TenantMember.id).filter_by(tenant_id=company_id, account_id=user.id, is_owner=True).first() is not None


def require_company_admin(db, user, company_id):
    check_company_access(db, user, company_id, write=True)
    if not is_company_admin(db, user, company_id):
        raise HTTPException(403, "需要本企业的管理员权限")


def validate_location(db, company_id, site_id, org_unit_id, *, catalog=None):
    if site_id is None:
        if org_unit_id is not None:
            raise HTTPException(422, "请先选择工厂，再选择车间或产线")
        return None, None
    if catalog is None:
        site = db.query(Site).filter_by(tenant_id=company_id, id=site_id).first()
        unit = db.query(OrgUnit).filter_by(tenant_id=company_id, id=org_unit_id).first() if org_unit_id else None
    else:
        site, unit = catalog[0].get(site_id), catalog[1].get(org_unit_id)
    if site is None:
        raise HTTPException(422, "所选工厂不存在或不属于当前企业")
    if org_unit_id is not None and (unit is None or unit.site_id != site_id):
        raise HTTPException(422, "所选组织单元不属于当前工厂")
    return site, unit


def active_boundary(db, company_id, period):
    if not company_id or not period:
        return None
    return db.query(ReportingBoundary).join(ReportingPeriod, ReportingPeriod.boundary_id == ReportingBoundary.id).join(
        InventoryPeriod, InventoryPeriod.id == ReportingPeriod.inventory_id
    ).filter(InventoryPeriod.company_id == company_id, InventoryPeriod.period == period,
             ReportingBoundary.tenant_id == company_id, ReportingPeriod.tenant_id == company_id).first()


def boundary_snapshot(db, boundary):
    if boundary is None:
        return None
    members = db.query(BoundaryMember, Site, LegalEntity).join(
        Site, Site.id == BoundaryMember.site_id
    ).join(LegalEntity, LegalEntity.id == Site.legal_entity_id).filter(
        BoundaryMember.boundary_id == boundary.id, BoundaryMember.tenant_id == boundary.tenant_id
    ).order_by(Site.id).all()
    return {"id": boundary.id, "code": boundary.code, "version": boundary.version_no,
            "title": boundary.title, "consolidation": boundary.consolidation, "note": boundary.note,
            "sites": [{"id": site.id, "code": site.code, "name": site.name, "legal_entity": entity.legal_name,
                       "share_ratio": float(member.share_ratio)} for member, site, entity in members]}


def require_period_location(db, company_id, period, site_id):
    boundary = active_boundary(db, company_id, period)
    if boundary and (not site_id or not db.get(BoundaryMember, (boundary.id, site_id))):
        raise HTTPException(422, "此月份使用已发布的盘查边界，请把活动归集至边界内的工厂")


def set_activity_location(row, site, unit):
    if site is None:
        row.location = None
    else:
        if row.location is None:
            row.location = ActivityLocation(tenant_id=row.company_id)
        row.location.site_id = site.id
        row.location.org_unit_id = unit.id if unit else None


def period_site_catalog(db, company_id):
    rows = db.query(InventoryPeriod.period, BoundaryMember.site_id).join(
        ReportingPeriod, ReportingPeriod.inventory_id == InventoryPeriod.id
    ).join(BoundaryMember, BoundaryMember.boundary_id == ReportingPeriod.boundary_id).filter(
        InventoryPeriod.company_id == company_id, ReportingPeriod.tenant_id == company_id,
        BoundaryMember.tenant_id == company_id
    )
    catalog = {}
    for month, site_id in rows:
        catalog.setdefault(month, set()).add(site_id)
    return catalog


def scope_snapshot(db, company_id, period):
    from ..models.organization import ScopeAssessment

    rows = db.query(ScopeAssessment).join(InventoryPeriod, InventoryPeriod.id == ScopeAssessment.inventory_id).filter(
        InventoryPeriod.company_id == company_id, InventoryPeriod.period == period
    ).order_by(ScopeAssessment.category)
    return [{"category": row.category, "status": row.status, "rationale": row.rationale} for row in rows]


def fix_boundary_inputs(records, boundary):
    weights = {site["id"]: site["share_ratio"] for site in boundary["sites"]}
    normalized = []
    for record in records:
        share = weights.get(record.get("site_id"))
        if share is None:
            raise HTTPException(422, "部分活动没有归集至该月边界内的工厂。请在业务台账筛查后补齐")
        changes = {"consolidation_share": share}
        for name in ("quantity", "amount"):
            if record.get(name) is not None:
                changes[f"original_{name}"] = record[name]
                changes[name] = record[name] * share
        normalized.append({**record, **changes})
    return normalized
