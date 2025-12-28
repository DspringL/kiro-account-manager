import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'

// 常量（与 Kiro 官方一致）
const REFRESH_BEFORE_EXPIRY_SECONDS = 10 * 60
const DEFAULT_REFRESH_INTERVAL = 50 // 分钟

/**
 * 自动刷新 Token 的 Hook
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

  // 判断 token 是否在指定秒数内过期
  const isAuthTokenExpiredWithinSeconds = (acc, seconds) => {
    if (!acc.expiresAt || !acc.accessToken) return true
    const expiresAt = new Date(acc.expiresAt.replace(/\//g, '-'))
    return expiresAt.valueOf() < Date.now() + seconds * 1000
  }

  // 判断账号是否需要刷新
  const isExpiringSoon = (acc) => {
    if (acc.status === 'banned') return false
    if (!acc.expiresAt || !acc.accessToken) return false
    return isAuthTokenExpiredWithinSeconds(acc, REFRESH_BEFORE_EXPIRY_SECONDS)
  }

  // 刷新过期的 token
  const refreshExpiredTokens = async () => {
    try {
      const accounts = await invoke('get_accounts')
      if (!accounts?.length) return

      const expiredAccounts = accounts.filter(isExpiringSoon)
      if (!expiredAccounts.length) {
        console.log('[AutoRefresh] 没有需要刷新的 token')
        return
      }

      console.log(`[AutoRefresh] 刷新 ${expiredAccounts.length} 个过期 token...`)

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
      emit('accounts-updated')
    } catch (e) {
      console.error('[AutoRefresh] 刷新失败:', e)
    }
  }

  // 定时刷新检查
  const checkAndRefreshExpiringTokens = async () => {
    const settings = appSettingsRef.current || {}
    if (settings.autoRefresh === false) return
    await refreshExpiredTokens()
  }

  // 启动定时器
  const startAutoRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
    }

    // 启动时立即刷新一次
    refreshExpiredTokens()

    const settings = appSettingsRef.current || {}
    const interval = settings.autoRefreshInterval ?? DEFAULT_REFRESH_INTERVAL
    const intervalMs = interval * 60 * 1000

    console.log(`[AutoRefresh] 定时器间隔: ${interval} 分钟`)
    refreshTimerRef.current = setInterval(checkAndRefreshExpiringTokens, intervalMs)
  }

  // 设置加载完成后启动定时器
  useEffect(() => {
    if (settingsLoading) return

    console.log('[AutoRefresh] 设置加载完成，启动定时器')
    startAutoRefreshTimer()

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [settingsLoading])

  return { startAutoRefreshTimer }
}
