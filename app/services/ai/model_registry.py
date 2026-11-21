"""Record evidence from a completed trainer run without promoting the checkpoint."""
import hashlib
from pathlib import Path


def checkpoint_hash(directory):
    files=sorted(list(directory.glob("*.safetensors")) or list(directory.glob("pytorch_model*.bin")))
    if not files:
        raise ValueError("训练输出缺少权重文件")
    combined=hashlib.sha256()
    for file in files:
        digest=hashlib.sha256()
        with file.open("rb") as stream:
            for chunk in iter(lambda:stream.read(1024*1024),b""):
                digest.update(chunk)
        combined.update(file.name.encode()+b"\0"+digest.digest())
    return combined.hexdigest()


def record(company_id,args,manifest):
    from ...database import SessionLocal
    from ...models import Company
    from ...models.base import utcnow
    from ...models.enterprise_domains import ModelEvaluation,ModelRelease,ModelTrainingRun
    with SessionLocal.begin() as db:
        from ..inventory import lock_company
        lock_company(db,company_id)
        if not db.get(Company,company_id):
            raise ValueError("研究账套不存在")
        product="ser-tenant-"+str(company_id)
        digest=manifest["checkpoint_sha256"]
        release=db.query(ModelRelease).filter_by(model_code=product,version=digest).first()
        if not release:
            release=ModelRelease(model_code=product,version=digest,provider="enterprise",artifact_hash=digest,
                                  engine_type="ser",status="evaluated")
            db.add(release);db.flush()
        base_name=hashlib.sha256(args.base_model.encode()).hexdigest()
        base=db.query(ModelRelease).filter_by(model_code="ser-base",version=base_name).first()
        if not base:
            base=ModelRelease(model_code="ser-base",version=base_name,provider="trainer-config",
                              engine_type="ser_base",status="declared",artifact_uri=None)
            db.add(base);db.flush()
        splits=manifest["dataset"]
        run=None
        if manifest["training_performed"]:
            run=db.query(ModelTrainingRun).filter_by(tenant_id=company_id,checkpoint_hash=digest).first()
            if not run:
                run=ModelTrainingRun(tenant_id=company_id,base_model_id=base.id,output_model_id=release.id,
                    trainer_revision=manifest["trainer_sha256"],params={"epochs":args.epochs,"batch_size":args.batch_size,"lr":args.lr},
                    checkpoint_hash=digest,train_split_hash=splits["zh_train"]["annotation_sha256"],
                    validation_split_hash=splits["zh_val"]["annotation_sha256"],status="completed",completed_at=utcnow())
                db.add(run);db.flush()
        db.add(ModelEvaluation(tenant_id=company_id,training_run_id=run.id if run else None,model_release_id=release.id,
               evaluated_at=utcnow(),training_performed=manifest["training_performed"],data_split_hash=splits["zh_val"]["annotation_sha256"],
               metrics=manifest["metrics"],scope_note=manifest["scope"]))
