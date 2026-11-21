import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Select, Space, Table } from 'antd'
import { request } from '../../api/client'
import { uploadDocument } from '../../api/modules/documents'
import { errorText } from '../organization/companyData'

type Recipient={id:number;name:string;purpose:string;scope:string;expires:string;state:string}
type Sheet={id:number;metrics:{code:string;value:string;unit:string}[]}
type Data={company_id:number;can_manage:boolean;current:boolean;recipients:Recipient[];assessments:Sheet[]}
const required=[{required:true,message:'此项必填'}]
const states:Record<string,string>={prepared:'待导出',exported:'已导出',revoked:'已撤销',expired:'已过期'}
const metrics:Record<string,string>={period_emissions:'当期排放',reported_period_revenue:'企业申报收入',carbon_intensity_per_10000_cny:'每万元收入碳强度'}
export default function DeliveryPanel({number}:{number:string}){
  const path='/api/v1/evidence-delivery/'+encodeURIComponent(number)
  const [data,setData]=useState<Data>()
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [file,setFile]=useState<File>()
  const [revenueForm]=Form.useForm()
  const [recipientForm]=Form.useForm()
  const load=useCallback(async()=>setData(await request<Data>({url:path})),[path])
  useEffect(()=>{void load().catch(e=>setError(errorText(e)))},[load])
  async function action(work:()=>Promise<void>){
    if(busy)return
    setBusy(true);setError('')
    try{await work();await load()}catch(e){setError(errorText(e))}finally{setBusy(false)}
  }
  async function exported(id:number){
    const blob=await request<Blob>({url:path+'/'+id+'/package',method:'POST',responseType:'blob'})
    const href=URL.createObjectURL(blob)
    const a=document.createElement('a');a.href=href;a.download=number+'-delivery-'+id+'.zip';document.body.appendChild(a);a.click();a.remove()
    window.setTimeout(()=>URL.revokeObjectURL(href),1000)
  }
  if(!data?.current && !data?.recipients.length && !error)return null
  return <Card title="核证与融资材料" style={{marginBlock:16}}>
    {error && <Alert type="error" message={error}/>}
    {data?.current && data.can_manage && <>
      <Form form={revenueForm} layout="vertical" onFinish={v=>void action(async()=>{await request({url:path+'/finance',method:'POST',data:v});revenueForm.resetFields()})}>
        <Space wrap align="end"><Form.Item name="revenue_cny" label="同一报告期营业收入（元）" rules={required}><InputNumber min={0.01} precision={2}/></Form.Item>
        <Form.Item label="收入证明原件"><input aria-label="选择营业收入证明" type="file" accept="image/*,application/pdf" onChange={e=>setFile(e.target.files?.[0])}/></Form.Item>
        <Form.Item><Button disabled={!file || busy} onClick={()=>void action(async()=>{if(file){const doc=await uploadDocument(file,data.company_id,'revenue_evidence');revenueForm.setFieldValue('proof_id',doc.id)}})}>上传收入证明</Button></Form.Item>
        <Form.Item name="proof_id" label="已上传的证明编号" rules={required}><InputNumber min={1} precision={0}/></Form.Item>
        <Form.Item><Button htmlType="submit" loading={busy}>编制融资底稿</Button></Form.Item></Space>
      </Form>
      <Form form={recipientForm} layout="vertical" onFinish={v=>void action(async()=>{await request({url:path+'/recipients',method:'POST',data:v});recipientForm.resetFields()})}>
        <Space wrap align="end"><Form.Item label="材料接收机构" name="name" rules={required}><Input maxLength={160}/></Form.Item>
          <Form.Item label="用途" name="purpose" initialValue="verifier"><Select style={{minWidth:108}} options={[{label:'核证准备',value:'verifier'},{label:'融资材料',value:'finance'}]}/></Form.Item>
          <Form.Item label="交付范围" name="scope" rules={[...required,{min:4}]}><Input maxLength={500}/></Form.Item>
          <Form.Item label="可导出天数" name="days" initialValue={7}><InputNumber min={1} max={90}/></Form.Item>
          <Form.Item><Button htmlType="submit" loading={busy}>登记材料交付</Button></Form.Item></Space>
      </Form>
    </>}
    {data?.assessments.map(s=><p key={s.id}>底稿 #{s.id}　{s.metrics.map(m=>metrics[m.code]+' '+Number(m.value).toLocaleString('zh-CN',{maximumFractionDigits:4})+' '+m.unit).join('　')}</p>)}
    <Table size="small" rowKey="id" dataSource={data?.recipients} scroll={{x:580}} pagination={{pageSize:10,hideOnSinglePage:true}} columns={[
      {title:'接收机构',dataIndex:'name'},{title:'范围',dataIndex:'scope'},{title:'状态',dataIndex:'state',render:v=>states[v]??v},
      {title:'可导出至',dataIndex:'expires',render:v=>new Date(v).toLocaleDateString('zh-CN')},
      {title:'操作',render:(_,r)=>data?.can_manage && ['prepared','exported'].includes(r.state) && <Space><Button disabled={busy || !data.current} onClick={()=>void action(()=>exported(r.id))}>下载交付包</Button><Button disabled={busy} onClick={()=>void action(async()=>{await request({url:path+'/'+r.id+'/revoke',method:'POST'})})}>撤销后续导出</Button></Space>}
    ]}/>
    <small>交付包按接收机构列明用途和文件摘要，由企业自行交付。系统记录企业端导出，机构收件和鉴证结论须由对方确认。</small>
  </Card>
}
