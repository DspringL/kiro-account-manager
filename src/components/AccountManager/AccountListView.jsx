import { useRef, useMemo, memo, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Users, Plus, RefreshCw, ArrowRightLeft, Eye, Edit2, Trash2 } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { usePrivacy } from '../../contexts/PrivacyContext'
import { getQuota, getUsed } from '../../utils/accountStats'
import ContextMenu from './ContextMenu'

// 单行组件
const ListRow = memo(function ListRow({
  account, isSelected, isCurrent, refreshingId, switchingId, tagDefinitions, colors, isLightTheme, t, maskEmail,
  onSelectOne, onSwitch, onRefresh, onEdit, onEditLabel, onDelete,
}) {
  const [contextMenu, setContextMenu] = useState(null)
  const used = getUsed(account)
  const limit = getQuota(account)
  const remaining = limit - used
  const isBanned = account.status === 'banned' || account.status === '封禁' || account.status === '已封禁'
  const isActive = account.status === 'active' || account.status === '正常' || account.status === '有效'
  const isRefreshing = refreshingId === account.id
  const isSwitching = switchingId === account.id

  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const getMenuItems = useCallback(() => [
    { icon: Eye, label: t('accounts.detail'), onClick: () => onEdit(account) },
    { icon: Edit2, label: t('accountCard.editRemark'), onClick: () => onEditLabel(account) },
    { divider: true },
    { icon: RefreshCw, label: t('accounts.refresh'), onClick: () => onRefresh(account.id), disabled: isRefreshing },
    { icon: ArrowRightLeft, label: t('accounts.switch'), onClick: () => onSwitch(account), disabled: isSwitching || isBanned },
    { divider: true },
    { icon: Trash2, label: t('common.delete'), onClick: () => onDelete(account.id), danger: true },
  ], [t, account, onEdit, onEditLabel, onRefresh, onSwitch, onDelete, isRefreshing, isSwitching, isBanned])

  return (
    <div 
      onContextMenu={handleContextMenu}
      className={`flex items-center gap-3 px-4 py-2.5 border-b ${colors.cardBorder} ${isCurrent ? (isLightTheme ? 'bg-blue-50' : 'bg-blue-500/10') : ''} ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'} cursor-context-menu`}
    >
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} items={getMenuItems()} isLightTheme={isLightTheme} />
      )}
      <input type="checkbox" checked={isSelected} onChange={(e) => onSelectOne(account.id, e.target.checked)} className="w-4 h-4 rounded shrink-0 cursor-pointer" onClick={(e) => e.stopPropagation()} />
      
      {/* 邮箱 */}
      <div className="w-52 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${colors.text}`}>{maskEmail(account.email)}</span>
          {isCurrent && <span className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded shrink-0">当前</span>}
        </div>
        {account.label && <span className={`text-xs ${colors.textMuted} truncate block mt-0.5`}>{account.label}</span>}
      </div>

      {/* 标签 */}
      <div className="w-36 shrink-0">
        {account.tags?.length > 0 ? (
          <div className="flex items-center gap-1 overflow-hidden">
            {account.tags.slice(0, 1).map(tagId => {
              const tag = tagDefinitions.find(t => t.id === tagId)
              return tag ? <span key={tagId} className="text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[80px]" style={{ backgroundColor: `${tag.color}20`, color: tag.color }} title={tag.name}>{tag.name}</span> : null
            })}
            {account.tags.length > 1 && <span className={`text-[10px] ${colors.textMuted}`}>+{account.tags.length - 1}</span>}
          </div>
        ) : <span className={`text-xs ${colors.textMuted}`}>-</span>}
      </div>

      {/* 提供商 */}
      <span className={`text-xs px-2 py-1 rounded w-20 text-center shrink-0 ${
        account.provider === 'Google' ? (isLightTheme ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400')
        : account.provider === 'GitHub' ? (isLightTheme ? 'bg-gray-200 text-gray-700' : 'bg-gray-500/20 text-gray-300')
        : account.provider === 'BuilderId' ? (isLightTheme ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-400')
        : (isLightTheme ? 'bg-gray-100' : 'bg-white/10') + ' ' + colors.textMuted
      }`}>{account.provider || 'Unknown'}</span>

      {/* 订阅类型 */}
      <span className={`text-xs px-2 py-1 rounded w-20 text-center shrink-0 ${
        account.usageData?.subscriptionInfo?.subscriptionTitle?.includes('PRO') 
          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
          : (isLightTheme ? 'bg-gray-100' : 'bg-white/10') + ' ' + colors.textMuted
      }`}>{account.usageData?.subscriptionInfo?.subscriptionTitle || 'Free'}</span>

      {/* 配额 */}
      <div className="w-20 shrink-0">
        <div className={`text-xs ${remaining > 0 ? 'text-green-500' : 'text-red-500'}`}>{used}/{limit}</div>
        <div className={`h-1 rounded-full ${isLightTheme ? 'bg-gray-200' : 'bg-white/10'} mt-1`}>
          <div className={`h-full rounded-full ${remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min((used / limit) * 100, 100)}%` }} />
        </div>
      </div>

      {/* 状态 */}
      <span className={`text-xs px-2 py-1 rounded w-14 text-center shrink-0 ${
        isBanned ? (isLightTheme ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400')
        : isActive ? (isLightTheme ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400')
        : (isLightTheme ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-400')
      }`}>{isBanned ? t('accounts.banned') : isActive ? t('accounts.active') : account.status}</span>

      {/* 机器码 */}
      <span className={`text-xs font-mono w-16 text-center shrink-0 ${isLightTheme ? 'text-red-600' : 'text-red-400'}`}>
        {account.machineId?.slice(0, 6) || '-'}
      </span>

      {/* 到期时间（合并显示） */}
      <div className="w-32 shrink-0 text-[11px]">
        <span className={colors.textMuted} title="Token 过期">{account.expiresAt?.slice(5, 16).replace('/', '-').replace(' ', ' ') || '-'}</span>
        {account.usageData?.usageBreakdownList?.[0]?.freeTrialInfo?.freeTrialExpiry && (
          <span className={`ml-1 ${isLightTheme ? 'text-orange-600' : 'text-orange-400'}`} title="试用到期">
            试{new Date(account.usageData.usageBreakdownList[0].freeTrialInfo.freeTrialExpiry * 1000).toLocaleDateString().slice(5)}
          </span>
        )}
      </div>
    </div>
  )
}, (prev, next) => (
  prev.account === next.account && prev.isSelected === next.isSelected && prev.isCurrent === next.isCurrent &&
  prev.refreshingId === next.refreshingId && prev.switchingId === next.switchingId && prev.tagDefinitions === next.tagDefinitions && prev.isLightTheme === next.isLightTheme
))


