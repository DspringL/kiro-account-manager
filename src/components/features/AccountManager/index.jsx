import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import { useAccounts } from './hooks/useAccounts'
import { useSwitchAccount } from './hooks/useSwitchAccount'
import { getTags, getGroups } from '../../../api/groupTag'
import { applyFilters } from './utils/filterUtils'
import { cn } from '../../../utils/cn'
import { showSuccess, showError } from '../../../utils/toast.jsx'
import AccountHeader from './AccountHeader'
import AccountTable from './AccountTable'
import AccountListView from './AccountListView'
import ImportAccountModal from './ImportAccountModal'
import RefreshProgressModal from './RefreshProgressModal'
import AccountDetailModal from '../../modals/AccountDetailModal'
import EditAccountModal from './EditAccountModal'
import BatchTagModal from './BatchTagModal'
import ConfirmModal from './ConfirmModal'
import { AccountListSkeleton, AccountTableSkeleton } from '../../shared/Skeleton'

function AccountManager() {
  const { t, colors } = useApp()
  const { showConfirm } = useDialog()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [editingAccount, setEditingAccount] = useState(null)
  const [editingLabelAccount, setEditingLabelAccount] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showBatchTagModal, setShowBatchTagModal] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [selectedTag, setSelectedTag] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('accountViewMode') || 'card')
  const [tagDefinitions, setTagDefinitions] = useState([])
  const [groupDefinitions, setGroupDefinitions] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
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
    getTags()
      .then(tags => {
        setTagDefinitions(tags)
      })
      .catch(err => {
        console.error('标签加载失败:', err)
      })
  }, [])

  // 加载分组定义
  const loadGroupDefinitions = useCallback(() => {
    getGroups().then(setGroupDefinitions).catch(() => {})
  }, [])

  useEffect(() => {
    loadTagDefinitions()
    loadGroupDefinitions()
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

  // 包装刷新函数，添加 toast 通知
  const handleRefreshWithNotify = useCallback(async (id) => {
    const result = await handleRefreshStatus(id)
    if (result.success) {
      showSuccess(t('accounts.refreshSuccess'))
    } else if (result.error) {
      const errorMsg = result.error
      if (errorMsg.includes('BANNED')) {
        showError(t('accounts.accountBanned'))
      } else if (errorMsg.includes('AUTH_ERROR') || errorMsg.includes('401') || errorMsg.includes('invalid')) {
        showError(t('accounts.tokenInvalid'))
      } else {
        showError(errorMsg.slice(0, 100))
      }
    }
    return result
  }, [handleRefreshStatus, t])

  // 获取所有标签（从标签定义中获取）
  const allTags = useMemo(() => {
    // 收集账号中使用的标签 ID（从 tagLinks 中提取）
    const usedTagIds = new Set()
    accounts.forEach(a => {
      if (a.tagLinks) a.tagLinks.forEach(link => usedTagIds.add(link.tagId))
    })
    // 返回被使用的标签定义
    return tagDefinitions.filter(t => usedTagIds.has(t.id))
  }, [accounts, tagDefinitions])

  // 当选中的标签不存在时，重置筛选（排除 __none__ 和 __has__ 特殊值）
  useEffect(() => {
    if (selectedTag && selectedTag !== '__none__' && selectedTag !== '__has__' && !allTags.find(t => t.id === selectedTag)) {
      setSelectedTag(null)
    }
  }, [allTags, selectedTag])

  // 获取试用到期时间戳
  const getTrialExpiry = (account) => {
    const expiry = account.usageData?.usageBreakdownList?.[0]?.freeTrialInfo?.freeTrialExpiry
    if (!expiry) return Infinity // 没有试用的排最后
    return expiry
  }

  // 获取使用量（已用绝对值）
  const getUsageAmount = (account) => {
    const breakdown = account.usageData?.usageBreakdownList?.[0]
    if (!breakdown) return 0
    const mainUsed = breakdown.currentUsage || 0
    const trialUsed = breakdown.freeTrialInfo?.currentUsage || 0
    const bonusUsed = (breakdown.bonuses || []).reduce((sum, b) => sum + (b.currentUsage || 0), 0)
    return mainUsed + trialUsed + bonusUsed
  }

  const filteredAccounts = useMemo(() => {
    let result = accounts.filter(a => {
      const term = searchTerm.toLowerCase()
      // 搜索过滤：邮箱、备注、标签名称（从 tagLinks 中提取）
      const tagNames = (a.tagLinks || []).map(link => tagDefinitions.find(t => t.id === link.tagId)?.name || '').join(' ').toLowerCase()
      const matchSearch = a.email.toLowerCase().includes(term) ||
        a.label.toLowerCase().includes(term) ||
        tagNames.includes(term)
      // 分组过滤（__none__ 表示无分组，__has__ 表示有分组）
      const matchGroup = !selectedGroup ||
        (selectedGroup === '__none__' ? !a.groupId :
         selectedGroup === '__has__' ? !!a.groupId :
         a.groupId === selectedGroup)
      // 标签过滤（按 ID，__none__ 表示筛选无标签账号，__has__ 表示筛选有标签账号）
      const tagIds = (a.tagLinks || []).map(link => link.tagId)
      const matchTag = !selectedTag || 
        (selectedTag === '__none__' ? tagIds.length === 0 : 
         selectedTag === '__has__' ? tagIds.length > 0 :
         tagIds.includes(selectedTag))
      // 状态过滤
      const matchStatus = !selectedStatus || 
        (selectedStatus === 'active' && (a.status === 'active' || a.status === '正常' || a.status === '有效')) ||
        (selectedStatus === 'banned' && (a.status === 'banned' || a.status === '封禁' || a.status === '已封禁'))
      return matchSearch && matchGroup && matchTag && matchStatus
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
            return getUsageAmount(a) - getUsageAmount(b)
          case 'usageDesc':
            return getUsageAmount(b) - getUsageAmount(a)
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
  }, [accounts, searchTerm, selectedGroup, selectedTag, selectedStatus, tagDefinitions, advancedFilters, sortBy])

  const handleSearchChange = useCallback((term) => { setSearchTerm(term) }, [])
  const handleGroupFilter = useCallback((group) => { setSelectedGroup(group) }, [])
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
    <div className={cn('h-full flex flex-col', colors.main)}>
      <div className="flex-1 flex flex-col min-h-0">
      <AccountHeader
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedCount={selectedIds.length}
        onBatchDelete={onBatchDelete}
        onBatchTag={() => setShowBatchTagModal(true)}
        onAdd={() => setShowImportModal(true)}
        onImport={() => setShowImportModal(true)}
        onExport={async () => {
          if (selectedIds.length === 0) {
            showError(t('accounts.exportSelectFirst') || '请先选择要导出的账号')
            return
          }
          handleExport(selectedIds)
        }}
        onRefresh={loadAccounts}
        onRefreshAll={async () => {
          if (selectedIds.length === 0) {
            showError(t('accounts.refreshSelectFirst') || '请先选择要刷新的账号')
            return
          }
          batchRefreshAccounts(selectedIds, accounts)
        }}
        autoRefreshing={autoRefreshing}
        lastRefreshTime={lastRefreshTime}
        refreshProgress={refreshProgress}
        allGroups={groupDefinitions}
        selectedGroup={selectedGroup}
        onGroupFilter={handleGroupFilter}
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
          onAdd={() => setShowImportModal(true)}
          refreshingId={refreshingId}
          switchingId={switchingId}
          localToken={localToken}
          tagDefinitions={tagDefinitions}
          groupDefinitions={groupDefinitions}
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
          groupDefinitions={groupDefinitions}
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
      {editingLabelAccount && (<EditAccountModal account={editingLabelAccount} onClose={() => setEditingLabelAccount(null)} onSuccess={() => { loadAccounts(); loadTagDefinitions(); loadGroupDefinitions() }} />)}
      {showImportModal && (<ImportAccountModal onClose={() => setShowImportModal(false)} onSuccess={loadAccounts} />)}
      {showBatchTagModal && (<BatchTagModal accountIds={selectedIds} accounts={accounts} onClose={() => setShowBatchTagModal(false)} onSuccess={() => { loadAccounts(); loadTagDefinitions(); setSelectedIds([]) }} />)}
      {autoRefreshing && (<RefreshProgressModal refreshProgress={refreshProgress} />)}
      
      {/* 切换账号弹窗 */}
      {switchDialog && (
        <ConfirmModal
          type={switchDialog.type}
          title={switchDialog.title}
          message={switchDialog.message}
          onConfirm={switchDialog.type === 'confirm' ? confirmSwitch : closeSwitchDialog}
          onCancel={closeSwitchDialog}
          confirmText={switchDialog.type === 'confirm' ? t('switch.confirmBtn') : t('common.ok')}
        />
      )}
      </div>
    </div>
  )
}

export default AccountManager

