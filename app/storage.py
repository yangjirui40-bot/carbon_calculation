"""文件存储抽象：本地磁盘（默认）与 S3/OSS 兼容后端（可插拔）。"""
from __future__ import annotations

from pathlib import Path

from .config import BASE_DIR, settings


class LocalStorage:
    backend = "local"

    def __init__(self):
        self.root = BASE_DIR / "storage"
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if not str(p).startswith(str(self.root.resolve())):
            raise ValueError("非法存储键")
        return p

    def save(self, key: str, data: bytes) -> str:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return str(p)

    def load(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path(key).exists()


class S3Storage:
    backend = "s3"

    def __init__(self):
        import boto3  # 懒加载：未安装 boto3 时不影响其它功能

        kwargs = {}
        if settings.S3_ENDPOINT:
            kwargs["endpoint_url"] = settings.S3_ENDPOINT
        if settings.S3_REGION:
            kwargs["region_name"] = settings.S3_REGION
        self.client = boto3.client(
            "s3",
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            **kwargs,
        )
        self.bucket = settings.S3_BUCKET

    def save(self, key: str, data: bytes) -> str:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data)
        return f"s3://{self.bucket}/{key}"

    def load(self, key: str) -> bytes:
        obj = self.client.get_object(Bucket=self.bucket, Key=key)
        return obj["Body"].read()

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False


_storage = None


def get_storage():
    global _storage
    if _storage is None:
        if settings.STORAGE_BACKEND == "s3" and settings.S3_BUCKET:
            _storage = S3Storage()
        else:
            _storage = LocalStorage()
    return _storage


__all__ = ["get_storage", "LocalStorage", "S3Storage"]
