"""后端压测脚本：多线程并发压测核心接口，输出 RPS 与 P50/P95/P99 延迟。

用法：
  python -m tests.load_test --base http://127.0.0.1:8000 --users 20 --duration 15
"""
from __future__ import annotations

import argparse
import statistics
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "vendor"))

import httpx  # noqa: E402


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    k = (len(values) - 1) * p / 100.0
    lo, hi = int(k), min(int(k) + 1, len(values) - 1)
    return values[lo] + (values[hi] - values[lo]) * (k - lo)


def worker(base: str, token: str, stop_at: float, latencies: list[float], counts: dict, lock):
    headers = {"Authorization": f"Bearer {token}"}
    endpoints = [
        ("GET", "/healthz", None),
        ("GET", "/api/v1/dashboard/company/1/summary", headers),
        ("POST", "/api/v1/calculations/enterprise", {**headers, "Content-Type": "application/json"}),
    ]
    body = {"company_id": 1, "period": "2026-10"}
    with httpx.Client(base_url=base, timeout=60) as client:
        while time.time() < stop_at:
            for method, path, hdr in endpoints:
                t0 = time.perf_counter()
                try:
                    if method == "GET":
                        r = client.get(path, headers=hdr)
                    else:
                        r = client.post(path, headers=hdr, json=body)
                    if r.status_code in (200, 201):
                        ok = "ok"
                    elif r.status_code == 429:
                        ok = "limited"
                    else:
                        ok = "fail"
                except Exception:  # noqa: BLE001
                    ok = "fail"
                if ok != "limited":
                    latencies.append(time.perf_counter() - t0)
                with lock:
                    counts["total"] += 1
                    counts[ok] += 1


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="http://127.0.0.1:8000")
    p.add_argument("--users", type=int, default=20)
    p.add_argument("--duration", type=int, default=15)
    args = p.parse_args()

    login = httpx.post(f"{args.base}/api/v1/auth/login",
                       data={"username": "admin", "password": "admin123"}, timeout=30)
    if login.status_code != 200:
        raise SystemExit("登录失败：请先启动服务并完成种子数据（python -m app.seed）")
    token = login.json()["access_token"]

    latencies: list[float] = []
    counts = {"total": 0, "ok": 0, "fail": 0, "limited": 0}
    lock = threading.Lock()
    stop_at = time.time() + args.duration
    print(f"压测开始：{args.users} 并发 × {args.duration}s  →  {args.base}")
    with ThreadPoolExecutor(max_workers=args.users) as pool:
        futures = [pool.submit(worker, args.base, token, stop_at, latencies, counts, lock)
                   for _ in range(args.users)]
        for f in futures:
            f.result()

    total = counts["total"]
    elapsed = args.duration
    print(f"总请求：{total}　成功：{counts['ok']}　限流(429)：{counts['limited']}　失败：{counts['fail']}")
    print(f"RPS：{total / elapsed:.1f}（有效 RPS：{counts['ok'] / elapsed:.1f}，未含 429 限流响应）")
    if latencies:
        print(f"延迟：P50={percentile(latencies, 50) * 1000:.1f}ms  "
              f"P95={percentile(latencies, 95) * 1000:.1f}ms  "
              f"P99={percentile(latencies, 99) * 1000:.1f}ms  均值={statistics.mean(latencies) * 1000:.1f}ms")


if __name__ == "__main__":
    main()
