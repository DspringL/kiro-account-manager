import { useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Users, Plus, RefreshCw, ArrowRightLeft, Eye, Edit2, Copy, Check } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { getQuota, getUsed } from '../../utils/accountStats'

function AccountListView({
  accounts,
  totalCount,
  selectedIds,
  onSelectAll,
  onSelectOne,
  copiedId,
  onCopy,
  onSwitch,
  onRefresh,
  onEdit,
  onEditLabel,
  onDelete,
  onAdd,
  refreshingId,
  switchingId,
  localToken,
}) {
  const { t, theme, colors } = useApp()
  const isDark = theme === 'dark'
  const scrollRef = useRef(null)

  const rowVirtualizer = useVirtualizer({
    count: accounts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 10,
  })

  // 计算配额（使用统一的工具函数）
  const getQuotaInfo = useCallback((account) => {
    const used = getUsed(account)
    const limit = getQuota(account)
    return { used, limit, remaining: limit - used }
  }, [])

  // 判断状态
  const getStatus = useCallback((account) => {
    const isBanned = account.status === 'banned' || account.status === '封禁' || account.status === '已封禁'
    const isActive = account.status === 'active' || account.status === '正常' || account.status === '有效'
    return { isBanned, isActive }
  }, [])

  const renderRow = useCallback((account, isSelected, isCurrent) => {
    const { used, limit, remaining } = getQuotaInfo(account)
    const { isBanned, isActive } = getStatus(account)
    const isRefreshing = refreshingId === account.id
    const isSwitching = switchingId === account.id

    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${colors.cardBorder} ${isCurrent ? (isDark ? 'bg-blue-500/10' : 'bg-blue-50') : ''} ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition-colors`}>
        {/* 选择框 */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelectOne(account.id, e.target.checked)}
          className="w-4 h-4 rounded shrink-0 cursor-pointer"
        />

        {/* 邮箱 */}
        <div className="w-52 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${colors.text}`}>{account.email}</span>
            {isCurrent && <span className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded shrink-0">当前</span>}
          </div>
          {account.label && <span className={`text-xs ${colors.textMuted} truncate block`}>{account.label}</span>}
        </div>

        {/* 提供商 */}
        <span className={`text-xs px-2 py-1 rounded w-20 text-center shrink-0 ${
          account.provider === 'Google' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')
            : account.provider === 'GitHub' ? (isDark ? 'bg-gray-500/20 text-gray-300' : 'bg-gray-200 text-gray-700')
            : account.provider === 'BuilderId' ? (isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600')
            : (isDark ? 'bg-white/10' : 'bg-gray-100') + ' ' + colors.textMuted
        }`}>
          {account.provider || 'Unknown'}
        </span>

        {/* 订阅类型 */}
        <span className={`text-xs px-2 py-1 rounded w-20 text-center shrink-0 ${
          account.usageData?.subscriptionInfo?.subscriptionTitle?.includes('PRO') 
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
            : (isDark ? 'bg-white/10' : 'bg-gray-100') + ' ' + colors.textMuted
        }`}>
          {account.usageData?.subscriptionInfo?.subscriptionTitle || 'Free'}
        </span>

        {/* 配额 */}
        <div className="w-20 shrink-0">
          <div className={`text-xs ${remaining > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {used}/{limit}
          </div>
          <div className={`h-1 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-200'} mt-1`}>
            <div
              className={`h-full rounded-full ${remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min((used / limit) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* 状态 */}
        <span className={`text-xs px-2 py-1 rounded w-14 text-center shrink-0 ${
          isBanned ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')
            : isActive ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700')
            : (isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600')
        }`}>
          {isBanned ? t('accounts.banned') : isActive ? t('accounts.active') : account.status}
        </span>

        {/* 过期时间 */}
        <span className={`text-xs w-24 text-center shrink-0 ${colors.textMuted}`}>
          {account.expiresAt ? account.expiresAt.replace(/^\d{4}\//, '') : '-'}
        </span>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 w-28 justify-center ml-auto">
          <button
            onClick={() => onEdit(account)}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
            title={t('accounts.detail')}
          >
            <Eye size={14} className={colors.textMuted} />
          </button>
          <button
            onClick={() => onEditLabel(account)}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
            title={t('accountCard.editRemark')}
          >
            <Edit2 size={14} className={colors.textMuted} />
          </button>
          <button
            onClick={() => onRefresh(account.id)}
            disabled={isRefreshing}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} disabled:opacity-50`}
            title={t('accounts.refresh')}
          >
            <RefreshCw size={14} className={`${colors.textMuted} ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => onSwitch(account)}
            disabled={isSwitching || isBanned}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} disabled:opacity-50`}
            title={t('accounts.switch')}
          >
            {isSwitching ? <RefreshCw size={14} className="animate-spin text-blue-500" /> : <ArrowRightLeft size={14} className={colors.textMuted} />}
          </button>
        </div>
      </div>
    )
  }, [colors, isDark, t, refreshingId, switchingId, getQuotaInfo, getStatus, onSelectOne, onSwitch, onRefresh, onEdit, onEditLabel])

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      {accounts.length > 0 && (
        <div className="flex items-center justify-between mb-2 px-1 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.length === accounts.length && accounts.length > 0}
              onChange={(e) => onSelectAll(e.target.checked)}
              className="w-4 h-4 rounded transition-transform hover:scale-110"
            />
            <span className={`text-sm ${colors.textMuted}`}>
              {selectedIds.length > 0 ? `${t('common.selected')} ${selectedIds.length}` : t('common.selectAll')}
            </span>
          </label>
          <span className={`text-sm ${colors.textMuted}`}>
            {accounts.length === totalCount ? `共 ${totalCount} 个账号` : `${accounts.length} / ${totalCount} 个账号`}
          </span>
        </div>
      )}

      {/* 表头 */}
      {accounts.length > 0 && (
        <div className={`flex items-center gap-3 px-4 py-3 ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-t-xl ${colors.textMuted} text-xs font-semibold uppercase tracking-wider`}>
          <div className="w-4" />
          <div className="w-52">邮箱</div>
          <div className="w-20 text-center">提供商</div>
          <div className="w-20 text-center">订阅类型</div>
          <div className="w-20">配额</div>
          <div className="w-14 text-center">状态</div>
          <div className="w-24 text-center">过期时间</div>
          <div className="w-28 text-center ml-auto">操作</div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 ${colors.textMuted}`}>
          <div className={`w-20 h-20 rounded-full ${isDark ? 'bg-white/5' : 'bg-gray-100'} flex items-center justify-center mb-4`}>
            <Users size={40} strokeWidth={1} className="opacity-50" />
          </div>
          <p className="font-medium mb-1">{t('common.noAccounts')}</p>
          <p className="text-sm opacity-75">{t('common.addAccountHint')}</p>
          <button onClick={onAdd} className={`mt-4 px-4 py-2 rounded-xl ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}>
            <Plus size={16} className="inline mr-1" />
            {t('common.addAccount')}
          </button>
        </div>
      ) : (
        <div ref={scrollRef} className={`flex-1 overflow-auto border border-t-0 ${colors.cardBorder} rounded-b-xl`}>
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const account = accounts[virtualRow.index]
              const isSelected = selectedIds.includes(account.id)
              const isCurrent = localToken?.refreshToken && account.refreshToken === localToken.refreshToken
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {renderRow(account, isSelected, isCurrent)}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountListView
