import type { AuthUser, CreateUserPayload } from '../../../api/modules/auth'
import { SwissButton, SwissSection } from '../../../components/swiss'
import { EMPTY_VALUE } from '../../../utils/format'
import { userRoleLabel } from './constants'

type AccountCreatedProps = {
  user: AuthUser
  payload: CreateUserPayload
  onReset: () => void
}

/** 开通成功结果：展示后端返回的账号信息与“再次开通” */
export default function AccountCreated({ user, payload, onReset }: AccountCreatedProps) {
  const affiliation =
    payload.role === 'enterprise'
      ? payload.company_id != null
        ? `企业编号 ${payload.company_id}`
        : EMPTY_VALUE
      : payload.role === 'supplier'
        ? (payload.supplier_id ?? EMPTY_VALUE)
        : EMPTY_VALUE

  return (
    <SwissSection
      kicker="Account created"
      title="账号已开通"
      extra={
        <SwissButton variant="ghost" className="users-reset-btn" onClick={onReset}>
          再次开通
        </SwissButton>
      }
    >
      <dl className="account-result">
        <div className="account-result__row">
          <dt>账号 ID</dt>
          <dd>{user.id}</dd>
        </div>
        <div className="account-result__row">
          <dt>用户名</dt>
          <dd>{user.username}</dd>
        </div>
        <div className="account-result__row">
          <dt>邮箱</dt>
          <dd>{user.email}</dd>
        </div>
        <div className="account-result__row">
          <dt>角色</dt>
          <dd>{userRoleLabel(payload.role)}</dd>
        </div>
        <div className="account-result__row">
          <dt>归属</dt>
          <dd>{affiliation}</dd>
        </div>
        <div className="account-result__row">
          <dt>状态</dt>
          <dd className="account-result__active">
            {user.is_active === false ? '已停用' : '启用'}
          </dd>
        </div>
      </dl>
      <p className="account-result__note">
        账号已写入后端，请使用开通时填写的初始密码登录。
      </p>
    </SwissSection>
  )
}
