import activity from '../../assets/icons/activity.svg?url'
import arrowUpRight from '../../assets/icons/arrow-up-right.svg?url'
import chevronRight from '../../assets/icons/chevron-right.svg?url'
import circleCheck from '../../assets/icons/circle-check.svg?url'
import clock from '../../assets/icons/clock-3.svg?url'
import dashboard from '../../assets/icons/layout-dashboard.svg?url'
import files from '../../assets/icons/files.svg?url'
import fileText from '../../assets/icons/file-text.svg?url'
import help from '../../assets/icons/help-circle.svg?url'
import leaf from '../../assets/icons/leaf.svg?url'
import pie from '../../assets/icons/pie-chart.svg?url'
import plus from '../../assets/icons/plus.svg?url'
import scan from '../../assets/icons/scan-line.svg?url'
import upload from '../../assets/icons/upload.svg?url'
import './LineIcon.css'

const ICONS = {
  activity,
  'arrow-up-right': arrowUpRight,
  'chevron-right': chevronRight,
  'circle-check': circleCheck,
  clock,
  dashboard,
  files,
  'file-text': fileText,
  help,
  leaf,
  pie,
  plus,
  scan,
  upload,
} as const

export type LineIconName = keyof typeof ICONS

type LineIconProps = {
  name: LineIconName
  size?: number
  className?: string
}

/** Lucide 线性图标（ISC），用遮罩跟随 currentColor 上色 */
export default function LineIcon({ name, size = 16, className }: LineIconProps) {
  const url = ICONS[name]
  return (
    <span
      aria-hidden="true"
      className={className ? `line-icon ${className}` : 'line-icon'}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: `url("${url}")`,
        maskImage: `url("${url}")`,
      }}
    />
  )
}
