import { useState, type FormEvent } from 'react'
import { SwissButton, SwissField, SwissInput } from '../../../components/swiss'
import './EiolcaForm.css'

export type EiolcaAmounts = [number, number, number]

type EiolcaFormProps = {
  loading: boolean
  onSubmit: (amounts: EiolcaAmounts) => void
}

type FieldKey = 'electronics' | 'pcb' | 'packaging'

const FIELDS: Array<{ key: FieldKey; label: string; initial: string }> = [
  { key: 'electronics', label: '电子元器件（元）', initial: '7000' },
  { key: 'pcb', label: 'PCB 材料（元）', initial: '2000' },
  { key: 'packaging', label: '包装材料（元）', initial: '1000' },
]

type FieldErrors = Partial<Record<FieldKey, string>>

/** EIO-LCA 采购金额输入：三类金额，非负校验。 */
export default function EiolcaForm({ loading, onSubmit }: EiolcaFormProps) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    electronics: '7000',
    pcb: '2000',
    packaging: '1000',
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: FieldErrors = {}
    const parsed = FIELDS.map((field) => {
      const raw = values[field.key].trim()
      const value = Number(raw)
      if (!raw || !Number.isFinite(value) || value < 0) {
        nextErrors[field.key] = '请输入不小于 0 的金额'
        return 0
      }
      return value
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    if (parsed.every((value) => value === 0)) {
      setErrors({ electronics: '三项金额不能同时为 0' })
      return
    }
    onSubmit([parsed[0], parsed[1], parsed[2]])
  }

  return (
    <form className="eiolca-form" onSubmit={handleSubmit} noValidate>
      {FIELDS.map((field) => (
        <SwissField
          key={field.key}
          label={field.label}
          htmlFor={`eiolca-${field.key}`}
          required
          error={errors[field.key]}
        >
          <SwissInput
            id={`eiolca-${field.key}`}
            type="text"
            inputMode="decimal"
            value={values[field.key]}
            disabled={loading}
            onChange={(event) => {
              const next = event.target.value
              setValues((previous) => ({ ...previous, [field.key]: next }))
              if (errors[field.key]) {
                setErrors((previous) => ({ ...previous, [field.key]: undefined }))
              }
            }}
          />
        </SwissField>
      ))}

      <div className="eiolca-form__actions">
        <SwissButton type="submit" loading={loading}>
          计算部门排放
        </SwissButton>
        <span className="eiolca-form__note">金额单位：人民币元</span>
      </div>
    </form>
  )
}
