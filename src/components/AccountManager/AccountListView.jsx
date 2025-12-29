import { useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Users, Plus, RefreshCw, ArrowRightLeft, Eye, Edit2, Trash2 } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { usePrivacy } from '../../contexts/PrivacyContext'
import { getQuota, getUsed } from '../../utils/accountStats'

function AccountListView({
  accounts,
  totalCount,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onSwitch,
  onRefresh,
  onEdit,
  onEditLabel,
  onDelete,
  onAdd,
  refreshingId,
  switchingId,
  localToken,
  tagDefinitions = [],
}) {
  const { t, theme, colors } = useApp()
  const { maskEmail } = usePrivacy()
  const isLightTheme = theme === 'light'
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
    const hasTags = account.tags && account.tags.length > 0

    // 获取标签信息
    const getTagInfo = (tagId) => tagDefinitions.find(t => t.id === tagId)

    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${colors.cardBorder} ${isCurrent ? (isLightTheme ? 'bg-blue-50' : 'bg-blue-500/10') : ''} ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'} transition-colors`}>
        {/* 选择框 */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelectOne(account.id, e.target.checked)}
          className="w-4 h-4 rounded shrink-0 cursor-pointer"
        />

        {/* 邮箱 */}
        <div className="w-44 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${colors.text}`}>{maskEmail(account.email)}</span>
            {isCurrent && <span className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded shrink-0">当前</span>}
          </div>
          {account.label && <span className={`text-xs ${colors.textMuted} truncate block mt-0.5`}>{account.label}</span>}
        </div>

        {/* 标签 */}
        <div className="w-28 shrink-0">
          {hasTags ? (
            <div className="flex items-center gap-1 flex-wrap">
              {account.tags.slice(0, 2).map(tagId => {
                const tag = getTagInfo(tagId)
                if (!tag) return null
                return (
                  <span 
                    key={tagId} 
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ 
                      backgroundColor: `${tag.color || '#8b5cf6'}20`,
                      color: tag.color || '#8b5cf6',
                      border: `1px solid ${tag.color || '#8b5cf6'}40`
                    }}
                  >
                    {tag.name}
                  </span>
                )
              })}
              {account.tags.length > 2 && (
                <span className={`text-[10px] px-1 py-0.5 rounded ${isLightTheme ? 'bg-gray-100 text-gray-500' : 'bg-white/10 text-gray-400'}`}>
                  +{account.tags.length - 2}
                </span>
              )}
            </div>
          ) : (
            <span className={`text-xs ${colors.textMuted}`}>-</span>
          )}
        </div>

        {/* 提供商 */}
        <span className={`text-xs px-2 py-1 rounded w-20 text-center shrink-0 ${
          account.provider === 'Google' ? (isLightTheme ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400')
            : account.provider === 'GitHub' ? (isLightTheme ? 'bg-gray-200 text-gray-700' : 'bg-gray-500/20 text-gray-300')
            : account.provider === 'BuilderId' ? (isLightTheme ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-400')
            : (isLightTheme ? 'bg-gray-100' : 'bg-white/10') + ' ' + colors.textMuted
        }`}>
          {account.provider || 'Unknown'}
        </span>

        {/* 订阅类型 */}
        <span className={`text-xs px-2 py-1 rounded w-20 text-center shrink-0 ${
          account.usageData?.subscriptionInfo?.subscriptionTitle?.includes('PRO') 
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
            : (isLightTheme ? 'bg-gray-100' : 'bg-white/10') + ' ' + colors.textMuted
        }`}>
          {account.usageData?.subscriptionInfo?.subscriptionTitle || 'Free'}
        </span>

        {/* 配额 */}
        <div className="w-20 shrink-0">
          <div className={`text-xs ${remaining > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {used}/{limit}
          </div>
          <div className={`h-1 rounded-full ${isLightTheme ? 'bg-gray-200' : 'bg-white/10'} mt-1`}>
            <div
              className={`h-full rounded-full ${remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min((used / limit) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* 状态 */}
        <span className={`text-xs px-2 py-1 rounded w-14 text-center shrink-0 ${
          isBanned ? (isLightTheme ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400')
            : isActive ? (isLightTheme ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400')
            : (isLightTheme ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-400')
        }`}>
          {isBanned ? t('accounts.banned') : isActive ? t('accounts.active') : account.status}
        </span>

        {/* 机器码 - 红色高亮 */}
        <span className={`text-xs font-mono w-20 text-center shrink-0 ${isLightTheme ? 'text-red-600' : 'text-red-400'}`}>
          {account.machineId ? account.machineId.slice(0, 8) : '-'}
        </span>

        {/* 过期时间 */}
        <span className={`text-xs w-24 text-center shrink-0 ${colors.textMuted}`}>
          {account.expiresAt ? account.expiresAt.replace(/^\d{4}\//, '') : '-'}
        </span>

        {/* 试用到期 */}
        <span className={`text-xs w-20 text-center shrink-0 ${colors.textMuted}`}>
          {account.usageData?.usageBreakdownList?.[0]?.freeTrialInfo?.freeTrialExpiry 
            ? new Date(account.usageData.usageBreakdownList[0].freeTrialInfo.freeTrialExpiry * 1000).toLocaleDateString().replace(/^\d{4}\//, '')
            : '-'}
        </span>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 w-32 justify-center ml-auto">
          <button
            onClick={() => onEdit(account)}
            className={`p-1.5 rounded-lg ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'}`}
            title={t('accounts.detail')}
          >
            <Eye size={14} className={colors.textMuted} />
          </button>
          <button
            onClick={() => onEditLabel(account)}
            className={`p-1.5 rounded-lg ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'}`}
            title={t('accountCard.editRemark')}
          >
            <Edit2 size={14} className={colors.textMuted} />
          </button>
          <button
            onClick={() => onRefresh(account.id)}
            disabled={isRefreshing}
            className={`p-1.5 rounded-lg ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} disabled:opacity-50`}
            title={t('accounts.refresh')}
          >
            <RefreshCw size={14} className={`${colors.textMuted} ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => onSwitch(account)}
            disabled={isSwitching || isBanned}
            className={`p-1.5 rounded-lg ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} disabled:opacity-50`}
            title={t('accounts.switch')}
          >
            {isSwitching ? <RefreshCw size={14} className="animate-spin text-blue-500" /> : <ArrowRightLeft size={14} className={colors.textMuted} />}
          </button>
          <button
            onClick={() => onDelete(account.id)}
            className={`p-1.5 rounded-lg ${isLightTheme ? 'hover:bg-red-50' : 'hover:bg-red-500/20'}`}
            title={t('common.delete')}
          >
            <Trash2 size={14} className="text-red-500" />
          </button>
        </div>
      </div>
    )
  }, [colors, isLightTheme, t, refreshingId, switchingId, getQuotaInfo, getStatus, onSelectOne, onSwitch, onRefresh, onEdit, onEditLabel, onDelete, tagDefinitions, maskEmail])

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
        <div className={`flex items-center gap-3 px-4 py-3 ${isLightTheme ? 'bg-gray-50' : 'bg-white/5'} border ${colors.cardBorder} rounded-t-xl ${colors.textMuted} text-xs font-semibold uppercase tracking-wider`}>
          <div className="w-4" />
          <div className="w-44">邮箱</div>
          <div className="w-28">标签</div>
          <div className="w-20 text-center">提供商</div>
          <div className="w-20 text-center">订阅类型</div>
          <div className="w-20">配额</div>
          <div className="w-14 text-center">状态</div>
          <div className={`w-20 text-center ${isLightTheme ? 'text-red-600' : 'text-red-400'}`}>机器码</div>
          <div className="w-24 text-center">过期时间</div>
          <div className="w-20 text-center">试用到期</div>
          <div className="w-32 text-center ml-auto">操作</div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 ${colors.textMuted}`}>
          <div className={`w-20 h-20 rounded-full ${isLightTheme ? 'bg-gray-100' : 'bg-white/5'} flex items-center justify-center mb-4`}>
            <Users size={40} strokeWidth={1} className="opacity-50" />
          </div>
          <p className="font-medium mb-1">{t('common.noAccounts')}</p>
          <p className="text-sm opacity-75">{t('common.addAccountHint')}</p>
          <button onClick={onAdd} className={`mt-4 px-4 py-2 rounded-xl ${isLightTheme ? 'bg-gray-100 hover:bg-gray-200' : 'bg-white/10 hover:bg-white/20'}`}>
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
