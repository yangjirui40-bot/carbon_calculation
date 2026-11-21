/**
 * 接口类型。
 *
 * 来源：carbon-speed/backend/carbon_calculation（FastAPI，统一前缀 /api/v1）。
 * 约定：
 * - 后端无响应信封，直接返回业务数据；错误为 { detail: string | ValidationError[] }。
 * - 字段保持后端 snake_case，不在页面里改名；适配集中在 src/api/modules。
 * - 文件末尾的「旧前端假设类型」仍被 mocks 与现有页面引用，
 *   随 W1—W10 页面接入真实接口逐步替换，不要在新代码里继续使用。
 */

/* ============================================================
 * 一、通用与认证
 * ============================================================ */

export type Scope = 'scope1' | 'scope2' | 'scope3'

export type Role = 'admin' | 'enterprise' | 'supplier' | 'auditor'

export interface ApiError {
  code: string
  message: string
}

export interface UserOut {
  id: number
  username: string
  email: string
  role: Role
  company_id: number | null
  is_active: boolean
}

/** POST /auth/login（application/x-www-form-urlencoded） */
export interface LoginResponse {
  access_token: string
  token_type: string
  user: UserOut
}

/** 自助注册仅允许 enterprise 角色 */
export interface RegisterPayload {
  username: string
  email: string
  password: string
  role?: 'enterprise'
  company_id?: number | null
}

/* ============================================================
 * 二、企业
 * ============================================================ */

export interface CompanyDetail {
  id: number
  code: string
  name: string
  industry: string
  region: string | null
  scale: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  description: string | null
  created_at?: string | null
}

export interface CompanyCreatePayload {
  code: string
  name: string
  industry?: string
  region?: string
  scale?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  description?: string
}

export type CompanyUpdatePayload = Partial<Omit<CompanyCreatePayload, 'code'>>

/* ============================================================
 * 三、排放因子
 * ============================================================ */

export interface FactorRecord {
  id: number
  factor_id: string
  category: string
  scope: string
  value: number
  unit: string
  version: string
  origin: string | null
  price_basis: string | null
  is_demo: boolean
  uncertainty_pct: number | null
  description: string | null
}

export interface FactorCreatePayload {
  factor_id: string
  category: string
  scope?: string
  value: number
  unit: string
  version: string
  origin?: string
  price_basis?: string
  is_demo?: boolean
  description?: string
}

export interface OfficialFactor {
  factor_id: string
  category: string
  value: number
  unit: string
  origin: string
  uncertainty_pct: number | null
}

export interface FactorSetsResponse {
  /** 因子集名称 → { 业务类别: factor_id } */
  sets: Record<string, Record<string, string>>
  official_factors: OfficialFactor[]
  note: string
}

export interface FactorImportResult {
  imported: number
}

/* ============================================================
 * 四、单据解析
 * ============================================================ */

export type BackendParseStatus = 'uploaded' | 'parsing' | 'parsed' | 'failed'
export type DocumentReviewStatus = 'pending' | 'confirmed' | 'rejected'
export type VerifyStatus = 'unverified' | 'verified' | 'failed'

export interface SourceDocument {
  id: number
  company_id: number
  doc_type: string
  file_name: string
  file_ext: string
  parse_status: BackendParseStatus
  /** 解密后的 { fields, record_hint, fingerprint }，结构见 document_parser */
  extracted_fields: unknown
  overall_confidence: number | null
  ocr_engine: string | null
  correction_log: unknown[] | null
  review_status: DocumentReviewStatus
  verified_status: VerifyStatus
  reviewed_by_user_id: number | null
  review_note: string | null
  created_at: string | null
}

export interface DocumentUploadResponse extends SourceDocument {
  duplicate_hint: string | null
}

export interface DocumentParseResponse {
  job_id: number
  status: string
  document_id: number
}

export interface ReviewQueueItem {
  id: number
  file_name: string
  doc_type: string
  overall_confidence: number | null
  verified_status: VerifyStatus
  corrections: number
  reasons: string[]
}

export interface ReviewQueueResponse {
  queue: ReviewQueueItem[]
  count: number
}

