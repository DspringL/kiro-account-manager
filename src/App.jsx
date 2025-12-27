import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, emit } from '@tauri-apps/api/event'
import Sidebar from './components/Sidebar'
import Home from './components/Home'
import AccountManager from './components/AccountManager/index'
import Settings from './components/Settings'
import KiroConfig from './components/KiroConfig/index'
import About from './components/About'
import Login from './components/Login'
import WebOAuthLogin from './components/WebOAuthLogin'
import AuthCallback from './components/AuthCallback'
import UpdateChecker from './components/UpdateChecker'


import { useApp } from './hooks/useApp'
import { useAppSettings } from './contexts/AppSettingsContext'
import { AccountProvider } from './contexts/AccountContext'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeMenu, setActiveMenu] = useState('home')
  const { colors } = useApp()
  const { settings: appSettings } = useAppSettings()
  const refreshTimerRef = useRef(null)
  // 使用 ref 保持最新的设置引用，避免闭包捕获旧值
  const appSettingsRef = useRef(appSettings)

  // 常量（与 Kiro 官方一致）
  const REFRESH_BEFORE_EXPIRY_SECONDS = 10 * 60

  // 判断 token 是否在指定秒数内过期（与 Kiro isAuthTokenExpiredWithinSeconds 完全一致）
  const isAuthTokenExpiredWithinSeconds = (acc, seconds) => {
    if (!acc.expiresAt || !acc.accessToken) {
      return true
    }
    const expiresAt = new Date(acc.expiresAt.replace(/\//g, '-'))
    const now = new Date()
    return expiresAt.valueOf() < now.valueOf() + seconds * 1000
  }

  // 判断账号是否需要刷新
  const isExpiringSoon = (acc) => {
    // 跳过已封禁账号
    if (acc.status === 'banned') {
      console.log(`[AutoRefresh] 跳过封禁账号: ${acc.email}`)
      return false
    }
    // 没有过期时间或 accessToken 的不刷新
    if (!acc.expiresAt || !acc.accessToken) {
      console.log(`[AutoRefresh] 跳过无过期时间或 token: ${acc.email}`)
      return false
    }
    const needRefresh = isAuthTokenExpiredWithinSeconds(acc, REFRESH_BEFORE_EXPIRY_SECONDS)
    if (needRefresh) {
      const expiresAt = new Date(acc.expiresAt.replace(/\//g, '-'))
      const timeLeft = Math.round((expiresAt.getTime() - Date.now()) / 1000)
      console.log(`[AutoRefresh] 需要刷新: ${acc.email}, 剩余 ${timeLeft}秒`)
    }
    return needRefresh
  }

  // 启动时只刷新 token（不获取 usage，快速启动）
  // 启动时强制刷新，不检查 autoRefresh 设置
  const refreshExpiredTokensOnly = async () => {
    try {
      // 使用 ref 获取最新设置，避免闭包捕获旧值
      const settings = appSettingsRef.current || {}
      const autoRefreshEnabled = settings.autoRefresh !== false
      console.log('[AutoRefresh] 设置:', { autoRefresh: autoRefreshEnabled, interval: settings.autoRefreshInterval })
      
      const accounts = await invoke('get_accounts')
      console.log('[AutoRefresh] 账号数量:', accounts?.length || 0)
      if (!accounts || accounts.length === 0) return
      
      const expiredAccounts = accounts.filter(isExpiringSoon)
      console.log('[AutoRefresh] 需要刷新的账号:', expiredAccounts.length)
      
      if (expiredAccounts.length === 0) {
        console.log('[AutoRefresh] 没有需要刷新的 token')
        return
      }
      
      console.log(`[AutoRefresh] 刷新 ${expiredAccounts.length} 个过期 token...`)
      
      // 并发刷新
      await Promise.allSettled(
        expiredAccounts.map(async (account) => {
          try {
            await invoke('refresh_account_token', { id: account.id })
            console.log(`[AutoRefresh] ${account.email} token 刷新成功`)
          } catch (e) {
            console.warn(`[AutoRefresh] ${account.email} token 刷新失败:`, e)
          }
        })
      )
      
      console.log('[AutoRefresh] token 刷新完成')
      // 通知 AccountContext 刷新缓存
      emit('accounts-updated')
    } catch (e) {
      console.error('[AutoRefresh] 刷新失败:', e)
    }
  }

  // 检查并恢复锁定的模型
  const checkAndRestoreLockedModel = async () => {
    try {
      // 使用 ref 获取最新设置，避免闭包捕获旧值
      const settings = appSettingsRef.current || {}
      if (!settings.lockModel || !settings.lockedModel) return
      
      const kiroSettings = await invoke('get_kiro_settings').catch(() => ({}))
      const currentModel = kiroSettings.modelSelection
      
      if (currentModel && currentModel !== settings.lockedModel) {
        console.log(`[ModelLock] 检测到模型被修改: ${currentModel} -> 恢复为: ${settings.lockedModel}`)
        await invoke('set_kiro_model', { model: settings.lockedModel })
        console.log('[ModelLock] 模型已恢复')
      }
    } catch (e) {
      console.error('[ModelLock] 检查模型失败:', e)
    }
  }

  // 定时刷新：只刷新 token（复用 isExpiringSoon 判断）
  const checkAndRefreshExpiringTokens = async () => {
    try {
      // 使用 ref 获取最新设置，避免闭包捕获旧值
      const settings = appSettingsRef.current || {}
      // autoRefresh 默认为 true（null/undefined 视为 true）
      if (settings.autoRefresh === false) return
      
      const accounts = await invoke('get_accounts')
      if (!accounts || accounts.length === 0) return
      
      const expiredAccounts = accounts.filter(isExpiringSoon)
      
      if (expiredAccounts.length === 0) {
        console.log('[AutoRefresh] 没有需要刷新的 token')
        return
      }
      
      console.log(`[AutoRefresh] 刷新 ${expiredAccounts.length} 个 token...`)
      
      const results = await Promise.allSettled(
        expiredAccounts.map(async (account) => {
          try {
            const updated = await invoke('refresh_account_token', { id: account.id })
            console.log(`[AutoRefresh] ${account.email} token 刷新成功`)
            return { success: true, account: updated }
          } catch (e) {
            console.warn(`[AutoRefresh] ${account.email} token 刷新失败:`, e)
            return { success: false }
          }
        })
      )
      
      console.log('[AutoRefresh] token 刷新完成')
      // 重新加载账号列表确保前端数据是最新的
      const updatedAccounts = await invoke('get_accounts')
      console.log('[AutoRefresh] 账号列表已更新')
      // 通知 AccountContext 刷新缓存
      emit('accounts-updated')
    } catch (e) {
      console.error('[AutoRefresh] 刷新失败:', e)
    }
  }

  // 启动自动刷新定时器
  const startAutoRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
    }
    
    // 启动时只刷新 token（快速启动）
    refreshExpiredTokensOnly()
    
    // 使用 ref 获取最新设置读取刷新间隔
    const settings = appSettingsRef.current || {}
    const intervalMs = (settings.autoRefreshInterval || 50) * 60 * 1000
    
    console.log(`[AutoRefresh] 定时器间隔: ${settings.autoRefreshInterval || 50} 分钟`)
    refreshTimerRef.current = setInterval(checkAndRefreshExpiringTokens, intervalMs)
  }

  // 模型锁定检查定时器
  const modelLockTimerRef = useRef(null)

  // 同步 appSettings 到 ref
  useEffect(() => {
    appSettingsRef.current = appSettings
  }, [appSettings])
  
  const startModelLockTimer = async () => {
    if (modelLockTimerRef.current) {
      clearInterval(modelLockTimerRef.current)
    }
    
    // 启动时立即检查一次
    checkAndRestoreLockedModel()
    
    // 每 30 秒检查一次
    modelLockTimerRef.current = setInterval(checkAndRestoreLockedModel, 30 * 1000)
  }

  useEffect(() => {
    checkAuth()
    
    // 检查是否是回调页面
    const url = new URL(window.location.href)
    if (url.pathname === '/callback' && (url.searchParams.has('code') || url.searchParams.has('state'))) {
      setActiveMenu('callback')
      return
    }
    
    let unlisten = null
    let unlistenSettings = null
    let unlistenAppSettings = null
    let mounted = true

    const setupListeners = async () => {
      // 监听登录成功事件
      unlisten = await listen('login-success', (event) => {
        if (!mounted) return
        console.log('Login success in App:', event.payload)
        checkAuth()
        setActiveMenu('token')
      })
      
      // 监听设置变化，重启定时器
      unlistenSettings = await listen('settings-changed', () => {
        if (!mounted) return
        console.log('[AutoRefresh] 设置已变化，重启定时器')
        startAutoRefreshTimer()
      })
      
      // 监听设置变化，重启模型锁定检查
      unlistenAppSettings = await listen('app-settings-changed', () => {
        if (!mounted) return
        console.log('[ModelLock] 设置已变化，重新检查模型')
        checkAndRestoreLockedModel()
      })
    }

    setupListeners()
    
    // 启动自动刷新定时器
    startAutoRefreshTimer()
    
    // 启动模型锁定检查定时器
    startModelLockTimer()
    
    return () => { 
      mounted = false
      if (unlisten) unlisten()
      if (unlistenSettings) unlistenSettings()
      if (unlistenAppSettings) unlistenAppSettings()
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
      if (modelLockTimerRef.current) {
        clearInterval(modelLockTimerRef.current)
      }
    }
  }, [])

  const checkAuth = async () => {
    try {
      const currentUser = await invoke('get_current_user')
      setUser(currentUser)
    } catch (e) {
      console.error('Auth check failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = (loggedInUser) => {
    if (loggedInUser) {
      setUser(loggedInUser)
    }
    checkAuth()
  }

  const handleLogout = async () => {
    await invoke('logout')
    setUser(null)
  }

  const renderContent = () => {
    switch (activeMenu) {
      case 'home': return <Home onNavigate={setActiveMenu} />
      case 'token': return <AccountManager />
      case 'kiro-config': return <KiroConfig />
      case 'login': return <Login onLogin={(user) => { handleLogin(user); setActiveMenu('token'); }} />
      case 'web-oauth': return <WebOAuthLogin onLogin={(user) => { handleLogin(user); setActiveMenu('token'); }} />
      case 'callback': return <AuthCallback />
      case 'settings': return <Settings />
      case 'about': return <About />
      default: return <Home />
    }
  }

  if (loading) {
    return (
      <div className="h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    )
  }

  return (
    <AccountProvider>
      <div className={`flex h-screen ${colors.main}`}>
        <Sidebar 
          activeMenu={activeMenu} 
          onMenuChange={setActiveMenu}
          user={user}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-hidden">
          {renderContent()}
        </main>
        
        <UpdateChecker />
      </div>
    </AccountProvider>
  )
}

export default App
