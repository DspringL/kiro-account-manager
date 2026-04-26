import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { getConcurrency, runWithConcurrency } from '../utils/concurrency'
import { isUnavailableStatus } from '../utils/accountStatus'
import { Account } from '../types/account'
import { AppSettings } from '../contexts/AppSettingsContext'

// 常量
const DEFAULT_REFRESH_INTERVAL = 10 // 分钟

/**
 * 自动同步账号数据的 Hook
 * 定时调用 sync_account 同步配额数据，后端会自动刷新过期 Token
 */
export function useAutoRefresh(appSettings: AppSettings | null, settingsLoading: boolean) {
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const appSettingsRef = useRef<AppSettings | null>(appSettings)

  // 同步 appSettings 到 ref
  useEffect(() => {
    appSettingsRef.current = appSettings
  }, [appSettings])

  // 同步所有账号数据（包含配额和 Token 刷新）
  const syncAllAccounts = async () => {
    try {
      const accounts = await invoke<Account[]>('get_accounts')
      if (!accounts?.length) return

      // 只跳过封禁和封顶的账号，失效/过期的账号需要刷新 Token
      const validAccounts = accounts.filter(acc => {
        const status = acc.status?.toLowerCase() || ''
        // 跳过封禁和封顶状态
        return status !== 'banned' && status !== '封禁' && status !== '已封禁' && 
               status !== 'capped' && status !== '封顶'
      })
      if (!validAccounts.length) {
        return
      }

      const concurrency = getConcurrency(validAccounts.length)

      // 统计网络错误数量，避免频繁弹窗
      let networkErrorCount = 0

      // 构建任务列表（同步数据，包含刷新 Token）
      const tasks = validAccounts.map((account) => async () => {
        try {
          await invoke('sync_account', { id: account.id })
        } catch (e) {
          const errorMsg = String(e)
          if (errorMsg.includes('BANNED')) {
            // 发送封禁事件，让前端弹窗通知
            emit('account-banned', { email: account.email, id: account.id })
          } else if (errorMsg.includes('AUTH_ERROR') || errorMsg.includes('invalid')) {
            // 发送 Token 失效事件
            emit('account-token-invalid', { email: account.email, id: account.id })
          } else if (errorMsg.includes('request failed') || errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('connection')) {
            networkErrorCount++
          }
        }
      })

      // 分批执行
      await runWithConcurrency(tasks, concurrency)

      // 如果有网络错误，只弹一次窗
      if (networkErrorCount > 0) {
        emit('sync-network-error', { count: networkErrorCount, total: validAccounts.length })
      }

      emit('accounts-updated')
    } catch (e) {
      // 静默处理
    }
  }

  // 定时同步检查
  const checkAndSyncAccounts = async () => {
    const settings = appSettingsRef.current
    if (!settings || settings.autoRefresh === false) return
    await syncAllAccounts()
  }

  // 启动定时器
  const startAutoRefreshTimer = () => {
    // 先清理旧定时器，防止重复创建
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    // 启动时同步所有账号数据
    syncAllAccounts()

    const settings = appSettingsRef.current
    const interval = settings?.autoRefreshInterval ?? DEFAULT_REFRESH_INTERVAL
    const intervalMs = interval * 60 * 1000

    refreshTimerRef.current = setInterval(checkAndSyncAccounts, intervalMs)
  }

  // 设置加载完成后启动定时器
  useEffect(() => {
    if (settingsLoading) return

    startAutoRefreshTimer()

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [settingsLoading])

  return { startAutoRefreshTimer }
}
