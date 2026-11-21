import { useCallback, useState } from 'react'
import { recordsApi } from '../../api'
import type { BusinessRecord } from '../../api/types'
import { toErrorMessage } from './errors'

type UseRecordMutationsOptions = {
  /** 导入所需的企业；为 null 时导入按钮已禁用 */
  companyId: number | null
  /** 成功后刷新列表 */
  onChanged: () => void
}

/** 业务记录的导入、删除二次确认、成功/失败提示；新增成功由页面回调接入 */
export function useRecordMutations({ companyId, onChanged }: UseRecordMutationsOptions) {
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pendingDeleteNo, setPendingDeleteNo] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const clearMessages = useCallback(() => {
    setSuccessMessage(null)
    setActionError(null)
  }, [])

  function requestDelete(recordNo: string) {
    clearMessages()
    setPendingDeleteNo(recordNo)
  }

  function cancelDelete() {
    setPendingDeleteNo(null)
  }

  async function handleImportFile(file: File) {
    if (companyId == null) return
    clearMessages()
    setImporting(true)
    try {
      const result = await recordsApi.importRecords(file, companyId)
      setSuccessMessage(
        `导入完成：新增 ${result.imported} 条，共 ${result.total_rows} 行。`,
      )
      onChanged()
    } catch (err) {
      setActionError(toErrorMessage(err))
    } finally {
      setImporting(false)
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteNo) return
    const recordNo = pendingDeleteNo
    clearMessages()
    setDeleting(true)
    try {
      await recordsApi.deleteRecord(recordNo)
      setPendingDeleteNo(null)
      setSuccessMessage(`已删除记录 ${recordNo}。`)
      onChanged()
    } catch (err) {
      setPendingDeleteNo(null)
      setActionError(toErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  function handleEdited(record: BusinessRecord, action: string) {
    setSuccessMessage(`记录 ${record.record_no}${action}。`)
    setActionError(null)
    onChanged()
  }

  function handleCreated(record: BusinessRecord) {
    setSuccessMessage(`已新增记录 ${record.record_no}。`)
    setActionError(null)
    onChanged()
  }

  return {
    importing,
    deleting,
    pendingDeleteNo,
    successMessage,
    actionError,
    clearMessages,
    requestDelete,
    cancelDelete,
    handleImportFile,
    handleConfirmDelete,
    handleCreated,
    handleEdited,
  }
}