export interface DocumentReviewPayload {
  site_id?: number | null
  org_unit_id?: number | null
  period?: string
  category?: string
  scope?: string
  factor_id?: string
  quantity?: number
  unit?: string
  amount?: number
  currency?: string
  review_status?: 'confirmed' | 'rejected'
  fields_override?: Record<string, unknown>
  note?: string
}

export interface DocumentReviewResponse extends SourceDocument {
  duplicate_hint: string | null
  verify_hint: string | null
}

export interface DocumentVerifyResponse extends SourceDocument {
  verify_detail: string
}

/* ============================================================
 * 五、业务记录
 * ============================================================ */

export type RecordReviewStatus = 'pending' | 'confirmed' | 'rejected'

export interface RecordClassification {
  site_id?: number | null
  org_unit_id?: number | null
  site_name?: string | null
  workshop?: string | null
  production_line?: string | null
  scope3_category?: number | null
}

export interface BusinessRecord extends RecordClassification {
  id: number
  record_no: string
  company_id: number
  period: string
  category: string
  scope: string
  quantity: number | null
  unit: string | null
  amount: number | null
  currency: string
  factor_id: string
  review_status: RecordReviewStatus
  source: string
  document_id: number | null
  remark: string | null
}

export interface RecordCreatePayload extends RecordClassification {
  record_no: string
  company_id: number
  period: string
  category: string
  scope: string
  quantity?: number
  unit?: string
  amount?: number
  currency?: string
  factor_id: string
  review_status?: RecordReviewStatus
  source?: string
  document_id?: number
  remark?: string
}

export interface RecordImportResult {
  imported: number
  total_rows: number
}

/* ============================================================
 * 六、核算
 * ============================================================ */

export type RunStatus = 'success' | 'error'
export type RunOperation = 'enterprise' | 'eiolca' | 'product' | 'scenario'

export interface CalculationRunSummary {
  run_id: string
  operation: string
  company_id: number | null
  product_id: string | null
  status: RunStatus
  algorithm_version: string
  factor_versions: string[] | null
  total_kgco2e: number | null
  created_at: string | null
}

export interface CalculationRunDetail {
  run_id: string
  operation: string
  company_id: number | null
  product_id: string | null
  status: RunStatus
  algorithm_version: string
  factor_versions: string[] | null
  result: Record<string, unknown> | null
  warnings: string[] | null
  error_message: string | null
  request_snapshot: unknown
  created_at: string | null
}

/** 统一计算引擎的原始响应（enterprise / eiolca / product / scenario 共用） */
export interface EngineResponse<T = Record<string, unknown>> {
  success: boolean
  run_id: string
  operation: string
  status: RunStatus
  generated_at: string
  data: T
  warnings: string[]
  model_version: string
}

export interface CalcLine {
  record_id: string
  company_id?: number | null
  period?: string
  scope: Scope
  category: string
  factor_id: string
  factor_version: string
  activity_or_amount: number
  basis_unit: string
  emissions_kgco2e: number
  is_demo: boolean
}

export interface EnterpriseResultData {
  company_id: number | null
  period: string | null
  total_kgco2e: number
  scope_breakdown: Record<Scope, number>
  items: CalcLine[]
  excluded_record_ids: string[]
  factor_versions: string[]
  is_demo: boolean
}

export interface EnterpriseCalcPayload {
  company_id?: number
  period?: string
  records?: Array<Record<string, unknown>>
  factor_set?: string
}

export interface EIOLCAPayload {
  purchase_vector_cny: number[]
  A?: number[][]
  g?: number[]
  sectors?: string[]
}

export interface EIOLCAResultData {
  model: string
  sectors: string[]
  A: number[][]
  I_minus_A_inverse: number[][]
  g_kgco2e_per_cny: number[]
  y_cny: number[]
  f_kgco2e_per_cny: number[]
  sector_emissions_kgco2e: Record<string, number>
  total_kgco2e: number
  diagnostics: Record<string, unknown>
  is_demo: boolean
  parameter_status: string
  unit_note: string
}

export interface ProductCalcPayload {
  product_id?: string
  product?: Record<string, unknown>
  bom_items?: Array<Record<string, unknown>>
  factor_set?: string
}

