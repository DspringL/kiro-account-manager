import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
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
import Watermark from './components/Watermark'

import { useApp } from './hooks/useApp'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeMenu, setActiveMenu] = useState('home')
  const { colors } = useApp()
  const refreshTimerRef = useRef(null)

  // 判断账号是否需要刷新（已过期或5分钟内过期）
  const isExpiringSoon = (acc) => {
    // 跳过已封禁账号
    if (acc.status === 'banned') {
      console.log(`[AutoRefresh] 跳过封禁账号: ${acc.email}`)
      return false
    }
    // 没有过期时间的不刷新
    if (!acc.expiresAt) {
      console.log(`[AutoRefresh] 跳过无过期时间: ${acc.email}`)
      return false
    }
    try {
      const expiresAt = new Date(acc.expiresAt.replace(/\//g, '-'))
      // 检查日期是否有效
      if (isNaN(expiresAt.getTime())) {
        console.log(`[AutoRefresh] 跳过无效日期: ${acc.email}`)
        return false
      }
      const timeLeft = expiresAt.getTime() - Date.now()
      const needRefresh = timeLeft < 5 * 60 * 1000
      if (needRefresh) {
        console.log(`[AutoRefresh] 需要刷新: ${acc.email}, 剩余 ${Math.round(timeLeft / 1000)}秒`)
      }
      return needRefresh
    } catch {
      return false
    }
  }

  // 启动时只刷新 token（不获取 usage，快速启动）
  // 启动时强制刷新，不检查 autoRefresh 设置
  const refreshExpiredTokensOnly = async () => {
    try {
      const settings = await invoke('get_app_settings').catch(() => ({}))
      // autoRefresh 默认为 true（null/undefined 视为 true）
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
    } catch (e) {
      console.error('[AutoRefresh] 刷新失败:', e)
    }
  }

  // 检查并恢复锁定的模型
  const checkAndRestoreLockedModel = async () => {
    try {
      const appSettings = await invoke('get_app_settings').catch(() => ({}))
      if (!appSettings.lockModel || !appSettings.lockedModel) return
      
      const kiroSettings = await invoke('get_kiro_settings').catch(() => ({}))
      const currentModel = kiroSettings.modelSelection
      
      if (currentModel && currentModel !== appSettings.lockedModel) {
        console.log(`[ModelLock] 检测到模型被修改: ${currentModel} -> 恢复为: ${appSettings.lockedModel}`)
        await invoke('set_kiro_model', { model: appSettings.lockedModel })
        console.log('[ModelLock] 模型已恢复')
      }
    } catch (e) {
      console.error('[ModelLock] 检查模型失败:', e)
    }
  }

  // 定时刷新：只刷新 token（复用 isExpiringSoon 判断）
  const checkAndRefreshExpiringTokens = async () => {
    try {
      const settings = await invoke('get_app_settings').catch(() => ({}))
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
    } catch (e) {
      console.error('[AutoRefresh] 刷新失败:', e)
    }
  }

  // 启动自动刷新定时器
  const startAutoRefreshTimer = async () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
    }
    
    // 启动时只刷新 token（快速启动）
    refreshExpiredTokensOnly()
    
    // 从设置读取刷新间隔
    const settings = await invoke('get_app_settings').catch(() => ({}))
    const intervalMs = (settings.autoRefreshInterval || 50) * 60 * 1000
    
    console.log(`[AutoRefresh] 定时器间隔: ${settings.autoRefreshInterval || 50} 分钟`)
    refreshTimerRef.current = setInterval(checkAndRefreshExpiringTokens, intervalMs)
  }

  // 模型锁定检查定时器
  const modelLockTimerRef = useRef(null)
  
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
    
    // 监听登录成功事件
    const unlisten = listen('login-success', (event) => {
      console.log('Login success in App:', event.payload)
      checkAuth()
      setActiveMenu('token')
    })
    
    // 监听设置变化，重启定时器
    const unlistenSettings = listen('settings-changed', () => {
      console.log('[AutoRefresh] 设置已变化，重启定时器')
      startAutoRefreshTimer()
    })
    
    // 启动自动刷新定时器
    startAutoRefreshTimer()
    
    // 启动模型锁定检查定时器
    startModelLockTimer()
    
    // 监听设置变化，重启模型锁定检查
    const unlistenAppSettings = listen('app-settings-changed', () => {
      console.log('[ModelLock] 设置已变化，重新检查模型')
      checkAndRestoreLockedModel()
    })
    
    return () => { 
      unlisten.then(fn => fn())
      unlistenSettings.then(fn => fn())
      unlistenAppSettings.then(fn => fn())
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
      <Watermark />
    </div>
  )
}

export default App
