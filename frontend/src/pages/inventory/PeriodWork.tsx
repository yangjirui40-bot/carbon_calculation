import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table } from 'antd'
import { request } from '../../api/client'
import { getOrganization, errorText, type Site } from '../organization/companyData'

type Kind = 'collection'|'quality'
type Action = 'submit'|'return'|'accept'
type Task = { id:number; kind:Kind; site:string; title:string; owner:string; severity:string; due_date:string; state:string; version:number; can_submit:boolean; can_verify:boolean; resolution:string|null }
type Work = { items:Task[]; owners:{id:number;name:string}[]; can_assign:boolean }
type Edit = {kind:Kind; action:'new'} | {kind:Kind; action:Action; item:Task}
const labels = { collection:'采集任务', quality:'质量问题',submit:'提交处理结果',return:'退回补充',accept:'复核通过',open:'待处理',submitted:'待复核',closed:'已完成' }
const required = [{required:true,message:'请填写此项'}]

export default function PeriodWork({cid,month,afterChange}:{cid:number;month:string;afterChange:()=>Promise<void>}) {
  const url='/api/v1/period-work/'+cid+'/'+month
  const [data,setData]=useState<Work>()
  const [sites,setSites]=useState<Site[]>([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [edit,setEdit]=useState<Edit>()
  const [form]=Form.useForm()
  const reload=useCallback(async()=>{
    const [work,org]=await Promise.all([request<Work>({url}),getOrganization(cid)])
    setData(work);setSites(org.sites)
  },[url,cid])
  useEffect(()=>{void reload().catch(e=>setError(errorText(e)))},[reload])
  function open(e:Edit){form.resetFields();setError('');setEdit(e)}
  async function save(values:Record<string,unknown>){
    if(!edit || busy)return
    setBusy(true);setError('')
    try{
      await request({url:url+'/'+edit.kind+(edit.action==='new'?'':'/'+edit.item.id),method:'POST',
        data:edit.action==='new'?values:{...values,action:edit.action,version:edit.item.version}})
      setEdit(undefined);await reload();await afterChange()
    }catch(e){setError(errorText(e))}finally{setBusy(false)}
  }
  const action=(item:Task,op:Action)=><Button size="small" onClick={()=>open({kind:item.kind,action:op,item})}>{labels[op]}</Button>
  return <Card size="small" title="采集任务与质量整改" extra={data?.can_assign && <Space wrap>
    <Button size="small" onClick={()=>open({kind:'collection',action:'new'})}>分派采集</Button>
    <Button size="small" onClick={()=>open({kind:'quality',action:'new'})}>登记问题</Button></Space>}>
    {!edit && error && <Alert type="error" message={error}/>}
    <Table rowKey={r=>r.kind+r.id} size="small" dataSource={data?.items} scroll={{x:640}} pagination={{pageSize:10,hideOnSinglePage:true}}
      columns={[{title:'工作事项',render:(_,r)=><div>{r.title}<br/><small>{labels[r.kind]} · {r.severity==='blocking'?'关账前必办':'建议跟进'}</small></div>},
        {title:'工厂',dataIndex:'site'},{title:'责任人',dataIndex:'owner'},{title:'截止日',dataIndex:'due_date'},
        {title:'处理情况',render:(_,r)=><span>{labels[r.state as 'open'|'closed'|'submitted']} {r.resolution}</span>},
        {title:'操作',render:(_,r)=><Space>{r.can_submit && action(r,'submit')}{r.can_verify && <>{action(r,'accept')}{action(r,'return')}</>}</Space>}]}/>
    <Modal open={!!edit} title={edit?.action==='new'?labels[edit.kind]:edit && labels[edit.action]} onCancel={()=>{if(!busy)setEdit(undefined)}} onOk={()=>form.submit()} okText="保存" cancelText="取消" confirmLoading={busy}>
      {error && <Alert message={error} type="error"/>}
      <Form form={form} layout="vertical" onFinish={save}>
        {edit?.action==='new'?<>
          <Form.Item name="title" label="工作事项" rules={required}><Input maxLength={160}/></Form.Item>
          <Form.Item name="site_id" label="工厂" rules={required}><Select options={sites.map(s=>({value:s.id,label:s.name}))}/></Form.Item>
          <Form.Item name="owner_id" label="采集或整改责任人" rules={required}><Select options={data?.owners.map(o=>({value:o.id,label:o.name}))}/></Form.Item>
          <Form.Item name="due_date" label="截止日" rules={required}><Input type="date"/></Form.Item>
          {edit.kind==='quality' && <Form.Item name="severity" label="关账影响" initialValue="blocking"><Select options={[{value:'blocking',label:'处理并复核后才可送审'},{value:'advisory',label:'建议跟进'}]}/></Form.Item>}
        </>:<>
          <Form.Item name="note" label="处理或复核说明" rules={[...required,{min:2}]}><Input.TextArea maxLength={500}/></Form.Item>
          {edit?.action==='submit' && <Form.Item name="evidence_id" label="关联凭证编号（选填）"><InputNumber min={1} precision={0}/></Form.Item>}
        </>}
      </Form>
    </Modal>
  </Card>
}