export interface PCFResultData {
  product_id: string
  product_name: string
  output_quantity: number
  product_unit: string
  total_upstream_emissions_kgco2e: number
  unit_product_emissions_kgco2e: number
  unit_label: string
  items: Array<{
    bom_item_id: string
    material_name: string
    category: string
    material_amount_cny: number
    factor_id: string
    factor_version: string
    factor_kgco2e_per_cny: number
    emissions_kgco2e: number
    is_demo: boolean
  }>
  factor_versions: string[]
  boundary: string
  is_demo: boolean
  warnings: string[]
}

export interface ScenarioResultData {
  scenario_id: string
  scenario_name: string
  baseline_run_id: string | null
  baseline_total_kgco2e: number
  scenario_total_kgco2e: number
  scope_breakdown: Record<Scope, number>
  baseline_scope_breakdown: Record<Scope, number>
  reduction_kgco2e: number
  reduction_rate: number
  electricity_saving_rate: number
  procurement_reduction_rate: number
  changed_records: Array<Record<string, unknown>>
  items: CalcLine[]
  factor_versions: string[]
  is_demo: boolean
  warnings: string[]
}

export interface UncertaintyItem {
  name: string
  emissions_kgco2e: number
  uncertainty_pct: number
  sigma_kgco2e: number
  contribution_to_variance: number
}

export interface UncertaintyResponse {
  run_id: string
  operation: string
  total_kgco2e: number
  sigma_total_kgco2e: number
  relative_uncertainty: number
  ci95_low: number
  ci95_high: number
  items: UncertaintyItem[]
}

export interface EIOLCATablePayload {
  category_amounts: Record<string, number>
  g?: number[]
}

export interface EIOLCATableResponse {
  success: boolean
  operation: string
  data: Record<string, unknown>
}

/* ============================================================
 * 七、产品碳足迹
 * ============================================================ */

export interface ProductRecord {
  id: number
  product_id: string
  product_name: string
  company_id: number
  output_quantity: number
  product_unit: string
  description: string | null
}

export interface ProductBomLine {
  assembly_path?: string | null
  bom_item_id: string
  material_name: string
  material_amount: number
  currency: string
  matched_category: string | null
  matched_factor_id: string | null
  match_confidence: number | null
}

export interface ProductDetail extends ProductRecord {
  bom_items: ProductBomLine[]
}

export interface ProductCreatePayload {
  product_id: string
  product_name: string
  company_id: number
  output_quantity: number
  product_unit?: string
  description?: string
}

export interface BomItemPayload {
  assembly_path?: string | null
  bom_item_id: string
  material_name: string
  material_amount: number
  currency?: string
  matched_category?: string
  matched_factor_id?: string
  match_confidence?: number
}

export interface BomImportResult {
  product_id: string
  imported: number
  ready: number
  skipped: number
  total_rows: number
}

export interface BomMatchResult {
  product_id: string
  matched_items: Array<{
    material_name: string
    matched: boolean
    matched_category: string | null
    matched_factor_id: string | null
    confidence: number
    candidates: Array<Record<string, unknown>>
  }>
}

/* ============================================================
 * 八、驾驶舱
 * ============================================================ */

export interface DashboardSummary {
  run_id?: string | null
  periods?: string[]
  record_count?: number
  excluded_count?: number
  uses_demo_factors?: boolean
  total_kgco2e: number
  scope_breakdown: Record<Scope, number>
  period?: string | null
}

export interface DashboardRing {
  scopes: Array<{ scope: string; name: string; emissions_kgco2e: number; ratio: number }>
  categories: Array<{ category: string; emissions_kgco2e: number; scope: string }>
}

export interface DashboardSankey {
  nodes: Array<{ name: string }>
  links: Array<{ source: string; target: string; value: number; scope?: string; category?: string; record_count?: number }>
  summary: DashboardSummary
}

export interface DashboardTrendPoint {
  period: string
  run_id?: string
  scope1: number
  scope2: number
  scope3: number
  total: number
}

export interface DashboardTrend {
  historical: DashboardTrendPoint[]
  forecast: Array<{ period: string; total: number }>
  target_line: number[]
  target_total_kgco2e: number | null
  exceed_warning: boolean
  budget_year?: number
  monthly_budget_kgco2e?: number | null
}

