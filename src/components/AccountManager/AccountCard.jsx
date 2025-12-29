import { memo, useState, useCallback, useMemo } from 'react'
import { RefreshCw, Eye, Trash2, Copy, Check, Clock, Repeat, Edit2, UserX } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { usePrivacy } from '../../contexts/PrivacyContext'
import { getUsagePercent, getProgressBarColor } from './hooks/useAccountStats'
import { getQuota, getUsed, getSubType, getSubPlan } from '../../utils/accountStats'
import ContextMenu from './ContextMenu'

const AccountCard = memo(function AccountCard({
  account,
  isSelected,
  onSelect,
  copiedId,
  onCopy,
  onSwitch,
  onRefresh,
  onEdit,
  onEditLabel,
  onDelete,
  onDeleteRemote,
  refreshingId,
  switchingId,
  isCurrentAccount,
  tagDefinitions = [],
}) {
  const { t, theme, colors } = useApp()
  const { maskEmail } = usePrivacy()
  const isLightTheme = theme === 'light'
  const [contextMenu, setContextMenu] = useState(null)

  // 右键菜单处理
  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // 判断是否被封禁
  const isBannedAccount = account.status === 'banned' || account.status === '封禁' || account.status === '已封禁'

  // 复制账号 JSON
  const handleCopyJson = useCallback(() => {
    const exportData = {
      email: account.email,
      provider: account.provider,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      ...(account.clientIdHash && { clientIdHash: account.clientIdHash }),
      ...(account.clientId && { clientId: account.clientId }),
      ...(account.clientSecret && { clientSecret: account.clientSecret }),
      ...(account.region && { region: account.region }),
      ...(account.label && { label: account.label }),
      ...(account.tags?.length && { tags: account.tags }),
      ...(account.machineId && { machineId: account.machineId }),
    }
    onCopy(JSON.stringify(exportData, null, 2), account.id)
  }, [account, onCopy])

  // 右键菜单项（使用 useMemo 缓存）
  const menuItems = useMemo(() => [
    { icon: Eye, label: t('accountCard.viewDetails'), onClick: () => onEdit(account) },
    { icon: Edit2, label: t('accountCard.editRemark'), onClick: () => onEditLabel(account) },
    { icon: Copy, label: t('accountCard.copyJson'), onClick: handleCopyJson },
    { divider: true },
    { icon: RefreshCw, label: t('accountCard.refresh'), onClick: () => onRefresh(account.id), disabled: refreshingId === account.id },
    { icon: Repeat, label: t('accountCard.switchAccount'), onClick: () => onSwitch(account), disabled: switchingId === account.id },
    { divider: true },
    { icon: Trash2, label: t('accountCard.delete'), onClick: () => onDelete(account.id), danger: true },
    // Google/Github/BuilderId 支持远程注销，Enterprise 不支持，封禁账号不支持
    ...(account.provider !== 'Enterprise' && !isBannedAccount && onDeleteRemote ? [
      { icon: UserX, label: t('accountCard.deleteRemote'), onClick: () => onDeleteRemote(account), danger: true },
    ] : []),
  ], [t, account, handleCopyJson, onEdit, onEditLabel, onRefresh, onSwitch, onDelete, onDeleteRemote, refreshingId, switchingId, isBannedAccount])

  const quota = getQuota(account)
  const used = getUsed(account)
  const subType = getSubType(account)
  const subPlan = getSubPlan(account)
  const usageData = account.usageData
  const breakdown = usageData?.usageBreakdownList?.[0]
  const nextDateReset = usageData?.nextDateReset
  const percent = getUsagePercent(used, quota)
  const isExpired = account.expiresAt && new Date(account.expiresAt.replace(/\//g, '-')) < new Date()
  // 统一状态判断：后端只设置 'active' 或 'banned'，兼容旧数据的中文状态
  const isBanned = account.status === 'banned'
  const isNormal = account.status === 'active'

  // 状态光环颜色
  const glowColor = isCurrentAccount
    ? 'shadow-green-500/30 hover:shadow-green-500/50'
    : isBanned
      ? 'shadow-red-500/30 hover:shadow-red-500/50'
      : isNormal
        ? ''
        : 'shadow-orange-500/30 hover:shadow-orange-500/50'

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`relative rounded-2xl border transition-all duration-200 hover:shadow-lg flex flex-col min-h-[320px] ${glowColor} ${
      isSelected 
        ? (isLightTheme ? 'border-purple-400 bg-purple-50' : 'border-purple-500 bg-purple-500/10') 
        : isCurrentAccount
          ? (isLightTheme ? 'border-green-400 bg-green-50/50' : 'border-green-500/50 bg-green-500/5')
          : isBanned
            ? (isLightTheme ? 'border-red-300 bg-red-50/50' : 'border-red-500/50 bg-red-500/5')
            : !isNormal
              ? (isLightTheme ? 'border-orange-300 bg-orange-50/50' : 'border-orange-500/50 bg-orange-500/5')
              : (isLightTheme ? 'border-gray-200 bg-white hover:border-gray-300' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600')
    }`}>
      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={menuItems}
          isLightTheme={isLightTheme}
        />
      )}
      {/* 选择框和当前使用标记 */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={(e) => onSelect(e.target.checked)} 
          className="w-4 h-4 rounded transition-transform hover:scale-110 cursor-pointer" 
        />
      </div>
      
      {/* 状态标签 */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
          account.status === 'active' || account.status === '正常' || account.status === '有效'
            ? (isLightTheme ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400')
            : account.status === 'banned' || account.status === '封禁' || account.status === '已封禁'
              ? (isLightTheme ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400')
              : (isLightTheme ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-400')
        }`}>{isNormal ? t('accounts.active') : isBanned ? t('accounts.banned') : account.status}</span>
      </div>

      <div className="p-4 pt-10 flex-1 flex flex-col">
        {/* 头像和邮箱 */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${
            account.provider === 'Google' ? (isLightTheme ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400') :
            account.provider === 'Github' ? (isLightTheme ? 'bg-gray-200 text-gray-700' : 'bg-gray-600 text-gray-200') :
            (isLightTheme ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400')
          }`}>
            {account.email[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className={`font-medium ${colors.text} text-sm truncate`}>{maskEmail(account.email)}</span>
              <button 
                onClick={() => onCopy(account.email, account.id)} 
                className="btn-icon p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 flex-shrink-0"
              >
                {copiedId === account.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
              </button>
            </div>
            <div className={`text-xs ${colors.textMuted}`}>{account.label || account.provider || t('common.noLabel')}</div>
          </div>
        </div>

        {/* 订阅类型和登录方式 */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${
            (subType.includes('PRO+') || subPlan.includes('PRO+'))
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
              : (subType.includes('PRO') || subPlan.includes('PRO'))
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm'
                : isLightTheme ? 'bg-gray-100 text-gray-600' : 'bg-gray-700 text-gray-300'
          }`}>
            {subPlan || 'Free'}
          </span>
          <span className={`text-xs px-2 py-1 rounded-lg ${
            account.provider === 'Google' ? (isLightTheme ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400')
              : account.provider === 'GitHub' ? (isLightTheme ? 'bg-gray-200 text-gray-700' : 'bg-gray-600 text-gray-200')
              : account.provider === 'BuilderId' ? (isLightTheme ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-400')
              : (isLightTheme ? 'bg-gray-100 text-gray-500' : 'bg-gray-700 text-gray-400')
          }`}>
            {account.provider || t('common.unknown')}
          </span>
          {isCurrentAccount && (
            <span className="text-xs px-2 py-1 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium">
              {t('common.currentlyUsing')}
            </span>
          )}
        </div>

        {/* 标签 */}
        {account.tags && account.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {account.tags.map(tagId => {
              const tag = tagDefinitions.find(t => t.id === tagId)
              if (!tag) return null
              return (
                <span 
                  key={tagId} 
                  className="text-xs px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: tag.color || '#8b5cf6' }}
                >
                  {tag.name}
                </span>
              )
            })}
          </div>
        )}

        {/* 配额进度 */}
        <div className={`p-3 rounded-xl mb-3 ${isLightTheme ? 'bg-gray-50' : 'bg-white/5'}`}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={colors.textMuted}>{t('common.usage')}</span>
            <span className={`font-semibold ${percent > 80 ? 'text-red-500' : percent > 50 ? 'text-yellow-500' : 'text-green-500'}`}>
              {Math.round(percent)}%
            </span>
          </div>
          <div className={`h-2 ${isLightTheme ? 'bg-gray-200' : 'bg-white/10'} rounded-full overflow-hidden mb-2`}>
            <div 
              className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(percent)}`} 
              style={{ width: `${Math.min(percent, 100)}%` }} 
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>{Math.round(used * 100) / 100} / {quota}</span>
            <span className={colors.textMuted}>{t('common.remaining')} {Math.round((quota - used) * 100) / 100}</span>
          </div>
          {/* 日期信息 - 单行紧凑显示 */}
          {(nextDateReset || (breakdown?.freeTrialInfo?.freeTrialExpiry && breakdown.freeTrialInfo.freeTrialStatus === 'ACTIVE') || breakdown?.bonuses?.some(b => b.status === 'ACTIVE' && b.expiresAt)) && (
            <div className={`mt-2 pt-2 border-t ${isLightTheme ? 'border-gray-200' : 'border-white/10'} flex items-center gap-2 flex-wrap text-[10px]`}>
              <Clock size={10} className={colors.textMuted} />
              {nextDateReset && (
                <span className={colors.textMuted}>{t('common.reset')} {new Date(nextDateReset * 1000).toLocaleDateString()}</span>
              )}
              {breakdown?.freeTrialInfo?.freeTrialExpiry && breakdown.freeTrialInfo.freeTrialStatus === 'ACTIVE' && (
                <span className="text-purple-500">· {t('home.trial')} {new Date(breakdown.freeTrialInfo.freeTrialExpiry * 1000).toLocaleDateString()}</span>
              )}
              {breakdown?.bonuses?.filter(b => b.status === 'ACTIVE' && b.expiresAt).slice(0, 1).map((bonus, idx) => (
                <span key={idx} className="text-amber-500">· {t('detail.bonusTotal')} {new Date(bonus.expiresAt * 1000).toLocaleDateString()}</span>
              ))}
            </div>
          )}
        </div>

        {/* Token 过期时间 */}
        {account.expiresAt && (
          <div className={`text-xs ${isExpired ? 'text-red-500' : colors.textMuted} flex items-center gap-1`}>
            <Clock size={12} />
            Token: {account.expiresAt}
            {isExpired && <span className="text-red-500 font-medium ml-1">{t('accountCard.tokenExpired')}</span>}
          </div>
        )}

        {/* 机器码 - 红色高亮 */}
        {account.machineId && (
          <div className={`text-xs flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg ${isLightTheme ? 'bg-red-50' : 'bg-red-500/10'}`}>
            <span className={`font-medium shrink-0 ${isLightTheme ? 'text-red-600' : 'text-red-400'}`}>机器码:</span>
            <span className={`font-mono text-[10px] break-all ${isLightTheme ? 'text-red-700' : 'text-red-300'}`}>{account.machineId}</span>
            <button 
              onClick={() => onCopy(account.machineId, `${account.id}-mid`)} 
              className={`btn-icon p-0.5 rounded flex-shrink-0 ${isLightTheme ? 'hover:bg-red-100' : 'hover:bg-red-500/20'}`}
            >
              {copiedId === `${account.id}-mid` ? <Check size={10} className="text-green-500" /> : <Copy size={10} className={isLightTheme ? 'text-red-500' : 'text-red-400'} />}
            </button>
          </div>
        )}

        {/* 右键提示 */}
        <div className={`text-xs ${colors.textMuted} mt-auto pt-2 text-center opacity-50`}>
          {t('accountCard.rightClickTip')}
        </div>
      </div>
    </div>
  )
})

export default AccountCard
