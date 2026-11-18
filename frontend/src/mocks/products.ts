import type { ProductFootprint } from '../api/types'

/**
 * 长期模块 4.3 只读演示数据（不在中期验收范围）。
 * 估算值按演示因子计算：
 * 7000×0.35 + 2000×0.45 + 1000×0.12 = 3470 kgCO₂e，1000 件 → 3.47 kgCO₂e/件。
 */
export const mockProducts: ProductFootprint[] = [
  {
    product_id: 'p001',
    product_name: '控制板模块',
    output_quantity: 1000,
    product_unit: '件',
    total_kgco2e: 3470,
    per_unit_kgco2e: 3.47,
    items: [
      {
        bom_item_id: 'b001',
        material_name: '电子元器件',
        material_quantity: 1000,
        material_unit: '件',
        material_amount: 7000,
        matched_category: 'electronic_components',
        matched_factor_id: 'F_EEIO_01',
        supplier_id: 's001',
        estimated_kgco2e: 2450,
      },
      {
        bom_item_id: 'b002',
        material_name: 'PCB基板',
        material_quantity: 1000,
        material_unit: '片',
        material_amount: 2000,
        matched_category: 'pcb_materials',
        matched_factor_id: 'F_EEIO_02',
        supplier_id: 's002',
        estimated_kgco2e: 900,
      },
      {
        bom_item_id: 'b003',
        material_name: '包装纸盒',
        material_quantity: 1000,
        material_unit: '个',
        material_amount: 1000,
        matched_category: 'packaging_materials',
        matched_factor_id: 'F_EEIO_03',
        supplier_id: 's003',
        estimated_kgco2e: 120,
      },
    ],
  },
]
