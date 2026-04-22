import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useTheme as useNextTheme } from 'next-themes'
import { isLightTheme as checkIsLightTheme } from '../utils/themeMode'

const ThemeContext = createContext()

export const themes = {
  light: {
    nameKey: 'theme.light',
    sidebar: 'bg-gradient-to-b from-slate-100 to-slate-200',
    sidebarText: 'text-slate-800',
    sidebarHover: 'hover:bg-slate-300',
    sidebarActive: 'bg-slate-800 text-white',
    sidebarBorder: 'border-slate-300',
    sidebarMuted: 'text-slate-600',
    sidebarCard: 'bg-slate-200',
    main: 'glass-main',
    card: 'bg-white/80 backdrop-blur-md',
    cardBorder: 'border-gray-200/50',
    cardHover: 'hover:bg-gray-50/80',
    cardSecondary: 'bg-gray-50/30',
    text: 'text-gray-800',
    textMuted: 'text-gray-500',
    input: 'bg-white/50 border-gray-200',
    inputFocus: 'focus:ring-slate-500/20 focus:border-slate-500',
    btnPrimary: 'bg-slate-700 hover:bg-slate-800 text-white',
    btnSecondary: 'bg-gray-100/80 hover:bg-gray-200 border-gray-300 text-gray-700',
    btnDisabled: 'bg-gray-100 text-gray-400',
    iconColor: '#1a1a1a',
    // 下拉菜单样式
    menuHover: 'hover:bg-gray-100',
    menuBg: 'bg-white/95',
    menuBorder: 'border-gray-200/80',
    menuDivider: 'border-gray-200',
    primary: 'text-slate-600',
    // 状态徽章
    badgeDisabled: 'bg-gray-200 text-gray-500',
    badgeActive: 'bg-green-50 text-green-600',
    badgeInfo: 'bg-blue-100 text-blue-600',
    badgeSuccess: 'bg-green-100 text-green-600',
    badgePurple: 'bg-purple-100 text-purple-600',
    badgeWarning: 'bg-orange-100 text-orange-600',
    badgeCyan: 'bg-cyan-100 text-cyan-600',
    // 开关按钮
    toggleOff: 'bg-gray-300',
    toggleOn: 'bg-green-500',
    toggleThumb: 'bg-white',
    // 代码块
    codeBlock: 'bg-gray-100 text-gray-700',
    // 分隔线
    divider: 'border-gray-200',
    // 标签选择器
    tagActive: 'bg-slate-50',
    tagHover: 'hover:bg-gray-50',
    // 对话框
    dialogHeader: 'bg-gray-50/50',
    dialogFooter: 'bg-gray-50/80 border-t border-gray-100',
    // 虚线边框
    dashedBorder: 'border-gray-300',
    dashedBorderHover: 'hover:border-gray-400 hover:bg-gray-50',
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
    // 卡片状态样式
    cardSelected: 'border-purple-400 bg-purple-50',
    cardCurrent: 'border-green-400 bg-green-50/50',
    cardBanned: 'border-red-300 bg-red-50/50',
    cardWarning: 'border-orange-300 bg-orange-50/50',
    cardNormal: 'border-gray-200 bg-white/60 backdrop-blur-sm hover:border-gray-300',
    cardGlowCurrent: 'shadow-green-500/30 hover:shadow-green-500/50',
    cardGlowBanned: 'shadow-red-500/30 hover:shadow-red-500/50',
    cardGlowWarning: 'shadow-orange-500/30 hover:shadow-orange-500/50',
    // 提供商徽章
    providerGoogle: 'bg-red-100 text-red-600',
    providerGithub: 'bg-gray-200 text-gray-700',
    providerBuilderId: 'bg-orange-100 text-orange-600',
    providerEnterprise: 'bg-orange-100 text-orange-600',
    providerDefault: 'bg-gray-100 text-gray-500',
    // 机器码样式
    machineIdText: 'text-red-600',
    machineIdTextSecondary: 'text-red-700',
    machineIdIcon: 'text-red-500',
    // 快捷操作按钮
    actionView: 'text-purple-600',
    actionRefresh: 'text-blue-600',
    actionSwitch: 'text-green-600',
    // 配额百分比颜色
    quotaHigh: 'text-red-500',
    quotaMedium: 'text-yellow-500',
    quotaLow: 'text-green-500',
    // 日期信息颜色
    dateReset: 'text-gray-500',
    dateTrial: 'text-purple-500',
    dateBonus: 'text-amber-500',
    dateExpired: 'text-red-500',
    // 图标颜色
    iconSuccess: 'text-green-500',
    iconError: 'text-red-500',
    // 状态图标背景
    statusSuccessBg: 'bg-green-500',
    statusErrorBg: 'bg-red-500',
    statusLoadingBorder: 'border-slate-500',
    // Ring 颜色
    ringColor: 'ring-black/5',
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
    main: 'glass-main',
    card: 'bg-white/5 backdrop-blur-md',
    cardBorder: 'border-white/10',
    cardHover: 'hover:bg-white/10',
    cardSecondary: 'bg-white/[0.05]',
    text: 'text-gray-100',
    textMuted: 'text-gray-400',
    input: 'bg-white/5 border-gray-700',
    inputFocus: 'focus:ring-blue-500/30 focus:border-blue-500',
    btnPrimary: 'bg-blue-500 hover:bg-blue-600 text-white',
    btnSecondary: 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300',
    btnDisabled: 'bg-white/5 text-gray-500',
    iconColor: 'white',
    // 下拉菜单样式
    menuHover: 'hover:bg-white/10',
    menuBg: 'bg-gray-800/95',
    menuBorder: 'border-gray-600/50',
    menuDivider: 'border-gray-600/50',
    primary: 'text-blue-400',
    // 状态徽章
    badgeDisabled: 'bg-gray-500/30 text-gray-400',
    badgeActive: 'bg-green-500/20 text-green-400',
    badgeInfo: 'bg-blue-500/20 text-blue-400',
    badgeSuccess: 'bg-green-500/20 text-green-400',
    badgePurple: 'bg-purple-500/20 text-purple-400',
    badgeWarning: 'bg-orange-500/20 text-orange-400',
    badgeCyan: 'bg-cyan-500/20 text-cyan-400',
    // 开关按钮
    toggleOff: 'bg-gray-600',
    toggleOn: 'bg-green-500',
    toggleThumb: 'bg-gray-200',
    // 代码块
    codeBlock: 'bg-white/5 text-gray-300',
    // 分隔线
    divider: 'border-white/10',
    // 标签选择器
    tagActive: 'bg-white/10',
    tagHover: 'hover:bg-white/5',
    // 对话框
    dialogHeader: 'bg-white/5',
    dialogFooter: 'bg-white/[0.02] border-t border-white/5',
    // 虚线边框
    dashedBorder: 'border-gray-700',
    dashedBorderHover: 'hover:border-gray-500 hover:bg-white/5',
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
    // 卡片状态样式
    cardSelected: 'border-purple-500 bg-purple-500/10',
    cardCurrent: 'border-green-500/50 bg-green-500/5',
    cardBanned: 'border-red-500/50 bg-red-500/5',
    cardWarning: 'border-orange-500/50 bg-orange-500/5',
    cardNormal: 'border-white/10 bg-white/5 backdrop-blur-md hover:border-white/20',
    cardGlowCurrent: 'shadow-green-500/30 hover:shadow-green-500/50',
    cardGlowBanned: 'shadow-red-500/30 hover:shadow-red-500/50',
    cardGlowWarning: 'shadow-orange-500/30 hover:shadow-orange-500/50',
    // 提供商徽章
    providerGoogle: 'bg-red-500/20 text-red-400',
    providerGithub: 'bg-gray-600 text-gray-200',
    providerBuilderId: 'bg-orange-500/20 text-orange-400',
    providerEnterprise: 'bg-orange-500/20 text-orange-400',
    providerDefault: 'bg-gray-700 text-gray-400',
    // 机器码样式
    machineIdText: 'text-red-400',
    machineIdTextSecondary: 'text-red-300',
    machineIdIcon: 'text-red-400',
    // 快捷操作按钮
    actionView: 'text-purple-400',
    actionRefresh: 'text-blue-400',
    actionSwitch: 'text-green-400',
    // 配额百分比颜色
    quotaHigh: 'text-red-500',
    quotaMedium: 'text-yellow-500',
    quotaLow: 'text-green-500',
    // 日期信息颜色
    dateReset: 'text-gray-400',
    dateTrial: 'text-purple-400',
    dateBonus: 'text-amber-400',
    dateExpired: 'text-red-400',
    // 图标颜色
    iconSuccess: 'text-green-500',
    iconError: 'text-red-500',
    // 状态图标背景
    statusSuccessBg: 'bg-green-500',
    statusErrorBg: 'bg-red-500',
    statusLoadingBorder: 'border-blue-400',
    // Ring 颜色
    ringColor: 'ring-white/10',
  },
  purple: {
    nameKey: 'theme.purple',
    sidebarText: 'text-purple-900',
    sidebarHover: 'hover:bg-purple-100/50',
    sidebarActive: 'bg-purple-600 text-white',
    sidebarBorder: 'border-purple-200',
    sidebarMuted: 'text-purple-600/80',
    sidebarCard: 'bg-purple-100/50',
    main: 'glass-main',
    card: 'bg-white/80 backdrop-blur-md',
    cardBorder: 'border-purple-200/50',
    cardHover: 'hover:bg-purple-50/80',
    cardSecondary: 'bg-purple-50/30',
    text: 'text-purple-900',
    textMuted: 'text-purple-500',
    input: 'bg-white/50 border-purple-200',
    inputFocus: 'focus:ring-purple-500/30 focus:border-purple-500',
    btnPrimary: 'bg-purple-500 hover:bg-purple-600 text-white',
    btnSecondary: 'bg-purple-100/80 hover:bg-purple-200 border-purple-300 text-purple-700',
    accent: 'text-purple-600',
    accentBg: 'bg-purple-500',
    loginBtn: 'bg-purple-100 hover:bg-purple-200 border-purple-300',
    loginBtnIcon: '#6d28d9',
    // 下拉菜单样式
    menuHover: 'hover:bg-purple-100',
    primary: 'text-purple-600',
    // 状态徽章
    badgeDisabled: 'bg-gray-200 text-gray-500',
    badgeActive: 'bg-green-100 text-green-600',
    badgeInfo: 'bg-blue-100 text-blue-600',
    badgeSuccess: 'bg-green-100 text-green-600',
    badgePurple: 'bg-purple-100 text-purple-600',
    badgeWarning: 'bg-orange-100 text-orange-600',
    badgeCyan: 'bg-cyan-100 text-cyan-600',
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
    // 卡片状态样式
    cardSelected: 'border-purple-400 bg-purple-50',
    cardCurrent: 'border-green-400 bg-green-50/50',
    cardBanned: 'border-red-300 bg-red-50/50',
    cardWarning: 'border-orange-300 bg-orange-50/50',
    cardNormal: 'border-purple-200/50 bg-white/60 backdrop-blur-sm hover:border-purple-300',
    cardGlowCurrent: 'shadow-green-500/30 hover:shadow-green-500/50',
    cardGlowBanned: 'shadow-red-500/30 hover:shadow-red-500/50',
    cardGlowWarning: 'shadow-orange-500/30 hover:shadow-orange-500/50',
    // 提供商徽章
    providerGoogle: 'bg-red-100 text-red-600',
    providerGithub: 'bg-gray-200 text-gray-700',
    providerBuilderId: 'bg-orange-100 text-orange-600',
    providerEnterprise: 'bg-orange-100 text-orange-600',
    providerDefault: 'bg-gray-100 text-gray-500',
    // 机器码样式
    machineIdText: 'text-red-600',
    machineIdTextSecondary: 'text-red-700',
    machineIdIcon: 'text-red-500',
    // 快捷操作按钮
    actionView: 'text-purple-600',
    actionRefresh: 'text-blue-600',
    actionSwitch: 'text-green-600',
    // 配额百分比颜色
    quotaHigh: 'text-red-500',
    quotaMedium: 'text-yellow-500',
    quotaLow: 'text-green-500',
    // 日期信息颜色
    dateReset: 'text-gray-500',
    dateTrial: 'text-purple-500',
    dateBonus: 'text-amber-500',
    dateExpired: 'text-red-500',
    // 图标颜色
    iconSuccess: 'text-green-500',
    iconError: 'text-red-500',
    // 状态图标背景
    statusSuccessBg: 'bg-green-500',
    statusErrorBg: 'bg-red-500',
    statusLoadingBorder: 'border-purple-500',
    // Ring 颜色
    ringColor: 'ring-black/5',
  },
  green: {
    nameKey: 'theme.green',
    sidebarText: 'text-emerald-900',
    sidebarHover: 'hover:bg-emerald-100/50',
    sidebarActive: 'bg-emerald-600 text-white',
    sidebarBorder: 'border-emerald-200',
    sidebarMuted: 'text-emerald-600/80',
    sidebarCard: 'bg-emerald-100/50',
    main: 'glass-main',
    card: 'bg-white/80 backdrop-blur-md',
    cardBorder: 'border-emerald-200/50',
    cardHover: 'hover:bg-emerald-50/80',
    cardSecondary: 'bg-emerald-50/30',
    text: 'text-emerald-900',
    textMuted: 'text-emerald-600',
    input: 'bg-white/50 border-emerald-200',
    inputFocus: 'focus:ring-emerald-500/30 focus:border-emerald-500',
    btnPrimary: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    btnSecondary: 'bg-emerald-100/80 hover:bg-emerald-200 border-emerald-300 text-emerald-700',
    accent: 'text-emerald-600',
    accentBg: 'bg-emerald-500',
    loginBtn: 'bg-emerald-100 hover:bg-emerald-200 border-emerald-300',
    loginBtnIcon: '#047857',
    // 下拉菜单样式
    menuHover: 'hover:bg-emerald-100',
    primary: 'text-emerald-600',
    // 状态徽章
    badgeDisabled: 'bg-gray-200 text-gray-500',
    badgeActive: 'bg-green-100 text-green-600',
    badgeInfo: 'bg-blue-100 text-blue-600',
    badgeSuccess: 'bg-green-100 text-green-600',
    badgePurple: 'bg-purple-100 text-purple-600',
    badgeWarning: 'bg-orange-100 text-orange-600',
    badgeCyan: 'bg-cyan-100 text-cyan-600',
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
    // 卡片状态样式
    cardSelected: 'border-purple-400 bg-purple-50',
    cardCurrent: 'border-green-400 bg-green-50/50',
    cardBanned: 'border-red-300 bg-red-50/50',
    cardWarning: 'border-orange-300 bg-orange-50/50',
    cardNormal: 'border-emerald-200/50 bg-white/60 backdrop-blur-sm hover:border-emerald-300',
    cardGlowCurrent: 'shadow-green-500/30 hover:shadow-green-500/50',
    cardGlowBanned: 'shadow-red-500/30 hover:shadow-red-500/50',
    cardGlowWarning: 'shadow-orange-500/30 hover:shadow-orange-500/50',
    // 提供商徽章
    providerGoogle: 'bg-red-100 text-red-600',
    providerGithub: 'bg-gray-200 text-gray-700',
    providerBuilderId: 'bg-orange-100 text-orange-600',
    providerEnterprise: 'bg-orange-100 text-orange-600',
    providerDefault: 'bg-gray-100 text-gray-500',
    // 机器码样式
    machineIdText: 'text-red-600',
    machineIdTextSecondary: 'text-red-700',
    machineIdIcon: 'text-red-500',
    // 快捷操作按钮
    actionView: 'text-purple-600',
    actionRefresh: 'text-blue-600',
    actionSwitch: 'text-green-600',
    // 配额百分比颜色
    quotaHigh: 'text-red-500',
    quotaMedium: 'text-yellow-500',
    quotaLow: 'text-green-500',
    // 日期信息颜色
    dateReset: 'text-gray-500',
    dateTrial: 'text-purple-500',
    dateBonus: 'text-amber-500',
    dateExpired: 'text-red-500',
    // 图标颜色
    iconSuccess: 'text-green-500',
    iconError: 'text-red-500',
    // 状态图标背景
    statusSuccessBg: 'bg-green-500',
    statusErrorBg: 'bg-red-500',
    statusLoadingBorder: 'border-purple-500',
    // Ring 颜色
    ringColor: 'ring-black/5',
  },
}

