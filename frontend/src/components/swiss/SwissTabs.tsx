import { useRef, type KeyboardEvent } from 'react'
import './SwissTabs.css'

export type SwissTabItem = {
  key: string
  label: string
  count?: number
}

export type SwissTabsProps = {
  items: SwissTabItem[]
  activeKey: string
  onChange: (key: string) => void
}

/** 下划线页签：容器底部 1px rule，当前项 2px accent 下划线 + ink 文字 */
export default function SwissTabs({ items, activeKey, onChange }: SwissTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()

    let nextIndex = index
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + items.length) % items.length
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % items.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = items.length - 1

    const next = items[nextIndex]
    if (!next) return
    if (next.key !== activeKey) onChange(next.key)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <div className="swiss-tabs" role="tablist" aria-label="内容页签">
      {items.map((item, index) => {
        const active = item.key === activeKey
        return (
          <button
            key={item.key}
            ref={(node) => {
              tabRefs.current[index] = node
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={active ? 'swiss-tabs__tab is-active' : 'swiss-tabs__tab'}
            onClick={() => onChange(item.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span>{item.label}</span>
            {typeof item.count === 'number' ? (
              <span className="swiss-tabs__count">{item.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
