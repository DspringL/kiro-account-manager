import { useState, useRef, useEffect } from 'react'
import { Filter, X } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
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
  // value 可能是数组或字符串，统一处理
  const displayValue = Array.isArray(value) ? (value[0] || '') : (value || '')
  
  return (
    <div>
      <label className={`block text-xs font-semibold ${colors.text} mb-2.5 flex items-center gap-2`}>
        <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600"></div>
        {label}
      </label>
      <select
        value={displayValue}
        onChange={(e) => {
          const v = e.target.value
          console.log(`[FilterSelect] ${label} 选择:`, v)
          if (v === '') {
            console.log(`[FilterSelect] ${label} 清空`)
            onClear?.()
          } else {
            console.log(`[FilterSelect] ${label} 设置为:`, v)
            onChange(v)
          }
        }}
        className={`w-full px-4 py-3 text-sm rounded-xl border ${colors.input} ${colors.inputFocus} ${colors.text} transition-all`}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
  ].reduce((a, b) => a + b, 0)

  const clearAll = () => {
    onFiltersChange({ subscriptions: [], statuses: [], providers: [], usageRange: null })
    onGroupFilter?.(null)
    onTagFilter(null)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`
          flex items-center gap-2.5 px-4 py-2.5 
          ${colors.card} border-2 ${colors.cardBorder} 
          rounded-xl ${colors.cardHover} 
          transition-all duration-200
          shadow-sm hover:shadow-md
          ${activeCount > 0 ? 'border-blue-500 bg-blue-500/5 shadow-blue-500/20' : ''}
          ${open ? 'ring-2 ring-blue-500/30' : ''}
        `}
      >
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center
          ${activeCount > 0 ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30' : `${colors.cardSecondary}`}
          transition-all duration-200
        `}>
          <Filter 
            size={16} 
            className={activeCount > 0 ? 'text-white' : colors.textMuted} 
            strokeWidth={2.5}
          />
        </div>
        <span className={`text-sm font-medium ${activeCount > 0 ? 'text-blue-600' : colors.text}`}>
          {t('filter.title')}
        </span>
        {activeCount > 0 && (
          <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded-full font-bold min-w-[20px] text-center shadow-lg">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div 
          className={`
            absolute right-0 top-full mt-3 w-[340px]
            ${colors.card} border-2 ${colors.cardBorder} 
            rounded-2xl shadow-2xl z-50 
            backdrop-blur-sm
            overflow-hidden
          `}
          style={{ 
            animation: 'slideDown 0.2s ease-out',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(59, 130, 246, 0.1)'
          }}
        >
          {/* 顶部装饰渐变 */}
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-blue-500/10 via-purple-500/5 to-transparent pointer-events-none" />
          
          {/* 头部 */}
          <div className={`relative px-5 py-4 border-b ${colors.cardBorder}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Filter size={16} className="text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <span className={`text-sm font-semibold ${colors.text} block`}>{t('filter.title')}</span>
                  {activeCount > 0 && (
                    <span className="text-[10px] text-blue-500 font-medium">{activeCount} 个筛选条件</span>
                  )}
                </div>
              </div>
              {activeCount > 0 && (
                <button 
                  onClick={clearAll} 
                  className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-all font-medium shadow-sm hover:shadow-md"
                >
                  <X size={12} strokeWidth={2.5} />
                  清空
                </button>
              )}
            </div>
          </div>

          {/* 筛选项 */}
          <div className="relative p-5 space-y-3.5 max-h-[420px] overflow-y-auto custom-scrollbar">
            {/* 分组 */}
            {allGroups.length > 0 && (
              <div className={`p-4 rounded-xl ${colors.cardSecondary} border ${colors.cardBorder} hover:border-blue-500/30 transition-all duration-200 shadow-sm hover:shadow-md`}>
                <label className={`block text-xs font-semibold ${colors.text} mb-2.5 flex items-center gap-2`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  {t('groups.title') || '分组'}
                </label>
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
            )}

            {/* 标签 */}
            {allTags.length > 0 && (
              <div className={`p-4 rounded-xl ${colors.cardSecondary} border ${colors.cardBorder} hover:border-purple-500/30 transition-all duration-200 shadow-sm hover:shadow-md`}>
                <label className={`block text-xs font-semibold ${colors.text} mb-2.5 flex items-center gap-2`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                  {t('tags.title')}
                </label>
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
            )}

            {/* 订阅类型 */}
            <div className={`p-4 rounded-xl ${colors.cardSecondary} border ${colors.cardBorder} hover:border-indigo-500/30 transition-all duration-200 shadow-sm hover:shadow-md`}>
              <FilterSelect
                label={t('filter.subscription')}
                value={filters.subscriptions?.length > 0 ? filters.subscriptions[0] : ''}
                options={SUBSCRIPTION_OPTIONS}
                onChange={(v) => onFiltersChange({ ...filters, subscriptions: [v] })}
                onClear={() => onFiltersChange({ ...filters, subscriptions: [] })}
                colors={colors}
              />
            </div>

            {/* 账号状态 */}
            <div className={`p-4 rounded-xl ${colors.cardSecondary} border ${colors.cardBorder} hover:border-emerald-500/30 transition-all duration-200 shadow-sm hover:shadow-md`}>
              <FilterSelect
                label={t('filter.status')}
                value={filters.statuses?.length > 0 ? filters.statuses[0] : ''}
                options={STATUS_OPTIONS}
                onChange={(v) => onFiltersChange({ ...filters, statuses: [v] })}
                onClear={() => onFiltersChange({ ...filters, statuses: [] })}
                colors={colors}
              />
            </div>

            {/* 登录方式 */}
            <div className={`p-4 rounded-xl ${colors.cardSecondary} border ${colors.cardBorder} hover:border-cyan-500/30 transition-all duration-200 shadow-sm hover:shadow-md`}>
              <FilterSelect
                label={t('filter.provider')}
                value={filters.providers?.length > 0 ? filters.providers[0] : ''}
                options={PROVIDER_OPTIONS}
                onChange={(v) => onFiltersChange({ ...filters, providers: [v] })}
                onClear={() => onFiltersChange({ ...filters, providers: [] })}
                colors={colors}
              />
            </div>

            {/* 使用率 */}
            <div className={`p-4 rounded-xl ${colors.cardSecondary} border ${colors.cardBorder} hover:border-amber-500/30 transition-all duration-200 shadow-sm hover:shadow-md`}>
              <FilterSelect
                label={t('filter.usageRange')}
                value={filters.usageRange || ''}
                options={USAGE_RANGE_OPTIONS}
                onChange={(v) => onFiltersChange({ ...filters, usageRange: v })}
                onClear={() => onFiltersChange({ ...filters, usageRange: null })}
                colors={colors}
              />
            </div>
          </div>

          {/* 底部统计 */}
          {activeCount > 0 && (
            <div className={`relative px-5 py-3.5 border-t ${colors.cardBorder} bg-gradient-to-r from-blue-500/5 to-purple-500/5`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                    <span className="text-xs font-bold text-white">{activeCount}</span>
                  </div>
                  <p className="text-xs font-medium text-blue-600">
                    个筛选条件已激活
                  </p>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(activeCount, 5) }).map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 animate-pulse"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* 自定义滚动条样式 */}
          <style>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
              border-radius: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(to bottom, #2563eb, #7c3aed);
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

export default FilterDropdown
