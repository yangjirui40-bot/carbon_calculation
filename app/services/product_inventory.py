"""Structured product inventory from an issued BOM snapshot; original values are immutable."""
from sqlalchemy import select
from ..models import EmissionFactor
from ..models.company_factors import CompanyFactorVersion as FactorVersion
from ..models.enterprise_domains import BomLine, MeasurementUnit, PcfInventoryItem, ProductVersion
from ..models.product_versions import BomVersion, ProductStudy


def capture(db, study, bom):
    cid = study.tenant_id
    spec = bom.content.get("product") or {}
    if not db.query(ProductVersion.id).filter_by(bom_version_id=bom.id).first():
        unit = db.query(MeasurementUnit.id).filter_by(ucum_code=spec.get("product_unit")).scalar()
        db.add(ProductVersion(tenant_id=cid,product_id=bom.product_id,version_no=bom.version_no,declared_unit_id=unit,
                              stable_spec=spec,valid_from=study.start_on,bom_version_id=bom.id))
        db.flush()
    lines = {line.item_code:line for line in db.query(BomLine).filter_by(bom_version_id=bom.id)}
    seen = {v for v, in db.query(PcfInventoryItem.bom_line_id).filter_by(study_id=study.id)}
    for item in bom.content.get("bom_items",[]):
        code=str(item["bom_item_id"])
        item_key="item:"+code
        if item_key not in lines:
            parent=None
            prefix=[]
            for group in filter(None,(item.get("assembly_path") or "").split("/")):
                prefix.append(group.strip())
                key="group:"+"/".join(prefix)
                if key not in lines:
                    lines[key]=BomLine(tenant_id=cid,bom_version_id=bom.id,item_code=key,material_name=group,
                                       parent_line_id=parent.id if parent else None)
                    db.add(lines[key]);db.flush()
                parent=lines[key]
            line=BomLine(tenant_id=cid,bom_version_id=bom.id,item_code=item_key,material_name=item["material_name"],
                             purchase_value=item["material_amount"],parent_line_id=parent.id if parent else None)
            db.add(line);db.flush()
            lines[item_key]=line
        line=lines[item_key]
        if line.id in seen:
            continue
        fid=item.get("matched_factor_id")
        version=db.query(FactorVersion.id).join(EmissionFactor,EmissionFactor.id==FactorVersion.emission_factor_id).filter(
            EmissionFactor.factor_id==fid,FactorVersion.tenant_id==cid).scalar()
        db.add(PcfInventoryItem(tenant_id=cid,study_id=study.id,bom_line_id=line.id,stage_code="purchased_materials",
                data_origin="frozen_bom",factor_version_id=version,net_amount=item["material_amount"],currency=item["currency"]))
        seen.add(line.id)


def backfill(db):
    exists=select(PcfInventoryItem.id).where(PcfInventoryItem.study_id==ProductStudy.id).exists()
    for study,bom in db.query(ProductStudy,BomVersion).join(BomVersion,BomVersion.id==ProductStudy.bom_version_id).filter(~exists):
        capture(db,study,bom)
