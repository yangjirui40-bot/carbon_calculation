import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './SwissDrawer.css'

export type SwissDrawerProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number | string
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * 右侧详情抽屉：纸色背景、左边 1px rule、遮罩半透明。
 * Esc 与遮罩点击关闭；打开时把焦点移入面板，并在面板内循环 Tab。
 */
export default function SwissDrawer({
  open,
  title,
  onClose,
  children,
  footer,
  width = 440,
}: SwissDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusables.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="swiss-drawer__overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="swiss-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ width }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="swiss-drawer__header">
          <h2 className="swiss-drawer__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="swiss-drawer__close" aria-label="关闭" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="swiss-drawer__body">{children}</div>
        {footer ? <footer className="swiss-drawer__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
