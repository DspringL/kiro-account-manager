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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div 
        className={`${colors.card} rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col border ${colors.cardBorder}`} 
        onClick={e => e.stopPropagation()}
        style={{ animation: 'modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 ${colors.card} border-b ${colors.cardBorder}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${account.provider === 'Google' ? 'bg-red-500/20' : account.provider === 'Github' ? `${colors.cardSecondary}` : 'bg-blue-500/20'}`}>
              <User size={24} className={account.provider === 'Google' ? 'text-red-400' : account.provider === 'Github' ? `${colors.text}` : 'text-blue-400'} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-lg font-semibold ${colors.text}`}>{account.email}</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  (account.usageData?.subscriptionInfo?.subscriptionTitle?.toUpperCase()?.includes('ENTERPRISE'))
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                    : (account.usageData?.subscriptionInfo?.type?.includes('PRO+') || account.usageData?.subscriptionInfo?.subscriptionTitle?.includes('PRO+'))
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : (account.usageData?.subscriptionInfo?.type?.includes('PRO') || account.usageData?.subscriptionInfo?.subscriptionTitle?.includes('PRO'))
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                        : (account.usageData?.subscriptionInfo?.subscriptionTitle?.toUpperCase()?.includes('KIRO'))
                          ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                          : `${colors.cardSecondary} ${colors.textMuted}`
                }`}>
                  {account.usageData?.subscriptionInfo?.subscriptionTitle || 'Free'}
                </span>
              </div>
              <p className={`text-sm ${colors.textMuted}`}>
                <span className={`${
                  account.provider === 'Google' ? 'text-red-500'
                    : account.provider === 'GitHub' ? colors.text
                    : account.provider === 'BuilderId' ? 'text-orange-500'
                    : colors.textMuted
                }`}>{account.provider || t('common.unknown')}</span>
                {' · '}{t('detail.addedAt')} {account.addedAt?.split(' ')[0]}
              </p>
              {/* 机器码 - 显眼位置 */}
              {account.machineId && (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs ${colors.textMuted}`}>ID:</span>
                  <code className={`text-xs font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300`}>
                    {account.machineId}
                  </code>
                  <button type="button" onClick={() => handleCopy(account.machineId, 'machineId')} className={`p-1 rounded ${colors.cardHover}`}>
                    {copied === 'machineId' ? <Check size={12} className="text-green-500" /> : <Copy size={12} className={colors.textMuted} />}
                  </button>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className={`p-2 ${colors.cardHover} rounded-xl transition-all`}>
            <X size={20} className={colors.textMuted} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* 配额总览 */}
            <div className={`${colors.card} rounded-xl p-5 shadow-sm`}>
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
            <div className={`${colors.card} rounded-xl p-5 shadow-sm`}>
              <div className="flex items-center gap-2 mb-4">
                <User size={18} className={colors.textMuted} />
                <span className={`font-medium ${colors.text}`}>{t('detail.basicInfo')}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TextInput
                    label={t('detail.emailAddress')}
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    classNames={{
                      label: `text-xs font-medium ${colors.textMuted}`,
                      input: `${colors.text} ${colors.input}`
                    }}
                    styles={{
                      input: {
                        fontSize: '0.875rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
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
                      label: `text-xs font-medium ${colors.textMuted}`,
                      input: `${colors.text} ${colors.input} opacity-60`
                    }}
                    styles={{
                      input: {
                        fontSize: '0.875rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
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
          <div className={`flex justify-between items-center px-6 py-4 ${colors.card} border-t ${colors.cardBorder}`}>
            <div className={`text-xs ${colors.textMuted}`}>
              {account.status === 'active' || account.status === '正常' || account.status === '有效' 
                ? <span className="flex items-center gap-1 text-green-500"><Shield size={12} />{t('detail.accountNormal')}</span> 
                : account.status === 'banned' || account.status === '封禁' || account.status === '已封禁'
                  ? <span className="flex items-center gap-1 text-red-500"><Shield size={12} />{t('detail.accountBanned')}</span>
                  : <span className="flex items-center gap-1 text-orange-500"><Shield size={12} />{account.status}</span>}
            </div>
            <button type="button" onClick={onClose} className="px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountDetailModal

// 添加动画样式
const style = document.createElement('style')
style.textContent = `
  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
`
if (!document.querySelector('#edit-modal-styles')) {
  style.id = 'edit-modal-styles'
  document.head.appendChild(style)
}
