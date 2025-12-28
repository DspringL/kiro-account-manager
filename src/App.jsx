import { useState, useEffect, lazy, Suspense } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import Sidebar from './components/Sidebar'
import UpdateChecker from './components/UpdateChecker'
import AnnouncementModal from './components/AnnouncementModal'

import { useApp } from './hooks/useApp'
import { useAutoRefresh } from './hooks/useAutoRefresh'
import { useModelLock } from './hooks/useModelLock'
import { useAppSettings } from './contexts/AppSettingsContext'
import { AccountProvider } from './contexts/AccountContext'
import { PrivacyProvider } from './contexts/PrivacyContext'

// 路由级别懒加载，减少首屏加载时间
const Home = lazy(() => import('./components/Home'))
const AccountManager = lazy(() => import('./components/AccountManager/index'))
const Settings = lazy(() => import('./components/Settings'))
const KiroConfig = lazy(() => import('./components/KiroConfig/index'))
const About = lazy(() => import('./components/About'))
const Login = lazy(() => import('./components/Login'))
const WebOAuthLogin = lazy(() => import('./components/WebOAuthLogin'))
const AuthCallback = lazy(() => import('./components/AuthCallback'))

// 页面加载骨架屏
function PageLoading() {
  const { colors } = useApp()
  return (
    <div className={`h-full flex items-center justify-center ${colors.main}`}>
      <div className={`animate-pulse ${colors.textMuted}`}>加载中...</div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeMenu, setActiveMenu] = useState('home')
  const { colors } = useApp()
  const { settings: appSettings, loading: settingsLoading } = useAppSettings()

  // 使用抽离的 hooks
  const { startAutoRefreshTimer } = useAutoRefresh(appSettings, settingsLoading)
  const { checkAndRestoreLockedModel } = useModelLock(appSettings, settingsLoading)

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
      
      // 监听设置变化，重新检查模型
      unlistenAppSettings = await listen('app-settings-changed', () => {
        if (!mounted) return
        console.log('[ModelLock] 设置已变化，重新检查模型')
        checkAndRestoreLockedModel()
      })
    }

    setupListeners()
    
    return () => { 
      mounted = false
      if (unlisten) unlisten()
      if (unlistenSettings) unlistenSettings()
      if (unlistenAppSettings) unlistenAppSettings()
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
    <PrivacyProvider>
      <AccountProvider>
        <div className={`flex h-screen ${colors.main}`}>
          <Sidebar 
            activeMenu={activeMenu} 
            onMenuChange={setActiveMenu}
            user={user}
            onLogout={handleLogout}
          />
          <main className="flex-1 overflow-hidden">
            <Suspense fallback={<PageLoading />}>
              {renderContent()}
            </Suspense>
          </main>
          
          <UpdateChecker />
          <AnnouncementModal />
        </div>
      </AccountProvider>
    </PrivacyProvider>
  )
}

export default App
