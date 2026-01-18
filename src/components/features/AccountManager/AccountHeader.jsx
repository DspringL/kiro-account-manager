import { useState, useRef, useEffect } from 'react'
import { Search, Download, Upload, RefreshCcw, RotateCw, Trash2, Plus, Sparkles, LayoutGrid, List, Tag, ArrowUp, ArrowDown } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import FilterDropdown from './FilterDropdown'

function AccountHeader({
  searchTerm,
  onSearchChange,
  selectedCount,
  onBatchDelete,
  onBatchTag,
  onAdd,
  onImport,
  onExport,
  onRefresh,
  onRefreshAll,
  autoRefreshing,
  refreshProgress,
  allGroups = [],
  selectedGroup,
  onGroupFilter,
  allTags = [],
  selectedTag,
  onTagFilter,
  selectedStatus,
  onStatusFilter,
  sortBy = 'default',
  onSortChange,
  viewMode = 'card',
  onViewModeChange,
  advancedFilters = {},
  onAdvancedFiltersChange,
}) {
  const { t, theme, colors } = useApp()
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchRef = useRef(null)

  // 点击外部关闭搜索框
  useEffect(() => {
    const handleClick = (e) => {
      // 只在搜索框已展开且点击外部时关闭
      if (searchExpanded && searchRef.current && !searchRef.current.contains(e.target) && !searchTerm) {
        setSearchExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [searchTerm, searchExpanded])

  return (
    <div className={`${colors.card} border-b ${colors.cardBorder} px-6 py-4`}>
      <div className="flex items-center justify-between">
        {/* 左侧：标题 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${colors.text}`}>{t('accounts.title')}</h1>
            <p className={`text-xs ${colors.textMuted}`}>{t('accounts.subtitle')}</p>
          </div>
        </div>

        {/* 右侧：搜索和操作 */}
        <div className="flex items-center gap-3">
          {/* 搜索框 - 可收缩 */}
          <div ref={searchRef} className="relative">
            {searchExpanded || searchTerm ? (
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.textMuted}`} size={18} />
                <input
                  type="text"
                  placeholder={t('accounts.search')}
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  autoFocus
                  className={`pl-10 pr-4 py-2.5 ${colors.cardSecondary} border-0 rounded-xl text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${colors.text}`}
                />
              </div>
            ) : (
              <button
                onClick={() => setSearchExpanded(true)}
                className={`p-3 ${colors.card} border ${colors.cardBorder} rounded-xl ${colors.cardHover}`}
                title={t('accounts.search')}
              >
                <Search size={20} className={colors.textMuted} />
              </button>
            )}
          </div>

          {/* 排序按钮组 */}
          <div className="flex gap-1">
            {[
              { key: 'usage', label: t('sort.usage') },
              { key: 'added', label: t('sort.added') },
              { key: 'trial', label: t('sort.trial') },
            ].map(({ key, label }) => {
              const isActive = sortBy.startsWith(key)
              const isDesc = sortBy.endsWith('Desc')
              return (
                <button
                  key={key}
                  onClick={() => {
                    if (isActive) {
                      // 已激活：降序 → 升序 → 取消
                      if (isDesc) {
                        onSortChange(`${key}Asc`)
                      } else {
                        onSortChange('default')
                      }
                    } else {
                      // 未激活：默认降序
                      onSortChange(`${key}Desc`)
                    }
                  }}
                  className={`px-3 py-2 text-sm rounded-lg flex items-center gap-1.5 ${
                    isActive 
                      ? 'bg-blue-500 text-white shadow-sm' 
                      : `${colors.card} border ${colors.cardBorder} ${colors.cardHover} ${colors.textMuted}`
                  }`}
                  title={label}
                >
                  {label}
                  {isActive && (isDesc ? <ArrowDown size={14} /> : <ArrowUp size={14} />)}
                </button>
              )
            })}
          </div>

          {/* 视图切换 */}
          <div className="flex gap-1">
            <button
              onClick={() => onViewModeChange('card')}
              className={`p-2.5 rounded-lg ${viewMode === 'card' ? 'bg-blue-500 text-white shadow-sm' : `${colors.card} border ${colors.cardBorder} ${colors.cardHover} ${colors.textMuted}`}`}
              title={t('accounts.cardView')}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => onViewModeChange('table')}
              className={`p-2.5 rounded-lg ${viewMode === 'table' ? 'bg-blue-500 text-white shadow-sm' : `${colors.card} border ${colors.cardBorder} ${colors.cardHover} ${colors.textMuted}`}`}
              title={t('accounts.tableView')}
            >
              <List size={18} />
            </button>
          </div>

          {/* 筛选面板 */}
          <FilterDropdown
            filters={advancedFilters}
            onFiltersChange={onAdvancedFiltersChange}
            allGroups={allGroups}
            selectedGroup={selectedGroup}
            onGroupFilter={onGroupFilter}
            allTags={allTags}
            selectedTag={selectedTag}
            onTagFilter={onTagFilter}
            selectedStatus={selectedStatus}
            onStatusFilter={onStatusFilter}
          />

          {/* 批量操作 */}
          {selectedCount > 0 && (
            <>
              <button onClick={onBatchTag} className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 flex items-center gap-2 shadow-sm">
                <Tag size={16} />
                {t('tags.batchSet')} ({selectedCount})
              </button>
              <button onClick={onBatchDelete} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 flex items-center gap-2 shadow-sm">
                <Trash2 size={16} />
                {t('accounts.batchDelete')} ({selectedCount})
              </button>
            </>
          )}

          {/* 操作按钮组 */}
          <div className="flex gap-1">
            <button
              onClick={onAdd}
              className={`p-2.5 rounded-lg ${colors.card} border ${colors.cardBorder} ${colors.cardHover} text-green-500`}
              title={t('common.add')}
            >
              <Plus size={18} />
            </button>
            <button
              onClick={onImport}
              className={`p-2.5 rounded-lg ${colors.card} border ${colors.cardBorder} ${colors.cardHover} text-purple-500`}
              title={t('accounts.import')}
            >
              <Upload size={18} />
            </button>
            <button
              onClick={onExport}
              className={`p-2.5 rounded-lg ${colors.card} border ${colors.cardBorder} ${colors.cardHover} text-orange-500`}
              title={t('accounts.export')}
            >
              <Download size={18} />
            </button>
            <button
              onClick={onRefresh}
              className={`p-2.5 rounded-lg ${colors.card} border ${colors.cardBorder} ${colors.cardHover} ${colors.textMuted}`}
              title={t('accounts.refreshList')}
            >
              <RotateCw size={18} />
            </button>
            <button
              onClick={onRefreshAll}
              disabled={autoRefreshing}
              className={`p-2.5 rounded-lg ${colors.card} border ${colors.cardBorder} ${colors.cardHover} text-blue-500 disabled:opacity-50`}
              title={t('accounts.refreshAll')}
            >
              <RefreshCcw size={18} className={autoRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 刷新进度条 */}
      {autoRefreshing && refreshProgress.total > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div className={`flex-1 h-1.5 ${colors.cardSecondary} rounded-full overflow-hidden`}>
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all" style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }} />
          </div>
          <span className="text-xs text-blue-500 font-medium">{refreshProgress.current}/{refreshProgress.total}</span>
        </div>
      )}
    </div>
  )
}

export default AccountHeader
