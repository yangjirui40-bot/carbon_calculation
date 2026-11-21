import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Empty, Form, Input, InputNumber, Row, Select, Space, Tag } from 'antd'
import { request } from '../../api/client'
import { SwissMasthead } from '../../components/swiss'
import { scope3Categories } from '../../config/scope3'
import EnterpriseScope from '../organization/EnterpriseScope'
import { errorText } from '../organization/companyData'
import { categoryLabel } from '../records/constants'

type Factor = { factor_id:string;category:string;unit:string;value:number;version:string;publisher:string;citation:string;
  valid_from:string;valid_to:string|null;coverage:string }
const categories=['natural_gas','refrigerants','purchased_heat',...scope3Categories.map((_,i)=>'scope3_'+String(i+1).padStart(2,'0'))]
const units: Record<string,string[]>={natural_gas:['m3','kWh'],refrigerants:['kg'],purchased_heat:['kWh','GJ']}
const common=['kg','t','tkm','pkm','km','L','m3','kWh','GJ','piece','CNY']
const required=[{required:true}]

export default function CompanyFactorsPage() {
  return <><SwissMasthead title="企业因子" description="录入经企业核对并有出处的系数，按有效期间发布为不可改写的版本。"/>
    <EnterpriseScope>{(id) => <FactorWorkspace key={id} companyId={id}/>}</EnterpriseScope></>
}

function FactorWorkspace({ companyId }: { companyId:number }) {
  const [split,setSplit]=useState(false)
  const [weights,setWeights]=useState<Record<string,string>>({})
  const [entries,setEntries]=useState<Factor[]>([])
  const [canWrite,setCanWrite]=useState(false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [loaded,setLoaded]=useState(false)
  const [form]=Form.useForm()
  const category = Form.useWatch('category',form) as string | undefined
  const unit=Form.useWatch('activity_unit',form) as string | undefined
  const path='/api/v1/company-factors/'+companyId
  const refresh=useCallback(async () => {
    const data=await request<{entries:Factor[];can_publish:boolean}>({url:path})
    const basis=await request<{gwp:{weights:Record<string,string>}}>({url:path+'/bases'})
    setWeights(basis.gwp.weights)
    setEntries(data.entries);setCanWrite(data.can_publish);setLoaded(true)
  },[path])
  useEffect(() => { void refresh().catch((e:unknown) => setError(errorText(e))) },[refresh])
  return <Space orientation="vertical" size="middle" style={{width:'100%',paddingBlock:12}}>
    {error && <Alert type="error" message={error} showIcon/>}
    <Row gutter={[16,16]}>
      <Col xs={24} xl={canWrite ? 14 : 24}>
        <Card title="企业因子版本">
          {loaded && !entries.length && <Empty description="暂无企业因子"/>}
          {entries.map((row) => <div key={row.factor_id} style={{paddingBlock:10,borderBottom:'1px solid #e1e8ee'}}>
            <Space wrap><strong>{categoryLabel(row.category)}</strong><Tag>{row.version}</Tag><span>{row.value} {row.unit}</span></Space>
            <p>{row.factor_id} · {row.valid_from} 至 {row.valid_to ?? '未指定截止月'} · {row.coverage}</p>
            <p>{row.publisher} · {row.citation}</p>
          </div>)}
        </Card>
      </Col>
      {canWrite && <Col xs={24} xl={10}><Card title="发布企业因子">
        <Form layout="vertical" form={form} onFinish={async (values) => {
          setSaving(true);setError('')
          try {
            const body={...values,series:String(values.series).trim().toUpperCase(),valid_to:values.valid_to || null}
            if(split){delete body.value;body.components=Object.fromEntries(Object.entries(values.components??{}).filter(([,v])=>v!==null && v!==undefined))}
            else{delete body.components}
            await request({url:path,method:'POST',data:body});form.resetFields();await refresh()
          } catch (e) {setError(errorText(e))}
          finally {setSaving(false)}
        }}>
          <Form.Item name="series" label="因子序列编码" rules={required}><Input maxLength={24}/></Form.Item>
          <Form.Item name="category" label="排放活动" rules={required}>
            <Select options={categories.map((value) => ({value,label:categoryLabel(value)}))}
              onChange={() => form.setFieldValue('activity_unit',undefined)}/>
          </Form.Item>
          <Form.Item label="排放系数口径"><Select value={split?'gas':'combined'} onChange={v=>setSplit(v==='gas')} options={[{value:'combined',label:'直接录入来源公布的综合系数'},{value:'gas',label:'按各气体质量折算（AR6 GWP100）'}]}/></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="activity_unit" label="活动量单位" rules={required}>
              <Select disabled={!category} options={(units[category ?? ''] ?? common).map((value)=>({value,label:value}))}/>
            </Form.Item></Col>
            {!split && <Col span={12}><Form.Item preserve={false} name="value" label="每单位排放量 kgCO₂e" rules={required}>
              <InputNumber min={0} max={1e9} style={{width:'100%'}}/>
            </Form.Item></Col>}
          </Row>
          {split && <div><p>填写每单位活动产生的各气体千克数，甲烷按来源区分。数据采用 IPCC AR6 第一工作组表 7.15。</p>{Object.entries(weights).map(([gas,w])=><Form.Item key={gas} name={['components',gas]} label={gas+'（GWP100 '+Number(w)+'）'} preserve={false}><InputNumber min={0} precision={10}/></Form.Item>)}</div>}
          <Row gutter={12}>
            <Col span={12}><Form.Item name="valid_from" label="生效月" rules={required}><Input type="month"/></Form.Item></Col>
            <Col span={12}><Form.Item name="valid_to" label="截止月"><Input type="month"/></Form.Item></Col>
          </Row>
          <Form.Item name="publisher" label="数据来源或发布机构" rules={required}><Input maxLength={120}/></Form.Item>
          <Form.Item name="citation" label="引用、证明编号或链接" rules={required}><Input.TextArea rows={2} maxLength={600}/></Form.Item>
          <Form.Item name="methodology" label="适用方法与活动边界" rules={required}><Input.TextArea rows={2} maxLength={600}/></Form.Item>
          <Form.Item name="gas_coverage" label="气体覆盖" rules={required}><Input maxLength={80} placeholder="填写来源实际披露的覆盖"/></Form.Item>
          {unit==='CNY' && <Form.Item name="price_basis" label="金额口径与价格年度" rules={required} preserve={false}><Input maxLength={64}/></Form.Item>}
          <Button type="primary" htmlType="submit" loading={saving}>发布因子版本</Button>
        </Form>
      </Card></Col>}
    </Row>
  </Space>
}
