import { useEffect, useState } from 'react'
import { Button, Drawer, Select, Space } from 'antd'
import { factorsApi, productsApi } from '../../../api'
import type { FactorRecord, ProductBomLine } from '../../../api/types'
import { formatNumber } from '../../../utils/format'
import { categoryLabel, errorMessage } from '../labels'

export default function BomFactorDrawer({ item, productId, onClose, onSaved }: {
  item: ProductBomLine
  productId: string
  onClose: () => void
  onSaved: (updated: ProductBomLine) => void
}) {
  const [factors, setFactors] = useState<FactorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(item.matched_factor_id ?? undefined)

  useEffect(() => {
    let active = true
    void factorsApi.listFactors().then((items) => {
      if (active) setFactors(items.filter((factor) => factor.scope === 'scope3' &&
        ['kgCO2e/CNY', 'kgCO2/CNY'].includes(factor.unit) &&
        ['electronic_components', 'pcb_materials', 'packaging_materials'].includes(factor.category)))
    }).catch((cause) => {
      if (active) setError(errorMessage(cause))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const factor = factors.find((option) => option.factor_id === selected)

  async function save() {
    if (!factor || saving) return
    setSaving(true)
    setError('')
    try {
      onSaved(await productsApi.setBomFactor(productId, item.bom_item_id, factor.factor_id))
    } catch (cause) {
      setError(errorMessage(cause))
      setSaving(false)
    }
  }

  return (
    <Drawer width={470} title="复核物料因子" open onClose={saving ? undefined : onClose}
      footer={<Space><Button disabled={saving} onClick={onClose}>取消</Button><Button type="primary" disabled={!factor} loading={saving} onClick={() => void save()}>保存选择</Button></Space>}>
      <p><strong>{item.material_name}</strong> · {item.bom_item_id}</p>
      <p>请选择与采购物料、计价年度和数据边界相符的金额法因子。人工选择会保留到下次核算。</p>
      <Select aria-label="选择排放因子" value={selected} onChange={setSelected} loading={loading} disabled={saving}
        showSearch={{ optionFilterProp: 'label' }} placeholder="按因子编号、版本或类别查询" style={{ width: '100%' }}
        options={factors.map((choice) => ({
          value: choice.factor_id,
          label: `${categoryLabel(choice.category)} · ${choice.factor_id}${choice.is_demo ? '（演示）' : ''}`,
        }))} />
      {factor && <dl className="bom-factor-details">
        <div><dt>因子值</dt><dd>{formatNumber(factor.value, 6)} {factor.unit}</dd></div>
        <div><dt>版本</dt><dd>{factor.version}</dd></div>
        <div><dt>来源</dt><dd>{factor.origin || '未登记'}</dd></div>
        <div><dt>价格口径</dt><dd>{factor.price_basis || '未登记'}</dd></div>
        <div><dt>用途</dt><dd>{factor.is_demo ? '演示因子，仅供测试' : '按来源说明选用'}</dd></div>
      </dl>}
      {error && <p className="product-detail-error" role="alert">{error}</p>}
    </Drawer>
  )
}
