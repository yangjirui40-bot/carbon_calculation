import type { ReactNode } from 'react'
import './SwissTable.css'

export type SwissTableColumn = {
  key: string
  title: string
  align?: 'left' | 'right' | 'center'
  width?: string | number
  render?: (row: Record<string, ReactNode>, index: number) => ReactNode
}

export type SwissTableProps = {
  columns: SwissTableColumn[]
  rows: Array<Record<string, ReactNode>>
  rowKey: (row: Record<string, ReactNode>, index: number) => string
  empty?: ReactNode
}

/**
 * 细线数据表：原生 table 语义，表头小号大写，行底 1px rule-soft。
 * 数字列由调用方设置 align="right"。类名用 swiss-data-table，
 * 避免与既有页面里的 .swiss-table 冲突。
 */
export default function SwissTable({ columns, rows, rowKey, empty }: SwissTableProps) {
  if (rows.length === 0) {
    return (
      <div className="swiss-data-table__empty" role="status">
        {empty ?? '暂无数据'}
      </div>
    )
  }

  return (
    <div className="swiss-data-table-wrap">
      <table className="swiss-data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{ width: column.width, textAlign: column.align }}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((column) => (
                <td key={column.key} style={{ textAlign: column.align }}>
                  {column.render ? column.render(row, index) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
