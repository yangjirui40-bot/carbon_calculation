import type { ReactNode } from 'react'
import { Empty } from 'antd'
import { useCompanyScope } from '../calculations/useCompanyScope'
import CompanyPicker from '../calculations/swiss/CompanyPicker'

export default function EnterpriseScope({ children }: { children: (companyId: number) => ReactNode }) {
  const scope = useCompanyScope()
  return <>
    {scope.pickerVisible && <CompanyPicker companies={scope.companies} value={scope.effectiveCompanyId}
      loading={scope.pickerLoading} error={scope.pickerError} onChange={scope.selectCompany} onRetry={scope.reloadCompanies} />}
    {scope.effectiveCompanyId !== null ? children(scope.effectiveCompanyId) : <Empty description="请选择企业" />}
  </>
}
