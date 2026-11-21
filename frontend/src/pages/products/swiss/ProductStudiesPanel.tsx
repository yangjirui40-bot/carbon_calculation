import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Empty, Form, Input, InputNumber, Row, Select, Space, Tag } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { request } from '../../../api/client'
import { productsApi } from '../../../api'
import { errorText } from '../../organization/companyData'

type Study = { id:number;version_no:number;name:string;start_on:string;end_on:string;boundary_note:string;items_count:number;digest:string }
type Run = { success:boolean;run_id:string;warnings?:string[];data?:{total_upstream_emissions_kgco2e:number;total_study_emissions_kgco2e:number;production_emissions_kgco2e:number} }
const required=[{required:true}]
export default function ProductStudiesPanel({ productId, canWrite }: { productId:string;canWrite:boolean }) {
  const [studies,setStudies]=useState<Study[]>([])
  const [running,setRunning]=useState(false)
  const [error,setError]=useState('')
  const [run,setRun]=useState<Run>()
  const [language,setLanguage]=useState('zh')
  const [form]=Form.useForm()
  const navigate=useNavigate()
  const path='/api/v1/product-studies/'+encodeURIComponent(productId)
  const reload=useCallback(async () => {setStudies(await request<Study[]>({url:path}))},[path])
  useEffect(() => {void reload().catch((e:unknown) => setError(errorText(e)))},[reload])
  async function act(task:()=>Promise<void>) {
    setRunning(true);setError('')
    try { await task() } catch (e) {setError(errorText(e))}
    finally {setRunning(false)}
  }
  return <Card title="产品碳足迹研究版本" style={{marginBlock:20}}>
    <p>先在上方复核 BOM 因子。保存版本会固定物料数据和因子值；需要时可引用已关账生产活动。</p>
    {error && <Alert type="error" message={error} showIcon/>}
    {canWrite && <Form layout="vertical" form={form} onFinish={(values) => void act(async () => {
      await request({url:path,method:'POST',data:values});form.resetFields();await reload()
    })}>
      <Row gutter={12}>
        <Col xs={24} md={10}><Form.Item label="研究名称" name="name" rules={required}><Input maxLength={100}/></Form.Item></Col>
        <Col xs={12} md={7}><Form.Item label="参考期开始" name="start_on" rules={required}><Input type="date"/></Form.Item></Col>
        <Col xs={12} md={7}><Form.Item label="参考期结束" name="end_on" rules={required}><Input type="date"/></Form.Item></Col>
      </Row>
      <Form.Item label="边界与分摊依据" name="boundary_note" rules={required}><Input.TextArea maxLength={1500} rows={2}/></Form.Item>
      <Form.List name="allocations">{(fields,{add,remove}) => <Space orientation="vertical" style={{width:'100%'}}>
        {fields.map((field) => <Row key={field.key} gutter={8} align="bottom">
          <Col xs={24} md={7}><Form.Item name={[field.name,'run_id']} label="已关账核算运行编号" rules={required}><Input/></Form.Item></Col>
          <Col xs={24} md={6}><Form.Item name={[field.name,'record_no']} label="台账记录号" rules={required}><Input/></Form.Item></Col>
          <Col xs={12} md={4}><Form.Item name={[field.name,'share_ratio']} label="份额 0–1" rules={required}><InputNumber stringMode min="0.00000001" max="1"/></Form.Item></Col>
          <Col xs={24} md={5}><Form.Item name={[field.name,'reason']} label="活动分摊依据" rules={required}><Input/></Form.Item></Col>
          <Col xs={12} md={2}><Button type="link" onClick={() => remove(field.name)}>移除</Button></Col>
        </Row>)}
        <Button onClick={() => add()}>添加生产分摊</Button>
      </Space>}</Form.List>
      <Button type="primary" htmlType="submit" loading={running} style={{marginTop:16}}>保存研究版本</Button>
    </Form>}
    {studies.length ? studies.map((item) => <div key={item.id} style={{padding:'12px 0',borderBottom:'1px solid #e3ebf1'}}>
      <Space wrap><strong>{item.name}</strong><Tag>第 {item.version_no} 版</Tag>
        <span>{item.start_on} 至 {item.end_on} · {item.items_count} 条物料</span></Space>
      <p>{item.boundary_note}</p>
      {canWrite && <Button size="small" disabled={running} onClick={() => void act(async () => {
        const output=await request<Run>({url:path+'/'+item.id+'/calculate',method:'POST'})
        if (!output.success) throw new Error(output.warnings?.join('。') || '核算未成功')
        setRun(output)
      })}>核算这一版</Button>}
    </div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已保存的研究版本"/>}
    {run?.data && <div style={{marginTop:16}}>
      <p>版本结果 · 上游采购 {run.data.total_upstream_emissions_kgco2e} kgCO₂e · 生产分摊 {run.data.production_emissions_kgco2e} kgCO₂e · 纳入合计 {run.data.total_study_emissions_kgco2e} kgCO₂e</p>
      <Space wrap><Link to={'/audit/runs/'+run.run_id}>查看计算凭证</Link><Select aria-label="研究报告语言" value={language} onChange={setLanguage}
        options={[{value:'zh',label:'中文'},{value:'en',label:'English'},{value:'de',label:'Deutsch'},{value:'fr',label:'Français'}]}/>
        <Button loading={running} onClick={() => void act(async () => {
          const report=await productsApi.generateProductReport(productId,language,run.run_id)
          if (!('report_no' in report) || !report.report_no) throw new Error('未生成报告')
          navigate('/reports/'+report.report_no)
        })}>生成版本报告</Button></Space>
    </div>}
  </Card>
}
