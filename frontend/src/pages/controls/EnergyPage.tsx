import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Typography } from 'antd'
import { request } from '../../api/client'
import { readSession } from '../../api/modules/auth'
import { uploadDocument } from '../../api/modules/documents'
import { SwissMasthead } from '../../components/swiss'
import EnterpriseScope from '../organization/EnterpriseScope'
import { getOrganization, errorText, type Site } from '../organization/companyData'

type Certificate = { id: number; serial: string; issuer: string; site: string; credited_kwh: number; remaining_kwh: number; period_from: string; period_to: string }
type Allocation = { id: number; serial: string; record_no: string; applied_kwh: string; period: string; cancelled_at: string | null; cancellation_reason: string | null }
type Candidate = { record_no: string; quantity: number; period: string }
type Listing<T> = { items: T[]; total: number }
type Mode = { kind: 'create' } | { kind: 'allocate'; cert: Certificate; key: string } | { kind: 'cancel'; allocation: Allocation }
const required = [{ required: true, message: '请填写此项' }]
const month = [...required, { pattern: /^\d{4}-(0[1-9]|1[0-2])$/, message: '月份格式为 YYYY-MM' }]
const amount = (v: string | number) => Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 4 })

function Register({ cid }: { cid: number }) {
  const api = '/api/v1/energy/' + cid
  const writer = ['admin','enterprise'].includes(readSession()?.user.role ?? '')
  const [certs, setCerts] = useState<Listing<Certificate>>({ items: [], total: 0 })
  const [alloc, setAlloc] = useState<Listing<Allocation>>({ items: [], total: 0 })
  const [pages, setPages] = useState([1, 1])
  const [sites, setSites] = useState<Site[]>([])
  const [mode, setMode] = useState<Mode | null>(null)
  const [search, setSearch] = useState('')
  const [choices, setChoices] = useState<Candidate[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File>()
  const [form] = Form.useForm()
  const reload = useCallback(async () => {
    const [list, usage, org] = await Promise.all([
      request<Listing<Certificate>>({url:api, params:{page:pages[0]}}),
      request<Listing<Allocation>>({url:api+'/allocations', params:{page:pages[1]}}), getOrganization(cid)])
    setCerts(list); setAlloc(usage); setSites(org.sites)
  }, [cid,api,pages])
  useEffect(() => { void reload().catch(e => setError(errorText(e))) }, [reload])
  useEffect(() => {
    let active = true
    if (mode?.kind === 'allocate') {
      const url = api+'/'+mode.cert.id+'/eligible'
      void request<Candidate[]>({url, params:{search}}).then(r => { if (active) setChoices(r) })
        .catch(e => { if (active) setError(errorText(e)) })
    }
    return () => { active = false }
  }, [mode, search, api])
  function open(next: Mode) { form.resetFields(); setError(''); setSearch(''); setChoices([]); setFile(undefined); setMode(next) }
  async function save(values: Record<string,unknown>) {
    if (!mode || busy) return
    setBusy(true); setError('')
    try {
      if (mode.kind === 'create') await request({method:'POST',url:api,data:values})
      if (mode.kind === 'allocate') await request({method:'POST',url:api+'/'+mode.cert.id+'/allocations',data:{...values,request_key:mode.key}})
      if (mode.kind === 'cancel') await request({method:'POST',url:api+'/allocations/'+mode.allocation.id+'/cancel',data:values})
      setMode(null); await reload()
    } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  async function attach() {
    if (!file) return
    setPending(true); setError('')
    try { const saved = await uploadDocument(file,cid,'energy_certificate'); form.setFieldValue('proof_id', saved.id) }
    catch (e) { setError(errorText(e)) } finally { setPending(false) }
  }
  const certTable = <Table rowKey="id" dataSource={certs.items} scroll={{ x: 780 }} pagination={{current:pages[0],pageSize:25,total:certs.total,showSizeChanger:false,onChange:p=>setPages([p,pages[1]])}}
    columns={[{title:'凭证编号',dataIndex:'serial'},{title:'签发机构',dataIndex:'issuer'},{title:'工厂',dataIndex:'site'},
      {title:'适用月份',render:(_,r)=>r.period_from+' 至 '+r.period_to},{title:'总量 / kWh',dataIndex:'credited_kwh',render:amount},
      {title:'可分配 / kWh',dataIndex:'remaining_kwh',render:amount},{title:'操作',render:(_,r)=>writer && <Button type="link" disabled={Number(r.remaining_kwh)<=0} onClick={()=>open({kind:'allocate',cert:r,key:crypto.randomUUID()})}>分配电量</Button>}]}/>
  const allocTable = <Table rowKey="id" dataSource={alloc.items} scroll={{ x: 720 }} pagination={{current:pages[1],pageSize:25,total:alloc.total,showSizeChanger:false,onChange:p=>setPages([pages[0],p])}}
    columns={[{title:'凭证编号',dataIndex:'serial'},{title:'用电台账',dataIndex:'record_no'},{title:'月份',dataIndex:'period'},
      {title:'覆盖量 / kWh',dataIndex:'applied_kwh',render:amount},{title:'状态',render:(_,r)=>r.cancelled_at?'已撤销 · '+r.cancellation_reason:'生效'},
      {title:'操作',render:(_,r)=>writer && !r.cancelled_at && <Button type="link" onClick={()=>open({kind:'cancel',allocation:r})}>撤销</Button>}]}/>
  return <>{error && !mode && <Alert type="error" message={error}/>}
    <Tabs tabBarExtraContent={writer && <Button type="primary" onClick={()=>open({kind:'create'})}>登记凭证</Button>}
      items={[{key:'credits',label:'凭证登记簿',children:certTable},{key:'use',label:'电量分配明细',children:allocTable}]}/>
    <Modal open={!!mode} title={mode?.kind==='allocate'?'分配绿电 · '+mode.cert.serial:mode?.kind==='cancel'?'撤销电量分配':'登记已注销的绿电凭证'}
      okText="保存" cancelText="取消" confirmLoading={busy} okButtonProps={{disabled:pending}} onOk={()=>form.submit()} onCancel={()=>{if (!busy && !pending) setMode(null)}}>
      {error && <Alert type="error" message={error}/>}
      <Form layout="vertical" form={form} onFinish={save}>
        {mode?.kind==='create' && <>
          <Form.Item name="site_id" label="用电工厂" rules={required}><Select options={sites.map(s=>({value:s.id,label:s.name}))}/></Form.Item>
          <Form.Item name="issuer" label="签发机构" rules={required}><Input maxLength={128}/></Form.Item>
          <Form.Item name="serial" label="证书唯一编号" rules={required}><Input maxLength={128}/></Form.Item>
          <Form.Item name="retirement_reference" label="注销回执编号" rules={required}><Input maxLength={200}/></Form.Item>
          <Space wrap><Form.Item name="period_from" label="起始月" rules={month}><Input type="month"/></Form.Item>
            <Form.Item name="period_to" label="截止月" rules={month}><Input type="month"/></Form.Item></Space>
          <Form.Item name="credited_kwh" label="注销电量（kWh）" rules={required}><InputNumber min={0.0001} precision={4}/></Form.Item>
          <Space wrap><input aria-label="选择注销原件" type="file" accept="image/*,application/pdf" onChange={e=>setFile(e.target.files?.[0])}/>
            <Button disabled={!file} loading={pending} onClick={()=>void attach()}>上传原件</Button></Space>
          <Form.Item name="proof_id" label="原件档案编号" extra="上传后自动填入，也可填写已上传的本企业绿电原件编号。" rules={required}><InputNumber min={1} precision={0}/></Form.Item>
        </>}
        {mode?.kind==='allocate' && <>
          <Typography.Paragraph>{mode.cert.site} · 凭证余额 {amount(mode.cert.remaining_kwh)} kWh</Typography.Paragraph>
          <Form.Item name="record_no" label="已确认的用电台账" rules={required}><Select showSearch filterOption={false} onSearch={setSearch}
            placeholder="按台账编号搜索" options={choices.map(r=>({value:r.record_no,label:r.period+' · '+r.record_no+' · '+amount(r.quantity)+' kWh'}))}/></Form.Item>
          <Form.Item name="applied_kwh" label="本次覆盖量（kWh）" rules={required}><InputNumber min={0.0001} precision={4}/></Form.Item>
        </>}
        {mode?.kind==='cancel' && <Form.Item name="reason" label="撤销原因" rules={[...required,{min:2}]}><Input.TextArea maxLength={200}/></Form.Item>}
      </Form>
    </Modal></>
}

export default function EnergyPage() {
  return <><SwissMasthead title="绿电凭证" description="按用电工厂登记注销原件，将电量分配至已确认的月度台账。核算报告单列实物覆盖量。"/>
    <EnterpriseScope>{id=><Register key={id} cid={id}/>}</EnterpriseScope></>
}
