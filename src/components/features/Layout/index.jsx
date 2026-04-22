import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { User, Sun, Moon, Palette } from 'lucide-react'
import { Button } from '../../ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip'
import { cn } from '../../../lib/utils'
import { themes } from '../../../contexts/ThemeContext'
import { useApp } from '../../../hooks/useApp'
import { routes } from '../../../routes'
import { isLightTheme as checkIsLightTheme } from '../KiroConfig/themeAccent'

function useMenuItems() {
  const { t } = useApp()
  return routes.map(r => ({
    id: r.id,
    icon: r.icon,
    label: r.label || t(r.nameKey),
    desc: r.descKey ? t(r.descKey) : undefined,
  }))
}

function Sidebar({ activeMenu, onMenuChange }) {
  const [localToken, setLocalToken] = useState(null)
  const [version, setVersion] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const { t, theme, colors, setTheme } = useApp()
  const menuItems = useMenuItems()
  const isLightTheme = checkIsLightTheme(theme)

  useEffect(() => {
    invoke('get_kiro_local_token').then(setLocalToken).catch(() => {})
    getVersion().then(setVersion)
    // 从 localStorage 读取折叠状态
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  // 保存折叠状态
  const toggleCollapsed = () => {
    const newState = !collapsed
    setCollapsed(newState)
    localStorage.setItem('sidebar-collapsed', String(newState))
  }

  const themeIcons = { light: Sun, dark: Moon, purple: Palette, green: Palette }
  const ThemeIcon = themeIcons[theme] || Sun
  
  // 主题循环切换
  const themeOrder = ['light', 'dark', 'purple', 'green']
  const handleThemeClick = () => {
    const currentIndex = themeOrder.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themeOrder.length
    setTheme(themeOrder[nextIndex])
  }

  return (
    <div
      className={cn("flex flex-col relative transition-all duration-300", colors.sidebar)}
      style={{ width: collapsed ? 64 : 224 }}
    >
      {/* Logo - 双击折叠 */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn("cursor-pointer select-none", collapsed ? "p-2" : "p-4", "pb-3")}
              onDoubleClick={toggleCollapsed}
            >
              <div
                className={cn(
                  "flex items-center mb-2 animate-fade-in-up",
                  collapsed ? "justify-center gap-0" : "justify-start gap-2"
                )}
                style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-sm transition-transform hover:scale-105 flex-shrink-0", colors.sidebarCard || "bg-white/20")}>
                  <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                    <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="currentColor" className={colors.sidebarText || "text-white"}/>
                  </svg>
                </div>
                {!collapsed && (
                  <div className="flex flex-col gap-0">
                    <span className={cn("text-lg font-bold tracking-wider", colors.sidebarText || "text-white/95")}>KIRO</span>
                    <span className={cn("text-xs", colors.sidebarMuted || "text-white/60")}>Account Manager</span>
                  </div>
                )}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Menu */}
      <div className={cn("flex flex-col gap-1 flex-1 overflow-auto", collapsed ? "px-2" : "px-3")}>
        {menuItems.map((item, index) => {
          const Icon = item.icon
          const isActive = activeMenu === item.id
          return (
            <TooltipProvider key={item.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onMenuChange(item.id)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all animate-slide-in-left",
                      !isActive && (colors.sidebarText || "text-white/90"),
                      !isActive && (colors.sidebarHover || "hover:text-white hover:bg-white/10"),
                      isActive && (colors.sidebarActive || "bg-white/15 font-medium text-white"),
                      !isActive && "font-normal"
                    )}
                    style={{
                      animationDelay: `${0.15 + index * 0.05}s`,
                      animationFillMode: 'both'
                    }}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    {!collapsed && (
                      <>
                        <div className="flex-1 text-left">
                          <div className="text-sm">{item.label}</div>
                          {item.desc && <div className={cn("text-xs", colors.sidebarMuted || "text-white/60")}>{item.desc}</div>}
                        </div>
                        {isActive && (
                          <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-current opacity-80" />
                        )}
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>

      {/* Kiro IDE 本地连接状态 */}
      {localToken && !collapsed && (
        <div
          className={cn("mx-3 mb-3 p-3 rounded-xl backdrop-blur-sm animate-fade-in-up", colors.sidebarCard || "bg-white/15")}
          style={{ animationDelay: '0.5s', animationFillMode: 'both' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="relative">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
            </div>
            <span className={cn("text-xs", colors.sidebarText || "text-white/90")}>{t('nav.kiroConnected')}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/25 flex items-center justify-center transition-transform hover:scale-105 text-green-600 dark:text-green-400">
              <User size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-xs font-medium truncate", colors.sidebarText || "text-white")}>
                {localToken.provider || 'Local'}
              </div>
              <div className={cn("text-xs", colors.sidebarMuted || "text-white/70")}>
                {localToken.expiresAt ? new Date(localToken.expiresAt).toLocaleTimeString() : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 折叠状态下的连接指示器 */}
      {localToken && collapsed && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mx-2 mb-3 flex justify-center">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">{t('nav.kiroConnected')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Theme & Version */}
      <div className={cn("px-3 pb-3 flex items-center gap-2", collapsed ? "flex-col" : "justify-between")}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleThemeClick}
                className={cn("transition-transform hover:scale-105", colors.sidebarCard || "bg-white/10", colors.sidebarText || "text-white", colors.sidebarHover || "hover:bg-white/20 hover:text-white")}
              >
                <ThemeIcon size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "top"}>
              {t(themes[theme]?.nameKey || 'theme.light')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {!collapsed && (
          <span className={cn("text-xs ml-auto", colors.sidebarMuted || "text-white/70")}>v{version || '...'}</span>
        )}
      </div>
    </div>
  )
}

export default Sidebar
