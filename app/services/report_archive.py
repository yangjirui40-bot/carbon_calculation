"""Render and store the exact downloadable bytes of newly issued reports."""
import hashlib

from sqlalchemy import select

from ..crypto import open_bytes, seal_bytes
from ..models import ReportArtifact
from .report_files import iso14064_pdf, iso14064_xml, pcf_pdf, pcf_xml

MEDIA_TYPES = {"pdf": "application/pdf", "xml": "application/xml"}


def render(report, fmt):
    pdf, xml = (pcf_pdf, pcf_xml) if report.report_type == "PCF" else (iso14064_pdf, iso14064_xml)
    content = report.content or {}
    return pdf(content, report.language) if fmt == "pdf" else xml(content)


def purpose(report, fmt):
    return f"carbonspeed:report:{report.report_no}:{fmt}".encode()


def archive_report(db, report):
    db.add(report)
    db.flush()
    if db.bind.dialect.name != "postgresql":
        from ..models import CalculationRun
        from ..models.enterprise_domains import ReportRelease
        run=db.query(CalculationRun.id).filter_by(run_id=report.run_id,company_id=report.company_id).scalar()
        db.add(ReportRelease(id=report.id,tenant_id=report.company_id,report_no=report.report_no,run_id=run,
                             report_kind=report.report_type,issue_no=report.id,assurance_state="not_independently_verified",release_state=report.status))
    for fmt in MEDIA_TYPES:
        body = render(report, fmt)
        db.add(ReportArtifact(report_id=report.id, format=fmt,
                              sha256=hashlib.sha256(body).hexdigest(), size_bytes=len(body),
                              content=seal_bytes(body, purpose(report, fmt))))
    db.commit()


def list_metadata(db, report):
    rows = db.execute(select(ReportArtifact.format, ReportArtifact.sha256,
                             ReportArtifact.size_bytes, ReportArtifact.created_at)
                      .where(ReportArtifact.report_id == report.id).order_by(ReportArtifact.format))
    return [dict(format=fmt, sha256=hash, size_bytes=size, archived_at=created.isoformat())
            for fmt, hash, size, created in rows]


def read_artifact(db, report, fmt):
    artifact = db.get(ReportArtifact, (report.id, fmt))
    if artifact is None:
        body = render(report, fmt)
        return body, hashlib.sha256(body).hexdigest(), False
    body = open_bytes(artifact.content, purpose(report, fmt))
    digest = hashlib.sha256(body).hexdigest()
    if digest != artifact.sha256 or len(body) != artifact.size_bytes:
        raise RuntimeError("Archived report failed integrity verification")
    return body, digest, True
