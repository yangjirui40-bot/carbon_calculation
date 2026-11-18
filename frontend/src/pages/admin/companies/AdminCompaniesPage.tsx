import { App } from 'antd'
import { useState } from 'react'
import { companiesApi } from '../../../api'
import type { CompanyDetail } from '../../../api/types'
import {
  SwissButton,
  SwissEmpty,
  SwissError,
  SwissMasthead,
  SwissSection,
} from '../../../components/swiss'
import CompanyFormDrawer, { type CompanyFormMode } from './CompanyFormDrawer'
import CompanyTable from './CompanyTable'
import { toErrorMessage } from './errors'
import { useCompanyArchive } from './useCompanyArchive'
import './companies.css'

/**
 * 企业管理（仅管理员）：企业表的查看、新建、编辑与删除。
 * 删除失败（如被业务数据引用）保留列表并原样展示后端 detail。
 */
export default function AdminCompaniesPage() {
  const { modal } = App.useApp()
  const { companies, loading, error, reload } = useCompanyArchive()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<CompanyFormMode>('create')
  const [editingCompany, setEditingCompany] = useState<CompanyDetail | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function openCreate() {
    setDrawerMode('create')
    setEditingCompany(null)
    setDrawerOpen(true)
  }

  function openEdit(company: CompanyDetail) {
    setDrawerMode('edit')
    setEditingCompany(company)
    setDrawerOpen(true)
  }

  function handleSaved(company: CompanyDetail, mode: CompanyFormMode) {
    setDrawerOpen(false)
    setEditingCompany(null)
    setActionError(null)
    setActionMessage(
      mode === 'create' ? `已创建企业「${company.name}」。` : `已保存企业「${company.name}」的修改。`,
    )
    reload()
  }

  function handleDelete(company: CompanyDetail) {
    modal.confirm({
      title: `删除企业「${company.name}」？`,
      content:
        '删除后不可恢复。若该企业已被业务记录、订阅或账号引用，后端会拒绝删除，届时保留原始数据并展示原因。',
      okText: '删除',
      cancelText: '取消',
      rootClassName: 'swiss-confirm',
      centered: true,
      okButtonProps: { danger: true },
      onOk: async () => {
        setActionMessage(null)
        setActionError(null)
        try {
          await companiesApi.deleteCompany(company.id)
          setActionMessage(`已删除企业「${company.name}」。`)
          reload()
        } catch (requestError) {
          setActionError(toErrorMessage(requestError))
        }
      },
    })
  }

  return (
    <div className="companies-page">
      <SwissMasthead
        kicker="Admin"
        title="企业管理"
        description="维护企业档案与租户信息；企业编号创建后不可修改。"
        actions={<SwissButton onClick={openCreate}>新建企业</SwissButton>}
      />

      {actionMessage ? (
        <div className="companies-feedback" role="status">
          {actionMessage}
        </div>
      ) : null}
      {actionError ? (
        <div className="companies-feedback companies-feedback--fail" role="alert">
          {actionError}
        </div>
      ) : null}

      <SwissSection
        kicker="Companies"
        title="企业列表"
        extra={loading ? '正在加载…' : `${companies.length} 家企业`}
      >
        {error ? (
          <SwissError message={error} onRetry={reload} />
        ) : loading && companies.length === 0 ? (
          <div className="companies-state" role="status">
            正在加载企业…
          </div>
        ) : companies.length === 0 ? (
          <SwissEmpty
            title="还没有企业"
            description="创建第一家企业后可开通企业账号与订阅。"
            action={<SwissButton onClick={openCreate}>新建企业</SwissButton>}
          />
        ) : (
          <CompanyTable
            companies={companies}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        )}
      </SwissSection>

      <CompanyFormDrawer
        open={drawerOpen}
        mode={drawerMode}
        company={editingCompany}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}
