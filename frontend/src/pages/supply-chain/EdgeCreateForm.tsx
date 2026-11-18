import { useState } from 'react'
import { supplyChainApi } from '../../api'
import type { SupplyChainNetwork } from '../../api/types'
import {
  SwissButton,
  SwissField,
  SwissInput,
  SwissSelect,
} from '../../components/swiss'
import { errorText } from './errors'
import './shared.css'

type EdgeCreateFormProps = {
  nodes: SupplyChainNetwork['nodes']
  onCreated: () => void
}

/** 新增关系边：source / target 从当前网络节点选，amount 选填 */
export default function EdgeCreateForm({ nodes, onCreated }: EdgeCreateFormProps) {
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function reset() {
    setSourceId('')
    setTargetId('')
    setAmount('')
    setFieldErrors({})
  }

  async function handleSubmit() {
    if (submitting) return
    const errors: Record<string, string> = {}
    if (!sourceId) errors.source_id = '请选择起点节点'
    if (!targetId) errors.target_id = '请选择终点节点'
    if (sourceId && targetId && sourceId === targetId) {
      errors.target_id = '起点与终点不能相同'
    }
    if (amount.trim() !== '') {
      const value = Number(amount)
      if (!Number.isFinite(value) || value <= 0) errors.amount = '金额需为大于 0 的数字'
    }
    setFieldErrors(errors)
    setFormError(null)
    setSuccess(false)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await supplyChainApi.createEdge({
        source_id: sourceId,
        target_id: targetId,
        ...(amount.trim() !== '' ? { amount: Number(amount) } : {}),
      })
      reset()
      setSuccess(true)
      onCreated()
    } catch (error) {
      setFormError(errorText(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className="sc-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void handleSubmit()
      }}
    >
      <p className="sc-form__meta">
        关系类型默认按采购记录；金额选填，单位为元。新增后网络拓扑与热力图会重新计算。
      </p>

      {formError ? (
        <div className="sc-form__error" role="alert">
          {formError}
        </div>
      ) : null}
      {success ? (
        <div className="sc-form__error sc-form__success" role="status">
          关系边已新增。
        </div>
      ) : null}

      <SwissField label="起点节点" htmlFor="edge-source" required error={fieldErrors.source_id}>
        <SwissSelect
          id="edge-source"
          value={sourceId}
          onChange={(event) => setSourceId(event.target.value)}
        >
          <option value="">请选择起点</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.name}（{node.id}）
            </option>
          ))}
        </SwissSelect>
      </SwissField>

      <SwissField label="终点节点" htmlFor="edge-target" required error={fieldErrors.target_id}>
        <SwissSelect
          id="edge-target"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
        >
          <option value="">请选择终点</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.name}（{node.id}）
            </option>
          ))}
        </SwissSelect>
      </SwissField>

      <SwissField label="金额" htmlFor="edge-amount" error={fieldErrors.amount} hint="选填，单位元">
        <SwissInput
          id="edge-amount"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={amount}
          placeholder="如 100000"
          onChange={(event) => setAmount(event.target.value)}
        />
      </SwissField>

      <div className="sc-form__actions">
        <SwissButton type="submit" loading={submitting}>
          新增关系边
        </SwissButton>
      </div>
    </form>
  )
}
