import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, emit } from '@tauri-apps/api/event'

export function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0, currentEmail: '', results: [] })
  const [lastRefreshTime, setLastRefreshTime] = useState(null)
  const [refreshingId, setRefreshingId] = useState(null)
  const refreshTimerRef = useRef(null)

  // 判断账号是否即将过期（5分钟内）
  const isExpiringSoon = useCallback((account) => {
    // 跳过已封禁账号
    if (account.status === 'banned') return false
    // 没有过期时间的不刷新
    if (!account.expiresAt) return false
    try {
      const expiresAt = new Date(account.expiresAt.replace(/\//g, '-'))
      // 检查日期是否有效
      if (isNaN(expiresAt.getTime())) return false
      return expiresAt.getTime() - Date.now() < 5 * 60 * 1000
    } catch {
      return false
    }
  }, [])

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true)
      setAccounts(await invoke('get_accounts'))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  // 批量刷新账号
  // accountIds: 指定要刷新的账号ID列表，为空则刷新所有即将过期的账号
  // accountList: 所有账号列表
  const batchRefreshAccounts = useCallback(async (accountIds, accountList) => {
    if (autoRefreshing || accountList.length === 0) return
    
    const validAccounts = accountList.filter(acc => acc.status !== 'banned')
    // 如果指定了账号ID，强制刷新这些账号；否则只刷新即将过期的
    const accountsToRefresh = accountIds.length > 0
      ? validAccounts.filter(acc => accountIds.includes(acc.id))
      : validAccounts.filter(isExpiringSoon)
    
    if (accountsToRefresh.length === 0) return

    setAutoRefreshing(true)
    setRefreshProgress({ current: 0, total: accountsToRefresh.length, currentEmail: '', results: [] })

    const updatedAccounts = [...accountList]
    const results = []

    for (let i = 0; i < accountsToRefresh.length; i++) {
      const account = accountsToRefresh[i]
      setRefreshProgress(prev => ({ ...prev, currentEmail: account.email }))
      let success = false, message = ''
      try {
        const updated = await invoke('sync_account', { id: account.id })
        const idx = updatedAccounts.findIndex(a => a.id === account.id)
        if (idx !== -1) updatedAccounts[idx] = updated
        success = true
        message = '同步成功'
      } catch (e) {
        message = String(e).slice(0, 30)
      }
      results.push({ email: account.email, success, message })
      setRefreshProgress({ current: i + 1, total: accountsToRefresh.length, currentEmail: '', results: [...results] })
      if (i < accountsToRefresh.length - 1) await new Promise(r => setTimeout(r, 500))
    }

    setAccounts(updatedAccounts)
    setLastRefreshTime(new Date().toLocaleTimeString())
    emit('accounts-updated')
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }
    refreshTimerRef.current = setTimeout(() => {
      setAutoRefreshing(false)
      setRefreshProgress({ current: 0, total: 0, currentEmail: '', results: [] })
    }, 1500)
  }, [autoRefreshing, isExpiringSoon])


  const handleRefreshStatus = useCallback(async (id) => {
    setRefreshingId(id)
    try {
      const updated = await invoke('sync_account', { id })
      setAccounts(prev => prev.map(a => a.id === id ? updated : a))
      return { success: true }
    } catch (e) {
      console.warn(e)
      // 更新账号状态为错误信息
      const errorMsg = String(e)
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, status: errorMsg.includes('401') || errorMsg.includes('过期') ? 'Token已失效' : '刷新失败' } : a))
      return { success: false, error: errorMsg }
    } finally {
      setRefreshingId(null)
    }
  }, [])

  const handleExport = useCallback(async (selectedIds = []) => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      const { downloadDir } = await import('@tauri-apps/api/path')
      
      const suffix = selectedIds.length > 0 ? `-${selectedIds.length}` : ''
      const defaultName = `kiro-accounts${suffix}-${new Date().toISOString().slice(0, 10)}.json`
      const defaultDir = await downloadDir()
      
      const filePath = await save({
        defaultPath: `${defaultDir}${defaultName}`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
        title: '导出账号数据'
      })
      
      if (!filePath) return // 用户取消
      
      const json = await invoke('export_accounts', { ids: selectedIds.length > 0 ? selectedIds : null })
      await writeTextFile(filePath, json)
    } catch (e) {
      console.error('导出失败:', e)
    }
  }, [])

  // 注意：handleDelete, handleBatchDelete, handleSwitchAccount 已移动到 AccountManager/index.jsx 中
  // switchingId 已移动到 useSwitchAccount.js hook 中

  // 初始化和事件监听
  // 注意：自动刷新定时器已移至 App.jsx 统一管理，避免重复刷新
  useEffect(() => {
    let unlistenLoginSuccess = null
    let unlistenAccountsUpdated = null
    let unlistenKiroLoginData = null
    let mounted = true

    const setupListeners = async () => {
      unlistenLoginSuccess = await listen('login-success', () => {
        if (mounted) loadAccounts()
      })
      // 监听账号数据更新事件（来自 App.jsx 自动刷新或其他地方）
      unlistenAccountsUpdated = await listen('accounts-updated', () => {
        if (mounted) loadAccounts()
      })
      // 监听 Kiro 登录数据（通过 refresh_token 添加账号）
      unlistenKiroLoginData = await listen('kiro-login-data', async (event) => {
        if (!mounted) return
        try {
          const data = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload
          if (data?.refreshToken) {
            // 使用正确的命令：add_account_by_social
            await invoke('add_account_by_social', {
              refreshToken: data.refreshToken,
              provider: data.idp || data.provider || null
            })
            if (mounted) loadAccounts()
          }
        } catch (e) {
          console.error('Failed to handle kiro-login-data:', e)
        }
      })
    }

    loadAccounts()
    setupListeners()

    return () => {
      mounted = false
      if (unlistenLoginSuccess) unlistenLoginSuccess()
      if (unlistenAccountsUpdated) unlistenAccountsUpdated()
      if (unlistenKiroLoginData) unlistenKiroLoginData()
    }
  }, [loadAccounts])

  // 清理刷新timer
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  return {
    accounts,
    loading,
    loadAccounts,
    autoRefreshing,
    refreshProgress,
    lastRefreshTime,
    refreshingId,
    batchRefreshAccounts,
    handleRefreshStatus,
    handleExport,
  }
}
