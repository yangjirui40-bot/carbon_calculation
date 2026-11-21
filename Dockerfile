# ============================================================
# 碳速算平台镜像（构建上下文 = 本目录，即仓库根 backend/）
# 阶段 1：前端构建（React + Vite + TS7 原生编译器）
# 阶段 2：后端运行时（Python + 真实 AI 引擎 + 前端静态托管）
# ============================================================

# ---------- 阶段 1：前端构建 ----------
FROM node:24-slim AS frontend-build
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- 阶段 2：后端运行时 ----------
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_ENDPOINT=https://hf-mirror.com \
    MODELS_CACHE_DIR=/app/models_cache

# RapidOCR/OpenCV 依赖的系统库
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 \
 && rm -rf /var/lib/apt/lists/*

# 安装 CPU 版 torch（避免超大 CUDA 轮子），其余依赖使用默认 PyPI + 超时重试
RUN pip install --default-timeout=300 --retries 10 torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --default-timeout=300 --retries 10 -r requirements.txt

COPY algorithm_pkg ./algorithm_pkg
COPY app ./app
COPY data ./data
COPY run.py .
COPY migrations ./migrations
COPY alembic.ini .
COPY .env.example ./.env.example

# 前端构建产物：后端 / 根路径直接托管（SPA 回退内置于 app/main.py）
COPY --from=frontend-build /fe/dist ./frontend/dist

RUN mkdir -p /app/storage /app/models_cache

EXPOSE 8000

# 启动前先建库种子（幂等），再启动服务
CMD ["sh", "-c", "python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]
