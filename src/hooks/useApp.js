import { useTheme } from '../contexts/ThemeContext'
import { useI18n } from './useI18n'

/**
 * 全局应用 hook，整合主题和国际化功能
 * 返回：t, theme, colors, setTheme, locale, setLocale, langLoading
 */
export function useApp() {
  const { t, locale, setLocale, loading: langLoading } = useI18n()
  const { theme, colors, setTheme } = useTheme()
  return { t, theme, colors, setTheme, locale, setLocale, langLoading }
}