export interface DashboardProduction {
  locations: Array<RecordClassification & { scope: string; emissions_kgco2e: number }>
  sites?: Array<{site_id:number; site_name:string; scope:string; emissions_kgco2e:number}>
  scope3: Array<{ category: number | null; emissions_kgco2e: number; has_records: boolean;
    assessment?: { status: string; rationale: string } | null }>
  sankey: {
    nodes: Array<{ name: string; label: string; depth: number }>
    links: Array<{ source: string; target: string; value: number }>
  }
}

export interface DashboardBudget {
  year: number
  annual_limit_kgco2e: number | null
  allocated_kgco2e: number | null
  actual_kgco2e: number
  covered_months: number
  elapsed_months: number
  status: 'unset' | 'over' | 'within' | 'incomplete'
}

export interface DashboardDrilldown {
  scopes: Record<
    string,
    {
      scope: string
      total_kgco2e: number
      items: Array<{
        record_no: string
        site_id?: number | null
        site_name?: string | null
        workshop?: string | null
        production_line?: string | null
        scope3_category?: number | null
        period?: string
        category: string
        basis: number | null
        unit: string
        factor_id: string
        emissions_kgco2e: number
      }>
    }
  >
}

/* ============================================================
 * 九、绿色金融审计
 * ============================================================ */

export interface AuditFactorTrace {
  factor_id: string
  category: string
  value: number
  unit: string
  version: string
  origin: string | null
  is_demo: boolean
  snapshot_available?: boolean
}

export interface AuditTrace {
  lineage?: { inputs: number; results: number }
  run_id: string
  found: boolean
  operation?: string
  total_kgco2e?: number | null
  formula?: string
  factors?: AuditFactorTrace[]
  records?: Array<{
    record_no: string
    period: string | null
    category: string
    scope: string
    quantity: number | null
    amount: number | null
    factor_id: string
    document_id?: number | null
    evidence_link?: string
    emissions_kgco2e: number | null
  }>
  documents?: Array<{
    id: number
    file_name: string
    doc_type: string
    parse_status: string
    ocr_engine: string | null
  }>
  audit_logs?: Array<{ action: string; actor_user_id: number | null; created_at: string }>
  algorithm_version?: string
}

export interface Attestation {
  run_id: string
  attestation_hash: string
  prev_hash: string
  data_summary: Record<string, unknown>
  block_height: number
  onchain_time: string
  verified: boolean
}

export interface AttestationQuery {
  run_id: string
  attested: boolean
  attestation_hash?: string
  prev_hash?: string
  data_summary?: Record<string, unknown>
  block_height?: number
  onchain_time?: string
  verified?: boolean
}

export interface AuditLogEntry {
  id: number
  run_id: string | null
  action: string
  actor_user_id: number | null
  source_ip: string | null
  detail: Record<string, unknown> | null
  created_at: string
}

/* ============================================================
 * 十、减排模拟器
 * ============================================================ */

export interface ScenarioRecord {
  scenario_id: string
  scenario_name: string
  baseline_run_id: string | null
  electricity_saving_rate: number
  procurement_reduction_rate: number
  baseline_total_kgco2e: number | null
  scenario_total_kgco2e: number | null
  reduction_kgco2e: number | null
  reduction_rate: number | null
  roi: ROIResponse | null
  assumptions?: ScenarioRates | null
}

export interface ScenarioRates {
  electricity_saving_rate: number
  electricity_substitution_rate: number
  procurement_reduction_rate: number
}

export type ScenarioFinance = Required<Omit<ROIRequestPayload, 'annual_reduction_kgco2e'>>

export interface ScenarioProjection {
  historical: Array<{ period: string; kgco2e: number }>
  forecast: Array<{ period: string; baseline_kgco2e: number; scenario_kgco2e: number }>
}

export interface ScenarioPreviewData {
  baseline_run_id: string
  baseline_total_kgco2e: number
  scenario_total_kgco2e: number
  reduction_kgco2e: number
  reduction_rate: number
  projection: ScenarioProjection
  roi?: ROIResponse
  assumptions: ScenarioRates
}

export interface ScenarioRunPayload {
  company_id: number
  scenario_id?: string
  scenario_name?: string
  electricity_saving_rate?: number
  electricity_substitution_rate?: number
  procurement_reduction_rate?: number
  forecast_months?: number
  finance?: ScenarioFinance
  baseline_run_id?: string
  factor_set?: string
}

