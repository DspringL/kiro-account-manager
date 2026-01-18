import { memo, useState, useCallback, useMemo } from 'react'
import { RefreshCw, Eye, Trash2, Copy, Check, Clock, Repeat, Edit2, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@mantine/core'
import { useTheme } from '../../contexts/ThemeContext'
import { usePrivacy } from '../../contexts/PrivacyContext'
import { getUsagePercent, getProgressBarColor } from './hooks/useAccountStats'
import { getQuota, getUsed, getSubType, getSubPlan, formatUsage } from '../../utils/accountStats'
import ContextMenu from './ContextMenu'

const AccountCard = memo(function AccountCard({
  account,
  selectedIdsSet,
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
  groupDefinitions = [],
}) {
  const { t } = useTranslation()
  const { theme, colors } = useTheme()
  const { maskEmail } = usePrivacy()
  const isLightTheme = theme === 'light'
  const [contextMenu, setContextMenu] = useState(null)
  
  // 从 Set 中计算是否选中
  const isSelected = selectedIdsSet?.has(account.id) ?? false

  // 预计算常用值，避免重复计算
  const cardData = useMemo(() => {
    const quota = getQuota(account)
    const used = getUsed(account)
    const subType = getSubType(account)
    const subPlan = getSubPlan(account)
    const percent = getUsagePercent(used, quota)
    const isBanned = account.status === 'banned' || account.status === '封禁' || account.status === '已封禁'
    const isNormal = account.status === 'active' || account.status === '正常' || account.status === '有效'
    const isExpired = account.expiresAt && new Date(account.expiresAt.replace(/\//g, '-')) < new Date()
    const breakdown = account.usageData?.usageBreakdownList?.[0]
    const nextDateReset = account.usageData?.nextDateReset
    
    return { quota, used, subType, subPlan, percent, isBanned, isNormal, isExpired, breakdown, nextDateReset }
  }, [account])

  const { quota, used, subType, subPlan, percent, isBanned, isNormal, isExpired, breakdown, nextDateReset } = cardData

  // 右键菜单处理
  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // 复制账号 JSON
  const handleCopyJson = useCallback(() => {
    const exportData = {
      email: account.email,
      provider: account.provider,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      ...(account.authMethod && { authMethod: account.authMethod }),
      ...(account.clientIdHash && { clientIdHash: account.clientIdHash }),
      ...(account.clientId && { clientId: account.clientId }),
      ...(account.clientSecret && { clientSecret: account.clientSecret }),
      ...(account.region && { region: account.region }),
      ...(account.userId && { userId: account.userId }),
      ...(account.label && { label: account.label }),
      ...(account.tagLinks?.length && { tagLinks: account.tagLinks }),
      ...(account.machineId && { machineId: account.machineId }),
    }
    onCopy(JSON.stringify(exportData, null, 2), account.id)
  }, [account, onCopy])

  // 状态光环颜色
  const glowColor = isCurrentAccount
    ? 'shadow-green-500/30 hover:shadow-green-500/50'
    : isBanned
      ? 'shadow-red-500/30 hover:shadow-red-500/50'
      : isNormal
        ? ''
        : 'shadow-orange-500/30 hover:shadow-orange-500/50'

  // 右键菜单项 - 只在菜单打开时计算
  const getMenuItems = useCallback(() => [
    { icon: Eye, label: t('accountCard.viewDetails'), onClick: () => onEdit(account) },
    { icon: Edit2, label: t('accountCard.editRemark'), onClick: () => onEditLabel(account) },
    { icon: Copy, label: t('accountCard.copyJson'), onClick: handleCopyJson },
    { divider: true },
    { icon: RefreshCw, label: t('accountCard.refresh'), onClick: () => onRefresh(account.id), disabled: refreshingId === account.id },
    { icon: Repeat, label: t('accountCard.switchAccount'), onClick: () => onSwitch(account), disabled: switchingId === account.id || isBanned },
    { divider: true },
    { icon: Trash2, label: t('accountCard.delete'), onClick: () => onDelete(account.id), danger: true },
    ...(account.provider !== 'Enterprise' && !isBanned && onDeleteRemote ? [
      { icon: UserX, label: t('accountCard.deleteRemote'), onClick: () => onDeleteRemote(account), danger: true },
    ] : []),
  ], [t, account, handleCopyJson, onEdit, onEditLabel, onRefresh, onSwitch, onDelete, onDeleteRemote, refreshingId, switchingId, isBanned])

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`relative rounded-2xl border transition-all duration-200 hover:shadow-lg flex flex-col ${glowColor} ${
      isSelected 
        ? (isLightTheme ? 'border-purple-400 bg-purple-50' : 'border-purple-500 bg-purple-500/10') 
        : isCurrentAccount
          ? (isLightTheme ? 'border-green-400 bg-green-50/50' : 'border-green-500/50 bg-green-500/5')
          : isBanned
            ? (isLightTheme ? 'border-red-300 bg-red-50/50' : 'border-red-500/50 bg-red-500/5')
            : !isNormal
              ? (isLightTheme ? 'border-orange-300 bg-orange-50/50' : 'border-orange-500/50 bg-orange-500/5')
              : (isLightTheme ? 'border-gray-200 bg-white hover:border-gray-300' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600')
    }`}
      style={{ height: '100%', minHeight: '320px' }}
    >
      {/* 右键菜单 - 懒加载 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={getMenuItems()}
          isLightTheme={isLightTheme}
        />
      )}
      {/* 选择框 */}
      <div className="absolute top-3 left-3 z-10">
        <Checkbox
          checked={isSelected}
          onChange={(e) => onSelect(e.currentTarget.checked)}
          size="sm"
          styles={{
            root: { cursor: 'pointer' },
            input: { 
              cursor: 'pointer',
              backgroundColor: isSelected ? undefined : (isLightTheme ? 'white' : 'rgba(255, 255, 255, 0.1)'),
              borderColor: isSelected ? undefined : (isLightTheme ? '#d1d5db' : 'rgba(255, 255, 255, 0.2)'),
            },
          }}
          aria-label={t('accountCard.selectAccount')}
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
            (subType.includes('ENTERPRISE') || subPlan.toUpperCase().includes('ENTERPRISE'))
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
              : (subType.includes('PRO+') || subPlan.includes('PRO+'))
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
                : (subType.includes('PRO') || subPlan.includes('PRO'))
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm'
                  : (subPlan.toUpperCase().includes('KIRO'))
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-sm'
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

        {/* 分组 */}
        {account.groupId && (
          <div className="flex items-center gap-1.5 mb-2">
            {(() => {
              const group = groupDefinitions.find(g => g.id === account.groupId)
              if (!group) return null
              return (
                <span 
                  className="text-xs px-2 py-0.5 rounded-lg font-medium"
                  style={{ 
                    backgroundColor: group.color ? `${group.color}20` : (isLightTheme ? '#e5e7eb' : 'rgba(255,255,255,0.1)'),
                    color: group.color || (isLightTheme ? '#374151' : '#9ca3af')
                  }}
                >
                  {group.name}
                </span>
              )
            })()}
          </div>
        )}

        {/* 标签 */}
        {account.tagLinks && account.tagLinks.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {account.tagLinks.map(tagLink => {
              const tag = tagDefinitions.find(t => t.id === tagLink.tagId)
              // 优先用标签定义的名称，如果标签被删除则用 tagLink 中存储的名称
              const tagName = tag?.name || tagLink.tagName || '未知标签'
              const tagColor = tag?.color || '#888888'
              const linkedAt = tagLink.linkedAt
              return (
                <span 
                  key={tagLink.tagId} 
                  className="text-xs px-2 py-0.5 rounded-full text-white cursor-default"
                  style={{ backgroundColor: tagColor }}
                  title={linkedAt ? `关联于 ${linkedAt}` : ''}
                >
                  {tagName}
                </span>
              )
            })}
          </div>
        )}

        {/* 配额进度 */}
        <div className={`p-3 rounded-xl mb-3 ${colors.cardSecondary}`}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={colors.textMuted}>{t('common.usage')}</span>
            <span className={`font-semibold ${percent > 80 ? 'text-red-500' : percent > 50 ? 'text-yellow-500' : 'text-green-500'}`}>
              {Math.round(percent)}%
            </span>
          </div>
          <div className={`h-2 ${colors.cardSecondary} rounded-full overflow-hidden mb-2`}>
            <div 
              className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(percent)}`} 
              style={{ width: `${Math.min(percent, 100)}%` }} 
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium ${colors.text}`}>{formatUsage(used)} / {formatUsage(quota)}</span>
            <span className={colors.textMuted}>{t('common.remaining')} {formatUsage(quota - used)}</span>
          </div>
          {/* 日期信息 - 单行紧凑显示 */}
          {(nextDateReset || (breakdown?.freeTrialInfo?.freeTrialExpiry && breakdown.freeTrialInfo.freeTrialStatus === 'ACTIVE') || breakdown?.bonuses?.some(b => b.status === 'ACTIVE' && b.expiresAt)) && (
            <div className={`mt-2 pt-2 border-t ${colors.cardBorder} flex items-center gap-2 flex-wrap text-[10px]`}>
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
          <div className={`text-xs flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg ${colors.cardSecondary}`}>
            <span className={`font-medium shrink-0 ${isLightTheme ? 'text-red-600' : 'text-red-400'}`}>机器码:</span>
            <span className={`font-mono text-[10px] break-all ${isLightTheme ? 'text-red-700' : 'text-red-300'}`}>{account.machineId}</span>
            <button 
              onClick={() => onCopy(account.machineId, `${account.id}-mid`)} 
              className={`btn-icon p-0.5 rounded flex-shrink-0 ${colors.cardHover}`}
            >
              {copiedId === `${account.id}-mid` ? <Check size={10} className="text-green-500" /> : <Copy size={10} className={isLightTheme ? 'text-red-500' : 'text-red-400'} />}
            </button>
          </div>
        )}

        {/* 底部操作栏 */}
        <div className={`mt-auto pt-3 border-t ${colors.cardBorder} flex items-center justify-between`}>
          {/* 左侧：右键提示 */}
          <span className={`text-[10px] ${colors.textMuted} opacity-60`}>{t('accountCard.rightClickTip')}</span>
          {/* 右侧：快捷操作按钮 */}
          <div className="flex items-center gap-1">
            {/* 查看详情 */}
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(account) }}
              className={`p-1.5 rounded-lg transition-colors ${colors.cardHover} ${
                isLightTheme 
                  ? 'text-purple-600' 
                  : 'text-purple-400'
              }`}
              title={t('accountCard.viewDetails')}
            >
              <Eye size={14} />
            </button>
            {/* 刷新 */}
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh(account.id) }}
              disabled={refreshingId === account.id}
              className={`p-1.5 rounded-lg transition-colors ${colors.cardHover} ${
                isLightTheme 
                  ? 'text-blue-600' 
                  : 'text-blue-400'
              } disabled:opacity-50`}
              title={t('accountCard.refresh')}
            >
              <RefreshCw size={14} className={refreshingId === account.id ? 'animate-spin' : ''} />
            </button>
            {/* 切换账号 */}
            {!isCurrentAccount && (
              <button
                onClick={(e) => { e.stopPropagation(); onSwitch(account) }}
                disabled={switchingId === account.id || isBanned}
                className={`p-1.5 rounded-lg transition-colors ${colors.cardHover} ${
                  isLightTheme 
                    ? 'text-green-600' 
                    : 'text-green-400'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isBanned ? t('accountCard.bannedCannotSwitch') : t('accountCard.switchAccount')}
              >
                <Repeat size={14} className={switchingId === account.id ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // 自定义比较：只在关键 props 变化时重渲染
  const prevSelected = prevProps.selectedIdsSet?.has(prevProps.account.id) ?? false
  const nextSelected = nextProps.selectedIdsSet?.has(nextProps.account.id) ?? false
  
  return (
    prevProps.account === nextProps.account &&
    prevSelected === nextSelected &&
    prevProps.copiedId === nextProps.copiedId &&
    prevProps.refreshingId === nextProps.refreshingId &&
    prevProps.switchingId === nextProps.switchingId &&
    prevProps.isCurrentAccount === nextProps.isCurrentAccount &&
    prevProps.tagDefinitions === nextProps.tagDefinitions
  )
})

export default AccountCard
