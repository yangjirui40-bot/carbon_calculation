import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Empty, Flex, Input, Select, Spin, Tag, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { request } from '../../api/client'
import { readSession } from '../../api/modules/auth'
import { SwissMasthead } from '../../components/swiss'
import { useCompanyScope } from '../calculations/useCompanyScope'
import CompanyPicker from '../calculations/swiss/CompanyPicker'
import { formatDateTime } from '../../utils/format'
import { getBoundaries } from '../organization/companyData'
import type { Boundary } from '../organization/companyData'
import PeriodWork from './PeriodWork'
import CoverageEditor from './CoverageEditor'

type Duty = 'coordinator' | 'reviewer'
type Status = 'open' | 'submitted' | 'closed'
type Operation = 'submit' | 'return' | 'close' | 'reopen'
type Period = {
  period: string
  boundary: string
  boundary_id: number | null
  status: Status
  revision: number
  run_id: string | null
  submitted_by: number | null
  confirmed: number
  unconfirmed: number
}
type Inventory = { can_manage: boolean; duty: Duty | null; user_id: number; periods: Period[] }
type Person = { id: number; username: string; duty: Duty | null }
type History = {
  action: Operation | 'open' | 'work_open' | 'work_accept' | 'work_return' | 'work_submit'
  actor: string
  created_at: string
  revision: number
  note: string
  run_id: string | null
}

const statuses: Record<Status, { label: string; color: string }> = {
  open: { label: '待归集', color: 'default' },
  submitted: { label: '待复核', color: 'blue' },
  closed: { label: '已关账', color: 'green' },
}
const actions = { work_open:'分派任务',work_accept:'任务复核通过',work_return:'退回任务',work_submit:'提交任务结果', open: '建立期间', submit: '提交复核', return: '退回补正', close: '确认关账', reopen: '重开更正' }
const duties = { coordinator: '盘查负责人', reviewer: '独立复核人' }

export default function InventoryPage() {
  const scope = useCompanyScope()
  return (
    <>
      <SwissMasthead title="月度盘查" description="按归集范围完成月度核算，交由另一岗位复核，再生成带关账记录的盘查清单。" />
      {scope.pickerVisible && (
        <CompanyPicker companies={scope.companies} value={scope.effectiveCompanyId} loading={scope.pickerLoading}
          error={scope.pickerError} onChange={scope.selectCompany} onRetry={scope.reloadCompanies} />
      )}
      {scope.effectiveCompanyId === null
        ? <Empty description="请选择要查看盘查进度的企业" />
        : <InventoryWorkspace key={scope.effectiveCompanyId} companyId={scope.effectiveCompanyId} />}
    </>
  )
}

