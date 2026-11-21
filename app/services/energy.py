"""Electricity instruments are tracked in physical kWh before ownership consolidation."""
from sqlalchemy import func
from ..models import BusinessRecord, SourceDocument
from ..models.enterprise_controls import CertificateAllocation as Allocation, EnergyCertificate as Certificate


def allocated(db, company_id, **filters):
    return db.query(func.sum(Allocation.applied_kwh)).filter_by(
        company_id=company_id, cancelled_at=None, **filters).scalar() or 0


def entries(db, company_id):
    return db.query(Allocation, Certificate, BusinessRecord, SourceDocument.content_hash).join(
        Certificate, Certificate.id == Allocation.certificate_id).join(
        BusinessRecord, BusinessRecord.id == Allocation.record_id).join(
        SourceDocument, SourceDocument.id == Certificate.proof_id).filter(Allocation.company_id == company_id)


def allocation_fields(a, cert, row, proof_hash):
    return dict(id=a.id, certificate_id=cert.id, record_no=row.record_no, period=row.period,
                site_id=cert.site_id, issuer=cert.issuer, serial=cert.serial, proof_id=cert.proof_id,
                proof_sha256=proof_hash, retirement_reference=cert.retirement_reference,
                revision_id=a.revision_id, applied_kwh=format(a.applied_kwh, ".4f"))


def period_allocations(db, company_id, period):
    rows = entries(db, company_id).filter(BusinessRecord.period == period, Allocation.cancelled_at.is_(None))
    return [allocation_fields(*entry) for entry in rows.order_by(Allocation.id)]
