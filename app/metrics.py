"""Prometheus 指标：HTTP 请求、核算耗时、解析任务与队列深度。"""
from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram, generate_latest

HTTP_REQUESTS = Counter(
    "carbonspeed_http_requests_total", "HTTP 请求总数", ["method", "path_group", "status"]
)
HTTP_LATENCY = Histogram(
    "carbonspeed_http_latency_seconds", "HTTP 请求耗时", ["method", "path_group"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300),
)
CALC_DURATION = Histogram(
    "carbonspeed_calculation_seconds", "核算耗时", ["operation"],
    buckets=(0.01, 0.05, 0.1, 0.5, 1, 5, 15, 60, 120),
)
PARSE_DURATION = Histogram(
    "carbonspeed_parse_seconds", "单据解析耗时（OCR+多模态）", buckets=(1, 5, 15, 30, 60, 120, 300)
)
QUEUE_DEPTH = Gauge("carbonspeed_job_queue_depth", "任务队列待处理数量")


def path_group(path: str) -> str:
    parts = [p for p in path.split("/") if p]
    # /api/v1/companies/1 -> companies/*
    if len(parts) >= 3 and parts[0] == "api":
        rest = parts[2:]
        grouped = []
        for i, p in enumerate(rest):
            if p.isdigit() or (len(p) >= 8 and any(c.isdigit() for c in p)):
                grouped.append("*")
            else:
                grouped.append(p)
        return "/".join(grouped) or path
    return path


def metrics_response() -> bytes:
    return generate_latest()


__all__ = [
    "HTTP_REQUESTS",
    "HTTP_LATENCY",
    "CALC_DURATION",
    "PARSE_DURATION",
    "QUEUE_DEPTH",
    "path_group",
    "metrics_response",
]
