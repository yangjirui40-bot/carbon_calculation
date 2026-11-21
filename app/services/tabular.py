"""共用 CSV / XLSX 导入读取和文件大小限制。"""
import csv
import io
from zipfile import BadZipFile, ZipFile

from openpyxl.utils.exceptions import InvalidFileException

TABULAR_ERRORS = (ValueError, BadZipFile, InvalidFileException, csv.Error, KeyError)


def iter_table(name: str, content: bytes, required: set[str], expanded_mib: int = 32):
    def validate_headers(headers):
        useful = [header for header in headers if header]
        if not required.issubset(useful):
            raise ValueError("缺少模板必填列")
        if len(useful) != len(set(useful)):
            raise ValueError("列名重复")

    if name.lower().endswith(".csv"):
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig"), newline=""))
        validate_headers(reader.fieldnames or [])
        yield from reader
        return
    if not name.lower().endswith(".xlsx"):
        raise ValueError("仅支持 CSV 或 XLSX")

    from openpyxl import load_workbook

    with ZipFile(io.BytesIO(content)) as archive:
        if sum(entry.file_size for entry in archive.infolist()) > expanded_mib * 1024 * 1024:
            raise ValueError(f"工作簿解压后超过 {expanded_mib} MB")
    workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True, keep_links=False)
    try:
        values = workbook.active.iter_rows(max_col=32, values_only=True)
        headers = next(values, ())
        validate_headers(headers)
        yield from (dict(zip(headers, row)) for row in values)
    finally:
        workbook.close()


def table_values(raw: dict) -> dict:
    if None in raw and isinstance(raw[None], list) and any(raw[None]):
        raise ValueError("数据列超出表头")
    return {key: str(value).strip() if value is not None else "" for key, value in raw.items() if key}


def table_error(exc: Exception) -> str:
    if isinstance(exc, ValueError) and not isinstance(exc, UnicodeError):
        return str(exc)[:480]
    return "表格无法读取，请使用 UTF-8 CSV 或有效的 XLSX"
