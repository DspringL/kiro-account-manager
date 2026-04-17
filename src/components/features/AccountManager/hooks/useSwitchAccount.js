import { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../../../hooks/useApp'
import { useAppSettings } from '../../../../contexts/AppSettingsContext'
import { applyMachineGuid, buildSwitchParams } from '../../../../utils/kiroSwitch'
import { getAccountStatusMeta, isUnavailableStatus } from '../../../../utils/accountStatus'

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
  const [switchTarget, setSwitchTarget] = useState('ide') // 'ide' | 'cli'
  const [cliInstalled, setCliInstalled] = useState(false)

  // 检测 CLI 安装状态
  useEffect(() => {
    invoke('check_cli_installation').then(info => {
      const installed = info?.cli_installed ?? info?.cliInstalled ?? info?.installed
      setCliInstalled(Boolean(installed))
    }).catch(() => setCliInstalled(false))
  }, [])

  // 从 localStorage 读取上次选择的切换目标
  useEffect(() => {
    const saved = localStorage.getItem('switchTarget')
    if (saved && (saved === 'ide' || saved === 'cli')) {
      setSwitchTarget(saved)
    }
  }, [])

  // 显示切换确认弹窗
  const handleSwitchAccount = useCallback((account) => {
    if (isUnavailableStatus(account)) {
      const statusMeta = getAccountStatusMeta(account, t)
      setSwitchDialog({ type: 'error', title: t('switch.failed'), message: `账号当前状态为${statusMeta.label}，请重新登录或恢复后再切换`, account: null })
      return
    }
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
    
    // 保存用户选择的切换目标
    localStorage.setItem('switchTarget', switchTarget)
    
    setSwitchDialog(null)
    setSwitchingId(account.id)
    
    try {
      // 如果选择 CLI，先检测 CLI 2.0 安装状态
      if (switchTarget === 'cli') {
        const cliInfo = await invoke('check_cli_installation')
        const installed = cliInfo?.cli_installed ?? cliInfo?.cliInstalled ?? cliInfo?.installed
        if (!installed) {
          setSwitchDialog({
            type: 'error',
            title: t('switch.cliNotInstalled'),
            message: t('switch.cliNotInstalledMessage'),
            account: null,
          })
          setSwitchingId(null)
          return
        }
      }
      
      // 先同步账号（刷新 token + 获取最新配额）
      const syncResult = await invoke('sync_account', { id: account.id })
      let refreshedAccount = syncResult.account
      
      const settings = appSettings || {}
      refreshedAccount = await applyMachineGuid(refreshedAccount, settings)
      
      if (switchTarget === 'cli') {
        // CLI 切号
        const payload = await invoke('build_cli_switch_payload', { account: refreshedAccount })
        await invoke('switch_to_cli_account', { payload })
      } else {
        // IDE 切号
        const params = buildSwitchParams(refreshedAccount)
        await invoke('switch_kiro_account', { params })
      }
      
      // 更新当前账号标识
      invoke('get_kiro_local_token').then(onLocalTokenChange).catch(() => onLocalTokenChange(null))
      
      // 从 usageData 获取配额信息（API 原始响应）
      const usageData = refreshedAccount.usageData
      const breakdown = usageData?.usageBreakdownList?.[0]
      const now = Date.now()
      
      // 主配额（永不过期）
      const mainUsed = breakdown?.currentUsage ?? 0
      const mainLimit = breakdown?.usageLimit ?? 0
      
      // 试用配额（检查过期）
      const trialInfo = breakdown?.freeTrialInfo
      const trialExpiry = trialInfo?.freeTrialExpiry ? trialInfo.freeTrialExpiry * 1000 : 0
      const trialValid = trialExpiry > now
      const trialUsed = trialValid ? (trialInfo?.currentUsage ?? 0) : 0
      const trialLimit = trialValid ? (trialInfo?.usageLimit ?? 0) : 0
      
      // 奖励配额（检查每个奖励的过期时间）
      const bonuses = breakdown?.bonuses ?? []
      let bonusUsed = 0, bonusLimit = 0
      bonuses.forEach(b => {
        const expiry = b.expiresAt ? b.expiresAt * 1000 : Infinity
        if (expiry > now) {
          bonusUsed += b.currentUsage ?? 0
          bonusLimit += b.usageLimit ?? 0
        }
      })
      
      // 总计
      const totalUsed = mainUsed + trialUsed + bonusUsed
      const totalLimit = mainLimit + trialLimit + bonusLimit
      const remaining = totalLimit - totalUsed
      const provider = refreshedAccount.provider || 'Unknown'
      
      const targetLabel = switchTarget === 'cli' ? 'CLI 2.0' : 'IDE'
      
      setSwitchDialog({
        type: 'success',
        title: t('switch.success'),
        message: `${refreshedAccount.email}\n\n📊 ${t('switch.quota')}: ${totalUsed}/${totalLimit} (${t('switch.remaining')} ${remaining})\n🏷️ ${t('switch.type')}: ${provider}\n🎯 切换目标: ${targetLabel}`,
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
  }, [switchDialog, appSettings, onLocalTokenChange, t, switchTarget])

  // 关闭弹窗
  const closeSwitchDialog = useCallback(() => setSwitchDialog(null), [])

  return {
    switchingId,
    setSwitchingId,
    switchDialog,
    handleSwitchAccount,
    confirmSwitch,
    closeSwitchDialog,
    switchTarget,
    setSwitchTarget,
    cliInstalled,
  }
}
