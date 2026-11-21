import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { request } from '../../api/client'
import { errorText } from '../organization/companyData'

export default function JoinInvitePage() {
  const [token, setToken] = useState(() => window.location.hash.slice(1))
  const [submitting,setSubmitting] = useState(false)
  const [notice,setNotice] = useState('')
  const navigate = useNavigate()
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }, [])
  return <main style={{maxWidth:520,margin:'clamp(32px, 10vh, 108px) auto',padding:'0 16px'}}>
    <Card><Typography.Title level={2}>接受企业邀请</Typography.Title>
      {notice && <Alert type="error" message={notice} showIcon/>}
      <Form layout="vertical" onFinish={async (data) => {
        setSubmitting(true); setNotice('')
        try {
          await request({ url:'/api/v1/organization/accept',method:'POST',data:{...data,token:token.trim()} })
          navigate('/login',{replace:true})
        } catch (err) { setNotice(errorText(err)) }
        finally { setSubmitting(false) }
      }}>
        {!token && <Form.Item label="邀请码"><Input onChange={(e) => setToken(e.target.value)}/></Form.Item>}
        <Form.Item label="用户名" name="username" rules={[{required:true,min:3,max:64}]}><Input autoComplete="username"/></Form.Item>
        <Form.Item label="登录密码" name="password" rules={[{required:true,min:12,max:72}]}><Input.Password autoComplete="new-password"/></Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting} disabled={!token}>开通账号</Button>
      </Form>
      <Link to="/login">返回登录</Link>
    </Card>
  </main>
}
