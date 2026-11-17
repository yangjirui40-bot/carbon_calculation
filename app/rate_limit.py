"""限流器：进程内滑动窗口（默认）与 Redis 固定窗口（多副本一致，可插拔）。"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from .config import settings


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int = 60):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            dq = self._hits[key]
            while dq and now - dq[0] > self.window:
                dq.popleft()
            if len(dq) >= self.limit:
                return False
            dq.append(now)
            return True

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)


class RedisRateLimiter:
    """Redis 固定窗口限流：跨进程/多副本一致，Redis 不可用时自动回退进程内。"""

    def __init__(self, limit: int, window_seconds: int = 60, redis_url: str | None = None):
        self.limit = limit
        self.window = window_seconds
        self.redis_url = redis_url or settings.REDIS_URL
        self._fallback = RateLimiter(limit, window_seconds)
        self._client = None
        self._error = None
        try:
            import redis

            self._client = redis.Redis.from_url(self.redis_url, socket_connect_timeout=2, decode_responses=True)
            self._client.ping()
        except Exception as exc:  # noqa: BLE001
            self._client = None
            self._error = str(exc)

    @property
    def backend(self) -> str:
        return "redis" if self._client else "memory"

    def allow(self, key: str) -> bool:
        if self._client is None:
            return self._fallback.allow(key)
        try:
            bucket = f"carbonspeed:rl:{key}:{int(time.time() // self.window)}"
            pipe = self._client.pipeline()
            pipe.incr(bucket)
            pipe.expire(bucket, self.window * 2)
            count = pipe.execute()[0]
            return int(count) <= self.limit
        except Exception:  # noqa: BLE001
            return self._fallback.allow(key)

    def reset(self, key: str) -> None:
        self._fallback.reset(key)


def build_limiter() -> object:
    limit = max(1, settings.RATE_LIMIT_PER_MINUTE)
    if settings.RATE_LIMIT_BACKEND == "redis":
        return RedisRateLimiter(limit, window_seconds=60)
    return RateLimiter(limit, window_seconds=60)


limiter = build_limiter()

__all__ = ["RateLimiter", "RedisRateLimiter", "limiter"]
