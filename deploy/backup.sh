#!/bin/sh
# 碳速算平台 · PostgreSQL 每日自动备份（容器内循环执行）
# 备份格式：自定义格式 dump + gzip，保留最近 7 天，存放于宿主机 ./backups/
set -e
mkdir -p /backups
echo "[backup] daily pg_dump loop started (keep 7 days)"

while true; do
  TS=$(date +%Y%m%d_%H%M%S)
  if pg_dump -h db -U carbonspeed -d carbonspeed -F c -f "/backups/carbonspeed_${TS}.dump"; then
    gzip -f "/backups/carbonspeed_${TS}.dump"
    echo "[backup] ok carbonspeed_${TS}.dump.gz"
  else
    echo "[backup] FAILED at ${TS}"
  fi
  # 清理 7 天前的备份
  find /backups -name '*.dump.gz' -mtime +7 -delete 2>/dev/null || true
  sleep 86400
done
