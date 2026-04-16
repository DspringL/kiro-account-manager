// i18n hook（仅支持中文）
import { useTranslation } from 'react-i18next'

export function useI18n() {
  const { t } = useTranslation()
  
  return {
    t,
    locale: 'zh-CN',
    setLocale: () => {}, // 不再支持切换语言
    loading: false,
  }
}
