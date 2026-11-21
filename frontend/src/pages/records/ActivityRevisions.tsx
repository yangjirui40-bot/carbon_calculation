import { useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Select, Space } from 'antd'
import { request } from '../../api/client'
import type { BusinessRecord } from '../../api/types'
import { errorText } from '../organization/companyData'
import { formatDateTime } from '../../utils/format'

type Revision={revision_no:number;actor:string;reason:string;record:Partial<BusinessRecord>;created_at:string}
export default function ActivityRevisions({ record, onChanged }: {record:BusinessRecord; onChanged:(record:BusinessRecord,operation:string)=>void}) {
  const [history,setHistory]=useState<Revision[]>()
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [form]=Form.useForm()
  const action=Form.useWatch('action',form)
  const path='/api/v1/records/'+encodeURIComponent(record.record_no)
  return <details className="records-review-meta" style={{display:'block',marginTop:16}}>
    <summary>活动更正与版本历史</summary>
    {error && <Alert type="error" message={error} showIcon/>}
    <Button size="small" disabled={busy} onClick={async () => {
      try {setHistory(await request<Revision[]>({url:path+'/revisions'}));setError('')}
      catch (e) {setError(errorText(e))}
    }}>读取版本</Button>
    {history?.map((row) => <div key={row.revision_no} style={{marginBlock:8}}>
      <b>第 {row.revision_no} 版</b> · {row.actor} · {formatDateTime(row.created_at)}
      <p>{row.reason} · {row.record.quantity ?? row.record.amount} {row.record.unit ?? row.record.currency} · {row.record.factor_id}</p>
    </div>)}
    {history && record.site_id && record.review_status!=='rejected' && <Form layout="vertical" form={form} initialValues={{action:'correct'}}
      onFinish={async (values) => {
        setBusy(true);setError('')
        try {
          const body={...values,expected_revision:history[0]?.revision_no ?? 0}
          onChanged(await request<BusinessRecord>({url:path+'/adjust',method:'PATCH',data:body}),'活动历史已更新')
        } catch (e) {setError(errorText(e))}
        finally {setBusy(false)}
      }}>
      <Form.Item label="操作" name="action" rules={[{required:true}]}><Select options={[{value:'correct',label:'更正活动'},{value:'void',label:'冲销记录'}]}/></Form.Item>
      {action==='correct' &&
        <Space wrap>
          {record.unit ? <Form.Item name="quantity" label="更正活动量" preserve={false}><InputNumber min={0}/></Form.Item>
            : <Form.Item name="amount" label="更正金额" preserve={false}><InputNumber min={0}/></Form.Item>}
          <Form.Item name="factor_id" label="更正因子编号" preserve={false}><Input placeholder={record.factor_id}/></Form.Item>
        </Space>}
      <Form.Item label="原因与依据" name="reason" rules={[{required:true,min:2}]}><Input.TextArea maxLength={500} rows={2}/></Form.Item>
      <Button type="primary" loading={busy} htmlType="submit">提交更正记录</Button>
    </Form>}
  </details>
}
