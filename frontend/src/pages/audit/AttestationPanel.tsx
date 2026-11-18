import { App } from 'antd'
import { useState } from 'react'
import { auditApi } from '../../api'
import type { Attestation, AttestationQuery } from '../../api/types'
import { SwissButton } from '../../components/swiss'
import { EMPTY_VALUE, formatDateTime } from '../../utils/format'
import { errorMessage } from './auditFormat'

export type AttestationPanelProps = {
  runId: string
  attestation: AttestationQuery | null
  onAttested: (attestation: Attestation) => void
}

/** 哈希存证：未存证时二次确认后生成；已存证展示哈希链字段与验证结果 */
export default function AttestationPanel({
  runId,
  attestation,
  onAttested,
}: AttestationPanelProps) {
  const { modal } = App.useApp()
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  const attached = attestation?.attested === true

  const runAttest = async () => {
    setSubmitting(true)
    setActionError('')
    try {
      const result = await auditApi.attest(runId)
      if ('found' in result) {
        setActionError('找不到这次运行，无法发起存证。')
        return
      }
      onAttested(result)
    } catch (error: unknown) {
      setActionError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const requestAttest = () => {
    modal.confirm({
      title: '发起哈希存证？',
      content:
        '将为本次运行生成 SHA-256 哈希，并与前一条存证串联为哈希链记录，同时写入审计日志。存证生成后不可撤销。',
      okText: '发起存证',
      cancelText: '取消',
      rootClassName: 'swiss-confirm',
      centered: true,
      onOk: () => runAttest(),
    })
  }

  if (attached) {
    const verified = attestation.verified === true
    return (
      <div className="audit-attest">
        <div className="audit-attest__head">
          <span className="audit-attest__badge">已存证</span>
          <span className="audit-attest__note">
            哈希链记录用于验证本次核算结果未被篡改。
          </span>
        </div>

        <dl className="audit-attest__grid">
          <div className="audit-attest__row audit-attest__row--wide">
            <dt>存证哈希</dt>
            <dd className="audit-mono">{attestation.attestation_hash || EMPTY_VALUE}</dd>
          </div>
          <div className="audit-attest__row audit-attest__row--wide">
            <dt>前序哈希</dt>
            <dd className="audit-mono">{attestation.prev_hash || EMPTY_VALUE}</dd>
          </div>
          <div className="audit-attest__row">
            <dt>区块高度</dt>
            <dd className="audit-mono">
              {attestation.block_height ?? EMPTY_VALUE}
            </dd>
          </div>
          <div className="audit-attest__row">
            <dt>存证时间</dt>
            <dd className="audit-mono">{formatDateTime(attestation.onchain_time)}</dd>
          </div>
          <div className="audit-attest__row">
            <dt>验证结果</dt>
            <dd
              className={
                verified
                  ? 'audit-attest__verified'
                  : 'audit-attest__unverified'
              }
            >
              {verified ? '哈希校验通过' : '哈希校验未通过'}
            </dd>
          </div>
        </dl>

        <p className="audit-attest__foot">
          哈希由运行编号、核算结果与算法版本生成，并链接前一条存证；
          存证字段来自系统存证记录。
        </p>
      </div>
    )
  }

  return (
    <div className="audit-attest">
      <p className="audit-attest__intro">
        本次运行尚未存证。发起后将基于运行编号、核算结果与算法版本生成
        SHA-256 哈希，并与前一条存证串联为哈希链记录，同时写入审计日志。
      </p>
      {actionError ? (
        <p className="audit-inline-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <div className="audit-attest__actions">
        <SwissButton onClick={requestAttest} loading={submitting}>
          发起存证
        </SwissButton>
        <span className="audit-attest__hint">存证生成后不可撤销。</span>
      </div>
    </div>
  )
}
