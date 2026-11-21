import type { ThemeConfig } from 'antd'

/**
 * Ant Design 主题。
 * 值必须与 src/styles/tokens.css 一致；改一处要改两处。
 * 这里是允许出现十六进制色值的两个文件之一（另一个是 tokens.css）。
 */
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1756a4',
    colorSuccess: '#087263',
    colorWarning: '#8b550e',
    colorError: '#a6343f',
    colorInfo: '#1756a4',
    colorText: '#132638',
    colorTextSecondary: '#526578',
    colorTextTertiary: '#62768a',
    colorBorder: '#d9e2ed',
    colorBgLayout: '#f4f7fb',
    colorBgContainer: '#FFFFFF',
    borderRadius: 8,
    fontSize: 14,
    fontFamily:
      '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#FFFFFF',
      headerHeight: 60,
      headerPadding: '0 24px',
      siderBg: '#FFFFFF',
      bodyBg: '#f4f7fb',
      footerBg: '#FFFFFF',
      footerPadding: '12px 24px',
    },
    Menu: {
      itemBg: 'transparent',
      itemColor: '#526578',
      itemHoverBg: '#f4f7fb',
      itemSelectedBg: '#eaf2ff',
      itemSelectedColor: '#1756a4',
      itemHeight: 40,
      itemBorderRadius: 8,
      itemMarginInline: 8,
    },
    Table: {
      headerBg: '#f4f7fb',
      headerColor: '#132638',
      rowHoverBg: '#f4f7fb',
      borderColor: '#d9e2ed',
    },
    Card: {
      borderRadiusLG: 12,
      paddingLG: 24,
    },
  },
}
