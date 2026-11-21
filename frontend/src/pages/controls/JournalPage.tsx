import { useEffect, useState } from 'react'
import { Alert, Button, Space, Table, Tabs } from 'antd'
import { request } from '../../api/client'
import { SwissMasthead } from '../../components/swiss'
import EnterpriseScope from '../organization/EnterpriseScope'
import { errorText } from '../organization/companyData'

type Entry = { id: number; at: string; [field: string]: string | number | null }
type Kind = 'quota' | 'progress' | 'usage' | 'refresh'
const kinds: Record<Kind,string> = {quota:'配额变动', progress:'减排执行', usage:'订阅用量',refresh:'驾驶舱刷新'}
const labels: Record<string,string> = {opening_balance:'启用时余额',transfer:'企业间转移',adjustment:'调整',usage:'使用',allocation:'分配',document:'凭证上传',calculation:'核算运行'}
const columns: Record<Kind,Record<string,string>> = {
  quota:{year:'年度',supplier:'供应商',kind:'事项',allocated_delta:'分配变动',used_delta:'用量变动',available_after:'结余',reference:'关联交易'},
  progress:{plan:'减排计划',from:'原进度',to:'新进度',note:'说明',actor:'操作人编号'},
  usage:{kind:'服务',quantity:'次数'},refresh:{activities:'已汇总活动',periods:'覆盖月份'}
}
function Entries({id,kind}:{id:number;kind:Kind}) {
  const [rows,setRows] = useState<Entry[]>([])
  const [cursor,setCursor] = useState<number[]>([])
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  const before = cursor.at(-1)
  useEffect(()=>{
    let active=true
    const endpoints={quota:'supply-chain/'+id+'/journal',progress:'supply-chain/'+id+'/progress-history',
      usage:'billing/company/'+id+'/usage-events',refresh:'energy/'+id+'/warehouse/history'}
    setLoading(true);setError('')
    void request<Entry[]>({url:'/api/v1/'+endpoints[kind],params:{before}}).then(r=>{if(active)setRows(r)})
      .catch(e=>{if(active){setError(errorText(e));setRows([])}}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[id,kind,before])
  return <>{error && <Alert message={error} type="error"/>}<Table rowKey="id" dataSource={rows} loading={loading} pagination={false} scroll={{x:720}}
    columns={[{title:'时间',dataIndex:'at',render:(s:string)=>new Date(s).toLocaleString('zh-CN')},
      ...Object.entries(columns[kind]).map(([field,title])=>({title,dataIndex:field,render:(v:string|number|null)=>field==='kind'?labels[String(v)]??v:v??'—'}))]}/>
    <Space><Button disabled={!cursor.length || loading} onClick={()=>setCursor(cursor.slice(0,-1))}>上一页</Button>
      <Button disabled={rows.length<100 || loading} onClick={()=>setCursor([...cursor,rows[rows.length-1].id])}>下一页</Button></Space></>
}
export default function JournalPage() {
  const [kind,setKind]=useState<Kind>('quota')
  return <><SwissMasthead title="运营流水" description="复核年度配额余额，追踪减排计划、核算用量及经营数据刷新记录。"/>
    <EnterpriseScope>{id=><><Tabs activeKey={kind} onChange={s=>setKind(s as Kind)} items={Object.entries(kinds).map(([key,label])=>({key,label}))}/>
      <Entries key={id+kind} id={id} kind={kind}/></>}</EnterpriseScope></>
}
