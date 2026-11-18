/* 瑞士设计系统共享组件出口；同时加载全局色板，页面从本文件导入即可 */
import '../../styles/swiss-tokens.css'

export { default as SwissAppShell } from '../../layouts/SwissAppLayout/SwissAppShell'
export type { SwissAppShellProps } from '../../layouts/SwissAppLayout/SwissAppShell'

export { default as SwissRail } from '../../layouts/SwissAppLayout/SwissRail'
export type {
  SwissRailGroup,
  SwissRailItem,
  SwissRailProps,
} from '../../layouts/SwissAppLayout/SwissRail'

export { default as SwissMasthead } from './SwissMasthead'
export type { SwissMastheadProps } from './SwissMasthead'

export { default as SwissSection } from './SwissSection'
export type { SwissSectionProps } from './SwissSection'

export { default as SwissStat } from './SwissStat'
export type { SwissStatProps } from './SwissStat'

export { default as SwissTable } from './SwissTable'
export type { SwissTableColumn, SwissTableProps } from './SwissTable'

export { default as SwissTabs } from './SwissTabs'
export type { SwissTabItem, SwissTabsProps } from './SwissTabs'

export { default as SwissField } from './SwissField'
export type { SwissFieldProps } from './SwissField'

export { default as SwissInput } from './SwissInput'
export type { SwissInputProps } from './SwissInput'

export { default as SwissSelect } from './SwissSelect'
export type { SwissSelectProps } from './SwissSelect'

export { default as SwissTextarea } from './SwissTextarea'
export type { SwissTextareaProps } from './SwissTextarea'

export { default as SwissButton } from './SwissButton'
export type { SwissButtonProps } from './SwissButton'

export { default as SwissDrawer } from './SwissDrawer'
export type { SwissDrawerProps } from './SwissDrawer'

export { default as SwissEmpty } from './SwissEmpty'
export type { SwissEmptyProps } from './SwissEmpty'

export { default as SwissError } from './SwissError'
export type { SwissErrorProps } from './SwissError'
