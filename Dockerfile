# 碳速算后端镜像
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
COPY run.py .
COPY .env.example ./.env.example

RUN mkdir -p /app/storage /app/models_cache

EXPOSE 8000

# 启动前先建库种子（幂等），再启动服务
CMD ["sh", "-c", "python -m app.seed && python run.py"]
