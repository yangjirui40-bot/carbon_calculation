import { request } from '../../api/client'

export type Legal = { id: number; code: string; legal_name: string; jurisdiction: string }
export type Site = { id: number; code: string; legal_entity_id: number; name: string; region: string }
export type Unit = { id: number; code: string; site_id: number; name: string; kind: 'workshop' | 'line' | 'department'; parent_id: number | null }
export type Organization = { can_manage: boolean; legal_entities: Legal[]; sites: Site[]; org_units: Unit[] }
export type Boundary = { id: number; title: string; version: number; code: string; consolidation: string; note: string;
  sites: { id: number; name: string; share_ratio: number; legal_entity: string }[] }

export const orgUrl = (companyId: number) => `/api/v1/organization/${companyId}`
export const getOrganization = (companyId: number) => request<Organization>({ url: orgUrl(companyId) })
export const getBoundaries = (companyId: number) => request<Boundary[]>({ url: orgUrl(companyId) + '/boundaries' })

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请重试'
}
