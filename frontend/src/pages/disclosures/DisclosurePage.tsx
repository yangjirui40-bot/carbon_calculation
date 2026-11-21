import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Collapse, Empty, Form, Input, InputNumber, Row, Select, Space, Tag, Typography } from 'antd'
import { request } from '../../api/client'
import { SwissMasthead } from '../../components/swiss'
import EnterpriseScope from '../organization/EnterpriseScope'
import { errorText } from '../organization/companyData'

type Phase = 'requested' | 'submitted' | 'returned' | 'approved'
type Revision = {id:number; version_no:number; emissions_kgco2e:string; boundary:string; note:string; state:Phase; review_note?:string; intensity?:string}
type Task = {id:number; supplier_name:string; title:string; period:string; instructions:string; due_on:string; status:Phase; versions:Revision[]}
type TaskList = {can_manage:boolean; requests:Task[]}
const labels = { requested:'待填报', submitted:'待复核', returned:'退回补正', approved:'已纳入' }
const colors = { requested:'default', submitted:'blue', returned:'orange', approved:'green' }
const required = [{required:true}]

export default function DisclosurePage() {
  return <><SwissMasthead title="供应商披露任务" description="按期间向供应商下发报送要求，复核后纳入披露底稿。"/>
    <EnterpriseScope>{(id) => <TaskWorkspace key={id} companyId={id}/>}</EnterpriseScope></>
}

export function SupplierDisclosurePage() {
  return <><SwissMasthead title="定向报送" description="选择企业下发的任务，提交当期排放数据及核算依据。"/>
    <TaskWorkspace companyId={null}/></>
}

function TaskWorkspace({ companyId }: { companyId: number | null }) {
  const [tasks,setTasks]=useState<Task[]>([])
  const [suppliers,setSuppliers]=useState<Array<{id:number;name:string}>>([])
  const [permission,setPermission]=useState(false)
  const [status,setStatus]=useState<Phase>()
  const [error,setError]=useState('')
  const [pending,setPending]=useState(false)
  const [loaded,setLoaded]=useState(false)
  const path = '/api/v1/disclosures/' + (companyId ?? 'portal')
  const reload = useCallback(async () => {
    if (companyId === null) {
      setTasks(await request<Task[]>({url:path}))
    } else {
      const result = await request<TaskList>({url:path})
      setTasks(result.requests); setPermission(result.can_manage)
      if (result.can_manage) setSuppliers(await request({url:'/api/v1/supply-chain/suppliers',params:{company_id:companyId}}))
    }
    setLoaded(true)
  },[path,companyId])
  useEffect(() => { void reload().catch((e: unknown) => setError(errorText(e))) },[reload])

  const visible=tasks.filter((task) => !status || task.status===status)
  async function post(url: string, data: unknown) {
    setPending(true); setError('')
    try { await request({url,method:'POST',data}); await reload() }
    catch (e) {setError(errorText(e))}
    finally {setPending(false)}
  }
  return <Space orientation="vertical" size="middle" style={{width:'100%',paddingBlock:12}}>
    {error && <Alert type="error" message={error} showIcon/>}
    {!loaded && !error && <p>正在加载披露任务…</p>}
    {permission && <Card title="新建披露计划">
      <Form layout="vertical" onFinish={(values) => void post(path,values)}>
        <Row gutter={12}>
          <Col xs={24} lg={10}><Form.Item name="name" label="计划名称" rules={required}><Input maxLength={100}/></Form.Item></Col>
          <Col xs={12} lg={7}><Form.Item name="period" label="数据期间" rules={required}><Input type="month"/></Form.Item></Col>
          <Col xs={12} lg={7}><Form.Item name="due_on" label="截止日期" rules={required}><Input type="date"/></Form.Item></Col>
        </Row>
        <Form.Item name="supplier_ids" label="须报送的供应商" rules={required}>
          <Select mode="multiple" showSearch optionFilterProp="label" options={suppliers.map((x) => ({value:x.id,label:x.name}))}/>
        </Form.Item>
        <Form.Item name="instructions" label="范围、计量口径及证明要求" rules={required}><Input.TextArea rows={2} maxLength={1500}/></Form.Item>
        <Button type="primary" htmlType="submit" loading={pending} disabled={!suppliers.length}>下发报送任务</Button>
      </Form>
    </Card>}
    {loaded && <>
      <Space wrap>
        {(Object.keys(labels) as Phase[]).map((key) => <Tag key={key} color={colors[key]}>{labels[key]} {tasks.filter((task) => task.status===key).length}</Tag>)}
        <Select style={{minWidth:155}} allowClear placeholder="全部状态" onChange={setStatus}
          options={Object.entries(labels).map(([value,label]) => ({value,label}))}/>
      </Space>
      {visible.length === 0 ? <Empty description="没有符合条件的报送任务"/> : <Collapse items={visible.map((task) => ({
        key:task.id,
        label:<Space wrap><Typography.Text strong>{task.title}</Typography.Text><span>{task.supplier_name} · {task.period}</span>
          <Tag color={colors[task.status]}>{labels[task.status]}</Tag></Space>,
        children:<TaskDetail task={task} portal={companyId===null} canReview={permission} pending={pending}
          onSubmit={(data) => post(companyId === null ? path+'/'+task.id : path+'/'+task.id+'/review',data)}/>,
      }))}/>}
    </>}
  </Space>
}

