import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Empty, Form, Input, Row, Space, Table, Tag, Typography } from 'antd'
import { request } from '../../api/client'
import { SwissMasthead } from '../../components/swiss'
import EnterpriseScope from '../organization/EnterpriseScope'
import { errorText, getOrganization } from '../organization/companyData'
import { formatDateTime } from '../../utils/format'

type Connection = { id:number; name:string; code:string; feed_path:string;revoked_at:string|null }
type Batch = { id:number; request_key:string; created_at:string; rows:number; imported:number; skipped:number }
const required=[{required:true}]

export default function IntegrationsPage() {
  return <><SwissMasthead title="ERP 与数据接入" description="为业务系统开通独立接入凭据，核对每次推送结果。推送数据先进入待复核台账。"/>
    <EnterpriseScope>{(id) => <IntegrationWorkspace key={id} companyId={id}/>}</EnterpriseScope></>
}

function IntegrationWorkspace({ companyId }: { companyId:number }) {
  const [connections,setConnections]=useState<Connection[]>([])
  const [batches,setBatches]=useState<Batch[]>([])
  const [selected,setSelected]=useState<number>()
  const [detail,setDetail]=useState<string[]>([])
  const [token,setToken]=useState('')
  const [tokenId,setTokenId]=useState<number>()
  const [error,setError]=useState('')
  const [saving,setSaving]=useState(false)
  const [allowed,setAllowed]=useState<boolean>()
  const [form]=Form.useForm()
  const path='/api/v1/integrations/'+companyId
  const load=useCallback(async () => {
    const org=await getOrganization(companyId)
    setAllowed(org.can_manage)
    if (org.can_manage) setConnections(await request<Connection[]>({url:path}))
  },[companyId,path])
  useEffect(() => { void load().catch((e:unknown)=>setError(errorText(e))) },[load])
  async function post(endpoint:string, data:unknown, keepToken=true) {
    setSaving(true);setError('');setToken('')
    try {
      const reply=await request<Connection & {token?:string}>({url:endpoint,method:'POST',data})
      if (keepToken && reply.token) {setToken(reply.token); setTokenId(reply.id)}
      await load()
      return true
    } catch(e) {setError(errorText(e));return false}
    finally {setSaving(false)}
  }
  return <Space orientation="vertical" size="middle" style={{width:'100%',paddingBlock:12}}>
    {error && <Alert type="error" message={error} showIcon/>}
    {allowed===false && <Empty description="由本企业管理员管理接入连接"/>}
    {allowed && <>
      <Card title="创建数据接入">
        <Form form={form} layout="vertical" onFinish={async (values) => {
          if (await post(path,{...values,code:String(values.code).trim().toUpperCase()})) form.resetFields()
        }}>
          <Row gutter={12}>
            <Col xs={24} md={10}><Form.Item label="连接名称" name="name" rules={required}><Input maxLength={100}/></Form.Item></Col>
            <Col xs={24} md={10}><Form.Item label="接入编码" name="code" rules={required}><Input maxLength={16} placeholder="例如 ERP-PUR"/></Form.Item></Col>
          </Row>
          <Button type="primary" loading={saving} htmlType="submit">创建接入</Button>
        </Form>
      </Card>
      {connections.map((item) => <Card key={item.id} title={item.name} extra={<Tag>{item.revoked_at?'已停用':'已启用'}</Tag>}>
        <Typography.Paragraph><b>{item.code}</b> · <code style={{overflowWrap:'anywhere'}}>{new URL(item.feed_path,location.origin).href}</code></Typography.Paragraph>
        <Space wrap>
          <Button disabled={saving} onClick={() => void post(path+'/'+item.id+'/rotate',undefined)}>轮换凭证</Button>
          {!item.revoked_at && <Button disabled={saving} onClick={() => void post(path+'/'+item.id+'/revoke',undefined,false)}>停用</Button>}
          <Button onClick={async () => {
            setError('');setSelected(item.id);setBatches([])
            try {setDetail([]);setBatches(await request<Batch[]>({url:path+'/'+item.id+'/batches'}))}
            catch (e) {setError(errorText(e))}
          }}>查看接入批次</Button>
        </Space>
        {tokenId===item.id && token && <div style={{marginTop:12}}>
          <Typography.Paragraph>本次生成的凭据只显示一次。由 ERP 负责人保存在受控密钥管理器。</Typography.Paragraph>
          <Typography.Paragraph copyable={{text:token}} style={{overflowWrap:'anywhere'}}>{token}</Typography.Paragraph>
        </div>}
        {selected===item.id && <Table rowKey="id" size="small" style={{marginTop:12}} scroll={{x:560}} dataSource={batches}
          locale={{emptyText:'暂无接入批次'}} columns={[
            {title:'请求键',dataIndex:'request_key'},
            {title:'明细',render:(_,b:Batch)=><Button size="small" onClick={async()=>{
              try{
                const d=await request<{rows:{line:number;source_record_key:string}[];rejections:{request_key:string;reason:string}[]}>({url:path+'/'+item.id+'/batches/'+b.id})
                setDetail([...d.rejections.map(x=>'拒收 '+x.request_key+' · '+x.reason),...d.rows.map(x=>x.line+' · '+x.source_record_key)])
              }catch(e){setError(errorText(e))}
            }}>查看回执</Button>},
            {title:'接收时间',dataIndex:'created_at',render:formatDateTime},
            {title:'记录',dataIndex:'rows'},{title:'新入账',dataIndex:'imported'},{title:'已存在',dataIndex:'skipped'},
          ]}/>}
        {selected===item.id && detail.length>0 && <ul>{detail.map((v,i)=><li key={i}>{v}</li>)}</ul>}
      </Card>)}
      <Card title="ERP 调用约定">
        <p>使用 POST，传入 Authorization: Bearer 凭据、Idempotency-Key: 唯一批次编号及 JSON 数据。每批最多 1,000 条。</p>
        <Typography.Paragraph><code style={{overflowWrap:'anywhere'}}>{JSON.stringify({records:[{record_no:'ERP-LINE-001',period:'YYYY-MM',category:'electricity',scope:'scope2',quantity:120,unit:'kWh',factor_id:'MEE_ELEC_2022_NAT', site_code:'工厂编码'}]})}</code></Typography.Paragraph>
        <p>同一请求键重试会返回原结果。接入端只可提交数据，复核人员在「业务台账」确认后才参与核算。</p>
      </Card>
    </>}
  </Space>
}
