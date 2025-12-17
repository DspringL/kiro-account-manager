import { memo, useState, useEffect, useCallback } from 'react'
import { RefreshCw, Eye, Trash2, Copy, Check, Clock, Repeat, Edit2 } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { getUsagePercent, getProgressBarColor } from './hooks/useAccountStats'
import { getQuota, getUsed, getSubType, getSubPlan } from '../../utils/accountStats'

// 右键菜单组件
function ContextMenu({ x, y, onClose, items, isDark }) {
  useEffect(() => {
    const handleClick = () => onClose()
    const handleScroll = () => onClose()
    document.addEventListener('click', handleClick)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose])

  return (
    <div
      className={`fixed z-50 min-w-[160px] py-1 rounded-lg shadow-xl border ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, idx) =>
        item.divider ? (
          <div key={idx} className={`my-1 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`} />
        ) : (
          <button
            key={idx}
            onClick={() => { item.onClick(); onClose() }}
            disabled={item.disabled}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors disabled:opacity-50 ${
              item.danger
                ? (isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50')
                : (isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100')
            }`}
          >
            {item.icon && <item.icon size={14} />}
            {item.label}
          </button>
        )
      )}
    </div>
  )
}

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
  refreshingId,
  switchingId,
  isCurrentAccount,
}) {
  const { t, theme, colors } = useApp()
  const isDark = theme === 'dark'
  const [contextMenu, setContextMenu] = useState(null)

  // 右键菜单处理
  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // 右键菜单项
  const menuItems = [
    { icon: Repeat, label: t('accountCard.switchAccount'), onClick: () => onSwitch(account), disabled: switchingId === account.id },
    { icon: RefreshCw, label: t('accountCard.refresh'), onClick: () => onRefresh(account.id), disabled: refreshingId === account.id },
    { divider: true },
    { icon: Eye, label: t('accountCard.viewDetails'), onClick: () => onEdit(account) },
    { icon: Edit2, label: t('accountCard.editRemark'), onClick: () => onEditLabel(account) },
    { icon: Copy, label: t('common.copy') + ' Email', onClick: () => onCopy(account.email, account.id) },
    { divider: true },
    { icon: Trash2, label: t('accountCard.delete'), onClick: () => onDelete(account.id), danger: true },
  ]

  const quota = getQuota(account)
  const used = getUsed(account)
  const subType = getSubType(account)
  const subPlan = getSubPlan(account)
  const breakdown = account.usageData?.usageBreakdownList?.[0]
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
      className={`relative rounded-2xl border transition-all duration-200 hover:shadow-lg flex flex-col ${glowColor} ${
      isSelected 
        ? (isDark ? 'border-purple-500 bg-purple-500/10' : 'border-purple-400 bg-purple-50') 
        : isCurrentAccount
          ? (isDark ? 'border-green-500/50 bg-green-500/5' : 'border-green-400 bg-green-50/50')
          : isBanned
            ? (isDark ? 'border-red-500/50 bg-red-500/5' : 'border-red-300 bg-red-50/50')
            : !isNormal
              ? (isDark ? 'border-orange-500/50 bg-orange-500/5' : 'border-orange-300 bg-orange-50/50')
              : (isDark ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600' : 'border-gray-200 bg-white hover:border-gray-300')
    }`}>
      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={menuItems}
          isDark={isDark}
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
            ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700')
            : account.status === 'banned' || account.status === '封禁' || account.status === '已封禁'
              ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')
              : (isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600')
        }`}>{isNormal ? t('accounts.active') : isBanned ? t('accounts.banned') : account.status}</span>
      </div>

      <div className="p-4 pt-10 flex-1 flex flex-col">
        {/* 头像和邮箱 */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${
            account.provider === 'Google' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600') :
            account.provider === 'Github' ? (isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700') :
            (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')
          }`}>
            {account.email[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className={`font-medium ${colors.text} text-sm truncate`}>{account.email}</span>
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
                : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
          }`}>
            {subPlan || 'Free'}
          </span>
          <span className={`text-xs px-2 py-1 rounded-lg ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
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
            {account.tags.map(tag => (
              <span 
                key={tag} 
                className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-600'}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 配额进度 */}
        <div className={`p-3 rounded-xl mb-3 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={colors.textMuted}>{t('common.usage')}</span>
            <span className={`font-semibold ${percent > 80 ? 'text-red-500' : percent > 50 ? 'text-yellow-500' : 'text-green-500'}`}>
              {Math.round(percent)}%
            </span>
          </div>
          <div className={`h-2 ${isDark ? 'bg-white/10' : 'bg-gray-200'} rounded-full overflow-hidden mb-2`}>
            <div 
              className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(percent)}`} 
              style={{ width: `${Math.min(percent, 100)}%` }} 
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{Math.round(used * 100) / 100} / {quota}</span>
            <span className={colors.textMuted}>{t('common.remaining')} {Math.round((quota - used) * 100) / 100}</span>
          </div>
          {breakdown?.nextDateReset && (
            <div className={`text-xs ${colors.textMuted} mt-1 flex items-center gap-1`}>
              <Clock size={10} />
              {new Date(breakdown.nextDateReset * 1000).toLocaleDateString()} {t('common.reset')}
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

        {/* 右键提示 */}
        <div className={`text-xs ${colors.textMuted} mt-auto pt-2 text-center opacity-50`}>
          {t('accountCard.rightClickTip')}
        </div>
      </div>
    </div>
  )
})

export default AccountCard