function TaskDetail({ task, portal, canReview, pending, onSubmit }: {
  task:Task; portal:boolean; canReview:boolean; pending:boolean; onSubmit:(data:unknown)=>Promise<void>
}) {
  const latest = task.versions[0]
  return <>
    <Typography.Paragraph>截止 {task.due_on} · {task.instructions}</Typography.Paragraph>
    {task.versions.map((row) => <Card key={row.id} size="small" title={`版本 ${row.version_no}`} extra={<Tag>{labels[row.state]}</Tag>} style={{marginBottom:8}}>
      <p>总排放 {row.emissions_kgco2e} kgCO₂e{row.intensity != null ? ' · 强度 '+row.intensity+' kgCO₂e/CNY' : ''}</p>
      <p>边界 {row.boundary}</p><p>依据 {row.note}</p>
      {row.review_note && <p>复核意见 {row.review_note}</p>}
    </Card>)}
    {portal && (task.status==='requested' || task.status==='returned') &&
      <Form layout="vertical" key={latest?.version_no ?? 0} initialValues={latest} onFinish={(values) => void onSubmit(values)}>
        <Form.Item label="当期排放量（kgCO₂e）" name="emissions_kgco2e" rules={required}><InputNumber stringMode min="0" precision={6}/></Form.Item>
        <Form.Item label="排放强度（kgCO₂e/CNY）" name="intensity"><InputNumber stringMode min="0" precision={10}/></Form.Item>
        <Form.Item label="核算边界" name="boundary" rules={required}><Input maxLength={1500}/></Form.Item>
        <Form.Item label="数据来源和证据编号" name="note" rules={required}><Input.TextArea rows={2} maxLength={1500}/></Form.Item>
        <Button type="primary" htmlType="submit" loading={pending}>提交填报</Button>
      </Form>}
    {canReview && task.status==='submitted' && latest &&
      <Form layout="vertical" initialValues={{decision:'approve'}} onFinish={(values) => void onSubmit({...values,version_no:latest.version_no})}>
        <Form.Item label="复核结果" name="decision" rules={required}>
          <Select options={[{value:'approve',label:'通过并纳入披露'},{value:'return',label:'退回补正'}]}/>
        </Form.Item>
        <Form.Item label="复核说明" name="note" rules={required}><Input.TextArea maxLength={1500} rows={2}/></Form.Item>
        <Button type="primary" htmlType="submit" loading={pending}>保存复核决定</Button>
      </Form>}
  </>
}