const lightBase = themes.light
const darkBase = themes.dark

Object.assign(themes, {
  'dark-one': { ...darkBase, nameKey: 'theme.darkOne', main: 'bg-transparent', sidebar: 'bg-gradient-to-b from-[#1b1e23] to-[#121418]' },
  tech: { ...darkBase, nameKey: 'theme.tech', main: 'bg-transparent', sidebar: 'bg-gradient-to-b from-[#0f172a] to-[#0b1120]', btnPrimary: 'bg-blue-600 hover:bg-blue-700 text-white' },
  business: { ...lightBase, nameKey: 'theme.business', main: 'bg-transparent', sidebar: 'bg-gradient-to-b from-amber-100 to-orange-100', btnPrimary: 'bg-amber-600 hover:bg-amber-700 text-white' },
  sunset: { ...lightBase, nameKey: 'theme.sunset', main: 'bg-transparent', sidebar: 'bg-gradient-to-b from-orange-100 to-red-100', btnPrimary: 'bg-orange-600 hover:bg-orange-700 text-white' },
  ocean: { ...lightBase, nameKey: 'theme.ocean', main: 'bg-transparent', sidebar: 'bg-gradient-to-b from-cyan-100 to-blue-100', btnPrimary: 'bg-cyan-600 hover:bg-cyan-700 text-white' },
  rose: { ...lightBase, nameKey: 'theme.rose', main: 'bg-transparent', sidebar: 'bg-gradient-to-b from-pink-100 to-rose-100', btnPrimary: 'bg-pink-600 hover:bg-pink-700 text-white' },
  aurora: { ...lightBase, nameKey: 'theme.aurora', main: 'bg-transparent', sidebar: 'bg-gradient-to-b from-teal-100 to-emerald-100', btnPrimary: 'bg-teal-600 hover:bg-teal-700 text-white' }
})

