import { useState, useRef, useEffect, useMemo } from 'react'
import { Filter, X } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'
import { useTranslation } from 'react-i18next'
import SearchableTagSelect from './SearchableTagSelect'
import { getThemeAccent } from '../KiroConfig/themeAccent'

import { buildFilterSummaryItems, countActiveFilters } from './utils/filterDropdownState'
import { isPointerInsideContainer } from './utils/pointerInside'
import React from 'react'

const SUBSCRIPTION_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'FREE', label: 'FREE' },
  { value: 'KIRO FREE', label: 'KIRO FREE' },
  { value: 'KIRO PRO', label: 'KIRO PRO' },
  { value: 'KIRO PRO+', label: 'KIRO PRO+' },
  { value: 'KIRO POWER', label: 'KIRO POWER' },
]
const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'normal', label: '正常' },
  { value: 'capped', label: '封顶' },
  { value: 'banned', label: '封禁' },
  { value: 'invalid', label: '失效' },
  { value: 'expired', label: '过期' },
]
const PROVIDER_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'Google', label: 'Google' },
  { value: 'Github', label: 'Github' },
  { value: 'BuilderId', label: 'BuilderId' },
  { value: 'Enterprise', label: 'Enterprise' },
]
const USAGE_RANGE_OPTIONS = [
  { value: '', label: '全部' },
  { value: '0-500', label: '0-500' },
  { value: '500-1000', label: '500-1000' },
  { value: '1000-2000', label: '1000-2000' },
  { value: '2000-+', label: '2000+' },
]