export interface ROIRequestPayload {
  capex: number
  annual_opex: number
  annual_saving: number
  annual_reduction_kgco2e: number
  carbon_price?: number
  project_life?: number
  discount_rate?: number
}

export interface ROIResponse {
  capex: number
  annual_opex: number
  annual_saving: number
  annual_reduction_kgco2e: number
  annual_carbon_revenue: number
  carbon_income_included?: boolean
  carbon_price?: number
  annual_net_cash_flow: number
  project_life: number
  discount_rate: number
  roi: number | null
  npv: number
  payback_period_years: number | null
  discounted_payback_period_years: number | null
  cash_flows: Array<{
    year: number
    cash_flow: number
    cumulative: number
    discounted: number
    discounted_cumulative: number
  }>
}

export interface TrajectoryResponse {
  historical_count: number
  forecast_count: number
  labels: string[]
  bau: number[]
  interventions: Array<{ scenario_id: string; scenario_name: string; curve: number[] }>
  summary: DashboardSummary
}

/* ============================================================
 * 十一、供应链协同
 * ============================================================ */

export type RiskLevel = 'red' | 'yellow' | 'green' | 'unknown'

export interface SupplierRecord {
  id: number
  supplier_id: string
  name: string
  industry: string | null
  region: string | null
  tier: number
  carbon_intensity: number | null
  annual_emissions: number | null
  risk_level: RiskLevel
  company_id: number | null
}

export interface SupplierCreatePayload {
  supplier_id: string
  name: string
  industry?: string
  region?: string
  tier?: number
  carbon_intensity?: number
  annual_emissions?: number
  risk_level?: RiskLevel
  company_id?: number
}

export interface SupplyChainEdgePayload {
  source_id: string
  target_id: string
  relation_type?: string
  amount?: number
  transport_distance?: number
  transport_mode?: string
}

export interface SupplyChainNetwork {
  company_id: number
  nodes: Array<{
    id: string
    name: string
    tier: number
    type: 'company' | 'supplier'
    industry?: string
    region?: string
    carbon_intensity: number | null
    annual_emissions: number | null
  }>
  edges: Array<{
    source_id: string
    target_id: string
    relation_type: string
    amount: number | null
    transport_distance: number | null
  }>
}

export interface HeatmapNode {
  id: string
  name: string
  tier: number
  type?: 'company' | 'supplier'
  industry?: string
  region?: string
  /** 节点自报碳强度；未填报的供应商为 null */
  carbon_intensity: number | null
  annual_emissions?: number | null
  updated_at?: string | null
  /** GNN 传播后的碳强度，展示以它为准 */
  propagated_intensity: number | null
  risk_level: RiskLevel
  estimated: boolean
}

export interface SupplierEvidence {
  node: HeatmapNode
  thresholds: { low: number; high: number }
  relationships: Array<{ id: string; name: string; tier: number }>
  submissions: Array<{ period: string; intensity: number | null; emissions_kgco2e: number }>
}

export interface HeatmapResponse {
  nodes: HeatmapNode[]
  adjacency: number[][]
  statistics: Record<RiskLevel, number>
  layers?: number
  thresholds?: { low: number; high: number }
}

export interface CarbonQuota {
  id: number
  supplier_id: string | null
  year: number
  allocated_quota: number
  used_quota: number
  remaining: number
}

export interface QuotaCreatePayload {
  company_id: number
  supplier_id?: string
  year?: number
  allocated_quota: number
  used_quota?: number
}

export interface ReductionPlanRecord {
  plan_id: string
  title: string
  target_supplier_id: string | null
  target_reduction_rate: number
  progress: number
  status: string
  deadline: string | null
  overdue?: boolean
}

export interface ReductionPlanCreatePayload {
  plan_id: string
  title: string
  target_supplier_id?: string
  target_reduction_rate?: number
  deadline?: string
}

export interface SupplyChainReport {
  company_id: number
  supplier_count: number
  hot_spots: HeatmapNode[]
  risk_statistics: Record<string, number>
  quotas: CarbonQuota[]
  reduction_plans: ReductionPlanRecord[]
}

