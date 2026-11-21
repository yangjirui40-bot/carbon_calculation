import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Select, Space, Table, Tabs } from 'antd'
import { request } from '../../api/client'
import { readSession } from '../../api/modules/auth'
import { SwissMasthead } from '../../components/swiss'
import EnterpriseScope from '../organization/EnterpriseScope'
import { errorText, getOrganization, type Site } from '../organization/companyData'

type Message={id:number;message:string;delivered:string;read:string|null}
type Meter={id:number;code:string;site:string;unit:string;installed_on:string}
type Limit={id:number;site:string;period:string;amount:string}
type Workspace={meters:Meter[];budgets:Limit[];can_manage:boolean}
type Factor={factor_id:string;description:string;unit:string;is_demo:boolean}
const required=[{required:true,message:'请填写此项'}]
function Factory({cid}:{cid:number}){
  const url='/api/v1/factory/'+cid
  const [work,setWork]=useState<Workspace>()
  const [messages,setMessages]=useState<Message[]>([])
  const inbox='/api/v1/period-work/'+cid+'/inbox/messages'
  const [sites,setSites]=useState<Site[]>([])
  const [factors,setFactors]=useState<Factor[]>([])
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const load=useCallback(async()=>{
    const [w,o,f,m]=await Promise.all([request<Workspace>({url}),getOrganization(cid),request<Factor[]>({url:'/api/v1/factors',params:{category:'electricity',company_id:cid}}),request<Message[]>({url:inbox})])
    setMessages(m)
    setWork(w);setSites(o.sites);setFactors(f.filter(v=>v.unit.endsWith('/kWh') && !v.is_demo && !v.factor_id.endsWith('_FP')))
  },[cid,url,inbox])
  useEffect(()=>{void load().catch(e=>setError(errorText(e)))},[load])
  async function save(path:string,data:Record<string,unknown>){
    setError('');setNotice('');setBusy(true)
    try{const v=await request<{record_no?:string}>({url:url+path,method:'POST',data});setNotice(v.record_no?'已登记用电台账 '+v.record_no:'已保存');await load()}
    catch(e){setError(errorText(e))}finally{setBusy(false)}
  }
  const site=<Select style={{minWidth:125}} options={sites.map(s=>({value:s.id,label:s.name}))}/>
  const meterForm=work?.can_manage && <Form layout="vertical" onFinish={v=>void save('/meters',v)}><Space wrap align="end">
    <Form.Item name="site_id" label="所属工厂" rules={required}>{site}</Form.Item>
    <Form.Item name="code" label="表计编码" rules={required}><Input maxLength={32}/></Form.Item>
    <Form.Item name="unit" label="计量单位" initialValue="kWh"><Select options={['Wh','kWh','MWh'].map(v=>({value:v,label:v}))}/></Form.Item>
    <Form.Item name="installed_on" label="投运日期" rules={required}><Input type="date"/></Form.Item>
    <Form.Item><Button htmlType="submit" loading={busy}>登记计量点</Button></Form.Item></Space></Form>
  const writer=readSession()?.user.role!=='auditor'
  const reading=writer && <Card size="small" title="录入本月实耗电量"><Form layout="vertical" onFinish={({meter_id,...v})=>void save('/meters/'+meter_id+'/readings',v)}><Space wrap align="end">
    <Form.Item label="表计与单位" name="meter_id" rules={required}><Select style={{minWidth:155}} options={work?.meters.map(m=>({value:m.id,label:m.site+' · '+m.code+' / '+m.unit}))}/></Form.Item>
    <Form.Item label="用电月份" name="month" rules={required}><Input type="month"/></Form.Item>
    <Form.Item label="本月实耗（表计单位）" name="consumed" rules={required}><InputNumber min={0.0001} precision={4}/></Form.Item>
    <Form.Item label="位置法用电因子" name="factor_id" rules={required}><Select style={{minWidth:200}} options={factors.map(f=>({value:f.factor_id,label:f.description||f.factor_id}))}/></Form.Item>
    <Form.Item><Button htmlType="submit" type="primary" loading={busy}>生成待复核台账</Button></Form.Item></Space></Form></Card>
  const budget=work?.can_manage && <Form layout="vertical" onFinish={v=>void save('/allocations',v)}><Space wrap align="end">
    <Form.Item name="site_id" label="所属工厂" rules={required}>{site}</Form.Item>
    <Form.Item name="month" label="盘查月份" rules={required}><Input type="month"/></Form.Item>
    <Form.Item name="amount" label="工厂当月预算（kg CO₂e）" rules={required}><InputNumber min={0.0001} precision={4}/></Form.Item>
    <Form.Item><Button htmlType="submit" loading={busy}>保存预算分解</Button></Form.Item></Space></Form>
  return <>{error && <Alert type="error" message={error}/>} {notice && <Alert type="success" message={notice}/>}
    <Tabs items={[{key:'meter',label:'表计与用电',children:<>{meterForm}<Table rowKey="id" size="small" dataSource={work?.meters} columns={[{title:'工厂',dataIndex:'site'},{title:'表号',dataIndex:'code'},{title:'单位',dataIndex:'unit'},{title:'投运',dataIndex:'installed_on'}]}/>{reading}</>},
      {key:'inbox',label:'我的工作消息',children:<Table rowKey="id" size="small" dataSource={messages} columns={[{title:'消息',dataIndex:'message'},{title:'收到时间',dataIndex:'delivered',render:v=>new Date(v).toLocaleString('zh-CN')},{title:'状态',render:(_,m)=>m.read?'已读':<Button size="small" onClick={()=>void request({url:inbox+'/'+m.id+'/read',method:'POST'}).then(load).catch(e=>setError(errorText(e)))}>标记已读</Button>}]}/>},
      {key:'budget',label:'分厂月度预算',children:<>{budget}<Table rowKey="id" size="small" dataSource={work?.budgets} columns={[{title:'月份',dataIndex:'period'},{title:'工厂',dataIndex:'site'},{title:'碳预算（kg CO₂e）',dataIndex:'amount'}]}/></>}]}/></>
}
export default function FactoryPage(){
  return <><SwissMasthead title="工厂计量与预算" description="按工厂登记电表、核对月度实耗，并将企业年度排放预算分解到已建账的月份。"/><EnterpriseScope>{id=><Factory key={id} cid={id}/>}</EnterpriseScope></>
}
