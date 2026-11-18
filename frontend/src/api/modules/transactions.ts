import { request } from '../client'
import type { Paginated, Transaction } from '../types'

// TODO(contract): 路径与查询参数以杨济瑞契约为准

export interface TransactionListParams {
  page?: number
  size?: number
  document_id?: string
  period?: string
  review_status?: Transaction['review_status']
}

export function listTransactions(params: TransactionListParams = {}) {
  return request<Paginated<Transaction>>({
    url: '/api/transactions',
    method: 'get',
    params,
  })
}

export function createTransaction(payload: Transaction) {
  return request<Transaction>({
    url: '/api/transactions',
    method: 'post',
    data: payload,
  })
}

/** 核对页保存修订：只提交改动字段 */
export function updateTransaction(
  id: string,
  patch: Partial<Omit<Transaction, 'id'>>,
) {
  return request<Transaction>({
    url: `/api/transactions/${id}`,
    method: 'patch',
    data: patch,
  })
}
