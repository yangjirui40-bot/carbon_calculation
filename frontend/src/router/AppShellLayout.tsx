import { useEffect, useState } from 'react'
import { BankOutlined, UserOutlined } from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { companiesApi } from '../api'
import type { CompanyDetail } from '../api/types'
import { filterNavGroups } from '../config/navigation'
import { ROLE_LABELS } from '../config/roles'
import { useCompany } from '../context/CompanyContext'
import SwissAppShell from '../layouts/SwissAppLayout/SwissAppShell'
import SwissRail from '../layouts/SwissAppLayout/SwissRail'
import { clearSession, readSession } from './guards/RequireAuth'

export default function AppShellLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { companyId, setCompanyId } = useCompany()
  const user = readSession()?.user
  const role = user?.role ?? null
  const userCompanyId = user?.company_id ?? null
  const [companies, setCompanies] = useState<CompanyDetail[]>([])

  useEffect(() => {
    let active = true
    if (role === 'enterprise' && userCompanyId !== null) {
      void companiesApi.getCompany(userCompanyId).then((company) => {
        if (active) setCompanies([company])
      }).catch(() => {})
    } else if (role === 'admin' || role === 'auditor') {
      void companiesApi.listCompanies().then((list) => {
        if (active) setCompanies(list)
      }).catch(() => {})
    }
    return () => { active = false }
  }, [role, userCompanyId])

  if (!user) return null

  const groups = filterNavGroups(role).map(({ title, items }) => ({ key: title, label: title, items }))
  const active = groups.flatMap((group) => group.items)
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]?.key

  return (
    <SwissAppShell
      activeKey={active}
      rail={<SwissRail groups={groups} activeKey={active} />}
      headerRight={
        <>
          <div className="carbon-company">
            <BankOutlined aria-hidden="true" />
            {role !== 'enterprise' && companies.length > 0 ? (
              <select aria-label="当前企业" value={companyId ?? userCompanyId ?? ''}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!next) return
                  setCompanyId(next)
                  if (/^\/(audit\/runs|reports|results|products)\/./.test(pathname) || /^\/documents\/\d+\/review/.test(pathname)) {
                    navigate('/workspace')
                  }
                }}>
                <option value="" disabled>选择企业</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            ) : (
              <span title={companies[0]?.name}>{companies[0]?.name ?? '企业空间'}</span>
            )}
          </div>
          <div className="carbon-account">
            <span className="carbon-avatar" aria-hidden="true"><UserOutlined /></span>
            <span className="carbon-account__name">{user.username}<small>{ROLE_LABELS[user.role]}</small></span>
            <button className="carbon-logout" type="button" onClick={() => {
              clearSession()
              setCompanyId(null)
              navigate('/login', { replace: true })
            }}>退出</button>
          </div>
        </>
      }
    >
      <Outlet />
    </SwissAppShell>
  )
}
