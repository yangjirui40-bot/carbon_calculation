import { useState } from 'react'
import { recordsApi } from '../../api'
import type { BusinessRecord, RecordClassification } from '../../api/types'
import { SwissButton, SwissDrawer } from '../../components/swiss'
import ClassificationFields, { normalizedClassification } from './ClassificationFields'
import ActivityRevisions from './ActivityRevisions'
import { toErrorMessage } from './errors'

export default function RecordClassificationDrawer({ record, onClose, onChanged }: {
  record: BusinessRecord; onClose: () => void; onChanged: (record: BusinessRecord, operation: string) => void
}) {
  const [classification, setClassification] = useState<RecordClassification>(record)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canConfirm = record.review_status === 'pending' && record.document_id == null && record.source !== 'photo'
  async function confirm() {
    setBusy(true)
    setError('')
    try {
      const confirmed = await recordsApi.confirmRecord(record.record_no)
      onChanged(confirmed, '复核已确认')
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return <SwissDrawer open title={`台账归集 · ${record.record_no}`} onClose={onClose} width={520}
    footer={<>
      <SwissButton variant="ghost" disabled={busy} onClick={onClose}>取消</SwissButton>
      {canConfirm && <SwissButton variant="ghost" disabled={busy} onClick={() => void confirm()}>确认台账数据</SwissButton>}
      <SwissButton type="submit" form="record-classification" loading={busy}>保存归集</SwissButton>
    </>}>
    <dl className="records-review-meta">
      <dt>期间</dt><dd>{record.period}</dd>
      <dt>活动量或金额</dt><dd>{record.quantity == null ? `${record.amount ?? '—'} ${record.currency}` : `${record.quantity} ${record.unit ?? ''}`}</dd>
      <dt>排放因子</dt><dd>{record.factor_id}</dd>
    </dl>
    <form id="record-classification" className="records-classification" onSubmit={async (event) => {
      event.preventDefault()
      setBusy(true)
      setError('')
      try {
        const updated = await recordsApi.classifyRecord(record.record_no, normalizedClassification(classification, record.scope))
        onChanged(updated, '归集已更新')
      } catch (err) {
        setError(toErrorMessage(err))
      } finally {
        setBusy(false)
      }
    }}>
      <ClassificationFields companyId={record.company_id} prefix="record-classification" scope={record.scope} value={classification} onChange={setClassification} />
      {error && <p role="alert">{error}</p>}
    </form>
    <ActivityRevisions record={record} onChanged={onChanged}/>
  </SwissDrawer>
}
