"""Versioned attributes for structured activity data."""
from ..models.organization import ActivityRevision, OrgUnit


def activity_fields(row):
    source = row.location
    if not source:
        return {}
    return {"site_id": source.site_id, "site_code": source.site.code,
            "site_name": source.site.name, "org_unit_id": source.org_unit_id}


def apply_org_names(db, row, unit, units=None):
    if unit is None:
        return
    if row.dimensions is None:
        from ..models import RecordDimensions
        row.dimensions = RecordDimensions()
    parent = (units.get(unit.parent_id) if units is not None else db.get(OrgUnit, unit.parent_id)) if unit.parent_id else None
    row.dimensions.workshop = parent.name if parent else unit.name
    row.dimensions.production_line = unit.name if unit.kind == "line" else None


def create_activity_revision(row, user_id, reason, *, version):
    dimensions = row.dimensions
    field_names = ("record_no", "period", "category", "scope", "quantity", "unit", "amount", "currency",
                   "factor_id", "review_status", "source", "document_id", "remark")
    snapshot = {name: getattr(row, name) for name in field_names}
    if dimensions:
        snapshot.update(workshop=dimensions.workshop, production_line=dimensions.production_line,
                        scope3_category=dimensions.scope3_category)
    if row.location:
        snapshot.update(site_id=row.location.site_id, org_unit_id=row.location.org_unit_id)
    return ActivityRevision(tenant_id=row.company_id, revision_no=version, reason=reason[:500],
                            changed_by=user_id, snapshot=snapshot)


def track_activity_change(db, row, user_id, reason):
    latest = db.query(ActivityRevision.revision_no).filter_by(record_id=row.id).order_by(
        ActivityRevision.revision_no.desc()
    ).limit(1).scalar()
    if row.location or latest is not None:
        revision = create_activity_revision(row, user_id, reason, version=(latest or 0)+1)
        revision.record_id = row.id
        db.add(revision)
