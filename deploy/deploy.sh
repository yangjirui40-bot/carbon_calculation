#!/usr/bin/env bash
# ============================================================
# 碳速算平台 · 阿里云 2核2G 一键部署脚本（root 执行）
# 用法：
#   export DOMAIN=carbon.example.com            # 你的域名（已解析到本机）
#   export GIT_TOKEN=gho_xxx                    # 可选：仓库私有时提供只读 token
#   curl -fsSL https://.../deploy/deploy.sh | bash
#   或：bash deploy/deploy.sh
# 说明：幂等可重跑；不触碰服务器上已有的其他服务（牙科小程序等），
#       仅新增 docker/swap/本平台目录 /opt/carbonspeed 与 80/443 端口。
# ============================================================
set -euo pipefail

DOMAIN="${DOMAIN:-}"
if [ -z "$DOMAIN" ]; then
  echo "[ERROR] 请先 export DOMAIN=你的域名（已解析到本机）再运行本脚本" >&2
  exit 1
fi

APP_DIR=/opt/carbonspeed
REPO_BASE="${GIT_REPO_BASE:-https://github.com/yangjirui40-bot}"
REPO_URL="$REPO_BASE/carbon_calculation.git"
if [ -n "${GIT_TOKEN:-}" ]; then
  REPO_URL="https://${GIT_TOKEN}@github.com/yangjirui40-bot/carbon_calculation.git"
fi

echo "[1/7] 检测系统并配置国内镜像源"
. /etc/os-release 2>/dev/null || ID=unknown
case "$ID" in
  ubuntu|debian)
    export DEBIAN_FRONTEND=noninteractive
    # 传统 sources.list 格式
    if [ -f /etc/apt/sources.list ]; then
      cp /etc/apt/sources.list /etc/apt/sources.list.bak.$(date +%s) 2>/dev/null || true
      sed -i -e 's|http://archive.ubuntu.com|http://mirrors.aliyun.com|g' \
             -e 's|http://security.ubuntu.com|http://mirrors.aliyun.com|g' \
             -e 's|http://ports.ubuntu.com|http://mirrors.aliyun.com|g' \
             -e 's|http://deb.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list
    fi
    # Ubuntu 24.04 deb822 格式
    if [ -f /etc/apt/sources.list.d/ubuntu.sources ]; then
      sed -i -e 's|http://archive.ubuntu.com|http://mirrors.aliyun.com|g' \
             -e 's|http://security.ubuntu.com|http://mirrors.aliyun.com|g' \
             -e 's|http://ports.ubuntu.com|http://mirrors.aliyun.com|g' \
             /etc/apt/sources.list.d/ubuntu.sources
    fi
    apt-get update -y
    apt-get install -y --no-install-recommends curl ca-certificates git openssl
    ;;
  alinux|alinux3|anolis|rocky|centos|rhel)
    yum install -y curl ca-certificates git openssl || true
    ;;
  *)
    echo "[WARN] 未识别的系统 $ID，继续使用现有源"
    ;;
esac

echo "[2/7] 配置 4GB swap（2G 内存运行 AI 模型必要）"
if ! swapon --show 2>/dev/null | grep -q '/swapfile'; then
  if ! fallocate -l 4G /swapfile 2>/dev/null; then
    dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  fi
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
grep -q '^vm.swappiness' /etc/sysctl.conf 2>/dev/null || echo 'vm.swappiness=10' >> /etc/sysctl.conf
sysctl -w vm.swappiness=10 >/dev/null || true

echo "[3/7] 安装 Docker（含 compose 插件）"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "[ERROR] docker compose 插件不可用，请检查 docker 版本（>=20.10）" >&2
  exit 1
fi

echo "[4/7] Docker 国内镜像加速 + 日志轮转（防磁盘写满）"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run",
    "https://dockerproxy.net"
  ],
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "3" }
}
EOF
systemctl enable --now docker 2>/dev/null || systemctl restart docker || service docker restart || true

echo "[5/7] 拉取代码并生成生产密钥"
mkdir -p "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
git fetch --depth 1 origin main 2>/dev/null && git reset --hard FETCH_HEAD 2>/dev/null || true

if [ ! -f .env ]; then
  umask 077
  cat > .env <<EOF
DOMAIN=${DOMAIN}
POSTGRES_PASSWORD=$(openssl rand -hex 16)
SECRET_KEY=$(openssl rand -hex 32)
DATA_ENC_KEY=$(openssl rand -hex 32)
FIRST_ADMIN_PASSWORD=$(openssl rand -hex 8)
LLM_API_BASE=
LLM_API_KEY=
EOF
  echo "[OK] 已生成 .env（随机生产密钥）。初始管理员 admin / $(grep FIRST_ADMIN_PASSWORD .env | cut -d= -f2)"
  echo "     请立即记录该密码；登录平台后可自行修改。"
else
  echo "[OK] .env 已存在，沿用（如需更换域名请编辑 DOMAIN）"
fi

echo "[6/7] 构建并启动（首次构建含 torch，2核机器约需 10-25 分钟）"
docker compose -f docker-compose.prod.yml up -d --build

echo "[7/7] 预下载 AI 模型（LayoutLMv3 + SBERT，约 1.5GB，经 hf-mirror）"
docker compose -f docker-compose.prod.yml run --rm --no-deps backend python -m app.services.ai.provision || true

sleep 10
echo ""
echo "==================== 部署完成 ===================="
curl -fsS http://127.0.0.1:8000/healthz && echo ""
echo "访问地址: https://${DOMAIN}"
echo "健康检查: ssh 到服务器后 curl http://127.0.0.1:8000/healthz"
echo "数据库备份: ${APP_DIR}/backups（每日自动，保留 7 天）"
echo "重启/升级: cd ${APP_DIR} && docker compose -f docker-compose.prod.yml up -d --build"
echo "=================================================="
