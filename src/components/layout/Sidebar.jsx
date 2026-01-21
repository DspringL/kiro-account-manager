import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { User, Sun, Moon, Palette } from 'lucide-react'
import { NavLink, Tooltip, Text, Group, Stack, Box, ActionIcon, Paper, Indicator } from '@mantine/core'
import { themes } from '../../contexts/ThemeContext'
import { useApp } from '../../hooks/useApp'
import { routes } from '../../routes'

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
    <Box
      className={colors.sidebar}
      style={{
        width: collapsed ? 64 : 224,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'width 300ms ease',
      }}
    >
      {/* Logo - 双击折叠 */}
      <Tooltip label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')} position="right">
        <Box
          p={collapsed ? 'xs' : 'md'}
          pb="sm"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onDoubleClick={toggleCollapsed}
        >
          <Group
            gap={collapsed ? 0 : 'sm'}
            justify={collapsed ? 'center' : 'flex-start'}
            mb="xs"
            style={{
              animation: 'fadeInUp 0.5s ease-out',
              animationDelay: '0.1s',
              animationFillMode: 'both',
            }}
          >
            <Box
              style={{
                width: 40,
                height: 40,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(8px)',
                transition: 'transform 200ms ease',
                flexShrink: 0,
              }}
              className="hover-scale"
            >
              <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
              </svg>
            </Box>
            {!collapsed && (
              <Stack gap={0}>
                <Text fw={700} size="lg" style={{ letterSpacing: '0.05em', color: 'rgba(255, 255, 255, 0.95)' }}>
                  KIRO
                </Text>
                <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  Account Manager
                </Text>
              </Stack>
            )}
          </Group>
        </Box>
      </Tooltip>

      {/* Menu */}
      <Stack
        gap="xs"
        px={collapsed ? 'xs' : 'sm'}
        style={{ flex: 1, overflow: 'auto' }}
      >
        {menuItems.map((item, index) => {
          const Icon = item.icon
          const isActive = activeMenu === item.id
          return (
            <Tooltip key={item.id} label={collapsed ? item.label : null} position="right" disabled={!collapsed}>
              <NavLink
                onClick={() => onMenuChange(item.id)}
                active={isActive}
                label={!collapsed && item.label}
                description={!collapsed && item.desc}
                leftSection={<Icon size={18} strokeWidth={isActive ? 2.5 : 2} />}
                rightSection={
                  isActive && !collapsed && (
                    <Box
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      }}
                    />
                  )
                }
                style={{
                  borderRadius: 12,
                  animation: 'slideInLeft 0.5s ease-out',
                  animationDelay: `${0.15 + index * 0.05}s`,
                  animationFillMode: 'both',
                  fontWeight: isActive ? 500 : 400,
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                }}
                styles={{
                  root: {
                    color: 'rgba(255, 255, 255, 0.9)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 1)',
                    },
                  },
                  label: {
                    color: 'inherit',
                    fontWeight: 'inherit',
                  },
                  description: {
                    color: 'rgba(255, 255, 255, 0.6)',
                  },
                  section: {
                    color: 'inherit',
                  },
                }}
              />
            </Tooltip>
          )
        })}
      </Stack>

      {/* Kiro IDE 本地连接状态 */}
      {localToken && !collapsed && (
        <Paper
          radius="md"
          p="sm"
          mx="sm"
          mb="sm"
          style={{
            animation: 'fadeInUp 0.5s ease-out',
            animationDelay: '0.5s',
            animationFillMode: 'both',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Group gap="xs" mb="xs">
            <Indicator color="green" processing size={6} />
            <Text size="xs" style={{ color: 'white', opacity: 0.9 }}>
              {t('nav.kiroConnected')}
            </Text>
          </Group>
          <Group gap="sm">
            <Box
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(34, 197, 94, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                transition: 'transform 200ms ease',
              }}
              className="hover-scale"
            >
              <User size={14} />
            </Box>
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
              <Text size="xs" fw={500} truncate c="white">
                {localToken.provider || 'Local'}
              </Text>
              <Text size="xs" c="white" opacity={0.7}>
                {localToken.expiresAt ? new Date(localToken.expiresAt).toLocaleTimeString() : ''}
              </Text>
            </Stack>
          </Group>
        </Paper>
      )}

      {/* 折叠状态下的连接指示器 */}
      {localToken && collapsed && (
        <Tooltip label={t('nav.kiroConnected')} position="right">
          <Box mx="xs" mb="sm" style={{ display: 'flex', justifyContent: 'center' }}>
            <Indicator color="green" processing size={8} />
          </Box>
        </Tooltip>
      )}

      {/* Theme & Version */}
      <Group
        px="sm"
        pb="sm"
        gap="xs"
        justify={collapsed ? 'center' : 'space-between'}
        style={{ flexDirection: collapsed ? 'column' : 'row' }}
      >
        {/* 主题切换 */}
        <Tooltip label={t(themes[theme]?.nameKey || 'theme.light')} position={collapsed ? 'right' : 'top'}>
          <ActionIcon
            variant="subtle"
            radius="md"
            size="md"
            onClick={handleThemeClick}
            style={{
              transition: 'transform 200ms ease',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
            }}
            className="hover-scale"
          >
            <ThemeIcon size={16} />
          </ActionIcon>
        </Tooltip>
        
        {!collapsed && (
          <Text size="xs" c="white" opacity={0.7} style={{ marginLeft: 'auto' }}>
            v{version || '...'}
          </Text>
        )}
      </Group>
    </Box>
  )
}

export default Sidebar
