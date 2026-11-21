import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { documentsApi, factorsApi } from '../../../api'
import { ApiRequestError } from '../../../api/client'
import type { FactorRecord, SourceDocument } from '../../../api/types'
import { CATEGORY_LABELS, CATEGORY_META } from '../../../config/business'
import { formatDateTime, formatNumber } from '../../../utils/format'
import {
  correctionText,
  docTypeLabel,
  fieldLabel,
  NUMERIC_FIELD_KEYS,
  orderedFieldKeys,
  parseExtraction,
} from '../../documents/meta'
import ReviewAccountingPanel from './ReviewAccountingPanel'
import ReviewFieldsPanel from './ReviewFieldsPanel'
import ReviewSourcePanel from './ReviewSourcePanel'
import ReviewPreviewPanel from './ReviewPreviewPanel'
import ReviewSidePanel from './ReviewSidePanel'
import './ReviewWorkspace.css'

type Submitting = 'confirm' | 'reject' | 'verify' | null

type Outcome = {
  kind: 'confirmed' | 'rejected'
  duplicateHint: string | null
  verifyHint: string | null
}

import LocationFields from '../../organization/LocationFields'
import type { RecordClassification } from '../../../api/types'

type ReviewWorkspaceProps = {
  document: SourceDocument
}

