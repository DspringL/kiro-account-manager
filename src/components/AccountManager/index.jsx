import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../hooks/useApp'
import { useDialog } from '../../contexts/DialogContext'
import { useAccounts } from './hooks/useAccounts'
import { useSwitchAccount } from './hooks/useSwitchAccount'
import { getTags } from '../../api/groupTag'
import { applyFilters } from './utils/filterUtils'
import AccountHeader from './AccountHeader'
import AccountTable from './AccountTable'
import AccountListView from './AccountListView'
import AddAccountModal from './AddAccountModal'
import ImportAccountModal from './ImportAccountModal'
import RefreshProgressModal from './RefreshProgressModal'
import AccountDetailModal from '../AccountDetailModal'
import EditAccountModal from './EditAccountModal'
import BatchTagModal from './BatchTagModal'
import ConfirmDialog from './ConfirmDialog'
import RedeemModal from './RedeemModal'
import { AccountListSkeleton, AccountTableSkeleton } from '../Skeleton'

function AccountManager() {
  const { t, colors } = useApp()
  const { showConfirm, showError, showSuccess } = useDialog()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [editingAccount, setEditingAccount] = useState(null)
  const [editingLabelAccount, setEditingLabelAccount] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showBatchTagModal, setShowBatchTagModal] = useState(false)
  const [showRedeemModal, setShowRedeemModal] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [selectedTag, setSelectedTag] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('accountViewMode') || 'card')
  const [tagDefinitions, setTagDefinitions] = useState([])
  const [advancedFilters, setAdvancedFilters] = useState({
    subscriptions: [],
    statuses: [],
    providers: [],
    usageRange: null
  })
  const [sortBy, setSortBy] = useState('trialAsc')
  
  // 当前登录的本地 token
  const [localToken, setLocalToken] = useState(null)
  
  // 用于管理复制提示的timer
  const copiedTimerRef = useRef(null)
  
  // 切换账号 hook
  const {
    switchingId,
    setSwitchingId,
    switchDialog,
    handleSwitchAccount,
    confirmSwitch,
    closeSwitchDialog,
  } = useSwitchAccount(setLocalToken)
  
  useEffect(() => {
    invoke('get_kiro_local_token').then(setLocalToken).catch(() => setLocalToken(null))
  }, [])

  // 加载标签定义
  const loadTagDefinitions = useCallback(() => {
    getTags().then(setTagDefinitions).catch(() => {})
  }, [])

  useEffect(() => {
    loadTagDefinitions()
  }, [])

  // 清理timer
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const {
    accounts,
    loading,
    loadAccounts,
    autoRefreshing,
    refreshProgress,
    lastRefreshTime,
    refreshingId,
    batchRefreshAccounts,
    handleRefreshStatus,
    handleExport,
  } = useAccounts()

  // 包装刷新函数，添加弹窗通知
  const handleRefreshWithNotify = useCallback(async (id) => {
    const result = await handleRefreshStatus(id)
    if (result.success) {
      // 只传递 usageData 作为原始响应
      await showSuccess(t('accounts.refreshSuccess'), t('accountCard.refresh') + t('common.success'), result.data?.usageData)
    } else if (result.error) {
      const errorMsg = result.error
      if (errorMsg.includes('BANNED')) {
        await showError(t('accounts.refreshFailed'), t('accounts.accountBanned'))
      } else if (errorMsg.includes('AUTH_ERROR') || errorMsg.includes('401') || errorMsg.includes('invalid')) {
        await showError(t('accounts.refreshFailed'), t('accounts.tokenInvalid'))
      } else {
        await showError(t('accounts.refreshFailed'), errorMsg.slice(0, 100))
      }
    }
    return result
  }, [handleRefreshStatus, showError, showSuccess, t])

  // 获取所有标签（从标签定义中获取）
  const allTags = useMemo(() => {
    // 收集账号中使用的标签 ID
    const usedTagIds = new Set()
    accounts.forEach(a => {
      if (a.tags) a.tags.forEach(id => usedTagIds.add(id))
    })
    // 返回被使用的标签定义
    return tagDefinitions.filter(t => usedTagIds.has(t.id))
  }, [accounts, tagDefinitions])

  // 当选中的标签不存在时，重置筛选（排除 __none__ 特殊值）
  useEffect(() => {
    if (selectedTag && selectedTag !== '__none__' && !allTags.find(t => t.id === selectedTag)) {
      setSelectedTag(null)
    }
  }, [allTags, selectedTag])

  // 获取试用到期时间戳
  const getTrialExpiry = (account) => {
    const expiry = account.usageData?.usageBreakdownList?.[0]?.freeTrialInfo?.freeTrialExpiry
    if (!expiry) return Infinity // 没有试用的排最后
    return expiry
  }

  // 获取使用率
  const getUsagePercent = (account) => {
    const breakdown = account.usageData?.usageBreakdownList?.[0]
    if (!breakdown) return 0
    const mainUsed = breakdown.currentUsage || 0
    const mainLimit = breakdown.usageLimit || 50
    const trialUsed = breakdown.freeTrialInfo?.currentUsage || 0
    const trialLimit = breakdown.freeTrialInfo?.usageLimit || 0
    const bonusUsed = (breakdown.bonuses || []).reduce((sum, b) => sum + (b.currentUsage || 0), 0)
    const bonusLimit = (breakdown.bonuses || []).reduce((sum, b) => sum + (b.usageLimit || 0), 0)
    const total = mainLimit + trialLimit + bonusLimit
    const used = mainUsed + trialUsed + bonusUsed
    return total > 0 ? (used / total) : 0
  }

  const filteredAccounts = useMemo(() => {
    let result = accounts.filter(a => {
      const term = searchTerm.toLowerCase()
      // 搜索过滤：邮箱、备注、标签名称
      const tagNames = (a.tags || []).map(id => tagDefinitions.find(t => t.id === id)?.name || '').join(' ').toLowerCase()
      const matchSearch = a.email.toLowerCase().includes(term) ||
        a.label.toLowerCase().includes(term) ||
        tagNames.includes(term)
      // 标签过滤（按 ID，__none__ 表示筛选无标签账号）
      const matchTag = !selectedTag || 
        (selectedTag === '__none__' ? (!a.tags || a.tags.length === 0) : (a.tags && a.tags.includes(selectedTag)))
      // 状态过滤
      const matchStatus = !selectedStatus || 
        (selectedStatus === 'active' && (a.status === 'active' || a.status === '正常' || a.status === '有效')) ||
        (selectedStatus === 'banned' && (a.status === 'banned' || a.status === '封禁' || a.status === '已封禁'))
      return matchSearch && matchTag && matchStatus
    })
    // 应用高级筛选
    result = applyFilters(result, advancedFilters)
    
    // 排序
    if (sortBy !== 'default') {
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case 'trialAsc':
            return getTrialExpiry(a) - getTrialExpiry(b)
          case 'trialDesc':
            return getTrialExpiry(b) - getTrialExpiry(a)
          case 'usageAsc':
            return getUsagePercent(a) - getUsagePercent(b)
          case 'usageDesc':
            return getUsagePercent(b) - getUsagePercent(a)
          case 'addedAsc':
            return new Date(a.addedAt || 0) - new Date(b.addedAt || 0)
          case 'addedDesc':
            return new Date(b.addedAt || 0) - new Date(a.addedAt || 0)
          default:
            return 0
        }
      })
    }
    return result
  }, [accounts, searchTerm, selectedTag, selectedStatus, tagDefinitions, advancedFilters, sortBy])

  const handleSearchChange = useCallback((term) => { setSearchTerm(term) }, [])
  const handleTagFilter = useCallback((tag) => { setSelectedTag(tag) }, [])
  const handleStatusFilter = useCallback((status) => { setSelectedStatus(status) }, [])
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode)
    localStorage.setItem('accountViewMode', mode)
  }, [])
  const handleSelectAll = useCallback((checked) => { setSelectedIds(checked ? filteredAccounts.map(a => a.id) : []) }, [filteredAccounts])
  const handleSelectOne = useCallback((id, checked) => { setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id)) }, [])
  const handleCopy = useCallback((text, id) => { 
    navigator.clipboard.writeText(text).catch(e => console.error('Copy failed:', e))
    setCopiedId(id)
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = setTimeout(() => setCopiedId(null), 1500)
  }, [])
  
  // 删除单个账号
  const handleDelete = useCallback(async (id) => {
    const confirmed = await showConfirm(t('accounts.delete'), t('accounts.confirmDelete'))
    if (confirmed) {
      await invoke('delete_account', { id })
      loadAccounts()
    }
  }, [showConfirm, loadAccounts, t])

  // 远程删除账号（从 AWS 服务端注销）
  const handleDeleteRemote = useCallback(async (account) => {
    const confirmed = await showConfirm(
      t('accountCard.deleteRemote'),
      t('accountCard.deleteRemoteConfirm')
    )
    if (confirmed) {
      try {
        await invoke('delete_account_remote', { id: account.id, deleteLocal: true })
        loadAccounts()
      } catch (e) {
        console.error('远程删除账号失败:', e)
      }
    }
  }, [showConfirm, loadAccounts, t])

  // 批量删除
  const onBatchDelete = useCallback(async () => {
    if (selectedIds.length === 0) return
    const confirmed = await showConfirm(t('accounts.batchDelete'), t('accounts.confirmDeleteMultiple', { count: selectedIds.length }))
    if (confirmed) {
      await invoke('delete_accounts', { ids: selectedIds })
      setSelectedIds([])
      loadAccounts()
    }
  }, [selectedIds, showConfirm, loadAccounts, t])

  return (
    <div className={`h-full flex flex-col ${colors.main}`}>
      <AccountHeader
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedCount={selectedIds.length}
        onBatchDelete={onBatchDelete}
        onBatchTag={() => setShowBatchTagModal(true)}
        onAdd={() => setShowAddModal(true)}
        onImport={() => setShowImportModal(true)}
        onExport={async () => {
          if (selectedIds.length === 0) {
            await showError(t('accounts.export'), t('accounts.exportSelectFirst') || '请先选择要导出的账号')
            return
          }
          handleExport(selectedIds)
        }}
        onRefresh={loadAccounts}
        onRefreshAll={async () => {
          if (selectedIds.length === 0) {
            await showError(t('accounts.refreshAll'), t('accounts.refreshSelectFirst') || '请先选择要刷新的账号')
            return
          }
          batchRefreshAccounts(selectedIds, accounts)
        }}
        onRedeem={() => setShowRedeemModal(true)}
        autoRefreshing={autoRefreshing}
        lastRefreshTime={lastRefreshTime}
        refreshProgress={refreshProgress}
        allTags={allTags}
        selectedTag={selectedTag}
        onTagFilter={handleTagFilter}
        selectedStatus={selectedStatus}
        onStatusFilter={handleStatusFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        advancedFilters={advancedFilters}
        onAdvancedFiltersChange={setAdvancedFilters}
      />
      <div className="flex-1 flex flex-col min-h-0">
      {loading ? (
        viewMode === 'card' ? <AccountListSkeleton count={8} /> : <AccountTableSkeleton count={8} />
      ) : viewMode === 'card' ? (
        <AccountTable
          accounts={filteredAccounts}
          totalCount={accounts.length}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          copiedId={copiedId}
          onCopy={handleCopy}
          onSwitch={handleSwitchAccount}
          onRefresh={handleRefreshWithNotify}
          onEdit={setEditingAccount}
          onEditLabel={setEditingLabelAccount}
          onDelete={handleDelete}
          onDeleteRemote={handleDeleteRemote}
          onAdd={() => setShowAddModal(true)}
          refreshingId={refreshingId}
          switchingId={switchingId}
          localToken={localToken}
          tagDefinitions={tagDefinitions}
        />
      ) : (
        <AccountListView
          accounts={filteredAccounts}
          totalCount={accounts.length}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          onSwitch={handleSwitchAccount}
          onRefresh={handleRefreshWithNotify}
          onEdit={setEditingAccount}
          onEditLabel={setEditingLabelAccount}
          onDelete={handleDelete}
          onDeleteRemote={handleDeleteRemote}
          onCopy={handleCopy}
          onAdd={() => setShowAddModal(true)}
          refreshingId={refreshingId}
          switchingId={switchingId}
          localToken={localToken}
          tagDefinitions={tagDefinitions}
          copiedId={copiedId}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      )}
      </div>
      {editingAccount && (
        <AccountDetailModal
          account={editingAccount}
          onClose={() => { setEditingAccount(null); loadAccounts() }}
        />
      )}
      {showAddModal && (<AddAccountModal onClose={() => setShowAddModal(false)} onSuccess={loadAccounts} />)}
      {editingLabelAccount && (<EditAccountModal account={editingLabelAccount} onClose={() => setEditingLabelAccount(null)} onSuccess={() => { loadAccounts(); loadTagDefinitions() }} />)}
      {showImportModal && (<ImportAccountModal onClose={() => setShowImportModal(false)} onSuccess={loadAccounts} />)}
      {showBatchTagModal && (<BatchTagModal accountIds={selectedIds} accounts={accounts} onClose={() => setShowBatchTagModal(false)} onSuccess={() => { loadAccounts(); loadTagDefinitions(); setSelectedIds([]) }} />)}
      {showRedeemModal && (<RedeemModal isOpen={showRedeemModal} onClose={() => setShowRedeemModal(false)} onSuccess={loadAccounts} colors={colors} />)}
      {autoRefreshing && (<RefreshProgressModal refreshProgress={refreshProgress} />)}
      
      {/* 切换账号弹窗 */}
      {switchDialog && (
        <ConfirmDialog
          type={switchDialog.type}
          title={switchDialog.title}
          message={switchDialog.message}
          onConfirm={switchDialog.type === 'confirm' ? confirmSwitch : closeSwitchDialog}
          onCancel={closeSwitchDialog}
          confirmText={switchDialog.type === 'confirm' ? t('switch.confirmBtn') : t('common.ok')}
        />
      )}
    </div>
  )
}

export default AccountManager

