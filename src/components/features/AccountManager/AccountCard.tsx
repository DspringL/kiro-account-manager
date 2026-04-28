import { memo, useCallback, useMemo, useState } from 'react'
import { Layers3, Copy, Check, Repeat, Key, Eye, Package, LogIn, LogOut, Edit, Trash2 } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'
import { usePrivacy } from '../../../contexts/PrivacyContext'
import { DialogRoot, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../shared/dialog'
import { getUsagePercent, getProgressBarColor } from './hooks/useAccountStats'
import { getQuota, getUsed, getSubType, getSubPlan, formatUsage, getAccountDisplayName } from '../../../utils/accountStats'
import { getAccountStatusMeta, isBannedStatus, isUnavailableStatus } from '../../../utils/accountStatus'
import { getProviderDisplayName, isGitHubProvider } from '../../../utils/accountProvider'
import { resolveAvailableModels } from './utils/availableModelsState'
import { Account, TagDefinition, GroupDefinition } from '../../../types/account'

interface AccountCardProps {
  account: Account;
  selectedIdsSet?: Set<string>;
  onSelect: (checked: boolean) => void;
  copiedId: string | null;
  onCopy: (text: string, id?: string) => void;
  onSwitch: (account: Account) => void;
  onRefresh: (id: string) => void;
  onRefreshToken?: (id: string) => void;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
  isRefreshing?: boolean;
  isRefreshingToken?: boolean;
  isSwitching?: boolean;
  isCurrentAccount: boolean;
  tagDefinitions?: TagDefinition[];
  groupDefinitions?: GroupDefinition[];
  availableModels?: any;
  availableModelsLoading?: boolean;
  availableModelsError?: string;
  onLoadAvailableModels?: (id: string, options?: { forceRefresh?: boolean }) => Promise<void>;
  onContextMenuOpen: (x: number, y: number) => void;
  index?: number;
}

const AccountCard = memo(function AccountCard({
  account,
  selectedIdsSet,
  onSelect,
  copiedId,
  onCopy,
  onSwitch,
  onRefresh,
  onRefreshToken,
  onEdit,
  onDelete,
  isRefreshing = false,
  isRefreshingToken = false,
  isSwitching = false,
  isCurrentAccount,
  tagDefinitions = [],
  groupDefinitions = [],
  availableModels = null,
  availableModelsLoading = false,
  availableModelsError = '',
  onLoadAvailableModels,
  onContextMenuOpen,
  index = 0
}: AccountCardProps) {
  const { t } = useApp()
  const { maskEmail } = usePrivacy()
  const [modelsModalOpen, setModelsModalOpen] = useState(false)

  const isSelected = selectedIdsSet?.has(account.id) ?? false

  const cardData = useMemo(() => {
    const quota = getQuota(account)
    const used = getUsed(account)
    const subType = getSubType(account)
    const subPlan = getSubPlan(account)
    const percent = getUsagePercent(used, quota)
    const statusMeta = getAccountStatusMeta(account, t)
    const isBanned = isBannedStatus(account)
    const isNormal = statusMeta.key === 'active'
    const isUnavailable = isUnavailableStatus(account)
    const isExpired = account.expiresAt && new Date(account.expiresAt.replace(/\//g, '-')) < new Date()
    const breakdown = account.usageData?.usageBreakdownList?.[0]
    const nextDateReset = account.usageData?.nextDateReset

    return { quota, used, subType, subPlan, percent, statusMeta, isBanned, isNormal, isUnavailable, isExpired, breakdown, nextDateReset }
  }, [account, t])

  const { quota, used, subPlan, percent, statusMeta, isBanned, isNormal, isUnavailable, breakdown, nextDateReset } = cardData
  const resolvedAvailableModels = useMemo(
    () => resolveAvailableModels(availableModels, account),
    [availableModels, account],
  )
  const hasLoadedAvailableModels = Array.isArray(resolvedAvailableModels)
  const availableModelsCache = account.availableModelsCache
  const availableModelsCachedAtText = availableModelsCache?.cachedAt
    ? new Date(availableModelsCache.cachedAt * 1000).toLocaleString()
    : ''

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onContextMenuOpen(e.clientX, e.clientY)
  }, [onContextMenuOpen])

  const handleOpenAvailableModels = useCallback(async () => {
    if (availableModelsLoading) return
    setModelsModalOpen(true)
    if (!hasLoadedAvailableModels) {
      await onLoadAvailableModels?.(account.id).catch(() => { })
    }
  }, [account.id, availableModelsLoading, hasLoadedAvailableModels, onLoadAvailableModels])

  const handleRefreshAvailableModels = useCallback(async () => {
    if (availableModelsLoading) return
    if (!modelsModalOpen) setModelsModalOpen(true)
    await onLoadAvailableModels?.(account.id, { forceRefresh: true }).catch(() => { })
  }, [account.id, availableModelsLoading, modelsModalOpen, onLoadAvailableModels])

  const cardStatusClass = isSelected
    ? "border-primary bg-primary/5 shadow-primary/10"
    : isCurrentAccount
      ? "border-green-500/50 bg-green-500/5 shadow-green-500/10"
      : isBanned
        ? "border-red-500/50 bg-red-500/5 shadow-red-500/10"
        : !isNormal
          ? "border-orange-500/40 bg-orange-500/5 shadow-orange-500/5"
          : "bg-card border-border hover:border-primary/30"

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`relative rounded-2xl border flex flex-col min-h-[240px] animate-stagger transition-all duration-300 ${cardStatusClass}`}
      style={{ animationDelay: `${Math.min(index, 20) * 30}ms` }}
    >
      {isCurrentAccount && (
        <div className="absolute -top-px -left-px -right-px h-1 bg-gradient-to-r from-green-500/80 to-emerald-500/80 rounded-t-2xl z-20" />
      )}

      <div className="absolute top-3 left-3 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
        />
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${statusMeta.key === 'active'
          ? "bg-green-500/10 text-green-500 border border-green-500/20"
          : statusMeta.tone === 'danger'
            ? "bg-red-500/10 text-red-500 border border-red-500/20"
            : "bg-orange-500/10 text-orange-500 border border-orange-500/20"
          }`}>{statusMeta.label}</span>
      </div>

      <div className="p-4 pt-9 flex-1 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm border border-border/50 ${account.provider === 'Google' ? "bg-red-500/10 text-red-500" :
            isGitHubProvider(account.provider) ? "bg-slate-500/10 text-slate-500" :
              "bg-primary/10 text-primary"
            }`}>
            {getAccountDisplayName(account)[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-bold text-foreground text-sm truncate">
                {account.email ? maskEmail(account.email) : getAccountDisplayName(account)}
              </span>
              <button
                onClick={() => onCopy(getAccountDisplayName(account), account.id)}
                className="p-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-primary transition-colors"
              >
                {copiedId === account.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              </button>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              {account.label || getProviderDisplayName(account.provider) || t('common.noLabel')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${(subPlan.toUpperCase().includes('ENTERPRISE'))
            ? 'bg-orange-500 text-white'
            : (subPlan.includes('PRO'))
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
            }`}>
            {subPlan || 'Free'}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-muted/50 text-muted-foreground text-[10px] font-medium border border-border/30">
            {getProviderDisplayName(account.provider) || t('common.unknown')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {account.groupId && (() => {
            const group = groupDefinitions.find(g => g.id === account.groupId)
            if (!group) return null
            return (
              <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-muted/40 border border-border/50" style={{ color: group.color }}>
                {group.name}
              </span>
            )
          })()}
          {account.tagLinks?.map(tagLink => {
            const tag = tagDefinitions.find(t => t.id === tagLink.tagId)
            return (
              <span key={tagLink.tagId} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                {tag?.name || tagLink.tagName}
              </span>
            )
          })}
        </div>

        <div className="mt-1 bg-muted/20 rounded-xl p-3 border border-border/30">
          <div className="flex items-center justify-between text-[11px] mb-2">
            <span className="text-muted-foreground font-medium">{t('common.usage')}</span>
            <span className={`font-bold ${percent > 80 ? 'text-red-500' : percent > 50 ? 'text-orange-500' : 'text-green-500'}`}>
              {Math.round(percent)}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-700 ${percent > 80 ? 'bg-red-500' : percent > 50 ? 'bg-orange-500' : 'bg-green-500'
                }`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-medium">
            <span className="text-foreground">{formatUsage(used)} / {formatUsage(quota)}</span>
            <span className="text-muted-foreground">{t('common.remaining')} {formatUsage(quota - used)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleOpenAvailableModels}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Package size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[11px] font-bold text-foreground">{t('accountCard.availableModels')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {availableModelsLoading ? (
                <Repeat size={12} className="animate-spin text-primary" />
              ) : (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                  {hasLoadedAvailableModels ? (resolvedAvailableModels as any[]).length : '--'}
                </span>
              )}
            </div>
          </button>
        </div>

        <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {account.machineId && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 border border-border/30 text-[10px] text-muted-foreground">
                <span className="font-mono truncate max-w-[80px]">{account.machineId}</span>
                <button onClick={() => onCopy(account.machineId!)} className="hover:text-primary transition-colors">
                  <Copy size={10} />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); onEdit(account) }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title={t('accountCard.viewDetails')}>
              <Eye size={16} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onEdit(account) }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title={t('accountCard.edit')}>
              <Edit size={16} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRefreshToken?.(account.id) }} disabled={isRefreshingToken} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors disabled:opacity-50" title={t('accountCard.refreshToken')}>
              <Key size={16} className={isRefreshingToken ? 'animate-spin' : ''} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRefresh(account.id) }} disabled={isRefreshing} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors disabled:opacity-50" title={t('accountCard.refreshQuota')}>
              <Repeat size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRefreshToken?.(account.id) }} disabled={isRefreshingToken} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors disabled:opacity-50" title={t('accountCard.refreshToken')}>
              <Key size={16} className={isRefreshingToken ? 'animate-spin' : ''} />
            </button>
            {isCurrentAccount ? (
              <button onClick={(e) => { e.stopPropagation(); onSwitch(account) }} disabled={isSwitching} className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50" title={t('accountCard.LogOut')}>
                <LogOut size={16} className={isSwitching ? 'animate-spin' : ''} />
              </button>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); onSwitch(account) }} disabled={isSwitching || isUnavailable} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50" title={t('accountCard.LogIn')}>
                <LogIn size={16} className={isSwitching ? 'animate-spin' : ''} />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onDelete(account.id) }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title={t('accountCard.delete')}>
              <Trash2 size={16} />
            </button>
            </div>
        </div>
      </div>

      <DialogRoot open={modelsModalOpen} onOpenChange={setModelsModalOpen}>
        <DialogContent maxWidth="600px">
          <DialogHeader icon={Package} className="border-b pb-4">
            <DialogTitle>{t('accountCard.availableModels')}</DialogTitle>
            <DialogDescription>{account.email || getAccountDisplayName(account)}</DialogDescription>
          </DialogHeader>
          <DialogBody className="py-6">
            {availableModelsLoading ? (
              <div className="flex justify-center py-12"><Repeat className="animate-spin text-primary" size={32} /></div>
            ) : availableModelsError ? (
              <div className="text-center py-12 text-red-500">{availableModelsError}</div>
            ) : hasLoadedAvailableModels ? (
              <div className="flex flex-wrap gap-2">
                {(resolvedAvailableModels as any[]).map(m => (
                  <span key={m.modelId} className="px-3 py-1.5 rounded-full bg-muted border border-border text-xs font-medium text-foreground">
                    {m.modelName || m.modelId}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">{t('accountCard.noAvailableModels')}</div>
            )}
          </DialogBody>
        </DialogContent>
      </DialogRoot>
    </div>
  )
})

export default AccountCard