export type TradeStatus = 'pending' | 'accepted' | 'declined'

export interface QuotaTrade {
  trade_id: string
  seller_company_id: number
  buyer_company_id: number
  year: number
  amount: number
  price: number
  status: TradeStatus
  note: string | null
  created_at: string | null
}

export interface TradeCreatePayload {
  seller_company_id: number
  buyer_company_id: number
  year?: number
  amount: number
  price: number
  note?: string
}

export interface TradeReconciliation {
  company_id: number
  summary: {
    sold_total: number
    bought_total: number
    net_quota_change: number
    revenue: number
    expense: number
    net_cash: number
  }
  trades: QuotaTrade[]
}

/* ============================================================
 * 十二、合规报告
 * ============================================================ */

export interface ISO14064RequestPayload {
  company_id: number
  run_id?: string
  language?: string
}

export interface PCFReportRequestPayload {
  product_id: string
  run_id?: string
  language?: string
}

export interface ReportGenerationResponse {
  report_no: string
  title: string
  content: Record<string, unknown>
}

export interface ReportNotFound {
  found: false
}

export interface ReportSummary {
  report_no: string
  report_type: string
  title: string
  company_id?: number
  status?: string
  created_at: string | null
}

export interface ReportDetail extends ReportSummary {
  artifacts?: Array<{ format: ReportFormat; sha256: string; size_bytes: number; archived_at: string }>
  language: string
  run_id: string | null
  content: Record<string, unknown> | null
}

export type ReportFormat = 'pdf' | 'xml'

/* ============================================================
 * 十三、订阅计费
 * ============================================================ */

export interface BillingPlan {
  plan_code: string
  name: string
  price_yearly: number
  quota_calculations: number
  quota_documents: number
  features: string[] | null
}

export interface SubscriptionInfo {
  company_id: number
  plan_code: string
  status: string
  start_date: string | null
  end_date: string | null
  usage_calculations: number
  usage_documents: number
  quota_calculations?: number | null
  quota_documents?: number | null
  remaining_calculations?: number | null
}

/* ============================================================
 * 十四、系统运维
 * ============================================================ */

export interface AIStatusResponse {
  ocr: { configured_engine: string; model: string; status: string }
  layoutlmv3: { model: string; provisioned: boolean; loaded: boolean }
  ser: { model: string; provisioned: boolean; loaded: boolean; enabled: boolean; note: string }
  sbert: { model: string; provisioned: boolean; loaded: boolean }
  llm: { enabled: boolean; model: string; check: Record<string, unknown>; note: string }
}

