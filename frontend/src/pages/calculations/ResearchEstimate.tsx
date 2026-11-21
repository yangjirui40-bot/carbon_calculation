import { useEffect, useState } from 'react'
import { Alert, Button, Card, Collapse, Form, Input, InputNumber, Select, Typography } from 'antd'
import { request } from '../../api/client'
import { errorText } from '../organization/companyData'
type Source={id:number;digest:string;source_doi:string;price_year:number;sectors:{name:string}[];mapping:Record<string,string>}
type Result={total_kgco2e:number;mapping:Record<string,string>}
const labels:Record<string,string>={electronic_components:'电子元器件',pcb_materials:'PCB 材料',packaging_materials:'包装材料'}
import EnterpriseScope from '../organization/EnterpriseScope'
type Price={id:number;source_year:number;target_year:number;region:string;multiplier:string;publisher:string;citation:string}
export default function ResearchEstimate(){
  return <EnterpriseScope>{cid=><Estimate key={cid} cid={cid}/>}</EnterpriseScope>
}
function Estimate({cid}:{cid:number}){
  const [prices,setPrices]=useState<Price[]>([])
  const [canPublish,setCanPublish]=useState(false)
  const [priceForm]=Form.useForm()
  const path='/api/v1/company-factors/'+cid
  useEffect(()=>{void Promise.all([request<{prices:Price[]}>({url:path+'/bases'}),request<{can_publish:boolean}>({url:path})]).then(([b,p])=>{setPrices(b.prices);setCanPublish(p.can_publish)}).catch(e=>setError(errorText(e)))},[path])
  const [sources,setSources]=useState<Source[]>([])
  const [selected,setSelected]=useState<number>()
  const [result,setResult]=useState<Result>()
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  useEffect(()=>{void request<Source[]>({url:'/api/v1/calculations/eiolca/datasets/catalog'}).then(data=>{setSources(data);setSelected(data[0]?.id)}).catch(e=>setError(errorText(e)))},[])
  const source=sources.find(r=>r.id===selected)
  async function compute(p:{category:string;amount:number;index?:number}){
    setBusy(true);setError('');setResult(undefined)
    try{const response=await request<{data:Result}>({url:'/api/v1/calculations/eiolca/table',method:'POST',data:{dataset_id:selected,company_id:cid,price_index_id:p.index,purchase_year:prices.find(v=>v.id===p.index)?.source_year??source?.price_year,category_amounts:{[p.category]:p.amount}}});setResult(response.data)}
    catch(e){setError(errorText(e))}finally{setBusy(false)}
  }
  return <Card title="42 部门采购排放估算">
    {error && <Alert type="error" message={error}/>}
    {source?<><Typography.Paragraph>{source.sectors.length} 个部门 · CO₂ · {source.price_year} 年生产者价格。按部门估算，采购金额需先换算至同年价格。</Typography.Paragraph>
      <Form layout="inline" onFinish={compute} onValuesChange={()=>setResult(undefined)}>
        <Form.Item label="数据版本"><Select value={selected} onChange={v=>{setSelected(v);setResult(undefined)}} options={sources.map(s=>({value:s.id,label:s.price_year+' · '+s.digest.slice(0,8)}))}/></Form.Item>
        <Form.Item name="category" label="采购类别" rules={[{required:true}]}><Select style={{minWidth:145}} options={Object.keys(labels).filter(k=>source.mapping[k]).map(k=>({value:k,label:labels[k]}))}/></Form.Item>
        <Form.Item name="amount" label="采购额（元）" rules={[{required:true}]}><InputNumber min={0} precision={2}/></Form.Item>
        <Form.Item name="index" label="采购额价格口径"><Select allowClear placeholder={source.price_year+' 年原价'} style={{minWidth:160}} options={prices.filter(v=>v.target_year===source.price_year).map(v=>({value:v.id,label:v.source_year+' → '+v.target_year+' · '+v.region+' × '+Number(v.multiplier)+' · '+v.publisher}))}/></Form.Item>
        <Button type="primary" htmlType="submit" loading={busy}>估算采购排放</Button>
      </Form>
      {canPublish && <Collapse ghost items={[{key:'prices',label:'登记企业采用的价格换算依据',children:<Form layout="vertical" form={priceForm} onFinish={async v=>{setError('');try{await request({url:path+'/prices',method:'POST',data:{...v,target_year:source.price_year}});setPrices((await request<{prices:Price[]}>({url:path+'/bases'})).prices);priceForm.resetFields()}catch(e){setError(errorText(e))}}}>
        <Form.Item name="source_year" label="原始采购价格年度" rules={[{required:true}]}><InputNumber min={1900} max={2200} precision={0}/></Form.Item>
        <Form.Item name="region_code" label="适用地区" rules={[{required:true}]}><Input maxLength={48}/></Form.Item>
        <Form.Item name="multiplier" label={'原金额乘以此系数，换算至 '+source.price_year+' 年人民币生产者价格'} rules={[{required:true}]}><InputNumber min={0.0000000001} precision={10}/></Form.Item>
        <Form.Item name="publisher" label="价格指数发布方" rules={[{required:true}]}><Input maxLength={120}/></Form.Item>
        <Form.Item name="citation" label="数据表、版本及行号" rules={[{required:true}]}><Input maxLength={600}/></Form.Item>
        <Button htmlType="submit">保存价格依据</Button></Form>}]}/>}
      {result && <p aria-live="polite">采购排放 {result.total_kgco2e.toLocaleString('zh-CN',{maximumFractionDigits:4})} kg CO₂ · {Object.values(result.mapping).join('、')}</p>}
      <Typography.Paragraph type="secondary">排放清单 DOI {source.source_doi} · 数据摘要 {source.digest.slice(0,16)}</Typography.Paragraph></>:<p>暂无可用的数据版本。</p>}
  </Card>
}