export function ThemeProvider({ children }) {
  const { theme: nextTheme, setTheme: setNextTheme } = useNextTheme()
  const hasLoadedInitialThemeRef = useRef(false)
  const hasPersistedInitialThemeRef = useRef(false)
  const theme = themes[nextTheme] ? nextTheme : 'dark'

  useEffect(() => {
    if (hasLoadedInitialThemeRef.current) {
      return
    }

    let cancelled = false

    invoke('get_app_settings')
      .then(settings => {
        if (cancelled) {
          return
        }

        const savedTheme = settings?.theme
        if (savedTheme && themes[savedTheme]) {
          setNextTheme(savedTheme)
        }
        hasLoadedInitialThemeRef.current = true
      })
      .catch(() => {
        hasLoadedInitialThemeRef.current = true
      })

    return () => {
      cancelled = true
    }
  }, [])

  const setTheme = (newTheme) => {
    if (!themes[newTheme]) {
      return
    }
    hasPersistedInitialThemeRef.current = true
    setNextTheme(newTheme)
  }

  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    root.setAttribute('data-theme', theme)
    body.setAttribute('data-theme', theme)
    const isLight = checkIsLightTheme(theme)
    root.classList.toggle('dark', !isLight)
    body.classList.toggle('dark', !isLight)    
    // 设置 CSS 变量供 toast 使用
    root.style.setProperty('--toast-bg', isLight ? '#ffffff' : '#1a1a2e')
    root.style.setProperty('--toast-text', isLight ? '#000000' : '#ffffff')
  }, [theme])

  useEffect(() => {
    if (!hasLoadedInitialThemeRef.current) {
      return
    }
    if (!themes[theme]) {
      return
    }
    if (!hasPersistedInitialThemeRef.current) {
      hasPersistedInitialThemeRef.current = true
    }

    invoke('save_app_settings', { settings: { theme } }).catch(err => {
      console.error('保存主题设置失败:', err)
    })
  }, [theme])

  const value = useMemo(() => ({
    theme,
    setTheme,
    colors: themes[theme],
    themes,
  }), [theme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
