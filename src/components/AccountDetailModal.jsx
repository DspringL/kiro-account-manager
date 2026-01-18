import { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { X, Copy, Check, RefreshCw, User, CreditCard, Shield } from 'lucide-react'
import { TextInput } from '@mantine/core'
import { useApp } from '../hooks/useApp'
import { useDialog } from '../contexts/DialogContext'
import { formatUsage } from '../utils/accountStats'
import { TokenJsonView } from './AccountManager/TokenJsonView'

function AccountDetailModal({ account, onClose }) {
  const { t, theme, colors } = useApp()
  const { showError } = useDialog()
  const isLightTheme = theme === 'light'
  const initQuota = account.usageData?.usageBreakdownList?.[0]?.usageLimit ?? account.quota ?? 50
  const initUsed = account.usageData?.usageBreakdownList?.[0]?.currentUsage ?? account.used ?? 0
  const [form, setForm] = useState({
    email: account.email,
    label: account.label || '',
    quota: initQuota,
    used: initUsed,
    status: account.status,
    accessToken: account.accessToken || '',
    refreshToken: account.refreshToken || '',
  })

  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(null)
  const copiedTimerRef = useRef(null)

  // 清理timer
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const updated = await invoke('sync_account', { id: account.id })
      // 封禁账号额度为 0
      const isBanned = updated.status === 'banned' || updated.status === '封禁' || updated.status === '已封禁'
      const quota = isBanned ? 0 : (updated.usageData?.usageBreakdownList?.[0]?.usageLimit ?? 50)
      const used = updated.usageData?.usageBreakdownList?.[0]?.currentUsage ?? 0
      setForm(prev => ({ ...prev, quota, used, status: updated.status }))
    } catch (e) {
      const errorMsg = String(e)
      let status = '刷新失败'
      if (errorMsg.includes('BANNED')) {
        status = 'banned'
      } else if (errorMsg.includes('AUTH_ERROR') || errorMsg.includes('401') || errorMsg.includes('invalid')) {
        status = 'Token已失效'
      }
      setForm(prev => ({ ...prev, status }))
      await showError(t('detail.refreshFailed'), errorMsg)
    } finally {
      setRefreshing(false)
    }
  }

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text).catch(e => console.error('Copy failed:', e))
    setCopied(field)
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = setTimeout(() => setCopied(null), 1500)
  }

  // 从 usageData 读取免费试用和奖励信息
  const breakdown = account.usageData?.usageBreakdownList?.[0]
  const freeTrialInfo = breakdown?.freeTrialInfo
  const bonuses = breakdown?.bonuses || []
  const now = Date.now()
  
  // 检查试用是否过期
  const trialExpiry = freeTrialInfo?.freeTrialExpiry ? freeTrialInfo.freeTrialExpiry * 1000 : 0
  const trialActive = freeTrialInfo?.freeTrialStatus === 'ACTIVE' || (trialExpiry > now)
  const freeTrialQuota = trialActive ? (freeTrialInfo?.usageLimit || 0) : 0
  const freeTrialUsed = trialActive ? (freeTrialInfo?.currentUsage || 0) : 0
  
  // 检查每个奖励是否过期
  let bonusQuota = 0, bonusUsed = 0
  bonuses.forEach(b => {
    const expiry = b.expiresAt ? b.expiresAt * 1000 : Infinity
    if (expiry > now && b.status !== 'EXPIRED') {
      bonusQuota += b.usageLimit || 0
      bonusUsed += b.currentUsage || 0
    }
  })
  
  const totalQuota = form.quota + freeTrialQuota + bonusQuota
  const totalUsed = form.used + freeTrialUsed + bonusUsed
  const totalPercent = totalQuota > 0 ? Math.min(100, (totalUsed / totalQuota) * 100) : 0

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div 
        className={`relative ${colors.card} rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col border ${colors.cardBorder}`} 
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部渐变背景 */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-br from-blue-500/5 via-purple-500/3 to-transparent pointer-events-none rounded-t-2xl" />
        
        {/* Header */}
        <div className={`relative px-8 py-6 border-b ${colors.cardBorder}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-5 flex-1">
              {/* 头像图标 */}
              <div className={`
                w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg
                ${account.provider === 'Google' 
                  ? 'bg-gradient-to-br from-red-500 to-orange-500' 
                  : account.provider === 'Github' 
                    ? 'bg-gradient-to-br from-gray-700 to-gray-900' 
                    : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                }`}
              >
                <User size={28} className="text-white" strokeWidth={2} />
              </div>
              
              {/* 账号信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className={`text-xl font-bold ${colors.text} truncate`}>{account.email}</h2>
                  <span className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shadow-lg ${
                    (account.usageData?.subscriptionInfo?.subscriptionTitle?.toUpperCase()?.includes('ENTERPRISE'))
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/30'
                      : (account.usageData?.subscriptionInfo?.type?.includes('PRO+') || account.usageData?.subscriptionInfo?.subscriptionTitle?.includes('PRO+'))
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-purple-500/30'
                        : (account.usageData?.subscriptionInfo?.type?.includes('PRO') || account.usageData?.subscriptionInfo?.subscriptionTitle?.includes('PRO'))
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-blue-500/30'
                          : (account.usageData?.subscriptionInfo?.subscriptionTitle?.toUpperCase()?.includes('KIRO'))
                            ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-teal-500/30'
                            : `${colors.cardSecondary} ${colors.textMuted}`
                  }`}>
                    {account.usageData?.subscriptionInfo?.subscriptionTitle || 'Free'}
                  </span>
                </div>
                
                <div className={`flex items-center gap-3 text-sm ${colors.textMuted} mb-3`}>
                  <span className={`flex items-center gap-1.5 font-medium ${
                    account.provider === 'Google' ? 'text-red-500'
                      : account.provider === 'GitHub' ? colors.text
                      : account.provider === 'BuilderId' ? 'text-orange-500'
                      : colors.textMuted
                  }`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                    {account.provider || t('common.unknown')}
                  </span>
                  <span>·</span>
                  <span>{t('detail.addedAt')} {account.addedAt?.split(' ')[0]}</span>
                </div>
                
                {/* 机器码 */}
                {account.machineId && (
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.cardSecondary}`}>
                    <span className={`text-xs font-medium ${colors.textMuted}`}>Machine ID:</span>
                    <code className="text-xs font-mono text-red-400">
                      {account.machineId}
                    </code>
                    <button 
                      type="button" 
                      onClick={() => handleCopy(account.machineId, 'machineId')} 
                      className={`p-1 rounded ${colors.cardHover}`}
                    >
                      {copied === 'machineId' ? <Check size={12} className="text-green-500" /> : <Copy size={12} className={colors.textMuted} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* 关闭按钮 */}
            <button 
              onClick={onClose} 
              className={`p-2.5 ${colors.cardHover} rounded-xl flex-shrink-0 ml-4`}
            >
              <X size={20} className={colors.textMuted} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-8">
            {/* 配额总览 */}
            <div className={`${colors.card} rounded-xl p-8 shadow-sm border ${colors.cardBorder}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className={colors.textMuted} />
                  <span className={`font-medium ${colors.text}`}>{t('detail.quotaOverview')}</span>
                </div>
                <button type="button" onClick={handleRefresh} disabled={refreshing} className={`p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors disabled:opacity-50`} title={t('detail.syncQuota')}>
                  <RefreshCw size={16} className={`text-blue-500 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <div className="mb-4">
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <span className={`text-3xl font-bold ${colors.text}`}>{formatUsage(totalUsed)}</span>
                    <span className={`${colors.textMuted} ml-1`}>/ {formatUsage(totalQuota)}</span>
                  </div>
                  <span className={`text-sm font-medium ${totalPercent > 80 ? 'text-red-500' : totalPercent > 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {totalPercent.toFixed(0)}% {t('detail.used')}
                  </span>
                </div>
                <div className={`h-3 ${colors.cardSecondary} rounded-full overflow-hidden`}>
                  <div className={`h-full rounded-full transition-all duration-500 ${totalPercent > 80 ? 'bg-gradient-to-r from-red-400 to-red-500' : totalPercent > 50 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`} style={{ width: `${totalPercent}%` }} />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className={`${colors.cardSecondary} rounded-lg p-3`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className={`text-xs ${colors.textMuted}`}>{t('detail.mainQuota')}</span>
                  </div>
                  <div className={`text-lg font-semibold ${colors.text}`} title={breakdown?.currentUsageWithPrecision != null ? `${t('detail.precise')}: ${breakdown.currentUsageWithPrecision} / ${breakdown.usageLimitWithPrecision}` : undefined}>{formatUsage(form.used)} / {formatUsage(form.quota)}</div>
                  {account.usageData?.nextDateReset && <div className={`text-xs ${colors.textMuted} mt-1`}>{new Date(account.usageData.nextDateReset * 1000).toLocaleDateString()} {t('detail.reset')}</div>}
                </div>
                
                <div className={`rounded-lg p-3 ${freeTrialQuota && freeTrialInfo?.freeTrialStatus === 'ACTIVE' ? 'bg-cyan-500/20' : colors.cardSecondary}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${freeTrialInfo?.freeTrialStatus === 'ACTIVE' ? 'bg-cyan-500' : `${colors.cardBorder}`}`}></div>
                    <span className={`text-xs ${colors.textMuted}`}>{t('detail.freeTrial')}</span>
                    {freeTrialInfo?.freeTrialStatus && <span className={`text-xs ${freeTrialInfo.freeTrialStatus === 'ACTIVE' ? 'text-cyan-500' : colors.textMuted}`}>({freeTrialInfo.freeTrialStatus})</span>}
                  </div>
                  <div className={`text-lg font-semibold ${colors.text}`} title={freeTrialInfo?.currentUsageWithPrecision != null ? `${t('detail.precise')}: ${freeTrialInfo.currentUsageWithPrecision} / ${freeTrialInfo.usageLimitWithPrecision}` : undefined}>{freeTrialQuota ? `${formatUsage(freeTrialUsed)} / ${formatUsage(freeTrialQuota)}` : '-'}</div>
                  {freeTrialInfo?.freeTrialExpiry && <div className={`text-xs ${colors.textMuted} mt-1`}>{new Date(freeTrialInfo.freeTrialExpiry * 1000).toLocaleDateString()} {t('detail.expires')}</div>}
                </div>
                
                <div className={`rounded-lg p-3 ${bonusQuota ? 'bg-purple-500/20' : colors.cardSecondary}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${bonusQuota ? 'bg-purple-500' : `${colors.cardBorder}`}`}></div>
                    <span className={`text-xs ${colors.textMuted}`}>{t('detail.bonusTotal')}</span>
                  </div>
                  <div className={`text-lg font-semibold ${colors.text}`}>{bonusQuota ? `${formatUsage(bonusUsed)} / ${formatUsage(bonusQuota)}` : '-'}</div>
                  {bonuses.length > 0 && <div className={`text-xs ${colors.textMuted} mt-1`}>{bonuses.length} {t('detail.bonusCount')}</div>}
                </div>
              </div>
              
              {/* Bonuses 列表 */}
              {bonuses.length > 0 && (
                <div className={`mt-4 pt-4 border-t ${colors.cardBorder}`}>
                  <div className={`text-xs font-medium ${colors.textMuted} mb-2`}>{t('detail.bonusDetails')}</div>
                  <div className="space-y-2">
                    {bonuses.map((bonus, idx) => (
                      <div key={idx} className={`flex items-center justify-between p-2.5 rounded-lg ${bonus.status === 'ACTIVE' ? 'bg-purple-500/10' : bonus.status === 'EXHAUSTED' ? `${colors.cardSecondary}` : colors.cardSecondary}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${colors.text}`}>{bonus.displayName || bonus.bonusCode}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${bonus.status === 'ACTIVE' ? 'bg-green-500/20 text-green-500' : bonus.status === 'EXHAUSTED' ? `${colors.cardSecondary} ${colors.textMuted}` : 'bg-yellow-500/20 text-yellow-600'}`}>{bonus.status}</span>
                          </div>
                          <div className={`text-xs ${colors.textMuted} mt-0.5`}>
                            {bonus.description && <span>{bonus.description} · </span>}
                            {bonus.redeemedAt && <span>{t('detail.redeemed')}: {new Date(bonus.redeemedAt * 1000).toLocaleDateString()} · </span>}
                            {bonus.expiresAt && <span>{t('detail.expires')}: {new Date(bonus.expiresAt * 1000).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <div className={`text-sm font-semibold ${colors.text}`}>{formatUsage(bonus.currentUsage || 0)} / {formatUsage(bonus.usageLimit || 0)}</div>
                          <div className={`text-xs ${colors.textMuted}`}>{bonus.bonusCode}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 订阅信息 */}
              <div className={`mt-4 pt-4 border-t ${colors.cardBorder} grid grid-cols-2 gap-x-6 gap-y-2 text-sm`}>
                <div className="flex justify-between"><span className={colors.textMuted}>{t('detail.userId')}</span><span className={`${colors.text} font-mono text-xs truncate max-w-[150px]`} title={account.usageData?.userInfo?.userId}>{account.usageData?.userInfo?.userId?.slice(-12) || '-'}</span></div>
                <div className="flex justify-between"><span className={colors.textMuted}>{t('detail.email')}</span><span className={`${colors.text} text-xs`}>{account.usageData?.userInfo?.email || account.email}</span></div>
                <div className="flex justify-between"><span className={colors.textMuted}>{t('detail.subscriptionType')}</span><span className={`${colors.text} font-mono text-xs truncate max-w-[150px]`} title={account.usageData?.subscriptionInfo?.type}>{account.usageData?.subscriptionInfo?.type || '-'}</span></div>
                <div className="flex justify-between"><span className={colors.textMuted}>{t('detail.upgradeable')}</span><span className={colors.text}>{account.usageData?.subscriptionInfo?.upgradeCapability === 'UPGRADE_CAPABLE' ? t('common.yes') : t('common.no')}</span></div>
                {breakdown?.overageRate != null && (
                  <>
                    <div className="flex justify-between"><span className={colors.textMuted}>{t('detail.overageRate')}</span><span className={colors.text}>{breakdown.currency === 'USD' ? '$' : breakdown.currency}{breakdown.overageRate}/{t('detail.perCredit')}</span></div>
                    <div className="flex justify-between"><span className={colors.textMuted}>{t('detail.overageCap')}</span><span className={colors.text}>{breakdown.currency === 'USD' ? '$' : breakdown.currency}{breakdown.overageCap}</span></div>
                  </>
                )}
              </div>
            </div>

            {/* 基本信息 */}
            <div className={`${colors.card} rounded-xl p-8 shadow-sm border ${colors.cardBorder}`}>
              <div className="flex items-center gap-2 mb-6">
                <User size={18} className={colors.textMuted} />
                <span className={`font-medium ${colors.text}`}>{t('detail.basicInfo')}</span>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <TextInput
                    label={t('detail.emailAddress')}
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    classNames={{
                      label: `text-sm font-medium ${colors.textMuted} mb-2`,
                      input: `${colors.text} ${colors.input}`
                    }}
                    styles={{
                      input: {
                        fontSize: '0.875rem',
                        padding: '0.625rem 0.875rem',
                        borderRadius: '0.75rem',
                      }
                    }}
                  />
                </div>
                <div>
                  <TextInput
                    label={t('detail.remarkLabel')}
                    value={form.label}
                    readOnly
                    placeholder={t('common.none')}
                    classNames={{
                      label: `text-sm font-medium ${colors.textMuted} mb-2`,
                      input: `${colors.text} ${colors.input} opacity-60`
                    }}
                    styles={{
                      input: {
                        fontSize: '0.875rem',
                        padding: '0.625rem 0.875rem',
                        borderRadius: '0.75rem',
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Token 凭证 JSON 视图 */}
            <TokenJsonView account={account} />
          </div>

          {/* Footer */}
          <div className={`relative flex justify-between items-center px-8 py-6 ${colors.dialogFooter}`}>
            <div className={`text-sm ${colors.textMuted} flex items-center gap-2`}>
              {account.status === 'active' || account.status === '正常' || account.status === '有效' 
                ? <><Shield size={14} className="text-green-500" /><span className="text-green-500 font-medium">{t('detail.accountNormal')}</span></> 
                : account.status === 'banned' || account.status === '封禁' || account.status === '已封禁'
                  ? <><Shield size={14} className="text-red-500" /><span className="text-red-500 font-medium">{t('detail.accountBanned')}</span></>
                  : <><Shield size={14} className="text-orange-500" /><span className="text-orange-500 font-medium">{account.status}</span></>}
            </div>
            <button 
              type="button" 
              onClick={onClose} 
              className="
                px-8 py-3 text-sm font-semibold rounded-xl text-white
                bg-gradient-to-r from-blue-500 to-indigo-600
                shadow-lg shadow-blue-500/30
                hover:opacity-90 hover:shadow-xl hover:shadow-blue-500/40
                transition-all duration-200 active:scale-[0.98]
              "
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountDetailModal
