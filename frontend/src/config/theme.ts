import type { ThemeConfig } from 'antd'

/**
 * Ant Design 主题。
 * 值必须与 src/styles/tokens.css 一致；改一处要改两处。
 * 这里是允许出现十六进制色值的两个文件之一（另一个是 tokens.css）。
 */
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#4CAF50',
    colorSuccess: '#4CAF50',
    colorWarning: '#FF9800',
    colorError: '#F44336',
    colorInfo: '#2196F3',
    colorText: '#1F2937',
    colorTextSecondary: '#6B7280',
    colorTextTertiary: '#9CA3AF',
    colorBorder: '#E5E7EB',
    colorBgLayout: '#F5F7FA',
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
      bodyBg: '#F5F7FA',
      footerBg: '#FFFFFF',
      footerPadding: '12px 24px',
    },
    Menu: {
      itemBg: 'transparent',
      itemColor: '#6B7280',
      itemHoverBg: '#F9FAFB',
      itemSelectedBg: '#F1F8E9',
      itemSelectedColor: '#388E3C',
      itemHeight: 40,
      itemBorderRadius: 8,
      itemMarginInline: 8,
    },
    Table: {
      headerBg: '#F9FAFB',
      headerColor: '#1F2937',
      rowHoverBg: '#F9FAFB',
      borderColor: '#E5E7EB',
    },
    Card: {
      borderRadiusLG: 12,
      paddingLG: 24,
    },
  },
}
