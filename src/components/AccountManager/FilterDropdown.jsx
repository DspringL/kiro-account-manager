import { useState, useRef, useEffect } from 'react'
import { Filter, X } from 'lucide-react'
import { Select } from '@mantine/core'
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
function FilterSelect({ label, value, options, onChange, onClear, colors }) {
  const hasValue = !!value
  
  return (
    <div>
      <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{label}</label>
      <div className="relative">
        <Select
          value={value}
          onChange={onChange}
          data={options}
          clearable={hasValue}
          onClear={onClear}
          classNames={{
            input: `${colors.input} ${colors.text} ${colors.inputFocus}`,
            dropdown: `${colors.card} border ${colors.cardBorder}`,
            option: `${colors.text}`
          }}
          styles={{
            input: {
              fontSize: '0.875rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              borderColor: hasValue ? '#3b82f6' : undefined,
              boxShadow: hasValue ? '0 0 0 1px rgba(59, 130, 246, 0.3)' : undefined
            }
          }}
        />
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
  const { colors } = useTheme()
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
        className={`flex items-center gap-2 px-3 py-2 ${colors.card} border ${colors.cardBorder} rounded-xl ${colors.cardHover} transition-all ${activeCount > 0 ? 'border-blue-500/50 shadow-sm shadow-blue-500/20' : ''}`}
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
            />

            <FilterSelect
              label={t('filter.status')}
              value={filters.statuses?.[0] || ''}
              options={STATUS_OPTIONS}
              onChange={(v) => onFiltersChange({ ...filters, statuses: v ? [v] : [] })}
              onClear={() => onFiltersChange({ ...filters, statuses: [] })}
              colors={colors}
            />

            <FilterSelect
              label={t('filter.provider')}
              value={filters.providers?.[0] || ''}
              options={PROVIDER_OPTIONS}
              onChange={(v) => onFiltersChange({ ...filters, providers: v ? [v] : [] })}
              onClear={() => onFiltersChange({ ...filters, providers: [] })}
              colors={colors}
            />

            <FilterSelect
              label={t('filter.usageRange')}
              value={filters.usageRange || ''}
              options={USAGE_RANGE_OPTIONS}
              onChange={(v) => onFiltersChange({ ...filters, usageRange: v || null })}
              onClear={() => onFiltersChange({ ...filters, usageRange: null })}
              colors={colors}
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
