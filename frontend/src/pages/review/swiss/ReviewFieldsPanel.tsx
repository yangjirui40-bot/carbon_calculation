import { fieldLabel } from '../../documents/meta'
import './ReviewFieldsPanel.css'

type ReviewFieldsPanelProps = {
  fieldKeys: string[]
  values: Record<string, string>
  original: Record<string, unknown>
  corrections: Map<string, string[]>
  onChange: (key: string, value: string) => void
}

/** 识别字段：可逐项修订，有勾稽纠偏的字段附修订说明 */
export default function ReviewFieldsPanel({
  fieldKeys,
  values,
  original,
  corrections,
  onChange,
}: ReviewFieldsPanelProps) {
  return (
    <section className="review-fields-panel">
      <div className="review-fields-head">
        <h2>识别字段</h2>
        <span>{fieldKeys.length} 个字段 · 修订随确认一起提交</span>
      </div>

      {fieldKeys.map((key) => {
        const notes = corrections.get(key)
        const isNumeric = typeof original[key] === 'number'
        const value = values[key] ?? ''
        const edited = value !== (original[key] === null || original[key] === undefined
          ? ''
          : String(original[key]))

        return (
          <div
            className={`review-field-block${notes ? ' is-corrected' : ''}${edited ? ' is-edited' : ''}`}
            key={key}
          >
            <div className="review-field-top">
              <span className="review-field-label">
                {fieldLabel(key)}
                <em>{key}</em>
              </span>
              {notes ? <span className="review-field-badge">已纠偏</span> : null}
            </div>

            <input
              className="review-input"
              type={isNumeric ? 'number' : 'text'}
              step={isNumeric ? 'any' : undefined}
              value={value}
              aria-label={fieldLabel(key)}
              onChange={(event) => onChange(key, event.target.value)}
            />

            {notes?.map((note) => (
              <p className="review-field-note" key={note}>
                {note}
              </p>
            ))}
          </div>
        )
      })}
    </section>
  )
}