function AccountListView({
  accounts, totalCount, selectedIds, onSelectAll, onSelectOne, onSwitch, onRefresh, onEdit, onEditLabel, onDelete, onAdd, refreshingId, switchingId, localToken, tagDefinitions = [],
}) {
  const { t, theme, colors } = useApp()
  const { maskEmail } = usePrivacy()
  const isLightTheme = theme === 'light'
  const scrollRef = useRef(null)

  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const localRefreshToken = localToken?.refreshToken

  const rowVirtualizer = useVirtualizer({
    count: accounts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 5,
  })

  if (accounts.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <div className={`flex flex-col items-center justify-center py-20 ${colors.textMuted}`}>
          <div className={`w-20 h-20 rounded-full ${isLightTheme ? 'bg-gray-100' : 'bg-white/5'} flex items-center justify-center mb-4`}>
            <Users size={40} strokeWidth={1} className="opacity-50" />
          </div>
          <p className="font-medium mb-1">{t('common.noAccounts')}</p>
          <p className="text-sm opacity-75">{t('common.addAccountHint')}</p>
          <button onClick={onAdd} className={`mt-4 px-4 py-2 rounded-xl ${isLightTheme ? 'bg-gray-100 hover:bg-gray-200' : 'bg-white/10 hover:bg-white/20'}`}>
            <Plus size={16} className="inline mr-1" />{t('common.addAccount')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      <div className="flex items-center justify-between mb-2 px-1 shrink-0">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={selectedIds.length === accounts.length && accounts.length > 0} onChange={(e) => onSelectAll(e.target.checked)} className="w-4 h-4 rounded" />
          <span className={`text-sm ${colors.textMuted}`}>{selectedIds.length > 0 ? `${t('common.selected')} ${selectedIds.length}` : t('common.selectAll')}</span>
        </label>
        <span className={`text-sm ${colors.textMuted}`}>{accounts.length === totalCount ? `共 ${totalCount} 个账号` : `${accounts.length} / ${totalCount} 个账号`}</span>
      </div>

      {/* 表头 */}
      <div className={`flex items-center gap-3 px-4 py-3 ${isLightTheme ? 'bg-gray-50' : 'bg-white/5'} border ${colors.cardBorder} rounded-t-xl ${colors.textMuted} text-xs font-semibold uppercase tracking-wider`}>
        <div className="w-4" />
        <div className="w-52">邮箱</div>
        <div className="w-36">标签</div>
        <div className="w-20 text-center">提供商</div>
        <div className="w-20 text-center">订阅类型</div>
        <div className="w-20">配额</div>
        <div className="w-14 text-center">状态</div>
        <div className={`w-16 text-center ${isLightTheme ? 'text-red-600' : 'text-red-400'}`}>机器码</div>
        <div className="w-32">到期</div>
      </div>

      <div ref={scrollRef} className={`flex-1 overflow-auto border border-t-0 ${colors.cardBorder} rounded-b-xl`}>
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((vRow) => {
            const acc = accounts[vRow.index]
            return (
              <div key={acc.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}>
                <ListRow
                  account={acc}
                  isSelected={selectedIdsSet.has(acc.id)}
                  isCurrent={localRefreshToken && acc.refreshToken === localRefreshToken}
                  refreshingId={refreshingId}
                  switchingId={switchingId}
                  tagDefinitions={tagDefinitions}
                  colors={colors}
                  isLightTheme={isLightTheme}
                  t={t}
                  maskEmail={maskEmail}
                  onSelectOne={onSelectOne}
                  onSwitch={onSwitch}
                  onRefresh={onRefresh}
                  onEdit={onEdit}
                  onEditLabel={onEditLabel}
                  onDelete={onDelete}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AccountListView
