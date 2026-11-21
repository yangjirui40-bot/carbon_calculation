"""Cited GWP100 characterization, restricted to the listed gases and period."""
from datetime import date
from decimal import Decimal
from ..models.enterprise_domains import GwpSet, GwpValue

EDITION="IPCC-AR6-WGI-T7.15-GWP100"
CITATION="IPCC AR6 WGI, Chapter 7, Table 7.15. https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-7/"
WEIGHTS={"CO2":"1","CH4-fossil":"29.8","CH4-non-fossil":"27.0","N2O":"273"}

def register(db):
    row=db.query(GwpSet).filter_by(edition_code=EDITION,horizon_years=100).first()
    if row is None:
        row=GwpSet(edition_code=EDITION,horizon_years=100,citation=CITATION,released_on=date(2021,8,9))
        db.add(row)
        db.flush()
        db.add_all(GwpValue(gwp_set_id=row.id,gas_code=gas,multiplier=Decimal(value)) for gas,value in WEIGHTS.items())

def edition(db):
    row=db.query(GwpSet).filter_by(edition_code=EDITION,horizon_years=100).one()
    return row,dict(db.query(GwpValue.gas_code,GwpValue.multiplier).filter_by(gwp_set_id=row.id).all())
