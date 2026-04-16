import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { calcAccountStats, getQuota, getUsed } from '../utils/accountStats'

const AccountContext = createContext(null)

export function AccountProvider({ children }) {
  const [accounts, setAccounts] = useState([])
  const [localToken, setLocalToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setError(null)
      const [accountsData, localData] = await Promise.all([
        invoke('get_accounts'),
        invoke('get_kiro_local_token').catch(() => null)
      ])
      setAccounts(accountsData || [])
      setLocalToken(localData)
    } catch (e) {
      setError(e)
    }
  }, [])

  // 初始加载 + 监听事件
  useEffect(() => {
    // 使用 ref 存储 unlisten 函数，避免闭包问题
    let unlistenLogin = null
    let unlistenAccounts = null
    let mounted = true
    
    const setup = async () => {
      // 监听登录成功事件，刷新数据
      unlistenLogin = await listen('login-success', () => {
        if (!mounted) return
        loadData()
      })
      
      // 监听账号数据变化（如自动刷新 token 后）
      unlistenAccounts = await listen('accounts-updated', () => {
        if (!mounted) return
        loadData()
      })
    }
    
    loadData().finally(() => {
      if (mounted) setLoading(false)
    })
    setup()
    
    return () => {
      mounted = false
      if (unlistenLogin) unlistenLogin()
      if (unlistenAccounts) unlistenAccounts()
    }
  }, [loadData])

  // 刷新所有数据
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadData()
    } finally {
      setTimeout(() => setRefreshing(false), 300)
    }
  }, [loadData])

  // 刷新单个账号
  const refreshAccount = useCallback(async (id) => {
    try {
      const result = await invoke('sync_account', { id })
      if (result.warning) {
        console.warn(`[账号同步警告] ${result.warning}`)
      }
    } catch (e) {
      // 错误会在 loadData 后反映到账号状态
    }
    await loadData()
  }, [loadData])

  // 缓存统计数据
  const stats = useMemo(() => calcAccountStats(accounts), [accounts])

  // 缓存当前账号匹配
  const currentAccount = useMemo(() => {
    if (!localToken) return null
    return accounts.find(a =>
      (localToken.refreshToken && a.refreshToken === localToken.refreshToken) ||
      (localToken.accessToken && a.accessToken === localToken.accessToken)
    )
  }, [accounts, localToken])

  // 当前账号配额信息
  const currentQuotaInfo = useMemo(() => {
    if (!currentAccount) return { quota: 0, used: 0, percent: 0 }
    const quota = getQuota(currentAccount)
    const used = getUsed(currentAccount)
    const percent = quota > 0 ? Math.round((used / quota) * 100) : 0
    return { quota, used, percent }
  }, [currentAccount])

  const value = {
    accounts,
    localToken,
    loading,
    refreshing,
    error,
    stats,
    currentAccount,
    currentQuotaInfo,
    refresh,
    refreshAccount
  }

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used within AccountProvider')
  return ctx
}
