import { useRef, type ChangeEvent } from 'react'
import { SwissButton } from '../../components/swiss'

type RecordsToolbarProps = {
  canWrite: boolean
  canWriteNow: boolean
  importing: boolean
  onImportFile: (file: File) => void
  onCreate: () => void
}

/** 眉标右侧操作：导入 CSV/XLSX 与新增记录；审计员不渲染 */
export default function RecordsToolbar({
  canWrite,
  canWriteNow,
  importing,
  onImportFile,
  onCreate,
}: RecordsToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  if (!canWrite) return null

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onImportFile(file)
  }

  return (
    <>
      <a className="records-template-link" href="/ledger-template.csv" download="碳速算_台账导入模板.csv">下载台账模板</a>
      <SwissButton
        variant="ghost"
        onClick={() => inputRef.current?.click()}
        disabled={!canWriteNow || importing}
        loading={importing}
      >
        导入 CSV/XLSX
      </SwissButton>
      <SwissButton onClick={onCreate} disabled={!canWriteNow}>
        新增记录
      </SwissButton>
      <input
        ref={inputRef}
        className="records-file-input"
        type="file"
        accept=".csv,.xlsx"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />
    </>
  )
}
