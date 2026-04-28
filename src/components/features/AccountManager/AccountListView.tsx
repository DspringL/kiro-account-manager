import { useRef, useMemo, memo, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Users, Plus, RefreshCw,Eye, Edit2, Trash2, Copy, UserX, ChevronUp, ChevronDown, Key, LogIn,LogOut } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { useApp } from '../../../hooks/useApp'
import { usePrivacy } from '../../../contexts/PrivacyContext'
import { getQuota, getUsed, formatUsage, getAccountDisplayName } from '../../../utils/accountStats'
import { getAccountStatusMeta, isBannedStatus, isUnavailableStatus } from '../../../utils/accountStatus'
import { getProviderDisplayName, isGitHubProvider } from '../../../utils/accountProvider'
import ContextMenu from './ContextMenu'
import { buildAccountListMaps } from './utils/accountListMaps'
import type { Account, TagDefinition, GroupDefinition } from '../../../types/account'
interface ListRowProps {
  account: Account
  isSelected: boolean
  isCurrent: boolean
  isRefreshing: boolean
  isRefreshingToken: boolean
  isSwitching: boolean
  tagMap: Map<string, any>
  groupMap: Map<string, any>
  t: (key: string) => string
  maskEmail: (email: string) => string
  onSelectOne: (id: string, checked: any) => void
  onSwitch: (account: Account) => void
  onRefresh: (id: string) => void
  onRefreshToken: (id: string) => void
  onEdit: (account: Account) => void
  onEditLabel: (account: Account) => void
  onDelete: (id: string) => void
  onDeleteRemote?: (account: Account) => void
  onCopy: (text: string, id: string) => void
}
const ListRow = memo(function ListRow({
  account,
  isSelected,
  isCurrent,
  isRefreshing,
  isRefreshingToken,
  isSwitching,
  tagMap,
  groupMap,
  t,
  maskEmail,
  onSelectOne,
  onSwitch,
  onRefresh,
  onRefreshToken,
  onEdit,
  onEditLabel,
  onDelete,
  onDeleteRemote,
  onCopy }: ListRowProps) {
  const [contextMenu, setContextMenu] = useState(null)
  const used = getUsed(account)
  const limit = getQuota(account)
  const remaining = Math.max(limit - used, 0)
  const usagePercent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const isBanned = isBannedStatus(account)
  const isUnavailable = isUnavailableStatus(account)
  const statusMeta = getAccountStatusMeta(account, t)
  //处理右键
  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const handleCopyJson = useCallback(() => {
    onCopy(JSON.stringify(account, null, 2), account.id)
  }, [account, onCopy])
  const getMenuItems = useCallback(() => [
    { icon: Eye, label: t('accountCard.viewDetails'), onClick: () => onEdit(account) },
    { icon: Edit2, label: t('accountCard.editRemark'), onClick: () => onEditLabel(account) },
    { icon: Copy, label: t('accountCard.copyJson'), onClick: handleCopyJson },
    { divider: true },
    { icon: RefreshCw, label: t('accountCard.refresh'), onClick: () => onRefresh(account.id), disabled: isRefreshing },
    { icon: Key, label: t('accountCard.refreshToken'), onClick: () => onRefreshToken?.(account.id), disabled: isRefreshingToken },
    isCurrent
      ? { icon: LogOut, label: t('accountCard.LogOut'), onClick: () => onSwitch(account), disabled: isSwitching, danger: true }
      : { icon: LogIn, label: t('accountCard.LogIn'), onClick: () => onSwitch(account), disabled: isSwitching || isUnavailable },
    { divider: true },
    { icon: Trash2, label: t('accountCard.delete'), onClick: () => onDelete(account.id), danger: true },
    ...(account.provider !== 'Enterprise' && !isBanned && onDeleteRemote ? [
      { icon: UserX, label: t('accountCard.deleteRemote'), onClick: () => onDeleteRemote(account), danger: true },
    ] : []),
  ], [t, account, handleCopyJson, onEdit, onEditLabel, onRefresh, onRefreshToken, onSwitch, onDelete, onDeleteRemote, isRefreshing, isRefreshingToken, isSwitching, isBanned, isUnavailable, isCurrent])
  return (
    <div
      onContextMenu={handleContextMenu}
      className={`flex items-center gap-3 px-4 h-[56px] border-b border-border hover:bg-muted/30 cursor-context-menu animate-stagger ${isCurrent ? "bg-green-500/5" : ""
        }`}
      style={{ animationDelay: `${Math.min(account._index || 0, 20) * 30}ms` }}
    >
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} items={getMenuItems()} />
      )}
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onSelectOne(account.id, checked)}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 cursor-pointer"
      />

      <div className="w-48 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate text-foreground">
            {account.email ? maskEmail(account.email) : getAccountDisplayName(account)}
          </span>
          {isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-green-500 text-white font-bold">LIVE</span>}
        </div>
        {account.label && <span className="text-[11px] text-muted-foreground truncate block mt-0.5">{account.label}</span>}
      </div>

      <span className={`text-[10px] px-2 py-1 rounded w-20 text-center shrink-0 font-bold border ${account.provider === 'Google' ? "bg-red-500/10 text-red-500 border-red-500/20"
          : isGitHubProvider(account.provider) ? "bg-slate-500/10 text-slate-500 border-slate-500/20"
            : "bg-muted text-muted-foreground border-border/50"
        }`}>{getProviderDisplayName(account.provider) || 'Unknown'}</span>

      <span className={`text-[10px] px-2 py-1 rounded w-20 text-center shrink-0 font-bold border ${account.usageData?.subscriptionInfo?.subscriptionTitle?.toUpperCase()?.includes('ENTERPRISE')
          ? "bg-orange-500 text-white border-orange-600"
          : account.usageData?.subscriptionInfo?.subscriptionTitle?.includes('PRO')
            ? "bg-primary text-primary-foreground border-primary/20"
            : "bg-muted text-muted-foreground border-border/50"
        }`}>{account.usageData?.subscriptionInfo?.subscriptionTitle || 'Free'}</span>

      <div className="w-24 shrink-0">
        <div className={`text-[11px] font-bold ${remaining > 0 ? 'text-green-500' : 'text-red-500'}`}>{formatUsage(used)}/{formatUsage(limit)}</div>
        <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden">
          <div className={`h-full rounded-full ${remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${usagePercent}%` }} />
        </div>
      </div>

      <span className={`text-[10px] px-2 py-1 rounded w-12 text-center shrink-0 font-bold uppercase ${statusMeta.key === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
        }`}>
        {statusMeta.label}
      </span>

      <span className="text-[10px] font-mono w-14 text-center shrink-0 text-muted-foreground bg-muted/50 py-0.5 rounded">
        {account.machineId?.slice(0, 6) || '-'}
      </span>

      <div className="w-28 shrink-0 text-[10px] text-muted-foreground font-medium">
        <span title="Token 过期">{account.expiresAt?.slice(11, 16) || '-'}</span>
        {account.usageData?.usageBreakdownList?.[0]?.freeTrialInfo?.freeTrialExpiry && (
          <span className="text-orange-500 ml-1" title="试用到期">
            · {new Date(account.usageData.usageBreakdownList[0].freeTrialInfo.freeTrialExpiry * 1000).toLocaleDateString().slice(5)}
          </span>
        )}
      </div>

      <div className="w-16 shrink-0">
        {account.groupId ? (() => {
          const group = groupMap.get(account.groupId)
          return group ? (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-bold truncate block max-w-full bg-muted/50 border border-border/50"
              style={{ color: group.color }}
              title={group.name}
            >
              {group.name}
            </span>
          ) : <span className="text-xs text-muted-foreground">-</span>
        })() : <span className="text-xs text-muted-foreground">-</span>}
      </div>

      <div className="flex-1 min-w-0">
        {account.tagLinks?.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap">
            {account.tagLinks.slice(0, 3).map(tagLink => {
              const tag = tagMap.get(tagLink.tagId)
              const tagName = tag?.name || tagLink.tagName || '标签'
              const tagColor = tag?.color || '#888888'
              return (
                <span
                  key={tagLink.tagId}
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium truncate max-w-[100px] border border-border/20"
                  style={{ backgroundColor: `${tagColor}20`, color: tagColor }}
                >
                  {tagName}
                </span>
              )
            })}
            {account.tagLinks.length > 3 && <span className="text-[10px] text-muted-foreground">+{account.tagLinks.length - 3}</span>}
          </div>
        ) : <span className="text-xs text-muted-foreground">-</span>}
      </div>
    </div>
  )
}, (prev: ListRowProps, next: ListRowProps) => (
  prev.account === next.account &&
  prev.isSelected === next.isSelected &&
  prev.isCurrent === next.isCurrent &&
  prev.isRefreshing === next.isRefreshing &&
  prev.isSwitching === next.isSwitching &&
  prev.tagMap === next.tagMap &&
  prev.groupMap === next.groupMap
))

