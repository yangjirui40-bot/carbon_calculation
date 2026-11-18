import { useState } from 'react'
import type { AuthUser, CreateUserPayload } from '../../../api/modules/auth'
import { SwissMasthead, SwissSection } from '../../../components/swiss'
import AccountCreated from './AccountCreated'
import CreateAccountForm from './CreateAccountForm'
import { useCompanyDirectory } from './useCompanyDirectory'
import './users.css'

type CreatedAccount = {
  user: AuthUser
  payload: CreateUserPayload
}

/**
 * 账号开通（仅管理员）：后端没有账号列表接口，本页只做开通入口。
 * 角色切换时显示企业编号或供应商编号，提交成功展示账号信息。
 */
export default function AdminUsersPage() {
  const [created, setCreated] = useState<CreatedAccount | null>(null)
  const { companies, loading, error } = useCompanyDirectory()

  return (
    <div className="users-page">
      <SwissMasthead
        kicker="Admin"
        title="账号开通"
        description="为企业、供应商、审计员或管理员开通账号；开通后账号立即生效。"
      />

      {created ? (
        <AccountCreated
          user={created.user}
          payload={created.payload}
          onReset={() => setCreated(null)}
        />
      ) : (
        <SwissSection kicker="Onboarding" title="开通新账号">
          <CreateAccountForm
            companies={companies}
            companiesLoading={loading}
            companiesError={error}
            onCreated={(user, payload) => setCreated({ user, payload })}
          />
        </SwissSection>
      )}
    </div>
  )
}
