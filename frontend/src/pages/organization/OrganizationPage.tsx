import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Empty, Form, Input, InputNumber, Row, Select, Space, Tabs, Tag, Typography } from 'antd'
import { request } from '../../api/client'
import { readSession } from '../../api/modules/auth'
import { SwissMasthead } from '../../components/swiss'
import EnterpriseScope from './EnterpriseScope'
import { errorText, getBoundaries, getOrganization, orgUrl } from './companyData'
import type { Boundary, Organization, Unit } from './companyData'

type Member = { id: number; username: string; email: string; role: string; is_owner: boolean; is_active: boolean }
type Invite = { id: number; email: string; role: string; expires_at: string; revoked_at: string | null; accepted_by: number | null }
type Supplier = { id: number; name: string }
type Editing = Record<string, unknown>
const roleLabel: Record<string, string> = { enterprise: '企业员工', auditor: '审计员', supplier: '供应商' }
const unitLabel: Record<Unit['kind'], string> = { workshop: '车间', line: '产线', department: '部门' }
const methods = [{ value: 'operational_control', label: '运营控制法' }, { value: 'financial_control', label: '财务控制法' }, { value: 'equity_share', label: '股权比例法' }]
const required = [{ required: true }]

export default function OrganizationPage() {
  return <><SwissMasthead title="企业与组织" description="建立法人、工厂和产线档案，维护盘查边界及团队访问权限。"/>
    <EnterpriseScope>{(id) => <OrganizationWorkspace key={id} companyId={id} />}</EnterpriseScope></>
}

