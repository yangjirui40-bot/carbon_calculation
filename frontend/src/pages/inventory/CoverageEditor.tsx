import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Input, Row, Select, Space, Typography } from 'antd'
import { request } from '../../api/client'
import { scope3Categories } from '../../config/scope3'
import { errorText } from '../organization/companyData'

type Assessment = { category: number; status: 'included' | 'unavailable' | 'not_applicable' | 'excluded'; rationale: string }
const statusLabels = { included: '已纳入核算', unavailable: '缺少数据', not_applicable: '不适用', excluded: '有理由排除' }

export default function CoverageEditor({ path, editable }: { path: string; editable: boolean }) {
  const [draft, setDraft] = useState<Assessment[]>([])
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    void request<Assessment[]>({ url:path }).then((values) => {
      if (active) setDraft(scope3Categories.map((_, index) => values.find((item) => item.category === index+1)
        ?? {category:index+1,status:'unavailable',rationale:''}))
    }).catch((e: unknown) => { if (active) setError(errorText(e)) })
    return () => { active=false }
  }, [path])
  function edit(category: number, update: Partial<Assessment>) {
    setSaved(false)
    setDraft((rows) => rows.map((row) => row.category === category ? {...row,...update} : row))
  }
  return <Card title="范围 3 覆盖评估" size="small" extra={<Typography.Text type="secondary">{draft.filter((row) => row.rationale.trim().length>1).length} / 15 已说明</Typography.Text>}>
    <Typography.Paragraph>逐项说明是否纳入，记录数据缺口或排除理由。提交前先保存，再按该月份重新核算。</Typography.Paragraph>
    {error && <Alert type="error" message={error} showIcon/>}
    {saved && <Alert type="success" message="已保存覆盖评估" showIcon/>}
    <Space orientation="vertical" style={{width:'100%'}}>
      {draft.map((row) => <Row gutter={[8,8]} key={row.category} align="middle">
        <Col xs={24} lg={8}>{row.category} · {scope3Categories[row.category-1]}</Col>
        <Col xs={24} sm={8} lg={5}>
          <Select aria-label={`第 ${row.category} 类覆盖状态`} style={{width:'100%'}} value={row.status} disabled={!editable}
            options={Object.entries(statusLabels).map(([value,label]) => ({value,label}))}
            onChange={(status) => edit(row.category,{status})}/>
        </Col>
        <Col xs={24} sm={16} lg={11}>
          <Input aria-label={`第 ${row.category} 类说明`} value={row.rationale} disabled={!editable}
            maxLength={1500} placeholder="依据或处理计划" onChange={(e) => edit(row.category,{rationale:e.target.value})}/>
        </Col>
      </Row>)}
      {editable && <Button type="primary" loading={saving} disabled={draft.length!==15 || draft.some((row) => row.rationale.trim().length<2)}
        onClick={async () => {
          setSaving(true); setError('')
          try { await request({ url:path,method:'PUT',data:{categories:draft} }); setSaved(true) }
          catch (e) { setError(errorText(e)) }
          finally { setSaving(false) }
        }}>保存范围 3 评估</Button>}
    </Space>
  </Card>
}
