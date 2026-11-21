"""应用配置：从 backend/.env 读取，提供数据库连接、JWT、算法路径等设置。"""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[1]  # backend/
ALGORITHM_PKG_DIR = BASE_DIR / "algorithm_pkg"
FACTOR_DATA_PATH = ALGORITHM_PKG_DIR / "data" / "demo_factors.csv"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 应用
    APP_NAME: str = "碳速算平台后端"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"

    # 数据库：默认指向本地 PostgreSQL（WSL Docker 容器 carbonspeed-db）
    DATABASE_URL: str = (
        "postgresql+psycopg2://carbonspeed:carbonspeed_2026_Db_x7KpQ2"
        "@localhost:5433/carbonspeed"
    )

    DB_TENANT_ISOLATION_ENABLED: bool = False

    # 安全
    SECRET_KEY: str = "carbonspeed-dev-secret-key-change-me-in-production"
    ALGORITHM_JWT: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # 算法
    ALGORITHM_VERSION: str = "carbon-engine-v0.5"
    # 演示排放因子文件（生产环境应由受控因子库替代）
    FACTOR_CSV: str = str(FACTOR_DATA_PATH)

    # CORS
    CORS_ORIGINS: str = "*"

    # 默认管理员账号（首次建库时创建）
    FIRST_ADMIN_USERNAME: str = "admin"
    FIRST_ADMIN_PASSWORD: str = "admin123"
    FIRST_ADMIN_EMAIL: str = "admin@carbonspeed.local"

    # ---------- 生产安全 ----------
    # 生产环境置 false：对外隐藏 /docs /redoc /openapi.json（Caddy 网关同样拦截）
    DOCS_ENABLED: bool = True
    DEMO_DATA_ENABLED: bool = True
    SELF_REGISTRATION_ENABLED: bool = True
    # ---------- 企业级安全 ----------
    # 敏感数据 AES-256-GCM 加密密钥（为空时由 SECRET_KEY 派生）
    DATA_ENC_KEY: str = ""
    RATE_LIMIT_PER_MINUTE: int = 120
    # 限流后端：memory（进程内）| redis（多副本一致）
    RATE_LIMIT_BACKEND: str = "memory"
    REDIS_URL: str = "redis://localhost:6379/0"

    # ---------- 存储 ----------
    STORAGE_BACKEND: str = "local"  # local | s3
    S3_BUCKET: str = ""
    S3_ENDPOINT: str = ""
    S3_REGION: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""

    # ---------- AI 引擎 ----------
    # 模型缓存与下载镜像
    MODELS_CACHE_DIR: str = str(BASE_DIR / "models_cache")
    HF_ENDPOINT: str = "https://hf-mirror.com"
    # OCR 引擎：rapidocr(真实) | layoutlmv3(真实多模态，需模型已下载) | mock
    OCR_ENGINE: str = "rapidocr"
    LAYOUT_MODEL: str = "microsoft/layoutlmv3-base-chinese"
    # 中文表单关键信息抽取（KIE）微调模型（LayoutLMv3 SER，XFUND-zh）
    SER_MODEL: str = "yuyijiong/layoutlmv3-base-chinese-xfund"
    # SER 为可选增强；须经目标票据评估并确认模型许可后启用。
    # 本地微调后同时设置 SER_ENABLED=true 和 SER_MODEL=模型目录。
    SER_ENABLED: bool = False
    INVOICE_VERIFY_ENABLED: bool = False
    INVOICE_VERIFY_API_BASE: str = ""
    INVOICE_VERIFY_API_KEY: str = ""
    SBERT_MODEL: str = "BAAI/bge-small-zh-v1.5"
    # POMDP-LLM 大模型适配（OpenAI 兼容接口，如 DeepSeek；未配置时使用规则推理引擎）
    LLM_API_BASE: str = ""
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "deepseek-flash"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip() in ("*", ""):
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def factor_csv_path(self) -> str:
        p = Path(self.FACTOR_CSV)
        if not p.is_absolute():
            p = BASE_DIR / p
        return str(p)

    @property
    def models_cache_path(self) -> str:
        p = Path(self.MODELS_CACHE_DIR)
        if not p.is_absolute():
            p = BASE_DIR / p
        return str(p)

    @property
    def data_enc_key(self) -> str:
        return self.DATA_ENC_KEY or self.SECRET_KEY

    @property
    def llm_enabled(self) -> bool:
        return bool(self.LLM_API_BASE and self.LLM_API_KEY)


settings = Settings()