interface FilterDropdownProps {
filters: any;
onFiltersChange: (filters: any) => void;
allGroups?: any[];
selectedGroup?: any;
onGroupFilter?: (group: any) => void;
allTags?: any[];
selectedTag?: any;
onTagFilter: (tag: any) => void;
selectedStatus?: any;
onStatusFilter?: (status: any) => void;
defaultGroupCollapsed?: boolean;
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-border bg-muted/30 p-3 space-y-3`}>
      <div>
        <h4 className={`text-sm font-semibold text-foreground`}>{title}</h4>
        {subtitle && <p className={`mt-1 text-[11px] text-muted-foreground`}>{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function FilterField({ label, hint, active, accent, children, fullWidth = false }: any) {
  return (
    <div
      className={`
        rounded-xl border p-3 space-y-2.5 transition-all duration-200
        ${active ? `${accent.border} ${accent.bgSoft} shadow-sm ${accent.shadow}` : `border-border glass-card`}
        ${fullWidth ? 'sm:col-span-2' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <label className={`block text-xs font-medium text-muted-foreground`}>
            {label}
          </label>
          {hint && (
            <p className={`mt-1 text-[11px] leading-5 text-muted-foreground`}>
              {hint}
            </p>
          )}
        </div>
        {active && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${accent.bgSoft} ${accent.text}`}>
            已设置
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function FilterSelect({ label, hint, value, options, onChange, onClear, accent }: any) {
  const displayValue = Array.isArray(value) ? (value[0] || '') : (value || '')
  const hasValue = displayValue !== ''

  return (
    <FilterField
      label={label}
      hint={hint}
      active={hasValue}
      accent={accent}
    >
      <div className="relative">
        <select
          value={displayValue}
          onChange={(e) => {
            const nextValue = e.target.value
            if (nextValue === '') {
              onClear?.()
            } else {
              onChange(nextValue)
            }
          }}
          className={`w-full px-3 py-2.5 ${hasValue ? 'pr-9' : 'pr-3'} text-sm rounded-lg border bg-background border-input text-foreground transition-all duration-200 cursor-pointer shadow-sm`}
        >
          {options.map((opt: any) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {hasValue && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClear?.()
            }}
            className={`cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted/50 hover:bg-red-500/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/60`}
            title="清空"
          >
            <X size={12} className="text-red-500" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </FilterField>
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
  onTagFilter}: FilterDropdownProps) {
  const { theme } = useApp()
  const accent = useMemo(() => getThemeAccent(theme), [theme])
  
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !isPointerInsideContainer(e, [dropdownRef.current, panelRef.current])) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const activeCount = countActiveFilters({ filters, selectedGroup, selectedTag })
  const summaryItems = buildFilterSummaryItems({
    filters,
    selectedGroup,
    selectedTag,
    allGroups,
    allTags})

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
          cursor-pointer flex items-center gap-2.5 px-3 py-2.5
          glass-card border-2 border-border
          rounded-xl hover:bg-muted/50
          transition-all duration-200
          shadow-sm hover:shadow-md focus:outline-none focus:ring-2 ${accent.ring}
          ${activeCount > 0 ? `${accent.border} ${accent.bgSoft} ${accent.shadow}` : ''}
          ${open ? `ring-2 ${accent.ring}` : ''}
        `}
        title={t('filter.title')}
        aria-label={t('filter.title')}
      >
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center
          ${activeCount > 0 ? `bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} shadow-lg ${accent.shadow}` : `bg-muted/30`}
          transition-all duration-200
        `}>
          <Filter
            size={16}
            className={activeCount > 0 ? 'text-white' : "text-muted-foreground"}
            strokeWidth={2.5}
          />
        </div>
        {activeCount > 0 && (
          <span className={`px-2 py-0.5 bg-gradient-to-r ${accent.gradientFrom} ${accent.gradientTo} text-white text-xs rounded-full font-bold min-w-[20px] text-center shadow-lg ${accent.shadow}`}>
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`
            absolute right-0 top-full mt-3 w-[420px] max-w-[calc(100vw-48px)]
            glass-card border border-border
            rounded-2xl shadow-2xl z-50
            overflow-hidden
          `}
          style={{
            animation: 'slideDown 0.2s ease-out',
            boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.25)'}}
        >
            <div className={`px-4 py-4 border-b border-border space-y-3`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} shadow-lg ${accent.shadow}`}>
                  <Filter size={18} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold text-foreground`}>{t('filter.title')}</span>
                    {activeCount > 0 && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${accent.bgSoft} ${accent.text}`}>
                        {activeCount} 项生效
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 text-xs text-muted-foreground`}>
                    组合分组、标签、状态和配额条件，快速收敛账号列表。
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {activeCount > 0 && (
                  <button
                    onClick={clearAll}
                    className={`cursor-pointer text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/60`}
                  >
                    <X size={12} strokeWidth={2.5} />
                    清空
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  type="button"
                  aria-label="关闭筛选面板"
                  title="关闭筛选面板"
                  className={`cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted/50 transition-all duration-200 hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 ${accent.ring}`}
                >
                  <X size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            {summaryItems.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {summaryItems.map(item => (
                  <span
                    key={item.key}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] border-border bg-muted/30 text-foreground`}
                  >
                    <span className={"text-muted-foreground"}>{item.label}</span>
                    <span className="font-medium">{item.value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 space-y-4 max-h-[480px] overflow-y-auto custom-scrollbar max-w-full">
            {allTags.length > 0 && (
              <SectionCard
                title="基础筛选"
                subtitle="优先按标签缩小范围，适合高频定位。"
              >
                <div>
                  <label className={`block text-xs font-medium text-muted-foreground mb-2`}>
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
              </SectionCard>
            )}

            <SectionCard
              title="高级筛选"
              subtitle="按订阅、状态、登录方式、使用量和分组进一步精确收敛。"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FilterSelect
                  label={t('filter.subscription')}
                  hint="适合快速筛出不同套餐层级的账号。"
                  value={filters.subscriptions?.length > 0 ? filters.subscriptions[0] : ''}
                  options={SUBSCRIPTION_OPTIONS}
                  onChange={(value: string) => onFiltersChange({ ...filters, subscriptions: [value] })}
                  onClear={() => onFiltersChange({ ...filters, subscriptions: [] })}
                  accent={accent}
                />

                <FilterSelect
                  label={t('filter.status')}
                  hint="查看正常、封顶、失效等当前状态。"
                  value={filters.statuses?.length > 0 ? filters.statuses[0] : ''}
                  options={STATUS_OPTIONS}
                  onChange={(value: string) => onFiltersChange({ ...filters, statuses: [value] })}
                  onClear={() => onFiltersChange({ ...filters, statuses: [] })}
                  accent={accent}
                />

                <FilterSelect
                  label={t('filter.provider')}
                  hint="按登录来源区分 Google、GitHub 等账号。"
                  value={filters.providers?.length > 0 ? filters.providers[0] : ''}
                  options={PROVIDER_OPTIONS}
                  onChange={(value: string) => onFiltersChange({ ...filters, providers: [value] })}
                  onClear={() => onFiltersChange({ ...filters, providers: [] })}
                  accent={accent}
                />

                <FilterSelect
                  label="使用量"
                  hint="快速关注不同 usage 区间的账号。"
                  value={filters.usageRange || ''}
                  options={USAGE_RANGE_OPTIONS}
                  onChange={(value: string) => onFiltersChange({ ...filters, usageRange: value })}
                  onClear={() => onFiltersChange({ ...filters, usageRange: null })}
                  accent={accent}
                />

                {allGroups.length > 0 && (
                  <FilterField
                    label={t('groups.title') || '分组'}
                    hint="不常用时放最后，需要时也能直接搜索或切到有/无分组。"
                    active={Boolean(selectedGroup)}
                    accent={accent}
                    fullWidth
                  >
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
                  </FilterField>
                )}
              </div>
            </SectionCard>
          </div>

          <div className={`flex items-center justify-end gap-2 border-t border-border px-4 py-3 glass-card`}>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <button
                  onClick={clearAll}
                  className="cursor-pointer rounded-lg px-3 py-2 text-xs font-medium text-red-500 transition-all duration-200 hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/60"
                >
                  一键清空
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-medium ${accent.text} ${accent.bgSoft} transition-all duration-200 hover:opacity-90 focus:outline-none focus:ring-2 ${accent.ring}`}
              >
                完成
              </button>
            </div>
          </div>

          <style>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
              margin: 4px 0;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: var(--app-primary-solid);
              border-radius: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: var(--app-primary-solid-hover);
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

export default FilterDropdown
