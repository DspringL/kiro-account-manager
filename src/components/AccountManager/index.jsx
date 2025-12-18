import { useState, useCallback, useMemo, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../hooks/useApp'
import { useDialog } from '../../contexts/DialogContext'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { useAccounts } from './hooks/useAccounts'
import AccountHeader from './AccountHeader'
import AccountTable from './AccountTable'
import AccountPagination from './AccountPagination'
import AddAccountModal from './AddAccountModal'
import ImportAccountModal from './ImportAccountModal'
import RefreshProgressModal from './RefreshProgressModal'
import AccountDetailModal from '../AccountDetailModal'
import EditAccountModal from './EditAccountModal'
import ConfirmDialog from './ConfirmDialog'

function AccountManager() {
  const { t, colors } = useApp()
  const { showConfirm } = useDialog()
  const { settings: appSettings } = useAppSettings()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [editingAccount, setEditingAccount] = useState(null)
  const [editingLabelAccount, setEditingLabelAccount] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [selectedTag, setSelectedTag] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)
  
  // 切换账号弹窗状态
  const [switchDialog, setSwitchDialog] = useState(null) // { type, title, message, account }
  
  // 当前登录的本地 token
  const [localToken, setLocalToken] = useState(null)
  
  useEffect(() => {
    invoke('get_kiro_local_token').then(setLocalToken).catch(() => setLocalToken(null))
  }, [])

  const {
    accounts,
    loadAccounts,
    autoRefreshing,
    refreshProgress,
    lastRefreshTime,
    refreshingId,
    switchingId,
    setSwitchingId,
    autoRefreshAll,
    handleRefreshStatus,
    handleExport,
  } = useAccounts()

  // 获取所有标签
  const allTags = useMemo(() => {
    const tags = new Set()
    accounts.forEach(a => {
      if (a.tags) a.tags.forEach(t => tags.add(t))
    })
    return Array.from(tags).sort()
  }, [accounts])

  // 当选中的标签不存在时，重置筛选
  useEffect(() => {
    if (selectedTag && !allTags.includes(selectedTag)) {
      setSelectedTag(null)
    }
  }, [allTags, selectedTag])

  const filteredAccounts = useMemo(() =>
    accounts.filter(a => {
      const term = searchTerm.toLowerCase()
      // 搜索过滤：邮箱、备注、标签
      const matchSearch = a.email.toLowerCase().includes(term) ||
        a.label.toLowerCase().includes(term) ||
        (a.tags && a.tags.some(tag => tag.toLowerCase().includes(term)))
      // 标签过滤
      const matchTag = !selectedTag || (a.tags && a.tags.includes(selectedTag))
      // 状态过滤
      const matchStatus = !selectedStatus || 
        (selectedStatus === 'active' && (a.status === 'active' || a.status === '正常' || a.status === '有效')) ||
        (selectedStatus === 'banned' && (a.status === 'banned' || a.status === '封禁' || a.status === '已封禁'))
      return matchSearch && matchTag && matchStatus
    }),
    [accounts, searchTerm, selectedTag, selectedStatus]
  )

  const totalPages = Math.ceil(filteredAccounts.length / pageSize) || 1
  const paginatedAccounts = useMemo(() =>
    filteredAccounts.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredAccounts, currentPage, pageSize]
  )

  const handleSearchChange = useCallback((term) => { setSearchTerm(term); setCurrentPage(1) }, [])
  const handleTagFilter = useCallback((tag) => { setSelectedTag(tag); setCurrentPage(1) }, [])
  const handleStatusFilter = useCallback((status) => { setSelectedStatus(status); setCurrentPage(1) }, [])
  const handlePageSizeChange = useCallback((size) => { setPageSize(size); setCurrentPage(1) }, [])
  const handleSelectAll = useCallback((checked) => { setSelectedIds(checked ? filteredAccounts.map(a => a.id) : []) }, [filteredAccounts])
  const handleSelectOne = useCallback((id, checked) => { setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id)) }, [])
  const handleCopy = useCallback((text, id) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500) }, [])
  
  // 删除单个账号
  const handleDelete = useCallback(async (id) => {
    const confirmed = await showConfirm(t('accounts.delete'), t('accounts.confirmDelete'))
    if (confirmed) {
      await invoke('delete_account', { id })
      loadAccounts()
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

  // 切换账号 - 显示确认弹窗
  const handleSwitchAccount = useCallback((account) => {
    if (!account.accessToken || !account.refreshToken) {
      setSwitchDialog({ type: 'error', title: t('switch.failed'), message: t('switch.missingAuth'), account: null })
      return
    }
    setSwitchDialog({
      type: 'confirm',
      title: t('switch.title'),
      message: `${t('switch.confirmSwitch')} ${account.email}？`,
      account,
    })
  }, [t])

  // 确认切换
  const confirmSwitch = useCallback(async () => {
    const account = switchDialog?.account
    if (!account) return
    
    setSwitchDialog(null)
    setSwitchingId(account.id)
    
    try {
      // 使用缓存的设置，避免 IPC 调用
      const settings = appSettings || {}
      const autoChangeMachineId = settings.autoChangeMachineId !== false // 默认 true
      const bindMachineIdToAccount = settings.bindMachineIdToAccount !== false // 默认 true
      
      // 处理 Windows MachineGuid
      if (autoChangeMachineId) {
        try {
          if (bindMachineIdToAccount) {
            // 绑定模式：使用账号绑定的机器码
            let boundMachineId = await invoke('get_bound_machine_id', { accountId: account.id }).catch(() => null)
            
            if (!boundMachineId) {
              // 首次切换，生成新的并绑定
              boundMachineId = await invoke('generate_machine_guid')
              await invoke('bind_machine_id_to_account', { accountId: account.id, machineId: boundMachineId })
              console.log(`[MachineGuid] 首次切换，生成并绑定: ${account.email}`)
            }
            
            await invoke('set_custom_machine_guid', { newGuid: boundMachineId })
            console.log(`[MachineGuid] 使用绑定的机器码: ${account.email}`)
          } else {
            // 随机模式：每次生成新的机器码
            const newMachineId = await invoke('generate_machine_guid')
            await invoke('set_custom_machine_guid', { newGuid: newMachineId })
            console.log(`[MachineGuid] 随机生成新机器码: ${account.email}`)
          }
        } catch (e) {
          console.error('[MachineGuid] 设置机器码失败:', e)
        }
      }
      
      const isIdC = account.provider === 'BuilderId' || account.provider === 'Enterprise' || account.clientIdHash
      const authMethod = isIdC ? 'IdC' : 'social'
      
      const params = {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        provider: account.provider || 'Google',
        authMethod,
        autoRestart: false
      }
      
      if (isIdC) {
        params.clientIdHash = account.clientIdHash || null
        params.region = account.region || 'us-east-1'
        params.clientId = account.clientId || null
        params.clientSecret = account.clientSecret || null
      } else {
        params.profileArn = account.profileArn || 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK'
      }
      
      await invoke('switch_kiro_account', { params })
      
      // 更新当前账号标识
      invoke('get_kiro_local_token').then(setLocalToken).catch(() => setLocalToken(null))
      
      // 从 usage_data 获取配额信息（统一使用 camelCase）
      const usageData = account.usageData
      const breakdown = usageData?.usageBreakdownList?.[0]
      const used = breakdown?.currentUsage ?? 0
      const limit = breakdown?.usageLimit ?? 50
      const remaining = limit - used
      const provider = account.provider || 'Unknown'
      setSwitchDialog({
        type: 'success',
        title: t('switch.success'),
        message: `${account.email}\n\n📊 ${t('switch.quota')}: ${used}/${limit} (${t('switch.remaining')} ${remaining})\n🏷️ ${t('switch.type')}: ${provider}`,
        account: null,
      })
    } catch (e) {
      setSwitchDialog({
        type: 'error',
        title: t('switch.failed'),
        message: String(e),
        account: null,
      })
    } finally {
      setSwitchingId(null)
    }
  }, [switchDialog, setSwitchingId])

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
        onRefreshAll={() => autoRefreshAll(accounts, true)}
        autoRefreshing={autoRefreshing}
        lastRefreshTime={lastRefreshTime}
        refreshProgress={refreshProgress}
        allTags={allTags}
        selectedTag={selectedTag}
        onTagFilter={handleTagFilter}
        selectedStatus={selectedStatus}
        onStatusFilter={handleStatusFilter}
      />
      <div className="flex-1 overflow-auto">
      <AccountTable
        accounts={paginatedAccounts}
        filteredAccounts={filteredAccounts}
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
        onAdd={() => setShowAddModal(true)}
        refreshingId={refreshingId}
        switchingId={switchingId}
        localToken={localToken}
      />
      </div>
      <div className="animate-slide-in-right delay-200">
      <AccountPagination
        totalCount={filteredAccounts.length}
        pageSize={pageSize}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageSizeChange={handlePageSizeChange}
        onPageChange={setCurrentPage}
      />
      </div>
      {editingAccount && (
        <AccountDetailModal
          account={editingAccount}
          onClose={() => { setEditingAccount(null); loadAccounts() }}
        />
      )}
      {showAddModal && (<AddAccountModal onClose={() => setShowAddModal(false)} onSuccess={loadAccounts} />)}
      {editingLabelAccount && (<EditAccountModal account={editingLabelAccount} onClose={() => setEditingLabelAccount(null)} onSuccess={loadAccounts} />)}
      {showImportModal && (<ImportAccountModal onClose={() => setShowImportModal(false)} onSuccess={loadAccounts} />)}
      {autoRefreshing && (<RefreshProgressModal refreshProgress={refreshProgress} />)}
      
      {/* 切换账号弹窗 */}
      {switchDialog && (
        <ConfirmDialog
          type={switchDialog.type}
          title={switchDialog.title}
          message={switchDialog.message}
          onConfirm={switchDialog.type === 'confirm' ? confirmSwitch : () => setSwitchDialog(null)}
          onCancel={() => setSwitchDialog(null)}
          confirmText={switchDialog.type === 'confirm' ? t('switch.confirmBtn') : t('common.ok')}
        />
      )}
    </div>
  )
}

export default AccountManager

