"""订阅与配额控制。"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from ..models import Plan, Subscription

FREE_PLAN = "free"

DEFAULT_PLANS = [
    dict(plan_code="free", name="免费试用", price_yearly=0, quota_calculations=20, quota_documents=200,
         features=["基础核算", "驾驶舱", "2 次标准报告"]),
    dict(plan_code="starter", name="初创合规版", price_yearly=4999, quota_calculations=120, quota_documents=2000,
         features=["标准核算报告", "在线合规诊断", "季度动态监控"]),
    dict(plan_code="pro", name="专业成长版", price_yearly=30000, quota_calculations=1000, quota_documents=10000,
         features=["Scope 3 穿透分析", "产品碳足迹标签", "月度动态监控", "供应链协同"]),
    dict(plan_code="fin", name="金融联动版", price_yearly=0, quota_calculations=10**9, quota_documents=10**6,
         features=["绿色信贷辅助", "按融资金额分成", "专属风控对接"]),
]


def seed_plans(db) -> None:
    if db.query(Plan).count() > 0:
        return
    for p in DEFAULT_PLANS:
        db.add(Plan(**p))
    db.commit()


def get_plan(db, plan_code: str) -> Plan:
    plan = db.query(Plan).filter(Plan.plan_code == plan_code).first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"套餐不存在：{plan_code}")
    return plan


def get_or_create_subscription(db, company_id: int) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.company_id == company_id).first()
    if sub is None:
        end = datetime.now(timezone.utc) + timedelta(days=365)
        sub = Subscription(company_id=company_id, plan_code=FREE_PLAN, status="trial", end_date=end)
        db.add(sub)
        db.commit()
        db.refresh(sub)
    return sub


def subscribe(db, company_id: int, plan_code: str) -> Subscription:
    plan = get_plan(db, plan_code)
    sub = db.query(Subscription).filter(Subscription.company_id == company_id).first()
    end = datetime.now(timezone.utc) + timedelta(days=365)
    if sub is None:
        sub = Subscription(company_id=company_id, plan_code=plan_code, status="active",
                           start_date=datetime.now(timezone.utc), end_date=end)
        db.add(sub)
    else:
        sub.plan_code = plan_code
        sub.status = "active"
        sub.start_date = datetime.now(timezone.utc)
        sub.end_date = end
        sub.usage_calculations = 0
        sub.usage_documents = 0
    db.commit()
    db.refresh(sub)
    return sub


def enforce_quota(db, company_id: int | None, kind: str) -> Subscription | None:
    """核算/单据配额控制：超限抛出 402。"""
    if company_id is None:
        return None
    sub = get_or_create_subscription(db, company_id)
    plan = get_plan(db, sub.plan_code)
    if kind == "calculation":
        quota, used = plan.quota_calculations, sub.usage_calculations
        if used >= quota:
            raise HTTPException(status_code=402, detail=f"核算配额已用尽（{used}/{quota}），请升级套餐")
        sub.usage_calculations = used + 1
    else:
        quota, used = plan.quota_documents, sub.usage_documents
        if used >= quota:
            raise HTTPException(status_code=402, detail=f"单据配额已用尽（{used}/{quota}），请升级套餐")
        sub.usage_documents = used + 1
    db.commit()
    return sub


__all__ = ["seed_plans", "subscribe", "enforce_quota", "get_or_create_subscription", "get_plan", "DEFAULT_PLANS"]
