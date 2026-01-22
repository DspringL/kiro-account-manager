import { memo, useState, useCallback, useMemo } from 'react'
import { RefreshCw, Eye, Trash2, Copy, Check, Clock, Repeat, Edit2, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@mantine/core'
import { useTheme } from '../../../contexts/ThemeContext'
import { usePrivacy } from '../../../contexts/PrivacyContext'
import { getUsagePercent, getProgressBarColor } from './hooks/useAccountStats'
import { getQuota, getUsed, getSubType, getSubPlan, formatUsage } from '../../../utils/accountStats'
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
  const isLightTheme = theme === 'light' || theme === 'purple' || theme === 'green'
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
    ? colors.cardGlowCurrent
    : isBanned
      ? colors.cardGlowBanned
      : isNormal
        ? ''
        : colors.cardGlowWarning

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
      className={`relative rounded-2xl border hover:shadow-lg flex flex-col ${glowColor} ${
      isSelected 
        ? colors.cardSelected
        : isCurrentAccount
          ? colors.cardCurrent
          : isBanned
            ? colors.cardBanned
            : !isNormal
              ? colors.cardWarning
              : colors.cardNormal
    }`}
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
            },
          }}
          aria-label={t('accountCard.selectAccount')}
        />
      </div>
      
      {/* 状态标签 */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
          account.status === 'active' || account.status === '正常' || account.status === '有效'
            ? colors.badgeSuccess
            : account.status === 'banned' || account.status === '封禁' || account.status === '已封禁'
              ? colors.error
              : colors.badgeWarning
        }`}>{isNormal ? t('accounts.active') : isBanned ? t('accounts.banned') : account.status}</span>
      </div>

      <div className="p-6 pt-11 flex-1 flex flex-col gap-5">
        {/* 头像和邮箱 */}
        <div className="flex items-start gap-3.5">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold shadow-lg ${
            account.provider === 'Google' ? colors.providerGoogle :
            account.provider === 'Github' ? colors.providerGithub :
            colors.badgeInfo
          }`}>
            {account.email[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`font-semibold ${colors.text} text-base truncate`}>{maskEmail(account.email)}</span>
              <button 
                onClick={() => onCopy(account.email, account.id)} 
                className={`btn-icon p-1.5 rounded-lg ${colors.cardHover} flex-shrink-0 transition-all hover:scale-110`}
              >
                {copiedId === account.id ? <Check size={14} className={colors.iconSuccess} /> : <Copy size={14} className={colors.textMuted} />}
              </button>
            </div>
            <div className={`text-sm ${colors.textMuted}`}>{account.label || account.provider || t('common.noLabel')}</div>
          </div>
        </div>

        {/* 订阅类型和登录方式 */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`inline-flex px-3.5 py-2 rounded-xl text-xs font-bold shadow-md ${
            (subType.includes('ENTERPRISE') || subPlan.toUpperCase().includes('ENTERPRISE'))
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
              : (subType.includes('PRO+') || subPlan.includes('PRO+'))
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : (subType.includes('PRO') || subPlan.includes('PRO'))
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                  : (subPlan.toUpperCase().includes('KIRO'))
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                    : colors.badgeDisabled
          }`}>
            {subPlan || 'Free'}
          </span>
          <span className={`text-xs px-3.5 py-2 rounded-xl font-semibold shadow-sm ${
            account.provider === 'Google' ? colors.providerGoogle
              : account.provider === 'GitHub' ? colors.providerGithub
              : account.provider === 'BuilderId' ? colors.providerBuilderId
              : colors.providerDefault
          }`}>
            {account.provider || t('common.unknown')}
          </span>
          {isCurrentAccount && (
            <span className="text-xs px-3.5 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold shadow-md">
              {t('common.currentlyUsing')}
            </span>
          )}
        </div>

        {/* 分组 */}
        {account.groupId && (
          <div className="flex items-center gap-2">
            {(() => {
              const group = groupDefinitions.find(g => g.id === account.groupId)
              if (!group) return null
              return (
                <span 
                  className={`text-sm px-4 py-2 rounded-xl font-semibold shadow-sm ${colors.cardSecondary}`}
                  style={{ 
                    backgroundColor: group.color ? `${group.color}20` : undefined,
                    color: group.color || colors.textMuted
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
          <div className="flex items-center gap-2 flex-wrap">
            {account.tagLinks.map(tagLink => {
              const tag = tagDefinitions.find(t => t.id === tagLink.tagId)
              const tagName = tag?.name || tagLink.tagName || '未知标签'
              const tagColor = tag?.color || '#888888'
              const linkedAt = tagLink.linkedAt
              return (
                <span 
                  key={tagLink.tagId} 
                  className="text-sm px-4 py-2 rounded-full text-white cursor-default font-semibold shadow-md"
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
        <div className={`p-4 rounded-xl ${colors.cardSecondary}`}>
          <div className="flex items-center justify-between text-sm mb-3">
            <span className={`${colors.text} font-semibold`}>{t('common.usage')}</span>
            <span className={`font-bold text-base ${percent > 80 ? 'text-red-400' : percent > 50 ? 'text-yellow-400' : 'text-green-400'}`}>
              {Math.round(percent)}%
            </span>
          </div>
          <div className={`h-3 ${colors.cardSecondary} rounded-full overflow-hidden mb-3 shadow-inner`}>
            <div 
              className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(percent)}`} 
              style={{ width: `${Math.min(percent, 100)}%` }} 
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={`font-bold ${colors.text}`}>{formatUsage(used)} / {formatUsage(quota)}</span>
            <span className={`${colors.textMuted} font-medium`}>{t('common.remaining')} {formatUsage(quota - used)}</span>
          </div>
          {/* 日期信息 */}
          {(nextDateReset || (breakdown?.freeTrialInfo?.freeTrialExpiry && breakdown.freeTrialInfo.freeTrialStatus === 'ACTIVE') || breakdown?.bonuses?.some(b => b.status === 'ACTIVE' && b.expiresAt)) && (
            <div className={`mt-3 pt-3 border-t ${colors.cardBorder} flex items-center gap-2 flex-wrap text-[10px]`}>
              <Clock size={10} className={colors.textMuted} />
              {nextDateReset && (
                <span className={colors.dateReset}>{t('common.reset')} {new Date(nextDateReset * 1000).toLocaleDateString()}</span>
              )}
              {breakdown?.freeTrialInfo?.freeTrialExpiry && breakdown.freeTrialInfo.freeTrialStatus === 'ACTIVE' && (
                <span className={colors.dateTrial}>· {t('home.trial')} {new Date(breakdown.freeTrialInfo.freeTrialExpiry * 1000).toLocaleDateString()}</span>
              )}
              {breakdown?.bonuses?.filter(b => b.status === 'ACTIVE' && b.expiresAt).slice(0, 1).map((bonus, idx) => (
                <span key={idx} className={colors.dateBonus}>· {t('detail.bonusTotal')} {new Date(bonus.expiresAt * 1000).toLocaleDateString()}</span>
              ))}
            </div>
          )}
        </div>

        {/* Token 过期时间 */}
        {account.expiresAt && (
          <div className={`text-xs ${isExpired ? colors.dateExpired : colors.textMuted} flex items-center gap-1.5 px-3 py-2 rounded-lg ${colors.cardSecondary}`}>
            <Clock size={12} />
            <span>Token: {account.expiresAt}</span>
            {isExpired && <span className={`${colors.dateExpired} font-medium`}>({t('accountCard.tokenExpired')})</span>}
          </div>
        )}

        {/* 机器码 */}
        {account.machineId && (
          <div className={`text-sm flex items-center gap-2.5 px-4 py-3 rounded-xl ${colors.cardSecondary} shadow-sm`}>
            <span className={`font-bold shrink-0 ${colors.machineIdText}`}>机器码:</span>
            <span className={`font-mono text-xs break-all ${colors.machineIdTextSecondary}`}>{account.machineId}</span>
            <button 
              onClick={() => onCopy(account.machineId, `${account.id}-mid`)} 
              className={`btn-icon p-2 rounded-lg flex-shrink-0 ${colors.cardHover} transition-all hover:scale-110`}
            >
              {copiedId === `${account.id}-mid` ? <Check size={14} className={colors.iconSuccess} /> : <Copy size={14} className={colors.machineIdIcon} />}
            </button>
          </div>
        )}

        {/* 底部操作栏 */}
        <div className={`mt-auto pt-5 border-t ${colors.cardBorder} flex items-center justify-between`}>
          <span className={`text-xs ${colors.textMuted} opacity-70 font-medium`}>{t('accountCard.rightClickTip')}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(account) }}
              className={`p-2.5 rounded-xl ${colors.cardHover} ${colors.actionView} transition-all hover:scale-110 shadow-sm`}
              title={t('accountCard.viewDetails')}
            >
              <Eye size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh(account.id) }}
              disabled={refreshingId === account.id}
              className={`p-2.5 rounded-xl ${colors.cardHover} ${colors.actionRefresh} disabled:opacity-50 transition-all hover:scale-110 shadow-sm`}
              title={t('accountCard.refresh')}
            >
              <RefreshCw size={18} className={refreshingId === account.id ? 'animate-spin' : ''} />
            </button>
            {!isCurrentAccount && (
              <button
                onClick={(e) => { e.stopPropagation(); onSwitch(account) }}
                disabled={switchingId === account.id || isBanned}
                className={`p-2.5 rounded-xl ${colors.cardHover} ${colors.actionSwitch} disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-110 shadow-sm`}
                title={isBanned ? t('accountCard.bannedCannotSwitch') : t('accountCard.switchAccount')}
              >
                <Repeat size={18} className={switchingId === account.id ? 'animate-spin' : ''} />
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
