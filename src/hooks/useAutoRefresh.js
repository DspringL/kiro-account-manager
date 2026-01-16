import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { getConcurrency, runWithConcurrency } from '../utils/concurrency'

// 常量
const DEFAULT_REFRESH_INTERVAL = 10 // 分钟

/**
 * 自动同步账号数据的 Hook
 * 定时调用 sync_account 同步配额数据，后端会自动刷新过期 Token
 * @param {Object} appSettings - 应用设置
 * @param {boolean} settingsLoading - 设置是否加载中
 */
export function useAutoRefresh(appSettings, settingsLoading) {
  const refreshTimerRef = useRef(null)
  const appSettingsRef = useRef(appSettings)

  // 同步 appSettings 到 ref
  useEffect(() => {
    appSettingsRef.current = appSettings
  }, [appSettings])

  // 同步所有账号数据（包含配额和 Token 刷新）
  const syncAllAccounts = async () => {
    try {
      const accounts = await invoke('get_accounts')
      if (!accounts?.length) return

      // 只排除封禁账号，其他都交给后端判断
      const validAccounts = accounts.filter(acc => acc.status !== 'banned')
      if (!validAccounts.length) {
        console.log('[AutoRefresh] 没有有效账号')
        return
      }

      const concurrency = getConcurrency(validAccounts.length)
      console.log(`[AutoRefresh] 同步 ${validAccounts.length} 个账号数据，并发数: ${concurrency}`)

      // 统计网络错误数量，避免频繁弹窗
      let networkErrorCount = 0

      // 构建任务列表（同步数据，包含刷新 Token）
      const tasks = validAccounts.map((account) => async () => {
        try {
          await invoke('sync_account', { id: account.id })
        } catch (e) {
          const errorMsg = String(e)
          if (errorMsg.includes('BANNED')) {
            console.warn(`[AutoRefresh] ${account.email} 账号已封禁`)
            // 发送封禁事件，让前端弹窗通知
            emit('account-banned', { email: account.email, id: account.id })
          } else if (errorMsg.includes('AUTH_ERROR') || errorMsg.includes('invalid')) {
            console.warn(`[AutoRefresh] ${account.email} Token已失效`)
            // 发送 Token 失效事件
            emit('account-token-invalid', { email: account.email, id: account.id })
          } else if (errorMsg.includes('request failed') || errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('connection')) {
            console.warn(`[AutoRefresh] ${account.email} 网络错误:`, errorMsg)
            networkErrorCount++
          } else {
            console.warn(`[AutoRefresh] ${account.email} 同步失败:`, errorMsg)
          }
        }
      })

      // 分批执行
      await runWithConcurrency(tasks, concurrency)

      // 如果有网络错误，只弹一次窗
      if (networkErrorCount > 0) {
        emit('sync-network-error', { count: networkErrorCount, total: validAccounts.length })
      }

      console.log('[AutoRefresh] 数据同步完成')
      emit('accounts-updated')
    } catch (e) {
      console.error('[AutoRefresh] 刷新失败:', e)
    }
  }

  // 定时同步检查
  const checkAndSyncAccounts = async () => {
    const settings = appSettingsRef.current || {}
    if (settings.autoRefresh === false) return
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

    const settings = appSettingsRef.current || {}
    const interval = settings.autoRefreshInterval ?? DEFAULT_REFRESH_INTERVAL
    const intervalMs = interval * 60 * 1000

    console.log(`[AutoRefresh] 定时器间隔: ${interval} 分钟`)
    refreshTimerRef.current = setInterval(checkAndSyncAccounts, intervalMs)
  }

  // 设置加载完成后启动定时器
  useEffect(() => {
    if (settingsLoading) return

    console.log('[AutoRefresh] 设置加载完成，启动定时器')
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
