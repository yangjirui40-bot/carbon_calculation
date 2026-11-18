import { request } from '../client'
import type {
  Attestation,
  AttestationQuery,
  AuditLogEntry,
  AuditTrace,
} from '../types'

/** 穿透核查：记录 → 因子 → 单据 → 审计日志 */
export function getTrace(runId: string) {
  return request<AuditTrace>({
    url: `/api/v1/audit/run/${runId}/trace`,
    method: 'get',
  })
}

/** 生成区块链哈希存证；重复调用返回已有存证，任务不存在时 found=false */
export function attest(runId: string) {
  return request<Attestation | { run_id: string; found: false }>({
    url: `/api/v1/audit/run/${runId}/attest`,
    method: 'post',
  })
}

export function getAttestation(runId: string) {
  return request<AttestationQuery>({
    url: `/api/v1/audit/run/${runId}/attestation`,
    method: 'get',
  })
}

export function listLogs(params: { run_id?: string; limit?: number } = {}) {
  return request<AuditLogEntry[]>({
    url: '/api/v1/audit/logs',
    method: 'get',
    params,
  })
}

export function exportAuditLog(runId?: string) {
  return request<{ logs: AuditLogEntry[] }>({
    url: '/api/v1/audit/export/audit-log',
    method: 'get',
    params: runId ? { run_id: runId } : {},
  })
}
