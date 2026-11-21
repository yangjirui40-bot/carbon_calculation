import { request } from '../client'
import type {
  EngineResponse,
  ROIRequestPayload,
  ROIResponse,
  ScenarioRecord,
  ScenarioPreviewData,
  ScenarioResultData,
  ScenarioRunPayload,
  TrajectoryResponse,
} from '../types'

/** 运行减排情景；结果同时持久化为 Scenario 记录 */
export function runScenario(payload: ScenarioRunPayload) {
  return request<EngineResponse<ScenarioResultData>>({
    url: '/api/v1/simulator/run',
    method: 'post',
    data: payload,
  })
}

export function listScenarios(companyId: number) {
  return request<ScenarioRecord[]>({
    url: `/api/v1/simulator/company/${companyId}/scenarios`,
    method: 'get',
  })
}

/** 减排投资财务测算：ROI / NPV / 回收期 */
export function computeRoi(payload: ROIRequestPayload) {
  return request<ROIResponse>({
    url: '/api/v1/simulator/roi',
    method: 'post',
    data: payload,
  })
}

/** BAU 基准线与各情景干预线 */
export function getTrajectory(companyId: number) {
  return request<TrajectoryResponse>({
    url: `/api/v1/simulator/company/${companyId}/trajectory`,
    method: 'get',
  })
}


export function previewScenario(payload: ScenarioRunPayload, signal?: AbortSignal) {
  return request<EngineResponse<ScenarioPreviewData>>({
    url: '/api/v1/simulator/preview',
    method: 'post',
    data: payload,
    signal,
  })
}