function OrganizationWorkspace({ companyId }: { companyId: number }) {
  const [org, setOrg] = useState<Organization>()
  const [boundaries, setBoundaries] = useState<Boundary[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [link, setLink] = useState('')
  const [failure, setFailure] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedSite, setSelectedSite] = useState<number>()
  const [selectedKind, setSelectedKind] = useState<Unit['kind']>('workshop')
  const [consolidation, setConsolidation] = useState('operational_control')
  const [coveredSites, setCoveredSites] = useState<number[]>([])
  const [shares, setShares] = useState<Record<number, number>>({})
  const [inviteRole, setInviteRole] = useState('enterprise')
  const platformAdmin = readSession()?.user.role === 'admin'
  const api = orgUrl(companyId)

  const reload = useCallback(async () => {
    const [organization, versions] = await Promise.all([getOrganization(companyId), getBoundaries(companyId)])
    setOrg(organization); setBoundaries(versions)
    if (organization.can_manage) {
      const [people, inviteRows, partners] = await Promise.all([
        request<Member[]>({ url: api + '/members' }),
        request<Invite[]>({ url: api + '/invites' }),
        request<Supplier[]>({ url: '/api/v1/supply-chain/suppliers', params: { company_id: companyId } }),
      ])
      setMembers(people); setInvites(inviteRows); setSuppliers(partners)
    }
  }, [companyId, api])
  useEffect(() => { void reload().catch((e: unknown) => setFailure(errorText(e))) }, [reload])

  async function change(path: string, data?: Editing, method = 'POST') {
    setSaving(true); setFailure('')
    try {
      await request({ url: api + path, method, data })
      await reload()
      return true
    } catch (err) {
      setFailure(errorText(err))
      return false
    } finally { setSaving(false) }
  }
  if (!org) return failure ? <Alert type="error" message={failure} /> : <p>正在加载企业组织…</p>

  const orgTab = <Row gutter={[16,16]}>
    <Col xs={24} xl={8}><Card title="法人">
      {org.legal_entities.map((row) => <p key={row.id}><Tag>{row.code}</Tag> {row.legal_name} · {row.jurisdiction}</p>)}
      {org.legal_entities.length === 0 && <p>暂无已登记法人。</p>}
      {org.can_manage && <Form layout="vertical" onFinish={(values) => void change('/legal-entities', values)}>
        <Form.Item label="法人编码" name="code" rules={required}><Input placeholder="示例 HN-CO" maxLength={32}/></Form.Item>
        <Form.Item label="法人全称" name="legal_name" rules={required}><Input maxLength={160}/></Form.Item>
        <Form.Item label="登记地" name="jurisdiction" rules={required}><Input placeholder="示例 湖南长沙"/></Form.Item>
        <Form.Item label="统一社会信用代码" name="registration_no"><Input maxLength={64}/></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>添加法人</Button>
      </Form>}
    </Card></Col>
    <Col xs={24} xl={8}><Card title="工厂">
      {org.sites.map((row) => <p key={row.id}><Tag>{row.code}</Tag> {row.name} · {row.region}</p>)}
      {org.sites.length === 0 && <p>暂无厂区。</p>}
      {org.can_manage && <Form layout="vertical" onFinish={(values) => void change('/sites', values)}>
        <Form.Item label="所属法人" name="legal_entity_id" rules={required}><Select options={org.legal_entities.map((x) => ({ value:x.id,label:x.legal_name }))}/></Form.Item>
        <Form.Item label="工厂编码" name="code" rules={required}><Input maxLength={32}/></Form.Item>
        <Form.Item label="工厂名称" name="name" rules={required}><Input maxLength={100}/></Form.Item>
        <Form.Item label="地区" name="region" rules={required}><Input maxLength={80}/></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} disabled={!org.legal_entities.length}>添加工厂</Button>
      </Form>}
    </Card></Col>
    <Col xs={24} xl={8}><Card title="车间、产线与部门">
      {org.org_units.map((row) => <p key={row.id}><Tag>{row.code}</Tag> {row.name} · {unitLabel[row.kind]} · {org.sites.find((x) => x.id === row.site_id)?.name}</p>)}
      {org.org_units.length === 0 && <p>暂无组织单元。</p>}
      {org.can_manage && <Form layout="vertical" initialValues={{kind:'workshop'}} onFinish={(values) => void change('/org-units', values)}>
        <Form.Item label="工厂" name="site_id" rules={required}><Select onChange={setSelectedSite} options={org.sites.map((x) => ({value:x.id,label:x.name}))}/></Form.Item>
        <Form.Item label="类型" name="kind" rules={required}><Select onChange={setSelectedKind} options={Object.entries(unitLabel).map(([value,label]) => ({value,label}))}/></Form.Item>
        {selectedKind === 'line' && <Form.Item label="所属车间" name="parent_id" rules={required} preserve={false}>
          <Select options={org.org_units.filter((x) => x.site_id === selectedSite && x.kind === 'workshop').map((x) => ({value:x.id,label:x.name}))}/></Form.Item>}
        <Form.Item label="组织编码" name="code" rules={required}><Input maxLength={32}/></Form.Item>
        <Form.Item label="组织名称" name="name" rules={required}><Input maxLength={80}/></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} disabled={!org.sites.length}>添加组织单元</Button>
      </Form>}
    </Card></Col>
  </Row>

  const boundaryTab = <Row gutter={[16,16]}>
    <Col xs={24} lg={14}><Space orientation="vertical" style={{width:'100%'}}>
      {boundaries.length === 0 && <Empty description="暂无已发布的盘查边界"/>}
      {boundaries.map((b) => <Card key={b.id} title={b.title} extra={<Tag>{b.code} v{b.version}</Tag>}>
        <Typography.Paragraph>{methods.find((m) => m.value === b.consolidation)?.label} · {b.note}</Typography.Paragraph>
        {b.sites.map((site) => <p key={site.id}>{site.legal_entity} · {site.name} · {(site.share_ratio*100).toFixed(2)}%</p>)}
      </Card>)}
    </Space></Col>
    {org.can_manage && <Col xs={24} lg={10}><Card title="发布盘查边界">
      <Typography.Paragraph>同一编码可发布新版本。已建立的月份继续使用原版本。</Typography.Paragraph>
      <Form layout="vertical" initialValues={{consolidation:'operational_control'}} onFinish={(values) => {
        void change('/boundaries', {...values, sites:coveredSites.map((id) => ({site_id:id,share_ratio:consolidation === 'equity_share' ? (shares[id] ?? 100)/100 : 1}))})
      }}>
        <Form.Item label="边界编码" name="code" rules={required}><Input maxLength={32}/></Form.Item>
        <Form.Item label="边界名称" name="title" rules={required}><Input maxLength={100}/></Form.Item>
        <Form.Item label="合并方法" name="consolidation" rules={required}><Select options={methods} onChange={setConsolidation}/></Form.Item>
        <Form.Item label="纳入工厂"><Select mode="multiple" value={coveredSites} onChange={setCoveredSites} options={org.sites.map((x) => ({value:x.id,label:x.name}))}/></Form.Item>
        {consolidation === 'equity_share' && coveredSites.map((id) => <Form.Item key={id} label={`${org.sites.find((x) => x.id === id)?.name ?? id} 的纳入比例 %`}>
          <InputNumber min={0.01} max={100} precision={4} value={shares[id] ?? 100} onChange={(value) => setShares({...shares,[id]:value ?? 100})}/>
        </Form.Item>)}
        <Form.Item label="组织与活动边界说明" name="note" rules={required}><Input.TextArea maxLength={1500} rows={3}/></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} disabled={coveredSites.length === 0}>发布版本</Button>
      </Form>
    </Card></Col>}
  </Row>

  const memberTab = <Row gutter={[16,16]}>
    <Col xs={24} lg={14}><Card title="成员与权限">
      {members.map((member) => <Space key={member.id} orientation="vertical" style={{display:'flex',borderBottom:'1px solid var(--line, #e5ebf0)',padding:'10px 0'}}>
        <Space wrap><Typography.Text strong>{member.username}</Typography.Text><Tag>{member.is_owner ? '企业管理员' : roleLabel[member.role] ?? member.role}</Tag>
          <Tag>{member.is_active ? '正常' : '停用'}</Tag></Space>
        <Space wrap>
          {platformAdmin && !member.is_owner && member.role === 'enterprise' && member.is_active &&
            <Button size="small" onClick={() => void change(`/members/${member.id}/owner`,undefined,'PUT')}>设为企业管理员</Button>}
          {!member.is_owner && member.role !== 'admin' && <Button size="small" disabled={saving}
            onClick={() => void change(`/members/${member.id}/status`,{enabled:!member.is_active},'PUT')}>{member.is_active ? '停用' : '恢复'}</Button>}
        </Space>
      </Space>)}
      <Typography.Title level={5}>邀请记录</Typography.Title>
      {invites.map((row) => <Space wrap key={row.id} style={{display:'flex',marginTop:8}}>
        <Typography.Text>{row.email}</Typography.Text><Tag>{roleLabel[row.role]}</Tag>
        <span>{row.accepted_by ? '已使用' : row.revoked_at ? '已撤销' : Date.parse(row.expires_at) <= Date.now() ? '已过期' : '等待接受'}</span>
        {!row.accepted_by && !row.revoked_at && Date.parse(row.expires_at) > Date.now() &&
          <Button size="small" disabled={saving} onClick={() => void change(`/invites/${row.id}/revoke`)}>撤销邀请</Button>}
      </Space>)}
    </Card></Col>
    <Col xs={24} lg={10}><Card title="创建限时邀请">
      <Typography.Paragraph>将一次性链接交给指定人员。审计员可以查阅所在企业的报告，供应商只进入其授权的报送门户。</Typography.Paragraph>
      <Form layout="vertical" initialValues={{role:'enterprise',valid_days:3}} onFinish={async (values) => {
        setSaving(true); setFailure(''); setLink('')
        try {
          const result = await request<{token:string}>({ method:'POST',url:api+'/invites',data:values })
          setLink(new URL('/join#'+result.token,location.origin).href)
          await reload()
        } catch (err) { setFailure(errorText(err)) }
        finally { setSaving(false) }
      }}>
        <Form.Item label="邮箱" name="email" rules={[{ required:true,type:'email' }]}><Input autoComplete="off"/></Form.Item>
        <Form.Item label="访问角色" name="role" rules={required}><Select onChange={setInviteRole} options={Object.entries(roleLabel).map(([value,label]) => ({value,label}))}/></Form.Item>
        {inviteRole === 'supplier' && <Form.Item label="供应商档案" name="supplier_id" rules={required} preserve={false}><Select options={suppliers.map((s) => ({value:s.id,label:s.name}))}/></Form.Item>}
        <Form.Item label="有效天数" name="valid_days" rules={required}><InputNumber min={1} max={14} precision={0}/></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>生成邀请链接</Button>
      </Form>
      {link && <div style={{marginTop:12}}><Input readOnly aria-label="一次性邀请链接" value={link}/>
        <Typography.Paragraph copyable={{text:link}}>复制链接</Typography.Paragraph></div>}
    </Card></Col>
  </Row>
  return <Space orientation="vertical" size="middle" style={{width:'100%'}}>
    {failure && <Alert type="error" showIcon message={failure} />}
    <Tabs items={[
      {key:'structure',label:'组织档案',children:orgTab},
      {key:'boundaries',label:'盘查边界',children:boundaryTab},
      ...(org.can_manage ? [{key:'members',label:'成员与邀请',children:memberTab}] : []),
    ]}/>
  </Space>
}
