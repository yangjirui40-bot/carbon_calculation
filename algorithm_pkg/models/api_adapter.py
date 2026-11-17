"""给 FastAPI 后端的轻量适配层。

该文件不强制依赖 FastAPI。后端可以在自己的 router 中调用
handle_calculation(request_json)，再把返回字典作为 JSON response。
"""
from models.calculation_engine import calculate

def handle_calculation(request_json: dict) -> dict:
    return calculate(request_json)
