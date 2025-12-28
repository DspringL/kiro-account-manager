import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../../hooks/useApp'
import { useAppSettings } from '../../../contexts/AppSettingsContext'

/**
 * 账号切换逻辑 hook
 * @param {Function} onLocalTokenChange - 本地 token 变化回调
 * @returns {Object} 切换相关状态和方法
 */
export function useSwitchAccount(onLocalTokenChange) {
  const { t } = useApp()
  const { settings: appSettings } = useAppSettings()
  const [switchingId, setSwitchingId] = useState(null)
  const [switchDialog, setSwitchDialog] = useState(null)

  // 处理机器码逻辑
  const handleMachineGuid = useCallback(async (account, settings) => {
    const autoChangeMachineId = settings.autoChangeMachineId !== false
    const bindMachineIdToAccount = settings.bindMachineIdToAccount !== false
    
    if (!autoChangeMachineId) return
    
    try {
      if (bindMachineIdToAccount) {
        // 绑定模式：使用账号绑定的机器码
        let boundMachineId = await invoke('get_bound_machine_id', { accountId: account.id }).catch(() => null)
        
        if (!boundMachineId) {
          // 首次切换，生成新的并绑定
          boundMachineId = await invoke('generate_machine_guid')
          await invoke('bind_machine_id_to_account', { accountId: account.id, machineId: boundMachineId })
        }
        
        await invoke('set_custom_machine_guid', { newGuid: boundMachineId })
      } else {
        // 随机模式：每次生成新的机器码
        const newMachineId = await invoke('generate_machine_guid')
        await invoke('set_custom_machine_guid', { newGuid: newMachineId })
      }
    } catch (e) {
      console.error('[MachineGuid] 设置机器码失败:', e)
    }
  }, [])

  // 构建切换参数
  const buildSwitchParams = useCallback((account) => {
    const isIdC = account.provider === 'BuilderId' || account.provider === 'Enterprise' || account.clientIdHash
    const authMethod = isIdC ? 'IdC' : 'social'
    
    const params = {
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      provider: account.provider || 'Google',
      authMethod,
      autoRestart: false
    }
    
    if (isIdC) {
      params.clientIdHash = account.clientIdHash || null
      params.region = account.region || 'us-east-1'
      params.clientId = account.clientId || null
      params.clientSecret = account.clientSecret || null
    } else {
      params.profileArn = account.profileArn || 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK'
    }
    
    return params
  }, [])

  // 显示切换确认弹窗
  const handleSwitchAccount = useCallback((account) => {
    if (!account.accessToken || !account.refreshToken) {
      setSwitchDialog({ type: 'error', title: t('switch.failed'), message: t('switch.missingAuth'), account: null })
      return
    }
    setSwitchDialog({
      type: 'confirm',
      title: t('switch.title'),
      message: `${t('switch.confirmSwitch')} ${account.email}？`,
      account,
    })
  }, [t])

  // 确认切换
  const confirmSwitch = useCallback(async () => {
    const account = switchDialog?.account
    if (!account) return
    
    setSwitchDialog(null)
    setSwitchingId(account.id)
    
    try {
      const settings = appSettings || {}
      await handleMachineGuid(account, settings)
      
      const params = buildSwitchParams(account)
      await invoke('switch_kiro_account', { params })
      
      // 更新当前账号标识
      invoke('get_kiro_local_token').then(onLocalTokenChange).catch(() => onLocalTokenChange(null))
      
      // 从 usage_data 获取配额信息
      const usageData = account.usageData
      const breakdown = usageData?.usageBreakdownList?.[0]
      const used = breakdown?.currentUsage ?? 0
      const limit = breakdown?.usageLimit ?? 50
      const remaining = limit - used
      const provider = account.provider || 'Unknown'
      
      setSwitchDialog({
        type: 'success',
        title: t('switch.success'),
        message: `${account.email}\n\n📊 ${t('switch.quota')}: ${used}/${limit} (${t('switch.remaining')} ${remaining})\n🏷️ ${t('switch.type')}: ${provider}`,
        account: null,
      })
    } catch (e) {
      setSwitchDialog({
        type: 'error',
        title: t('switch.failed'),
        message: String(e),
        account: null,
      })
    } finally {
      setSwitchingId(null)
    }
  }, [switchDialog, appSettings, handleMachineGuid, buildSwitchParams, onLocalTokenChange, t])

  // 关闭弹窗
  const closeSwitchDialog = useCallback(() => setSwitchDialog(null), [])

  return {
    switchingId,
    setSwitchingId,
    switchDialog,
    handleSwitchAccount,
    confirmSwitch,
    closeSwitchDialog,
  }
}
