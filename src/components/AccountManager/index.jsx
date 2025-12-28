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
import ConfirmDialog from './ConfirmDialog'
import { AccountListSkeleton } from '../Skeleton'

function AccountManager() {
  const { t, colors } = useApp()
  const { showConfirm } = useDialog()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [editingAccount, setEditingAccount] = useState(null)
  const [editingLabelAccount, setEditingLabelAccount] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
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

  // 当选中的标签不存在时，重置筛选
  useEffect(() => {
    if (selectedTag && !allTags.find(t => t.id === selectedTag)) {
      setSelectedTag(null)
    }
  }, [allTags, selectedTag])

  const filteredAccounts = useMemo(() => {
    let result = accounts.filter(a => {
      const term = searchTerm.toLowerCase()
      // 搜索过滤：邮箱、备注、标签名称
      const tagNames = (a.tags || []).map(id => tagDefinitions.find(t => t.id === id)?.name || '').join(' ').toLowerCase()
      const matchSearch = a.email.toLowerCase().includes(term) ||
        a.label.toLowerCase().includes(term) ||
        tagNames.includes(term)
      // 标签过滤（按 ID）
      const matchTag = !selectedTag || (a.tags && a.tags.includes(selectedTag))
      // 状态过滤
      const matchStatus = !selectedStatus || 
        (selectedStatus === 'active' && (a.status === 'active' || a.status === '正常' || a.status === '有效')) ||
        (selectedStatus === 'banned' && (a.status === 'banned' || a.status === '封禁' || a.status === '已封禁'))
      return matchSearch && matchTag && matchStatus
    })
    // 应用高级筛选
    return applyFilters(result, advancedFilters)
  }, [accounts, searchTerm, selectedTag, selectedStatus, tagDefinitions, advancedFilters])

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
      // 删除账号前，清理绑定的机器码
      try {
        await invoke('unbind_machine_id_from_account', { accountId: id }).catch(() => {})
      } catch (e) {
        console.error('清理机器码绑定失败:', e)
      }
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
        // 清理绑定的机器码
        await invoke('unbind_machine_id_from_account', { accountId: account.id }).catch(() => {})
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
      // 删除账号前，清理所有绑定的机器码
      try {
        await Promise.all(
          selectedIds.map(id => invoke('unbind_machine_id_from_account', { accountId: id }).catch(() => {}))
        )
      } catch (e) {
        console.error('清理机器码绑定失败:', e)
      }
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
        onAdd={() => setShowAddModal(true)}
        onImport={() => setShowImportModal(true)}
        onExport={() => handleExport(selectedIds)}
        onRefresh={loadAccounts}
        onRefreshAll={() => batchRefreshAccounts(selectedIds, accounts)}
        autoRefreshing={autoRefreshing}
        lastRefreshTime={lastRefreshTime}
        refreshProgress={refreshProgress}
        allTags={allTags}
        selectedTag={selectedTag}
        onTagFilter={handleTagFilter}
        selectedStatus={selectedStatus}
        onStatusFilter={handleStatusFilter}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        advancedFilters={advancedFilters}
        onAdvancedFiltersChange={setAdvancedFilters}
      />
      <div className="flex-1 overflow-auto">
      {loading ? (
        <AccountListSkeleton count={8} />
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
          onRefresh={handleRefreshStatus}
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
          onRefresh={handleRefreshStatus}
          onEdit={setEditingAccount}
          onEditLabel={setEditingLabelAccount}
          onDelete={handleDelete}
          onAdd={() => setShowAddModal(true)}
          refreshingId={refreshingId}
          switchingId={switchingId}
          localToken={localToken}
          tagDefinitions={tagDefinitions}
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

