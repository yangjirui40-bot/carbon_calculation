import { useRef, type ChangeEvent } from 'react'
import { SwissButton } from '../../components/swiss'

type FactorsAdminBarProps = {
  importing: boolean
  deriving: boolean
  onImportFile: (file: File) => void
  onDerive: () => void
  onOpenCreate: () => void
}

/** 管理员操作入口：新建因子、CSV 导入、由 IO 表派生 */
export default function FactorsAdminBar({
  importing,
  deriving,
  onImportFile,
  onDerive,
  onOpenCreate,
}: FactorsAdminBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onImportFile(file)
  }

  return (
    <div className="factors-admin-bar">
      <SwissButton
        variant="ghost"
        className="factors-admin-bar__button"
        onClick={() => inputRef.current?.click()}
        disabled={importing || deriving}
        loading={importing}
      >
        导入 CSV
      </SwissButton>
      <SwissButton
        variant="ghost"
        className="factors-admin-bar__button"
        onClick={onDerive}
        disabled={importing || deriving}
        loading={deriving}
      >
        由 IO 表派生
      </SwissButton>
      <SwissButton
        className="factors-admin-bar__button"
        onClick={onOpenCreate}
        disabled={importing || deriving}
      >
        新建因子
      </SwissButton>
      <input
        ref={inputRef}
        className="factors-file-input"
        type="file"
        accept=".csv"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />
    </div>
  )
}