function valueToText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/** 数据核对工作台：识别字段修订 + 入账信息 + 验真/入库/驳回 */
export default function ReviewWorkspace({ document: initialDocument }: ReviewWorkspaceProps) {
  const { modal } = App.useApp()
  const [doc, setDoc] = useState(initialDocument)

  const extraction = useMemo(
    () => parseExtraction(doc.extracted_fields, doc.correction_log),
    [doc.extracted_fields, doc.correction_log],
  )
  const hint = useMemo(
    () =>
      parseExtraction(initialDocument.extracted_fields, initialDocument.correction_log).hint,
    [initialDocument],
  )
  const fieldKeys = useMemo(() => orderedFieldKeys(extraction.fields), [extraction.fields])

  const [activeField, setActiveField] = useState<string | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const initial = parseExtraction(
      initialDocument.extracted_fields,
      initialDocument.correction_log,
    )
    const values: Record<string, string> = {}
    Object.entries(initial.fields).forEach(([key, value]) => {
      values[key] = valueToText(value)
    })
    return values
  })

  const [period, setPeriod] = useState(stringOf(hint.period))
  const [category, setCategory] = useState(hint.category ?? 'electronic_components')
  const [scope, setScope] = useState(hint.scope ?? 'scope3')
  const [quantity, setQuantity] = useState(stringOf(hint.quantity))
  const [unit, setUnit] = useState(hint.unit ?? '')
  const [amount, setAmount] = useState(stringOf(hint.amount))
  const [factorId, setFactorId] = useState(hint.factor_id ?? '')
  const [note, setNote] = useState('')
  const [locationFields, setLocationFields] = useState<RecordClassification>({})

  /** 表单初始值：与初始值相同的字段不提交，让后端用修订后的识别结果重算 record_hint */
  const initialForm = useMemo(
    () => ({
      period: stringOf(hint.period),
      category: hint.category ?? 'electronic_components',
      scope: hint.scope ?? 'scope3',
      quantity: stringOf(hint.quantity),
      unit: hint.unit ?? '',
      amount: stringOf(hint.amount),
      factorId: hint.factor_id ?? '',
    }),
    [hint],
  )

  const [factors, setFactors] = useState<FactorRecord[]>([])
  const [factorsLoading, setFactorsLoading] = useState(false)
  const [factorsError, setFactorsError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState<Submitting>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [verifyDetail, setVerifyDetail] = useState<string | null>(null)

  const loadFactors = useCallback(async () => {
    setFactorsLoading(true)
    setFactorsError(null)
    try {
      setFactors(await factorsApi.listFactors())
    } catch (err) {
      setFactorsError(err instanceof ApiRequestError ? err.message : '排放因子加载失败')
    } finally {
      setFactorsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFactors()
  }, [loadFactors])

  /** 类别切换或因子加载完成后，保证选中因子属于当前类别 */
  useEffect(() => {
    if (factors.length === 0) return
    const list = factors.filter((factor) => factor.category === category)
    if (list.length === 0) return
    setFactorId((prev) =>
      list.some((factor) => factor.factor_id === prev) ? prev : list[0].factor_id,
    )
  }, [factors, category])

  const correctionNotes = useMemo(() => {
    const map = new Map<string, string[]>()
    extraction.corrections.forEach((step) => {
      const text = correctionText(step)
      if (step.field && text) {
        map.set(step.field, [...(map.get(step.field) ?? []), text])
      }
    })
    return map
  }, [extraction.corrections])

  const correctionCount = useMemo(
    () => extraction.corrections.filter((step) => Boolean(step.field)).length,
    [extraction.corrections],
  )

  const categoryOptions = useMemo(() => {
    const keys = Object.keys(CATEGORY_LABELS)
    if (category && !keys.includes(category)) keys.push(category)
    return keys.map((key) => ({
      value: key,
      label: (CATEGORY_LABELS as Record<string, string>)[key] ?? key,
    }))
  }, [category])

  const categoryFactors = useMemo(
    () => factors.filter((factor) => factor.category === category),
    [factors, category],
  )
  const selectedFactor = factors.find((factor) => factor.factor_id === factorId) ?? null
  const factorOptions = useMemo(() => {
    const options = categoryFactors.map((factor) => ({
      value: factor.factor_id,
      label: `${factor.factor_id} · ${formatNumber(factor.value, 4)} ${factor.unit}`,
    }))
    if (factorId && !categoryFactors.some((factor) => factor.factor_id === factorId)) {
      options.unshift({ value: factorId, label: `${factorId}（因子库未匹配）` })
    }
    return options
  }, [categoryFactors, factorId])

  const handleCategoryChange = (next: string) => {
    setCategory(next)
    const meta = (CATEGORY_META as Record<string, { scope: string; unit: string }>)[next]
    if (meta) {
      setScope(meta.scope)
      setUnit(meta.unit)
    }
    const list = factors.filter((factor) => factor.category === next)
    if (list.length > 0) setFactorId(list[0].factor_id)
    setFormError(null)
  }

  async function handleVerify() {
    if (submitting) return
    setSubmitting('verify')
    setFormError(null)
    try {
      const res = await documentsApi.verifyDocument(doc.id)
      setDoc(res)
      setVerifyDetail(res.verify_detail)
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : '发票验真请求失败')
    } finally {
      setSubmitting(null)
    }
  }

  async function handleConfirm() {
    if (submitting) return
    setFormError(null)

    if (doc.verified_status === 'failed') {
      setFormError('发票验真未通过，不能入库；请修订字段后重新验真')
      return
    }

    const problems: string[] = []
    const overrides: Record<string, unknown> = {}
    const numericProblems: string[] = []

    fieldKeys.forEach((key) => {
      const current = fieldValues[key] ?? ''
      if (current === valueToText(extraction.fields[key])) return
      if (NUMERIC_FIELD_KEYS.has(key)) {
        if (current.trim() === '') {
          overrides[key] = null
          return
        }
        const num = Number(current)
        if (!Number.isFinite(num)) {
          numericProblems.push(fieldLabel(key))
          return
        }
        overrides[key] = num
      } else {
        overrides[key] = current
      }
    })

    const quantityValue = quantity.trim() === '' ? undefined : Number(quantity)
    const amountValue = amount.trim() === '' ? undefined : Number(amount)

    if (!category) problems.push('缺少业务类别')
    if (!scope) problems.push('缺少排放范围')
    if (!factorId) problems.push('缺少排放因子')
    if (!/^\d{4}-\d{2}$/.test(period.trim())) problems.push('核算期需为 YYYY-MM')
    if (quantityValue === undefined && amountValue === undefined) {
      problems.push('活动量与采购金额至少填写一项')
    }
    if (
      quantityValue !== undefined &&
      (!Number.isFinite(quantityValue) || quantityValue < 0)
    ) {
      problems.push('活动量需为非负数字')
    }
    if (amountValue !== undefined && (!Number.isFinite(amountValue) || amountValue < 0)) {
      problems.push('采购金额需为非负数字')
    }
    if (numericProblems.length > 0) {
      problems.push(`以下字段需填写数字：${numericProblems.join('、')}`)
    }

    if (problems.length > 0) {
      setFormError(problems.join('；'))
      return
    }

    setSubmitting('confirm')
    try {
      const res = await documentsApi.reviewDocument(doc.id, {
        period: period.trim() !== initialForm.period ? period.trim() : undefined,
        category: category !== initialForm.category ? category : undefined,
        scope: scope !== initialForm.scope ? scope : undefined,
        factor_id: factorId !== initialForm.factorId ? factorId : undefined,
        quantity:
          quantity.trim() !== initialForm.quantity ? quantityValue : undefined,
        unit: unit.trim() !== initialForm.unit ? unit.trim() || undefined : undefined,
        amount: amount.trim() !== initialForm.amount ? amountValue : undefined,
        currency: 'CNY',
        site_id: locationFields.site_id, org_unit_id: locationFields.org_unit_id,
        review_status: 'confirmed',
        fields_override: Object.keys(overrides).length > 0 ? overrides : undefined,
        note: note.trim() || undefined,
      })
      setDoc(res)
      setOutcome({
        kind: 'confirmed',
        duplicateHint: res.duplicate_hint,
        verifyHint: res.verify_hint,
      })
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : '入库失败，请稍后重试')
    } finally {
      setSubmitting(null)
    }
  }

  function handleReject() {
    if (submitting) return
    setFormError(null)
    modal.confirm({
      title: '驳回这张单据？',
      content: '驳回后不会生成业务记录，可在单据列表重新核对。',
      okText: '驳回',
      cancelText: '取消',
      rootClassName: 'swiss-confirm',
      centered: true,
      okButtonProps: { danger: true },
      onOk: async () => {
        setSubmitting('reject')
        try {
          const res = await documentsApi.reviewDocument(doc.id, {
            review_status: 'rejected',
            note: note.trim() || undefined,
          })
          setDoc(res)
          setOutcome({
            kind: 'rejected',
            duplicateHint: res.duplicate_hint,
            verifyHint: res.verify_hint,
          })
        } catch (err) {
          setFormError(err instanceof ApiRequestError ? err.message : '驳回失败，请稍后重试')
        } finally {
          setSubmitting(null)
        }
      },
    })
  }

  const terminal =
    outcome ??
    (initialDocument.review_status === 'confirmed'
      ? { kind: 'confirmed' as const, duplicateHint: null, verifyHint: null }
      : null)

  if (terminal) {
    return (
      <>
        <ReviewOutcome document={doc} outcome={terminal} fieldCount={fieldKeys.length} previouslyConfirmed={!outcome && initialDocument.review_status === 'confirmed'} />
        <div className="review-grid review-grid--evidence">
          <div><ReviewSourcePanel document={doc} activeField={activeField} value={activeField ? fieldValues[activeField] ?? '' : ''} /><ReviewPreviewPanel document={doc} correctionCount={correctionCount} verifyDetail={verifyDetail} /></div>
          <ReviewFieldsPanel fieldKeys={fieldKeys} values={fieldValues} original={extraction.fields} corrections={correctionNotes} onChange={() => undefined} onFocus={setActiveField} readOnly />
        </div>
      </>
    )
  }

  const notReadyMessage =
    doc.parse_status === 'failed'
      ? '上一轮解析失败，请回到单据列表重试解析，或转人工录入。'
      : doc.parse_status === 'parsing'
        ? '单据正在解析，请稍后回到列表刷新查看。'
        : doc.parse_status === 'uploaded'
          ? '单据还没有解析，请先在单据列表触发解析。'
          : '识别结果为空，无法核对；请回到单据列表重试解析。'

  if (doc.parse_status !== 'parsed' || fieldKeys.length === 0) {
    return (
      <main>
        <ReviewHead document={doc} fieldCount={fieldKeys.length} />
        <div className="review-not-ready">
          <div className="review-not-ready-kicker">Review / not ready</div>
          <h2>暂无可核对的识别结果</h2>
          <p>{notReadyMessage}</p>
          <Link className="review-missing-link" to="/documents">
            返回单据列表 →
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main>
      <ReviewHead document={doc} fieldCount={fieldKeys.length} />

      {doc.review_status === 'rejected' ? (
        <div className="review-notice">
          该单据此前已被驳回，修订字段与入账信息后可重新确认入库。
        </div>
      ) : null}

      <div className="review-grid">
        <div>
        <ReviewSourcePanel document={doc} activeField={activeField} value={activeField ? fieldValues[activeField] ?? "" : ""} />
        <ReviewPreviewPanel
          document={doc}
          correctionCount={correctionCount}
          verifyDetail={verifyDetail}
        />
        </div>

        <div className="review-center">
          <ReviewFieldsPanel
            onFocus={setActiveField}
            fieldKeys={fieldKeys}
            values={fieldValues}
            original={extraction.fields}
            corrections={correctionNotes}
            onChange={(key, value) =>
              setFieldValues((prev) => ({ ...prev, [key]: value }))
            }
          />

          <ReviewAccountingPanel
            period={period}
            onPeriodChange={setPeriod}
            category={category}
            categoryOptions={categoryOptions}
            onCategoryChange={handleCategoryChange}
            scope={scope}
            onScopeChange={setScope}
            quantity={quantity}
            onQuantityChange={setQuantity}
            unit={unit}
            onUnitChange={setUnit}
            amount={amount}
            onAmountChange={setAmount}
            factorId={factorId}
            factorOptions={factorOptions}
            onFactorChange={setFactorId}
            selectedFactor={selectedFactor}
            factorsLoading={factorsLoading}
            factorsError={factorsError}
            onReloadFactors={loadFactors}
            note={note}
            onNoteChange={setNote}
          />
        </div>

        <LocationFields companyId={doc.company_id} prefix="receipt-location" value={locationFields} onChange={setLocationFields}/>
        <ReviewSidePanel
          confidence={doc.overall_confidence}
          correctionCount={correctionCount}
          fieldCount={fieldKeys.length}
          verifyStatus={doc.verified_status}
          submitting={submitting}
          formError={formError}
          onVerify={handleVerify}
          onConfirm={handleConfirm}
          onReject={handleReject}
        />
      </div>
    </main>
  )
}

