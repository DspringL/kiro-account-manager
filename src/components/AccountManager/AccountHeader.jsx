import { useState, useRef, useEffect } from 'react'
import { Search, Download, Upload, RefreshCw, Trash2, Plus, Sparkles, MoreHorizontal, ShoppingCart, LayoutGrid, List, Tag } from 'lucide-react'
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
  const isLightTheme = theme === 'light'
  const [showMore, setShowMore] = useState(false)
  const moreRef = useRef(null)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClick = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setShowMore(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

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
        <div className="flex items-center gap-2">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={t('accounts.search')}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`pl-9 pr-3 py-2 ${isLightTheme ? 'bg-gray-50' : 'bg-white/5'} border-0 rounded-xl text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${colors.text}`}
            />
          </div>

          {/* 状态筛选 */}
          <select
            value={selectedStatus || ''}
            onChange={(e) => onStatusFilter(e.target.value || null)}
            className={`px-3 py-2 ${colors.input} border rounded-xl text-sm focus:outline-none ${colors.text} cursor-pointer`}
          >
            <option value="">{t('common.all')}</option>
            <option value="active">{t('accounts.active')}</option>
            <option value="banned">{t('accounts.banned')}</option>
          </select>

          {/* 标签筛选 */}
          {allTags.length > 0 && (
            <select
              value={selectedTag || ''}
              onChange={(e) => onTagFilter(e.target.value || null)}
              className={`px-3 py-2 ${colors.input} border rounded-xl text-sm focus:outline-none ${colors.text} cursor-pointer max-w-[120px]`}
            >
              <option value="">{t('tags.all')}</option>
              {allTags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select>
          )}

          {/* 排序 */}
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className={`px-3 py-2 ${colors.input} border rounded-xl text-sm focus:outline-none ${colors.text} cursor-pointer`}
          >
            <option value="default">{t('sort.default')}</option>
            <option value="trialExpiry">{t('sort.trialExpiry')}</option>
            <option value="usageAsc">{t('sort.usageAsc')}</option>
            <option value="usageDesc">{t('sort.usageDesc')}</option>
            <option value="addedAsc">{t('sort.addedAsc')}</option>
            <option value="addedDesc">{t('sort.addedDesc')}</option>
          </select>

          {/* 视图切换 */}
          <div className={`flex rounded-xl border ${colors.cardBorder} overflow-hidden`}>
            <button
              onClick={() => onViewModeChange('card')}
              className={`p-2 ${viewMode === 'card' ? 'bg-blue-500 text-white' : `${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'} ${colors.textMuted}`}`}
              title={t('accounts.cardView')}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => onViewModeChange('table')}
              className={`p-2 ${viewMode === 'table' ? 'bg-blue-500 text-white' : `${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'} ${colors.textMuted}`}`}
              title={t('accounts.tableView')}
            >
              <List size={16} />
            </button>
          </div>

          {/* 高级筛选 */}
          <FilterDropdown
            filters={advancedFilters}
            onFiltersChange={onAdvancedFiltersChange}
          />

          {/* 批量操作 */}
          {selectedCount > 0 && (
            <>
              <button onClick={onBatchTag} className="px-3 py-2 bg-purple-500 text-white rounded-xl text-sm hover:bg-purple-600 flex items-center gap-1.5">
                <Tag size={14} />
                {t('tags.batchSet')} ({selectedCount})
              </button>
              <button onClick={onBatchDelete} className="px-3 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600 flex items-center gap-1.5">
                <Trash2 size={14} />
                {t('accounts.batchDelete')} ({selectedCount})
              </button>
            </>
          )}

          {/* 购买按钮 */}
          <a
            href="https://pay.ldxp.cn/shop/hj01857655"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-medium hover:from-amber-600 hover:to-orange-600 flex items-center gap-1.5 shadow-lg shadow-amber-500/25"
          >
            <ShoppingCart size={14} />
            {t('about.shop')}
          </a>

          {/* 添加按钮 */}
          <button onClick={onAdd} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 flex items-center gap-1.5 shadow-lg shadow-blue-500/25">
            <Plus size={16} />
            {t('common.add')}
          </button>

          {/* 更多操作 */}
          <div ref={moreRef} className="relative">
            <button
              onClick={() => setShowMore(!showMore)}
              className={`p-2 ${colors.card} border ${colors.cardBorder} rounded-xl ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'}`}
            >
              <MoreHorizontal size={18} className={colors.textMuted} />
            </button>

            {showMore && (
              <div className={`absolute right-0 top-full mt-2 w-40 py-1 ${colors.card} border ${colors.cardBorder} rounded-xl shadow-xl z-50`}>
                <button
                  onClick={() => { onImport(); setShowMore(false) }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'} ${colors.text}`}
                >
                  <Upload size={14} />
                  {t('accounts.import')}
                </button>
                <button
                  onClick={() => { onExport(); setShowMore(false) }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'} ${colors.text}`}
                >
                  <Download size={14} />
                  {t('accounts.export')}
                </button>
                <div className={`my-1 border-t ${colors.cardBorder}`} />
                <button
                  onClick={() => { onRefresh(); setShowMore(false) }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'} ${colors.text}`}
                >
                  <RefreshCw size={14} />
                  {t('accounts.refreshList')}
                </button>
                <button
                  onClick={() => { onRefreshAll(); setShowMore(false) }}
                  disabled={autoRefreshing}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'} ${colors.text} disabled:opacity-50`}
                >
                  <RefreshCw size={14} className={autoRefreshing ? 'animate-spin' : ''} />
                  {t('accounts.refreshAll')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 刷新进度条 */}
      {autoRefreshing && refreshProgress.total > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div className={`flex-1 h-1.5 ${isLightTheme ? 'bg-gray-200' : 'bg-white/10'} rounded-full overflow-hidden`}>
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all" style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }} />
          </div>
          <span className="text-xs text-blue-500 font-medium">{refreshProgress.current}/{refreshProgress.total}</span>
        </div>
      )}
    </div>
  )
}

export default AccountHeader
