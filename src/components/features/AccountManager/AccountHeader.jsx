import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Download, Upload, RefreshCcw, RotateCw, Trash2, Plus, Sparkles, LayoutGrid, List, Tag, ArrowUp, ArrowDown, X, TrendingUp, Clock, Calendar, CheckSquare, Square } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'
import FilterDropdown from './FilterDropdown'
import { getThemeAccent, getSolidAccentButton, getGradientAccentButton } from '../KiroConfig/themeAccent'

function AccountHeader({
  searchTerm,
  onSearchChange,
  selectedCount,
  onBatchDelete,
  onBatchTag,
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
  totalCount = 0,
  onSelectAll,
  onDeselectAll,
}) {
  const { t, theme, colors } = useApp()
  const accent = getThemeAccent(theme)
  const accentSolidButtonClass = getSolidAccentButton(accent)
  const accentGradientButtonClass = getGradientAccentButton(accent)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm)
  const searchRef = useRef(null)
  const debounceTimerRef = useRef(null)

  // 搜索防抖
  const handleSearchChange = useCallback((value) => {
    setLocalSearchTerm(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      onSearchChange(value)
    }, 300)
  }, [onSearchChange])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // 同步外部搜索词
  useEffect(() => {
    setLocalSearchTerm(searchTerm)
  }, [searchTerm])

  // 点击外部关闭搜索框
  useEffect(() => {
    const handleClick = (e) => {
      if (searchExpanded && searchRef.current && !searchRef.current.contains(e.target) && !localSearchTerm) {
        setSearchExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [localSearchTerm, searchExpanded])

  return (
    <div className={`${colors.card} border-b ${colors.cardBorder} px-6 py-4`}>
      <div className="flex items-center justify-between">
        {/* 左侧：标题或选中提示 */}
        {selectedCount > 0 ? (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} rounded-xl flex items-center justify-center shadow-lg ${accent.shadow}`}>
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${colors.text}`}>
                {t('common.selected')} {selectedCount} {t('accounts.title')}
              </h1>
              <p className={`text-xs ${colors.textMuted}`}>批量操作模式</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} rounded-xl flex items-center justify-center shadow-lg ${accent.shadow}`}>
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${colors.text}`}>{t('accounts.title')}</h1>
              <p className={`text-xs ${colors.textMuted}`}>{t('accounts.subtitle')}</p>
            </div>
          </div>
        )}

        {/* 右侧：搜索和操作 */}
        <div className="flex items-center gap-3">
          {selectedCount === 0 && (
            <>
              {/* 搜索框 - 可收缩 */}
              <div ref={searchRef} className="relative">
                {searchExpanded || localSearchTerm ? (
                  <div className="relative">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.textMuted}`} size={18} />
                    <input
                      type="text"
                      placeholder={t('accounts.search')}
                      value={localSearchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      autoFocus
                      className={`pl-10 pr-10 py-2.5 ${colors.cardSecondary} border-0 rounded-xl text-sm w-48 focus:outline-none focus:ring-2 ${accent.ring} ${colors.text}`}
                    />
                    {localSearchTerm && (
                      <button
                        onClick={() => {
                          setLocalSearchTerm('')
                          onSearchChange('')
                        }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${colors.cardHover} transition-all hover:scale-110`}
                        title="清空"
                      >
                        <X size={16} className={colors.textMuted} />
                      </button>
                    )}
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
              <div className="flex gap-1.5">
                {[
                  { key: 'usage', label: t('sort.usage'), icon: TrendingUp },
                  { key: 'added', label: t('sort.added'), icon: Clock },
                  { key: 'trial', label: t('sort.trial'), icon: Calendar },
                ].map(({ key, label, icon: Icon }) => {
                  const isActive = sortBy.startsWith(key)
                  const isDesc = sortBy.endsWith('Desc')
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (isActive) {
                          if (isDesc) {
                            onSortChange(`${key}Asc`)
                          } else {
                            onSortChange('default')
                          }
                        } else {
                          onSortChange(`${key}Desc`)
                        }
                      }}
                      className={`p-3 rounded-xl flex items-center gap-1.5 transition-all duration-200 hover:shadow-md relative ${
                        isActive
                          ? `${accentSolidButtonClass} shadow-lg ${accent.shadow}`
                          : `${colors.card} border ${colors.cardBorder} ${colors.cardHover} ${colors.textMuted}`
                      }`}
                      title={label}
                      aria-label={label}
                    >
                      <Icon size={18} />
                      {isActive && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                          {isDesc ? <ArrowDown size={12} className="text-gray-700" /> : <ArrowUp size={12} className="text-gray-700" />}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* 视图切换 */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => onViewModeChange('card')}
                  className={`cursor-pointer p-3 rounded-xl transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 ${accent.ring} ${viewMode === 'card' ? `${accentSolidButtonClass} shadow-lg ${accent.shadow}` : `${colors.card} border ${colors.cardBorder} ${colors.cardHover} ${colors.textMuted}`}`}
                  title={t('accounts.cardView')}
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => onViewModeChange('table')}
                  className={`cursor-pointer p-3 rounded-xl transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 ${accent.ring} ${viewMode === 'table' ? `${accentSolidButtonClass} shadow-lg ${accent.shadow}` : `${colors.card} border ${colors.cardBorder} ${colors.cardHover} ${colors.textMuted}`}`}
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
                 defaultGroupCollapsed={true}
               />
            </>
          )}

          {/* 批量操作 */}
          {selectedCount > 0 && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={onSelectAll}
                  className={`cursor-pointer p-2.5 rounded-lg ${colors.card} border ${colors.cardBorder} ${colors.cardHover} transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 ${accent.ring}`}
                  title="全选"
                >
                  <CheckSquare size={16} className={accent.text} />
                </button>
                <button
                  onClick={onDeselectAll}
                  className={`cursor-pointer p-2.5 rounded-lg ${colors.card} border ${colors.cardBorder} ${colors.cardHover} transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 ${accent.ring}`}
                  title="取消全选"
                >
                  <Square size={16} className={colors.textMuted} />
                </button>
              </div>
              <button
                onClick={onBatchTag}
                className={`px-4 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2 transition-all duration-200 hover:shadow-lg ${accentGradientButtonClass}`}
                title={t('tags.batchSet')}
              >
                <Tag size={16} />
                ({selectedCount})
              </button>
              <button
                onClick={onBatchDelete}
                className="px-4 py-2.5 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30 hover:shadow-red-500/40 flex items-center gap-2 transition-all duration-200"
                title={t('accounts.batchDelete')}
              >
                <Trash2 size={16} />
                ({selectedCount})
              </button>
            </>
          )}

          {/* 操作按钮组 */}
          <div className="flex gap-1.5">
            <button
              onClick={onImport}
              className={`p-3 rounded-xl ${colors.card} border ${colors.cardBorder} ${colors.cardHover} ${accent.text} transition-all duration-200 hover:shadow-md`}
              title={t('accounts.import')}
            >
              <Upload size={18} />
            </button>
            <button
              onClick={onExport}
              className={`p-3 rounded-xl ${colors.card} border ${colors.cardBorder} ${colors.cardHover} ${accent.text} transition-all duration-200 hover:shadow-md`}
              title={t('accounts.export')}
            >
              <Download size={18} />
            </button>
            <button
              onClick={onRefresh}
              className={`p-3 rounded-xl ${colors.card} border ${colors.cardBorder} ${colors.cardHover} ${colors.textMuted} transition-all duration-200 hover:shadow-md`}
              title={t('accounts.refreshList')}
            >
              <RotateCw size={18} />
            </button>
            <button
              onClick={onRefreshAll}
              disabled={autoRefreshing}
              className={`p-3 rounded-xl ${colors.card} border ${colors.cardBorder} ${colors.cardHover} ${accent.text} disabled:opacity-50 transition-all duration-200 hover:shadow-md disabled:hover:shadow-sm`}
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
            <div className={`h-full bg-gradient-to-r ${accent.gradientFrom} ${accent.gradientTo} rounded-full transition-all`} style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }} />
          </div>
          <span className={`text-xs ${accent.text} font-medium`}>{refreshProgress.current}/{refreshProgress.total}</span>
        </div>
      )}
    </div>
  )
}

export default AccountHeader