export interface JobRecord {
  job_id: number
  job_type: string
  status: string
  result?: unknown
  error: string | null
  attempts?: number
  created_at?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export interface SchemaInfoResponse {
  modeling: Record<string, unknown>
}

/* ============================================================
 * 十五、供应商门户
 * ============================================================ */

export interface SupplierPortalProfile {
  supplier_id: string
  name: string
  industry: string | null
  region: string | null
  tier: number
  carbon_intensity: number | null
  annual_emissions: number | null
  risk_level: RiskLevel
  quotas: Array<{ year: number; allocated: number; used: number; remaining: number }>
  reduction_plans: Array<{
    plan_id: string
    title: string
    target_rate: number
    progress: number
    status: string
    deadline: string | null
  }>
}

export interface SupplierSubmissionPayload {
  period: string
  reported_emissions: number
  reported_intensity?: number
  note?: string
}

export interface SupplierSubmissionResult {
  submission_id: number
  supplier_id: string
  period: string
  reported_emissions: number
  quota_remaining: number | null
}

export interface SupplierSubmissionRecord {
  submission_id: number
  period: string
  reported_emissions: number
  reported_intensity: number | null
  note: string | null
  created_at: string | null
}

/* ============================================================
 * 十六、健康检查
 * ============================================================ */

export interface HealthResponse {
  status: string
  algorithm_version: string
}

/* ============================================================
 * 十七、旧前端假设类型（mocks 与现有页面在用，逐步替换）
 * ============================================================ */

/** 旧前端假设的企业展示模型（mocks/demoCompany） */
export interface Company {
  id: string
  name: string
  industry: string
  period: string
}

/** 旧前端假设的单据解析状态（现有 StatusTag 使用） */
export type ParseStatus = 'pending' | 'parsed' | 'failed'

export interface DocumentItem {
  id: string
  file_name: string
  file_type: 'image/jpeg' | 'image/png' | 'application/pdf'
  parse_status: ParseStatus
  uploaded_at?: string
  total_amount?: number
  currency?: string
  confidence_summary?: number
  error_message?: string
}

export interface RecognizedField {
  key: string
  label: string
  value: string | number | null
  /** 0—1 */
  confidence: number
  needs_review: boolean
  review_reason?: string
  /** 归一化坐标 0—1；后端不返回 bbox 时前端不做框选 */
  bbox?: [number, number, number, number]
}

export interface DocumentDetail extends DocumentItem {
  fields: RecognizedField[]
}

export type TransactionCategory =
  | 'diesel_combustion'
  | 'electricity'
  | 'electronic_components'
  | 'pcb_materials'
  | 'packaging_materials'

export type SourceType = 'manual' | 'document'
export type ReviewStatus = 'pending' | 'confirmed'

export interface Transaction {
  id: string
  company_id: string
  period: string
  document_id?: string
  source_type: SourceType
  activity_date: string
  supplier_id?: string
  item_name: string
  category: TransactionCategory
  scope: Scope
  quantity?: number
  unit?: string
  amount?: number
  currency?: string
  factor_id: string
  review_status: ReviewStatus
}

export interface CalculationItem {
  transaction_id: string
  scope: Scope
  category: TransactionCategory
  activity_value: number
  activity_unit: string
  factor_id: string
  factor_value: number
  factor_unit: string
  emissions_kgco2e: number
}

export interface EmissionFactor {
  factor_id: string
  category: TransactionCategory
  factor_value: number
  factor_unit: string
  price_basis?: string
  source: string
  version: string
  is_demo: boolean
}

export type CalculationStatus = 'pending' | 'running' | 'succeeded' | 'failed'

export interface CalculationResult {
  run_id: string
  status: CalculationStatus
  total_kgco2e: number
  scope_breakdown: Record<Scope, number>
  calculation_items: CalculationItem[]
  factor_version: string
  warnings: string[]
  is_demo: boolean
  error?: ApiError
}

export interface CalculationRequest {
  company_id: string
  period: string
  transactions: Transaction[]
  factor_version: string
}

export interface BomItem {
  bom_item_id: string
  material_name: string
  material_quantity?: number
  material_unit?: string
  material_amount: number
  matched_category: TransactionCategory
  matched_factor_id: string
  supplier_id?: string
  estimated_kgco2e: number
}

export interface ProductFootprint {
  product_id: string
  product_name: string
  output_quantity: number
  product_unit: string
  items: BomItem[]
  total_kgco2e: number
  per_unit_kgco2e: number
}

export type SubmissionStatus = '未提交' | '已提交' | '待核对'

export interface Supplier {
  supplier_id: string
  supplier_name: string
  supplier_tier?: string
  submission_period: string
  submission_status: SubmissionStatus
  reported_kgco2e?: number
}

export interface ReductionScenario {
  scenario_id: string
  scenario_name: string
  baseline_run_id: string
  electricity_saving_rate: number
  procurement_reduction_rate: number
  baseline_total_kgco2e: number
  scenario_total_kgco2e: number
}

export interface RecentRun {
  run_id: string
  started_at: string
  status: CalculationStatus
  total_kgco2e?: number
  error?: ApiError
}

export interface WorkspaceSummary {
  company_id: string
  period: string
  total_kgco2e: number
  document_count: number
  needs_review_count: number
  calculation_count: number
  scope_breakdown: Record<Scope, number>
  scope_ratio: Record<Scope, number>
}

export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
  request_id: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface DocumentListParams {
  page?: number
  size?: number
  parse_status?: ParseStatus
}

export interface UploadDocumentResponse {
  document_id: string
  parse_status?: ParseStatus
}

export interface ParseResponse {
  document_id: string
  parse_status: ParseStatus
}

export interface CreateCalculationResponse {
  run_id: string
  status?: CalculationStatus
}

export interface ReportPayload {
  run_id: string
  generated_at?: string
  download_url?: string
}
