import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'

/**
 * 模型锁定检查 Hook
 * @param {Object} appSettings - 应用设置
 * @param {boolean} settingsLoading - 设置是否加载中
 */
export function useModelLock(appSettings, settingsLoading) {
  const modelLockTimerRef = useRef(null)
  const appSettingsRef = useRef(appSettings)

  // 同步 appSettings 到 ref
  useEffect(() => {
    appSettingsRef.current = appSettings
  }, [appSettings])

  // 检查并恢复锁定的模型
  const checkAndRestoreLockedModel = async () => {
    try {
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

  // 启动定时器
  const startModelLockTimer = () => {
    if (modelLockTimerRef.current) {
      clearInterval(modelLockTimerRef.current)
    }

    // 启动时立即检查一次
    checkAndRestoreLockedModel()

    // 每 30 秒检查一次
    modelLockTimerRef.current = setInterval(checkAndRestoreLockedModel, 30 * 1000)
  }

  // 设置加载完成后启动定时器
  useEffect(() => {
    if (settingsLoading) return

    startModelLockTimer()

    return () => {
      if (modelLockTimerRef.current) {
        clearInterval(modelLockTimerRef.current)
      }
    }
  }, [settingsLoading])

  return { checkAndRestoreLockedModel }
}
