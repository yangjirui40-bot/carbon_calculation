"""Pydantic v2 请求/响应模型。"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from typing import Annotated


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- 认证 ----------
class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    email: str
    password: str = Field(min_length=6)
    role: str = "enterprise"
    company_id: Optional[int] = None
    supplier_id: Optional[str] = None
    company_name: Optional[str] = Field(default=None, min_length=2, max_length=255)


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(ORMModel):
    id: int
    username: str
    email: str
    role: str
    company_id: Optional[int] = None
    is_active: bool = True


# ---------- 企业 ----------
class CompanyCreate(BaseModel):
    code: str
    name: str
    industry: str = "电子信息制造"
    region: Optional[str] = None
    scale: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    description: Optional[str] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    region: Optional[str] = None
    scale: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    description: Optional[str] = None


class CompanyOut(ORMModel):
    id: int
    code: str
    name: str
    industry: str
    region: Optional[str] = None
    scale: Optional[str] = None


# ---------- 排放因子 ----------
class FactorCreate(BaseModel):
    factor_id: str
    category: str
    scope: str = "scope3"
    value: float = Field(ge=0)
    unit: str
    version: str
    origin: Optional[str] = None
    price_basis: Optional[str] = None
    is_demo: bool = True
    description: Optional[str] = None


class FactorOut(ORMModel):
    id: int
    factor_id: str
    category: str
    scope: str
    value: float
    unit: str
    version: str
    origin: Optional[str] = None
    is_demo: bool = True


# ---------- 业务记录 ----------
class RecordClassification(BaseModel):
    workshop: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None = None
    production_line: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None = None
    scope3_category: int | None = Field(None, ge=1, le=15)

    @model_validator(mode="after")
    def validate_line(self):
        if self.production_line and not self.workshop:
            raise ValueError("填写产线时需要同时填写车间")
        return self


class RecordCreate(RecordClassification):
    site_id: Optional[int] = None
    org_unit_id: Optional[int] = None
    record_no: str
    company_id: int
    period: str = Field(pattern=r"^[1-9][0-9]{3}-(0[1-9]|1[0-2])$")
    category: str
    scope: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "CNY"
    factor_id: str
    review_status: str = "confirmed"
    source: str = "manual"
    document_id: Optional[int] = None
    remark: Optional[str] = None

    @model_validator(mode="after")
    def validate_classification(self):
        if self.scope3_category is not None and self.scope != "scope3":
            raise ValueError("仅范围 3 记录可归入价值链分类")
        return self


class RecordOut(ORMModel):
    id: int
    record_no: str
    company_id: int
    period: str
    category: str
    scope: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    amount: Optional[float] = None
    currency: str
    factor_id: str
    review_status: str
    source: str


# ---------- 产品 / BOM ----------
class ProductCreate(BaseModel):
    product_id: str
    product_name: str
    company_id: int
    output_quantity: float = Field(gt=0)
    product_unit: str = "件"
    description: Optional[str] = None


class BOMItemCreate(BaseModel):
    bom_item_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
    material_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    material_amount: float = Field(ge=0, allow_inf_nan=False)
    assembly_path: str | None = Field(None, max_length=240)

    @model_validator(mode="after")
    def normalize_path(self):
        if self.assembly_path is not None:
            parts = [part.strip() for part in self.assembly_path.split("/")]
            if not 1 <= len(parts) <= 8 or any(not part or len(part) > 80 or part in (".", "..") for part in parts):
                raise ValueError("组件路径用 / 分隔，最多 8 级，每级最多 80 字")
            self.assembly_path = "/".join(parts)
        return self
    currency: str = "CNY"
    matched_category: Optional[str] = None
    matched_factor_id: Optional[str] = None
    match_confidence: Optional[float] = None


class BOMImport(BaseModel):
    bom_items: list[BOMItemCreate] = Field(min_length=1, max_length=10000)


# ---------- 核算请求 ----------
class EnterpriseCalcRequest(BaseModel):
    company_id: Optional[int] = None
    period: Optional[str] = None
    records: Optional[list[dict[str, Any]]] = None
    factor_set: Optional[str] = None  # official-2022 / official-2022-hunan 等官方因子集


class EIOLCARequest(BaseModel):
    purchase_vector_cny: list[float]
    A: Optional[list[list[float]]] = None
    g: Optional[list[float]] = None
    sectors: Optional[list[str]] = None


class ProductCalcRequest(BaseModel):
    product_id: Optional[str] = None
    product: Optional[dict[str, Any]] = None
    bom_items: Optional[list[dict[str, Any]]] = None
    factor_set: Optional[str] = None


class ScenarioFinance(BaseModel):
    capex: float = Field(ge=0, le=1e12, allow_inf_nan=False)
    annual_opex: float = Field(ge=0, le=1e12, allow_inf_nan=False)
    annual_saving: float = Field(ge=0, le=1e12, allow_inf_nan=False)
    carbon_price: float = Field(default=0, ge=0, le=100000, allow_inf_nan=False)
    project_life: int = Field(default=8, ge=1, le=50)
    discount_rate: float = Field(default=.08, ge=0, le=1, allow_inf_nan=False)


class ScenarioCalcRequest(BaseModel):
    company_id: int
    scenario_id: Optional[str] = None
    scenario_name: Optional[str] = "未命名情景"
    electricity_saving_rate: float = Field(0, ge=0, le=1)
    procurement_reduction_rate: float = Field(0, ge=0, le=1)
    electricity_substitution_rate: float = Field(0, ge=0, le=1)
    finance: ScenarioFinance | None = None
    forecast_months: int = Field(6, ge=1, le=36)
    baseline_run_id: Optional[str] = None
    factor_set: Optional[str] = None


class ROIRequest(BaseModel):
    capex: float = Field(ge=0)  # 初始投资
    annual_opex: float = Field(ge=0)  # 年运维
    annual_saving: float = Field(ge=0)  # 年节约成本
    annual_reduction_kgco2e: float = Field(ge=0)  # 年减排量
    carbon_price: float = Field(50.0, ge=0)  # 碳价（元/吨）
    project_life: int = Field(10, gt=0)  # 项目年限
    discount_rate: float = Field(0.08, ge=0, le=1)  # 折现率


# ---------- 供应链 ----------
class SupplierCreate(BaseModel):
    supplier_id: str
    name: str
    industry: Optional[str] = None
    region: Optional[str] = None
    tier: int = 1
    carbon_intensity: Optional[float] = None
    annual_emissions: Optional[float] = None
    risk_level: str = "green"
    company_id: Optional[int] = None


class EdgeCreate(BaseModel):
    source_id: str
    target_id: str
    relation_type: str = "purchase"
    amount: Optional[float] = None
    transport_distance: Optional[float] = None
    transport_mode: Optional[str] = None


class QuotaCreate(BaseModel):
    company_id: int
    supplier_id: Optional[str] = None
    year: int = 2026
    allocated_quota: float = Field(ge=0)
    used_quota: float = Field(0, ge=0)


class ReductionPlanCreate(BaseModel):
    plan_id: str
    company_id: int
    title: str
    target_supplier_id: Optional[str] = None
    target_reduction_rate: float = Field(0, ge=0, le=1)
    deadline: Optional[str] = None


Token.model_rebuild()
