"""GNN 图神经网络供应链碳强度传播与热点识别。

将供应链抽象为有向异构图：供应商为节点，采购/物流/资金关系为边。
采用图卷积网络（GCN）信息传播机制：
    H' = relu( Dhat^{-1/2} (A + I) Dhat^{-1/2} H W )
即使二、三级供应商未填报数据，也能依据邻居聚合估算其碳强度区间。
"""
from __future__ import annotations

import numpy as np


def build_adjacency(node_ids: list[str], edges: list[dict]) -> np.ndarray:
    """构建邻接矩阵。edges 中每个元素含 source_id / target_id。"""
    n = len(node_ids)
    idx = {sid: i for i, sid in enumerate(node_ids)}
    A = np.zeros((n, n), dtype=float)
    for e in edges:
        s, t = e.get("source_id"), e.get("target_id")
        if s in idx and t in idx:
            A[idx[s], idx[t]] += 1.0
    return A


def _normalized_adjacency(A: np.ndarray) -> np.ndarray:
    Ahat = A + np.eye(A.shape[0])
    deg = Ahat.sum(axis=1)
    deg_inv_sqrt = np.diag(1.0 / np.sqrt(np.maximum(deg, 1.0)))
    return deg_inv_sqrt @ Ahat @ deg_inv_sqrt


def gcn_propagate(features: np.ndarray, adjacency: np.ndarray, k: int = 2, W: np.ndarray | None = None) -> np.ndarray:
    """多层 GCN 前向传播。"""
    H = np.asarray(features, dtype=float)
    norm_A = _normalized_adjacency(adjacency)
    if W is None:
        W = np.eye(H.shape[1])
    W = np.asarray(W, dtype=float)
    for _ in range(max(1, k)):
        H = norm_A @ H @ W
        H = np.maximum(H, 0.0)  # relu
    return H


def _risk(intensity: float, low: float, high: float) -> str:
    if intensity >= high:
        return "red"
    if intensity >= low:
        return "yellow"
    return "green"


def compute_heatmap(
    nodes: list[dict],
    edges: list[dict],
    k: int = 2,
    intensity_key: str = "carbon_intensity",
    low_threshold: float = 0.2,
    high_threshold: float = 0.4,
) -> dict:
    """输入节点/边，返回每个节点的聚合碳强度、是否估算与风险等级。"""
    if not nodes:
        return {"nodes": [], "adjacency": [], "statistics": {"red": 0, "yellow": 0, "green": 0, "unknown": 0}}

    node_ids = [n["id"] for n in nodes]
    A = build_adjacency(node_ids, edges)

    # 特征：已知碳强度 + 是否有数据掩码 + 层级归一
    F = len(nodes)
    H = np.zeros((F, 3), dtype=float)
    known = np.zeros(F, dtype=bool)
    for i, n in enumerate(nodes):
        v = n.get(intensity_key)
        if v is not None and np.isfinite(v) and v >= 0:
            H[i, 0] = float(v)
            known[i] = True
        H[i, 1] = 1.0 if known[i] else 0.0
        tier = float(n.get("tier", 1) or 1)
        H[i, 2] = 1.0 / max(tier, 1.0)

    H_out = gcn_propagate(H, A, k=k)
    stats = {"red": 0, "yellow": 0, "green": 0, "unknown": 0}

    result_nodes = []
    for i, n in enumerate(nodes):
        raw = float(H_out[i, 0])
        mask = float(H_out[i, 1])
        if known[i]:
            intensity = float(H[i, 0])
            estimated = False
        else:
            intensity = raw / mask if mask > 1e-6 else None
            estimated = True
        risk = _risk(intensity, low_threshold, high_threshold) if intensity is not None else "unknown"
        stats[risk] += 1
        result_nodes.append(
            {
                **n,
                "propagated_intensity": round(intensity, 6) if intensity is not None else None,
                "estimate_available": intensity is not None,
                "estimated": estimated,
                "risk_level": risk,
            }
        )

    return {
        "nodes": result_nodes,
        "adjacency": A.tolist(),
        "statistics": stats,
        "layers": k,
        "method": "identity-weight GCN-style neighborhood diffusion; no supervised training",
        "thresholds": {"low": low_threshold, "high": high_threshold},
        "note": "无可用邻居数据时保持未知；热点提示不构成信用评级或经验证的排放预测区间",
    }


__all__ = ["build_adjacency", "gcn_propagate", "compute_heatmap"]
