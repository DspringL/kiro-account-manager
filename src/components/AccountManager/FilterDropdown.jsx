import { useState, useRef, useEffect } from 'react'
import { Filter, X, ChevronDown } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import SearchableTagSelect from './SearchableTagSelect'

const SUBSCRIPTION_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'FREE', label: 'FREE' },
  { value: 'KIRO FREE', label: 'KIRO FREE' },
  { value: 'KIRO PRO', label: 'KIRO PRO' },
  { value: 'KIRO PRO+', label: 'KIRO PRO+' },
  { value: 'KIRO ENTERPRISE', label: 'KIRO ENTERPRISE' },
]
const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'normal', label: '正常' },
  { value: 'banned', label: '封禁' },
  { value: 'expired', label: '过期' },
]
const PROVIDER_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'Google', label: 'Google' },
  { value: 'GitHub', label: 'GitHub' },
  { value: 'BuilderId', label: 'BuilderId' },
]
const USAGE_RANGE_OPTIONS = [
  { value: '', label: '全部' },
  { value: '0-25', label: '0-25%' },
  { value: '25-50', label: '25-50%' },
  { value: '50-75', label: '50-75%' },
  { value: '75-100', label: '75-100%' },
]

// 通用筛选下拉组件
function FilterSelect({ label, value, options, onChange, onClear, colors, isLightTheme }) {
  const hasValue = !!value
  const baseStyle = `w-full px-3 py-2 pr-16 border rounded-lg text-sm ${colors.text} ${isLightTheme ? 'bg-white' : 'bg-[#1a1a2e]'} focus:outline-none focus:ring-2 transition-all appearance-none`
  const activeStyle = hasValue ? 'border-blue-500 ring-1 ring-blue-500/30' : colors.cardBorder

  return (
    <div>
      <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${baseStyle} ${activeStyle}`}>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${colors.textMuted}`} />
        {hasValue && (
          <button onClick={onClear} className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-red-500/20 rounded transition-colors">
            <X size={14} className="text-red-500" />
          </button>
        )}
      </div>
    </div>
  )
}

function FilterDropdown({ 
  filters, 
  onFiltersChange,
  allGroups = [],
  selectedGroup,
  onGroupFilter,
  allTags = [],
  selectedTag,
  onTagFilter,
  selectedStatus,
  onStatusFilter,
}) {
  const { colors, theme } = useTheme()
  const isLightTheme = theme === 'light'
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeCount = [
    filters.subscriptions?.length || 0,
    filters.statuses?.length || 0,
    filters.providers?.length || 0,
    filters.usageRange ? 1 : 0,
    selectedGroup ? 1 : 0,
    selectedTag ? 1 : 0,
    selectedStatus ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const clearAll = () => {
    onFiltersChange({ subscriptions: [], statuses: [], providers: [], usageRange: null })
    onGroupFilter?.(null)
    onTagFilter(null)
    onStatusFilter(null)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 ${colors.card} border ${colors.cardBorder} rounded-xl ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'} transition-all ${activeCount > 0 ? 'border-blue-500/50 shadow-sm shadow-blue-500/20' : ''}`}
      >
        <Filter size={16} className={activeCount > 0 ? 'text-blue-500' : colors.textMuted} />
        <span className={`text-sm ${activeCount > 0 ? 'text-blue-500 font-medium' : colors.textMuted}`}>
          {t('filter.title')}
        </span>
        {activeCount > 0 && (
          <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full font-medium min-w-[18px] text-center">
            {activeCount}
          </span>
        )}
        <ChevronDown size={14} className={`${colors.textMuted} transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-2 w-72 ${colors.card} border ${colors.cardBorder} rounded-2xl shadow-2xl z-50 overflow-hidden`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${colors.cardBorder}`}>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-blue-500" />
              <span className={`text-sm font-medium ${colors.text}`}>{t('filter.title')}</span>
            </div>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors">
                <X size={12} />
                {t('filter.clearAll')}
              </button>
            )}
          </div>

          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {/* 分组 */}
            {allGroups.length > 0 && (
              <div>
                <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('groups.title') || '分组'}</label>
                <div className="relative">
                  <SearchableTagSelect
                    tags={allGroups}
                    value={selectedGroup}
                    onChange={onGroupFilter}
                    placeholder={t('groups.searchPlaceholder') || '搜索分组...'}
                    showAllOption={true}
                    showNoneOption={true}
                    allLabel={t('groups.all') || '全部'}
                    noneLabel={t('groups.noGroup') || '无分组'}
                    hasLabel={t('groups.hasGroup') || '有分组'}
                  />
                </div>
              </div>
            )}

            {/* 标签 */}
            {allTags.length > 0 && (
              <div>
                <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('tags.title')}</label>
                <div className="relative">
                  <SearchableTagSelect
                    tags={allTags}
                    value={selectedTag}
                    onChange={onTagFilter}
                    placeholder={t('tags.searchPlaceholder') || '搜索标签...'}
                    showAllOption={true}
                    showNoneOption={true}
                    allLabel={t('tags.all')}
                    noneLabel={t('tags.noTags')}
                    hasLabel={t('tags.hasTags') || '有标签'}
                  />
                </div>
              </div>
            )}

            <FilterSelect
              label={t('filter.subscription')}
              value={filters.subscriptions?.[0] || ''}
              options={SUBSCRIPTION_OPTIONS}
              onChange={(v) => onFiltersChange({ ...filters, subscriptions: v ? [v] : [] })}
              onClear={() => onFiltersChange({ ...filters, subscriptions: [] })}
              colors={colors}
              isLightTheme={isLightTheme}
            />

            <FilterSelect
              label={t('filter.status')}
              value={filters.statuses?.[0] || ''}
              options={STATUS_OPTIONS}
              onChange={(v) => onFiltersChange({ ...filters, statuses: v ? [v] : [] })}
              onClear={() => onFiltersChange({ ...filters, statuses: [] })}
              colors={colors}
              isLightTheme={isLightTheme}
            />

            <FilterSelect
              label={t('filter.provider')}
              value={filters.providers?.[0] || ''}
              options={PROVIDER_OPTIONS}
              onChange={(v) => onFiltersChange({ ...filters, providers: v ? [v] : [] })}
              onClear={() => onFiltersChange({ ...filters, providers: [] })}
              colors={colors}
              isLightTheme={isLightTheme}
            />

            <FilterSelect
              label={t('filter.usageRange')}
              value={filters.usageRange || ''}
              options={USAGE_RANGE_OPTIONS}
              onChange={(v) => onFiltersChange({ ...filters, usageRange: v || null })}
              onClear={() => onFiltersChange({ ...filters, usageRange: null })}
              colors={colors}
              isLightTheme={isLightTheme}
            />
          </div>

          {activeCount > 0 && (
            <div className={`px-4 py-2 border-t ${colors.cardBorder} bg-blue-500/10`}>
              <p className="text-xs text-blue-500">
                {t('common.selected')}: {activeCount} {t('common.filter').toLowerCase()}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FilterDropdown
