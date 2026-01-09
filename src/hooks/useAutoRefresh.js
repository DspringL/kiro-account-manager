import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'

// 常量
const DEFAULT_REFRESH_INTERVAL = 10 // 分钟

// 根据账号数量计算并发数：数量/10，最小3，最大20
const getConcurrency = (count) => {
  return Math.min(20, Math.max(3, Math.ceil(count / 10)))
}

// 分批执行异步任务
const runWithConcurrency = async (tasks, concurrency) => {
  const results = []
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map(fn => fn()))
    results.push(...batchResults)
  }
  return results
}

/**
 * 自动刷新 Token 的 Hook
 * 后端会判断 Token 是否需要刷新（5分钟内过期才刷新）
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

  // 刷新所有账号的 token（后端判断是否需要刷新）
  const refreshAllTokens = async () => {
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
      console.log(`[AutoRefresh] 检查 ${validAccounts.length} 个账号的 token，并发数: ${concurrency}`)

      // 构建任务列表（后端会判断是否需要刷新）
      const tasks = validAccounts.map((account) => async () => {
        try {
          await invoke('refresh_account_token', { id: account.id })
        } catch (e) {
          const errorMsg = String(e)
          if (errorMsg.includes('BANNED')) {
            console.warn(`[AutoRefresh] ${account.email} 账号已封禁`)
            // 更新账号状态为封禁
            try {
              await invoke('update_account', { 
                id: account.id, 
                updates: { status: 'banned' } 
              })
            } catch (updateErr) {
              console.error(`[AutoRefresh] 更新封禁状态失败:`, updateErr)
            }
          } else if (errorMsg.includes('AUTH_ERROR') || errorMsg.includes('invalid')) {
            console.warn(`[AutoRefresh] ${account.email} Token已失效`)
          } else {
            console.warn(`[AutoRefresh] ${account.email} token 刷新失败:`, errorMsg)
          }
        }
      })

      // 分批执行
      await runWithConcurrency(tasks, concurrency)

      console.log('[AutoRefresh] token 检查完成')
      emit('accounts-updated')
    } catch (e) {
      console.error('[AutoRefresh] 刷新失败:', e)
    }
  }

  // 定时刷新检查
  const checkAndRefreshTokens = async () => {
    const settings = appSettingsRef.current || {}
    if (settings.autoRefresh === false) return
    await refreshAllTokens()
  }

  // 启动定时器
  const startAutoRefreshTimer = () => {
    // 先清理旧定时器，防止重复创建
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    // 启动时检查所有账号的 token
    refreshAllTokens()

    const settings = appSettingsRef.current || {}
    const interval = settings.autoRefreshInterval ?? DEFAULT_REFRESH_INTERVAL
    const intervalMs = interval * 60 * 1000

    console.log(`[AutoRefresh] 定时器间隔: ${interval} 分钟`)
    refreshTimerRef.current = setInterval(checkAndRefreshTokens, intervalMs)
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
