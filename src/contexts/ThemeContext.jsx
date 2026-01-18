import { createContext, useContext, useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { MantineProvider } from '@mantine/core'

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
    btnDisabled: 'bg-gray-100 text-gray-400',
    iconColor: '#1a1a1a',
    // 下拉菜单样式
    menuHover: 'hover:bg-gray-100',
    menuBg: 'bg-white/95',
    menuBorder: 'border-gray-200/80',
    menuDivider: 'border-gray-200',
    primary: 'text-blue-600',
    // 状态徽章
    badgeDisabled: 'bg-gray-200 text-gray-500',
    badgeActive: 'bg-green-50 text-green-600',
    badgeInfo: 'bg-blue-50 text-blue-600',
    badgePurple: 'bg-purple-50 text-purple-600',
    badgeSuccess: 'bg-green-50 text-green-600',
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
    tagActive: 'bg-blue-50',
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
    badgePurple: 'bg-purple-500/20 text-purple-400',
    badgeSuccess: 'bg-green-500/20 text-green-400',
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
    // 通用 hover 背景
    hoverBg: 'hover:bg-white/5',
    // 空状态背景
    emptyBg: 'bg-white/5',
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
    
    // 设置 CSS 变量供 toast 使用
    const root = document.documentElement
    const isLight = theme === 'light' || theme === 'purple' || theme === 'green'
    root.style.setProperty('--toast-bg', isLight ? '#ffffff' : '#1a1a2e')
    root.style.setProperty('--toast-text', isLight ? '#000000' : '#ffffff')
  }, [theme])

  const value = {
    theme,
    setTheme,
    colors: themes[theme],
    themes,
  }

  // 根据主题动态生成 Mantine 配置
  const isLightTheme = theme === 'light' || theme === 'purple' || theme === 'green'
  const mantineTheme = {
    colorScheme: isLightTheme ? 'light' : 'dark',
    colors: {
      dark: [
        '#C1C2C5',
        '#A6A7AB',
        '#909296',
        '#5c5f66',
        '#373A40',
        '#2C2E33',
        '#25262b',
        '#1A1B1E',
        '#141517',
        '#101113',
      ],
    },
    primaryColor: 'blue',
    defaultRadius: 'md',
    components: {
      Select: {
        styles: (theme) => ({
          input: {
            backgroundColor: 'transparent',
            borderColor: isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
            color: 'inherit',
            '&:focus': {
              borderColor: isLightTheme ? '#3b82f6' : '#60a5fa',
            },
          },
          dropdown: {
            backgroundColor: isLightTheme ? '#ffffff' : '#1a1a2e',
            borderColor: isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
          },
          option: {
            color: 'inherit',
            '&[data-combobox-selected]': {
              backgroundColor: isLightTheme ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.2)',
            },
            '&:hover': {
              backgroundColor: isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
            },
          },
        }),
      },
      TextInput: {
        styles: {
          input: {
            backgroundColor: 'transparent',
            borderColor: isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
            color: 'inherit',
            '&:focus': {
              borderColor: isLightTheme ? '#3b82f6' : '#60a5fa',
            },
          },
        },
      },
      Textarea: {
        styles: {
          input: {
            backgroundColor: 'transparent',
            borderColor: isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
            color: 'inherit',
            '&:focus': {
              borderColor: isLightTheme ? '#3b82f6' : '#60a5fa',
            },
          },
        },
      },
      NumberInput: {
        styles: {
          input: {
            backgroundColor: 'transparent',
            borderColor: isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
            color: 'inherit',
            '&:focus': {
              borderColor: isLightTheme ? '#3b82f6' : '#60a5fa',
            },
          },
        },
      },
      Switch: {
        styles: {
          track: {
            cursor: 'pointer',
          },
        },
      },
      Card: {
        styles: {
          root: {
            backgroundColor: isLightTheme ? '#ffffff' : 'rgba(30, 30, 50, 0.8)',
            borderColor: isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)',
          },
        },
      },
    },
  }

  return (
    <ThemeContext.Provider value={value}>
      <MantineProvider theme={mantineTheme}>
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