interface AccountListViewProps {
  accounts: Account[]
  totalCount: number
  selectedIds: string[]
  selectedIdsSet?: Set<string>
  onSelectAll: (checked: any) => void
  onSelectOne: (id: string, checked: any) => void
  onSwitch: (account: Account) => void
  onRefresh: (id: string) => void
  onRefreshToken:(id:string) => void
  onEdit: (account: Account) => void
  onEditLabel: (account: Account) => void
  onDelete: (id: string) => void
  onDeleteRemote?: (account: Account) => void
  onCopy: (text: string, id: string) => void
  onAdd: () => void
  accountRowStateById?: Record<string, { isRefreshing?: boolean; isRefreshingToken?: boolean; isSwitching?: boolean }>
  localToken?: { refreshToken?: string } | null
  tagDefinitions?: TagDefinition[]
  groupDefinitions?: GroupDefinition[]
  sortBy?: string
  onSortChange?: (sort: string) => void
  [key: string]: any
}

function AccountListView({
  accounts,
  totalCount,
  selectedIds,
  selectedIdsSet,
  onSelectAll,
  onSelectOne,
  onSwitch,
  onRefresh,
  onRefreshToken,
  onEdit,
  onEditLabel,
  onDelete,
  onDeleteRemote,
  onCopy,
  onAdd,
  accountRowStateById = {},
  localToken,
  tagDefinitions = [],
  groupDefinitions = [],
  sortBy,
  onSortChange }: AccountListViewProps) {
  const { t } = useApp()
  const { maskEmail } = usePrivacy()
  const scrollRef = useRef(null)

  const _selectedIdsSet = selectedIdsSet || useMemo(() => new Set(selectedIds), [selectedIds])
  const localRefreshToken = localToken?.refreshToken
  const { tagMap, groupMap } = useMemo(() => buildAccountListMaps({
    tagDefinitions,
    groupDefinitions
  }), [tagDefinitions, groupDefinitions])

  const rowVirtualizer = useVirtualizer({
    count: accounts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 5,
  })

  const handleSort = useCallback((field) => {
    if (!onSortChange) return
    if (sortBy === `${field}Asc`) {
      onSortChange(`${field}Desc`)
    } else if (sortBy === `${field}Desc`) {
      onSortChange('default')
    } else {
      onSortChange(`${field}Asc`)
    }
  }, [sortBy, onSortChange])

  const SortIcon = ({ field }) => {
    if (sortBy === `${field}Asc`) return <ChevronUp size={12} className="inline ml-0.5" />
    if (sortBy === `${field}Desc`) return <ChevronDown size={12} className="inline ml-0.5" />
    return null
  }

  if (accounts.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <Users size={40} strokeWidth={1} className="opacity-50" />
          </div>
          <p className="font-medium mb-1">{t('common.noAccounts')}</p>
          <button onClick={onAdd} className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90">
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
          <Checkbox
            checked={selectedIds.length === accounts.length && accounts.length > 0}
            onCheckedChange={(checked) => onSelectAll(checked)}
          />
          <span className="text-sm text-muted-foreground font-medium">{selectedIds.length > 0 ? `${t('common.selected')} ${selectedIds.length}` : t('common.selectAll')}</span>
        </label>
        <span className="text-sm text-muted-foreground font-medium">{accounts.length === totalCount ? `共 ${totalCount} 个账号` : `${accounts.length} / ${totalCount} 个账号`}</span>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border border-border rounded-t-xl text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
        <div className="w-4" />
        <div className="w-48">邮箱</div>
        <div className="w-20 text-center">账号类型</div>
        <div className="w-20 text-center">订阅类型</div>
        <button type="button" onClick={() => handleSort('usage')} className="w-24 text-left hover:text-primary transition-colors">
          配额<SortIcon field="usage" />
        </button>
        <div className="w-12 text-center">状态</div>
        <div className="w-14 text-center">机器码</div>
        <button type="button" onClick={() => handleSort('trial')} className="w-28 text-left hover:text-primary transition-colors">
          过期|试用<SortIcon field="trial" />
        </button>
        <div className="w-16">分组</div>
        <div className="flex-1">标签</div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto border border-t-0 border-border rounded-b-xl glass-card no-scrollbar">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((vRow) => {
            const acc = accounts[vRow.index]
            return (
              <div key={acc.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}>
                <ListRow
                  account={acc}
                  isSelected={_selectedIdsSet.has(acc.id)}
                  isCurrent={localRefreshToken && acc.refreshToken === localRefreshToken}
                  isRefreshing={accountRowStateById[acc.id]?.isRefreshing ?? false}
                  isRefreshingToken={accountRowStateById[acc.id]?.isRefreshingToken ?? false}
                  isSwitching={accountRowStateById[acc.id]?.isSwitching ?? false}
                  tagMap={tagMap}
                  groupMap={groupMap}
                  t={t}
                  maskEmail={maskEmail}
                  onSelectOne={onSelectOne}
                  onSwitch={onSwitch}
                  onRefresh={onRefresh}
                  onRefreshToken={onRefreshToken}
                  onEdit={onEdit}
                  onEditLabel={onEditLabel}
                  onDelete={onDelete}
                  onDeleteRemote={onDeleteRemote}
                  onCopy={onCopy}
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
