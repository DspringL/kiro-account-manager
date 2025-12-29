import { createContext, useContext, useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

const ThemeContext = createContext()

export const themes = {
  light: {
    nameKey: 'theme.light',
    sidebar: 'bg-gradient-to-b from-[#4361ee] to-[#3651de]',
    sidebarText: 'text-white',
    sidebarHover: 'hover:bg-white/10',
    sidebarActive: 'bg-white text-[#4361ee]',
    sidebarBorder: 'border-white/20',
    sidebarMuted: 'text-blue-200/60',
    sidebarCard: 'bg-white/10',
    main: 'bg-gradient-to-br from-gray-50 to-gray-100',
    card: 'bg-white',
    cardBorder: 'border-gray-100',
    cardHover: 'hover:bg-gray-50',
    cardSecondary: 'bg-gray-50/50',
    text: 'text-gray-800',
    textMuted: 'text-gray-500',
    input: 'bg-white border-gray-200',
    inputFocus: 'focus:ring-blue-500/20 focus:border-blue-500',
    btnSecondary: 'bg-gray-100 hover:bg-gray-200 border-gray-300',
    iconColor: '#1a1a1a',
    // 下拉菜单样式
    menuHover: 'hover:bg-gray-100',
    primary: 'text-blue-600',
    // 错误样式
    error: 'bg-red-50 text-red-600',
    errorBorder: 'border-red-200',
    // 警告样式
    warning: 'bg-orange-50',
    warningBorder: 'border-orange-200',
    // 信息样式
    info: 'bg-blue-50',
    infoBorder: 'border-blue-200',
    // 危险按钮样式
    danger: 'bg-red-100 text-red-600',
    dangerHover: 'hover:bg-red-200',
  },
  dark: {
    nameKey: 'theme.dark',
    sidebar: 'bg-gradient-to-b from-[#1a1a2e] to-[#16162a]',
    sidebarText: 'text-white',
    sidebarHover: 'hover:bg-white/10',
    sidebarActive: 'bg-blue-600 text-white',
    sidebarBorder: 'border-white/10',
    sidebarMuted: 'text-gray-400',
    sidebarCard: 'bg-white/5',
    main: 'bg-[#0f0f1a]',
    card: 'bg-[#1a1a2e]',
    cardBorder: 'border-gray-800',
    cardHover: 'hover:bg-white/10',
    cardSecondary: 'bg-white/[0.02]',
    text: 'text-gray-100',
    textMuted: 'text-gray-400',
    input: 'bg-[#252540] border-gray-700',
    inputFocus: 'focus:ring-blue-500/30 focus:border-blue-500',
    btnSecondary: 'bg-[#1a1a1a] hover:bg-[#252525] border-[#333]',
    iconColor: 'white',
    // 下拉菜单样式
    menuHover: 'hover:bg-white/10',
    primary: 'text-blue-400',
    // 错误样式
    error: 'bg-red-500/10 text-red-400',
    errorBorder: 'border-red-500/20',
    // 警告样式
    warning: 'bg-orange-500/10',
    warningBorder: 'border-orange-500/20',
    // 信息样式
    info: 'bg-blue-500/10',
    infoBorder: 'border-blue-500/20',
    // 危险按钮样式
    danger: 'bg-red-500/20 text-red-400',
    dangerHover: 'hover:bg-red-500/30',
  },
  purple: {
    nameKey: 'theme.purple',
    sidebar: 'bg-gradient-to-b from-[#7c3aed] to-[#6d28d9]',
    sidebarText: 'text-white',
    sidebarHover: 'hover:bg-white/10',
    sidebarActive: 'bg-white text-[#7c3aed]',
    sidebarBorder: 'border-white/20',
    sidebarMuted: 'text-purple-200/60',
    sidebarCard: 'bg-white/10',
    main: 'bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50',
    card: 'bg-white/90 backdrop-blur-sm',
    cardBorder: 'border-purple-200/60',
    cardHover: 'hover:bg-purple-50',
    cardSecondary: 'bg-purple-50/30',
    text: 'text-purple-900',
    textMuted: 'text-purple-500',
    input: 'bg-purple-50/50 border-purple-200',
    inputFocus: 'focus:ring-purple-500/30 focus:border-purple-500',
    accent: 'text-purple-600',
    accentBg: 'bg-purple-500',
    loginBtn: 'bg-purple-100 hover:bg-purple-200 border-purple-300',
    loginBtnIcon: '#6d28d9',
    // 下拉菜单样式
    menuHover: 'hover:bg-purple-100',
    primary: 'text-purple-600',
    // 错误样式
    error: 'bg-red-100 text-red-600',
    errorBorder: 'border-red-300',
    // 警告样式
    warning: 'bg-orange-100',
    warningBorder: 'border-orange-300',
    // 信息样式
    info: 'bg-blue-100',
    infoBorder: 'border-blue-300',
    // 危险按钮样式
    danger: 'bg-red-100 text-red-600',
    dangerHover: 'hover:bg-red-200',
  },
  green: {
    nameKey: 'theme.green',
    sidebar: 'bg-gradient-to-b from-[#059669] to-[#047857]',
    sidebarText: 'text-white',
    sidebarHover: 'hover:bg-white/10',
    sidebarActive: 'bg-white text-[#059669]',
    sidebarBorder: 'border-white/20',
    sidebarMuted: 'text-emerald-200/60',
    sidebarCard: 'bg-white/10',
    main: 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50',
    card: 'bg-white/90 backdrop-blur-sm',
    cardBorder: 'border-emerald-200/60',
    cardHover: 'hover:bg-emerald-50',
    cardSecondary: 'bg-emerald-50/30',
    text: 'text-emerald-900',
    textMuted: 'text-emerald-600',
    input: 'bg-emerald-50/50 border-emerald-200',
    inputFocus: 'focus:ring-emerald-500/30 focus:border-emerald-500',
    accent: 'text-emerald-600',
    accentBg: 'bg-emerald-500',
    loginBtn: 'bg-emerald-100 hover:bg-emerald-200 border-emerald-300',
    loginBtnIcon: '#047857',
    // 下拉菜单样式
    menuHover: 'hover:bg-emerald-100',
    primary: 'text-emerald-600',
    // 错误样式
    error: 'bg-red-100 text-red-600',
    errorBorder: 'border-red-300',
    // 警告样式
    warning: 'bg-orange-100',
    warningBorder: 'border-orange-300',
    // 信息样式
    info: 'bg-blue-100',
    infoBorder: 'border-blue-300',
    // 危险按钮样式
    danger: 'bg-red-100 text-red-600',
    dangerHover: 'hover:bg-red-200',
  },
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark')
  const [loaded, setLoaded] = useState(false)

  // 从文件加载设置
  useEffect(() => {
    invoke('get_app_settings').then(settings => {
      if (settings?.theme && themes[settings.theme]) {
        setThemeState(settings.theme)
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  // 保存设置到文件（使用增量更新，只传需要修改的字段）
  const setTheme = (newTheme) => {
    setThemeState(newTheme)
    invoke('save_app_settings', { settings: { theme: newTheme } }).catch(err => {
      console.error('保存主题设置失败:', err)
    })
  }

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark' : ''
  }, [theme])

  const value = {
    theme,
    setTheme,
    colors: themes[theme],
    themes,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
