import React, { useEffect, useState } from 'react'
import i18n from 'i18next'
import { initReactI18next, I18nextProvider, useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'

// 从 JSON 文件导入翻译
import zhCN from '../locales/zh-CN.json'
import enUS from '../locales/en-US.json'
import ruRU from '../locales/ru-RU.json'

// 支持的语言
export const locales = {
  'zh-CN': '简体中文',
  'en-US': 'English',
  'ru-RU': 'Русский',
}

// 初始化 i18n（默认中文，后续从设置加载）
i18n
  .use(initReactI18next)
  .init({
    lng: 'zh-CN',
    fallbackLng: 'zh-CN',
    supportedLngs: ['zh-CN', 'en-US', 'ru-RU'],
    
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
      'ru-RU': { translation: ruRU },
    },
    
    interpolation: {
      escapeValue: false,
    },
    
    react: {
      useSuspense: false,
    },
  })

// 从 app-settings.json 加载语言设置
export const loadLocaleFromSettings = async () => {
  try {
    const settings = await invoke('get_app_settings')
    if (settings?.locale && locales[settings.locale]) {
      await i18n.changeLanguage(settings.locale)
    }
  } catch (e) {
    console.error('[i18n] Failed to load locale from settings:', e)
  }
}

// 切换语言（保存到 app-settings.json）
export const changeLanguage = async (lng) => {
  await i18n.changeLanguage(lng)
  try {
    await invoke('save_app_settings', { settings: { locale: lng } })
  } catch (e) {
    console.error('[i18n] Failed to save locale:', e)
  }
}

// 兼容旧的 useI18n hook
export function useI18n() {
  const { t, i18n: i18nInstance } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [, forceUpdate] = React.useReducer(x => x + 1, 0)
  
  const setLocale = async (lng) => {
    setLoading(true)
    try {
      await changeLanguage(lng)
      forceUpdate()
    } finally {
      setLoading(false)
    }
  }
  
  return {
    t,
    locale: i18nInstance.language,
    setLocale,
    loading,
  }
}

// I18nProvider 组件
export function I18nProvider({ children }) {
  const [loaded, setLoaded] = useState(false)
  
  useEffect(() => {
    loadLocaleFromSettings().finally(() => setLoaded(true))
  }, [])
  
  // 等待语言加载完成再渲染，显示加载状态避免闪烁
  if (!loaded) {
    return (
      <div className="h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-white/50 text-sm">加载中...</div>
      </div>
    )
  }
  
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

export default i18n
