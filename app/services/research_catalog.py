"""Immutable inputs for a reproducible 2017 domestic production-sector estimate."""
from decimal import Decimal
from hashlib import sha256
import json
import numpy as np
from sqlalchemy import text

from ..database import SessionLocal
from ..models import EmissionFactor
from ..models.enterprise_controls import FactorSet, FactorSetEntry, IoDatasetVersion, IoIntensity, IoSector, IoSectorMap
from . import calculate_eiolca
from .factor_library import FACTOR_SETS
from .io_tables import IO_DIR, CATEGORY_TO_SECTOR, SECTORS_42, load_g, build_system


def mappings(db):
    result = {}
    for code, category, factor in db.query(FactorSetEntry.set_code, FactorSetEntry.category, FactorSetEntry.factor_id):
        result.setdefault(code,{})[category] = factor
    return result


def load_reference_catalog():
    with SessionLocal.begin() as db:
        if db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(79116286)"))
        available = {f for f, in db.query(EmissionFactor.factor_id)}
        for code, items in FACTOR_SETS.items():
            if not set(items.values()) <= available:
                continue
            if not db.get(FactorSet,code):
                db.add(FactorSet(code=code,purpose="product" if code.endswith("footprint") else "enterprise"))
                db.flush()
            for category,factor in items.items():
                if not db.get(FactorSetEntry,(code,category)):
                    db.add(FactorSetEntry(set_code=code,category=category,factor_id=factor))
        if not (IO_DIR / "g_2017.csv").exists():
            return
        metadata = json.loads((IO_DIR / "g_2017.metadata.json").read_text())
        for filename, key in (("io2017_42sector.csv","io_sha256"),("g_2017.csv","g_sha256"),
                              ("ceads_2017_crosswalk.csv","crosswalk_sha256")):
            if sha256((IO_DIR / filename).read_bytes()).hexdigest() != metadata.get(key):
                raise ValueError("投入产出来源摘要不符：" + filename)
        digest = sha256(json.dumps([metadata,CATEGORY_TO_SECTOR],sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        if db.query(IoDatasetVersion.id).filter_by(digest=digest).first():
            return
        system = build_system()
        matrix = np.array(system["A"])
        names = system["sectors"]
        if (len(set(names)) != 42 or set(names) != set(SECTORS_42) or not np.isfinite(matrix).all()
                or min(system["X_wan"]) <= 0 or max(abs(np.linalg.eigvals(matrix))) >= 1):
            raise ValueError("投入产出矩阵无法用于可复核的采购估算")
        g = dict(zip(SECTORS_42,load_g(),strict=True))
        dataset = IoDatasetVersion(digest=digest,price_year=metadata["io_year"],source_metadata=metadata,
                                   matrix=system["A"],domestic_adjusted=system["domestic_adjusted"])
        db.add(dataset)
        db.flush()
        sectors = {name:IoSector(dataset_id=dataset.id,position=i,name=name) for i,name in enumerate(names)}
        db.add_all(sectors.values())
        db.flush()
        for name,sector in sectors.items():
            db.add(IoIntensity(sector_id=sector.id,kg_co2_per_wan=Decimal(str(g[name]))))
        for category, candidates in CATEGORY_TO_SECTOR.items():
            sector = next((sectors[n] for n in candidates if n in sectors),None)
            if sector:
                db.add(IoSectorMap(dataset_id=dataset.id,category=category,sector_id=sector.id))


def version(db, dataset_id=None):
    query = db.query(IoDatasetVersion)
    return db.get(IoDatasetVersion,dataset_id) if dataset_id is not None else query.order_by(IoDatasetVersion.id.desc()).first()


def contents(db,dataset):
    sectors = db.query(IoSector,IoIntensity).join(IoIntensity,IoIntensity.sector_id==IoSector.id).filter(
        IoSector.dataset_id==dataset.id).order_by(IoSector.position).all()
    maps = dict(db.query(IoSectorMap.category,IoSector.name).join(IoSector,IoSector.id==IoSectorMap.sector_id).filter(
        IoSectorMap.dataset_id==dataset.id).all())
    return sectors,maps


def estimate(db,dataset,amounts):
    sectors, maps = contents(db,dataset)
    names = [s.name for s,_ in sectors]
    y = np.zeros(len(names))
    for category, amount in amounts.items():
        if category not in maps:
            raise ValueError("采购类别无法映射：" + category)
        value = float(amount)
        if not np.isfinite(value) or value < 0:
            raise ValueError("采购金额必须是非负有限数值")
        y[names.index(maps[category])] += value
    result = calculate_eiolca(y=y,A=dataset.matrix,g=[float(i.kg_co2_per_wan) / 10000 for _,i in sectors],sector_names=names)
    result.pop("A", None)
    result.pop("I_minus_A_inverse", None)
    return {**result,"is_demo":False,"parameter_status":"registered_research_dataset",
            "unit_note":"g/f: kgCO2/2017-CNY; y: 2017-CNY; E: kgCO2","dataset_id":dataset.id,"dataset_digest":dataset.digest,"gas_coverage":"CO2-only",
            "price_year":dataset.price_year,"mapping":{k:maps[k] for k in amounts},"domestic_adjusted":dataset.domestic_adjusted}