function InventoryWorkspace({ companyId }: { companyId: number }) {
  const navigate = useNavigate()
  const isAdmin = readSession()?.user.role === 'admin'
  const path = `/api/v1/inventory/${companyId}`
  const [data, setData] = useState<Inventory>()
  const [people, setPeople] = useState<Person[]>([])
  const [events, setEvents] = useState<History[]>([])
  const [selected, setSelected] = useState('')
  const [month, setMonth] = useState('')
  const [boundary, setBoundary] = useState('')
  const [boundaryId,setBoundaryId] = useState<number>()
  const [boundaries,setBoundaries] = useState<Boundary[]>([])
  const [note, setNote] = useState('')
  const [run, setRun] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [seen, setSeen] = useState(false)
  const current = data?.periods.find((period) => period.period === selected)

  const refresh = useCallback(async () => {
    const result = await request<Inventory>({ url: path })
    setData(result)
    setSelected((value) => result.periods.some((item) => item.period === value) ? value : result.periods[0]?.period ?? '')
    if (result.can_manage) {
      const [staff, versions] = await Promise.all([request<Person[]>({url:path+'/people'}),getBoundaries(companyId)])
      setPeople(staff); setBoundaries(versions)
    }
  }, [path,companyId])

  const displayError = (failure: unknown) => failure instanceof Error ? failure.message : '请求失败，请重试'

  useEffect(() => {
    void refresh().catch((failure: unknown) => setError(displayError(failure))).finally(() => setSeen(true))
  }, [refresh])

  useEffect(() => {
    if (!selected) return
    let active = true
    const controller = new AbortController()
    void request<History[]>({ url: `${path}/${selected}/history`, signal: controller.signal })
      .then((rows) => { if (active) setEvents(rows) })
      .catch((failure: unknown) => { if (active) setError(displayError(failure)) })
    return () => { active = false; controller.abort() }
  }, [path, selected, data])

  async function change(work: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await work()
      await refresh()
    } catch (failure) {
      setError(displayError(failure))
    } finally {
      setBusy(false)
    }
  }

  function decide(action: Operation) {
    if (!current) return
    void change(async () => {
      await request({
        url: `${path}/${current.period}/decision`, method: 'POST',
        data: { action, note, expected_revision: current.revision, run_id: run.trim() || undefined },
      })
      setNote('')
      setRun('')
    })
  }

  const canSubmit = current?.status === 'open' && data?.duty === 'coordinator'
  const canReview = current && current.status !== 'open' && data?.duty === 'reviewer' && data.user_id !== current.submitted_by
  const canWriteReport = isAdmin || readSession()?.user.role === 'enterprise'

  return (
    <Flex vertical gap={16} style={{ paddingBlock: 16 }}>
      {error && <Alert type="error" showIcon title={error} action={<Button size="small" disabled={busy} onClick={() => void change(async () => {})}>刷新</Button>} />}
      {!seen && <Spin />}
      {data?.can_manage && seen && (
        <Card title="配置盘查岗位与期间">
          <Flex wrap gap={12} align="center">
            <Input type="month" aria-label="盘查月份" style={{ width: 170 }} value={month} onChange={(e) => setMonth(e.target.value)} />
            <Select aria-label="已发布的边界版本" allowClear value={boundaryId} onChange={setBoundaryId}
              options={boundaries.map((b) => ({value:b.id,label:`${b.title} · v${b.version}`}))}
              style={{minWidth:220}} placeholder="选择已发布的边界版本"/>
            <Input aria-label="组织与活动边界" style={{ flex: '1 1 280px' }} maxLength={1500} placeholder="填写组织与活动边界，例如纳入哪些场地和排放活动"
              value={boundary} onChange={(e) => setBoundary(e.target.value)} />
            <Button type="primary" loading={busy} disabled={!month || boundary.trim().length < 2 || (!isAdmin && !boundaryId)} onClick={() => void change(async () => {
              await request({ url: path, method: 'POST', data: { period: month, boundary, boundary_id: boundaryId } })
              setSelected(month); setBoundary('')
            })}>建立期间</Button>
          </Flex>
          <Typography.Paragraph style={{ marginBlock: 12 }}>在<Link to="/organization">企业与组织</Link>发布边界并邀请员工，再分别分配盘查和复核岗位。</Typography.Paragraph>
          <Flex vertical gap={8}>
            {people.map((person) => (
              <Flex key={person.id} align="center" justify="space-between" wrap gap={8}>
                <Typography.Text>{person.username}</Typography.Text>
                <Select aria-label={`${person.username} 盘查岗位`} style={{ minWidth: 156 }} disabled={busy} value={person.duty ?? 'none'}
                  options={[{ value: 'none', label: '无盘查岗位' }, ...Object.entries(duties).map(([value, label]) => ({ value, label }))]}
                  onChange={(value) => void change(async () => { await request({
                    method: 'PUT', url: `${path}/people/${person.id}`, data: { duty: value === 'none' ? null : value },
                  }) })} />
              </Flex>
            ))}
          </Flex>
        </Card>
      )}
      {seen && (
        <Card title="盘查进度" extra={data?.duty ? <Tag>{duties[data.duty]}</Tag> : undefined}>
          {data?.periods.length ? (
            <Select aria-label="选择已建立的月份" value={selected} disabled={busy} style={{ width: '100%', maxWidth: 340 }}
              options={data.periods.map((period) => ({ value: period.period, label: `${period.period} · ${statuses[period.status].label}` }))}
              onChange={(value) => { setSelected(value); setNote(''); setRun(''); setEvents([]) }} />
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无月度盘查，由管理员建立期间" />}
          {current && (
            <Flex vertical gap={12} style={{ marginTop: 16 }}>
              <div><Tag color={statuses[current.status].color}>{statuses[current.status].label}</Tag><Typography.Text type="secondary">第 {current.revision} 版</Typography.Text></div>
              <Typography.Text>{current.boundary}</Typography.Text>
              <div>已确认 {current.confirmed} 条 · 待处理 {current.unconfirmed} 条</div>
              <Flex gap={16} wrap>
                <Link to="/records">打开业务台账</Link>
                {current.run_id && <Link to={`/audit/runs/${current.run_id}`}>查看送审快照与证据</Link>}
              </Flex>
              {canSubmit && (
                <>
                  <Typography.Text>在企业核算中选择该月份，按台账生成新的核算快照。补全原始凭证并确认待处理记录后，填写运行编号和提交说明。</Typography.Text>
                  <Link to="/calculations">前往企业核算</Link>
                  <Input aria-label="核算运行编号" maxLength={64} value={run} onChange={(e) => setRun(e.target.value)} placeholder="核算运行编号" />
                </>
              )}
              {(canSubmit || canReview) && <Input.TextArea aria-label="处置说明" maxLength={1500} value={note} rows={3}
                onChange={(e) => setNote(e.target.value)} placeholder={canSubmit ? '说明本月数据覆盖和缺口' : '填写审批意见或更正原因'} />}
              <Flex gap={8} wrap>
                {canSubmit && <Button type="primary" loading={busy} disabled={!current.confirmed || Boolean(current.unconfirmed) || !run.trim() || note.trim().length < 2}
                  onClick={() => decide('submit')}>{actions.submit}</Button>}
                {canReview && current.status === 'submitted' && (
                  <>
                    <Button type="primary" loading={busy} disabled={note.trim().length < 2} onClick={() => decide('close')}>{actions.close}</Button>
                    <Button disabled={busy || note.trim().length < 2} onClick={() => decide('return')}>{actions.return}</Button>
                  </>
                )}
                {canReview && current.status === 'closed' && <Button disabled={busy || note.trim().length < 2} onClick={() => decide('reopen')}>{actions.reopen}</Button>}
                {canWriteReport && current.status === 'closed' && (
                  <Button type="primary" loading={busy} onClick={() => void change(async () => {
                    const report = await request<{ report_no: string }>({
                      method: 'POST', url: '/api/v1/reports/iso14064',
                      data: { company_id: companyId, run_id: current.run_id, require_closed_period: true },
                    })
                    navigate(`/reports/${report.report_no}`)
                  })}>生成已关账清单</Button>
                )}
              </Flex>
            </Flex>
          )}
        </Card>
      )}
      {current && <PeriodWork key={current.period+current.status} cid={companyId} month={current.period} afterChange={refresh}/>}
      {current?.boundary_id && <CoverageEditor key={current.period} path={`${path}/${current.period}/coverage`} editable={canSubmit} />}
      {current && (
        <Card title="审批记录">
          {events.length === 0 && <Typography.Text type="secondary">暂无可显示的处置记录</Typography.Text>}
          <Flex vertical gap={12}>
            {events.map((event, index) => (
              <div key={`${event.created_at}-${index}`}>
                <Typography.Text strong>{actions[event.action]} · 第 {event.revision} 版</Typography.Text>
                <div>{event.actor} · {formatDateTime(event.created_at)}</div>
                <Typography.Text style={{ overflowWrap: 'anywhere' }}>{event.note}</Typography.Text>
                {event.run_id && <div><Link to={`/audit/runs/${event.run_id}`}>查看该版快照</Link></div>}
              </div>
            ))}
          </Flex>
        </Card>
      )}
    </Flex>
  )
}