function stringOf(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function ReviewHead({
  document,
  fieldCount,
}: {
  document: SourceDocument
  fieldCount: number
}) {
  return (
    <div className="review-page-head">
      <div>
        <Link className="review-back" to="/documents">
          ← 返回单据
        </Link>
        <h1>数据核对</h1>
        <p>
          {document.file_name} · {docTypeLabel(document.doc_type)} · {fieldCount} 个识别字段
          {document.overall_confidence !== null
            ? ` · 综合置信度 ${document.overall_confidence.toFixed(2)}`
            : ''}
        </p>
      </div>
      <span className="review-page-meta">
        {document.review_status === 'confirmed'
          ? '已入库'
          : document.review_status === 'rejected'
            ? '已驳回 · 可复核重入'
            : '待复核'}{' '}
        · {formatDateTime(document.created_at).slice(0, 10)}
      </span>
    </div>
  )
}

function ReviewOutcome({
  document,
  outcome,
  fieldCount,
  previouslyConfirmed,
}: {
  document: SourceDocument
  outcome: Outcome
  fieldCount: number
  previouslyConfirmed: boolean
}) {
  const confirmed = outcome.kind === 'confirmed'
  return (
    <main>
      <ReviewHead document={document} fieldCount={fieldCount} />

      <div className={confirmed ? 'review-outcome is-ok' : 'review-outcome is-rejected'}>
        <div className="review-outcome-kicker">
          Review / {previouslyConfirmed ? 'archived' : outcome.kind}
        </div>
        <h2>{confirmed ? '已确认入库' : '已驳回'}</h2>
        <p>
          {previouslyConfirmed
            ? '该单据此前已确认入库，业务记录已生成。'
            : confirmed
              ? '单据已复核完成，业务记录已生成并参与排放分析。'
              : '单据已驳回，不会生成业务记录。'}
        </p>
        {outcome.duplicateHint ? (
          <p className="review-outcome-warn">{outcome.duplicateHint}</p>
        ) : null}
        {outcome.verifyHint ? (
          <p className="review-outcome-warn">{outcome.verifyHint}</p>
        ) : null}
        <div className="review-outcome-actions">
          <Link to="/documents">返回单据列表 →</Link>
          {confirmed ? <Link to="/records">查看业务记录 →</Link> : null}
        </div>
      </div>
    </main>
  )
}
