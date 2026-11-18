import type { Supplier } from '../api/types'

/** 长期模块 4.7 只读演示数据（不在中期验收范围） */
export const mockSuppliers: Supplier[] = [
  {
    supplier_id: 's001',
    supplier_name: '华湘电子材料',
    supplier_tier: 'Tier1',
    submission_period: '2026-10',
    submission_status: '已提交',
    reported_kgco2e: 850,
  },
  {
    supplier_id: 's002',
    supplier_name: '楚源电路材料',
    supplier_tier: 'Tier1',
    submission_period: '2026-10',
    submission_status: '待核对',
  },
  {
    supplier_id: 's003',
    supplier_name: '星城包装制品',
    supplier_tier: 'Tier1',
    submission_period: '2026-10',
    submission_status: '未提交',
  },
]
