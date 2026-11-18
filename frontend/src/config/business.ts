/**
 * 业务口径常量。
 * TODO(G2): 阈值与分类待王惠宇数据字典 v0.1 确认。
 */

import type { Scope, TransactionCategory } from '../api/types'

/** 置信度 ≥ 0.95 视为已通过，否则需要人工核对（02 §4） */
export const CONFIDENCE_THRESHOLD = 0.95

/** 业务类别的中文名（王惠宇《业务分类与演示数据》2026-11-04） */
export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  diesel_combustion: '设备柴油耗用',
  electricity: '外购电力',
  electronic_components: '电子元器件采购',
  pcb_materials: 'PCB 材料采购',
  packaging_materials: '包装材料采购',
}

/**
 * 类别 → Scope / 核算输入 / 单位 / 因子（王惠宇 2026-11-04）
 * Scope 1/2 用活动量，Scope 3 用未税采购金额。
 */
export const CATEGORY_META: Record<
  TransactionCategory,
  { scope: Scope; input: 'quantity' | 'amount'; unit: string; factorId: string }
> = {
  diesel_combustion: {
    scope: 'scope1',
    input: 'quantity',
    unit: 'L',
    factorId: 'F_DIESEL_01',
  },
  electricity: {
    scope: 'scope2',
    input: 'quantity',
    unit: 'kWh',
    factorId: 'F_ELEC_01',
  },
  electronic_components: {
    scope: 'scope3',
    input: 'amount',
    unit: 'CNY',
    factorId: 'F_EEIO_01',
  },
  pcb_materials: {
    scope: 'scope3',
    input: 'amount',
    unit: 'CNY',
    factorId: 'F_EEIO_02',
  },
  packaging_materials: {
    scope: 'scope3',
    input: 'amount',
    unit: 'CNY',
    factorId: 'F_EEIO_03',
  },
}
