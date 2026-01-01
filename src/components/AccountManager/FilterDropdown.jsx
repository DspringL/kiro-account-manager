import { useState, useRef, useEffect } from 'react'
import { Filter, X, ChevronDown } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import { USAGE_RANGES } from './utils/filterUtils'

const SUBSCRIPTION_OPTIONS = ['FREE', 'KIRO FREE', 'KIRO PRO', 'KIRO PRO+']
const STATUS_OPTIONS = ['normal', 'banned', 'expired']
const PROVIDER_OPTIONS = ['Google', 'GitHub', 'BuilderId']

function FilterDropdown({ filters, onFiltersChange }) {
  const { colors, theme } = useTheme()
  const isLightTheme = theme === 'light'
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  // 点击外部关闭
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
  ].reduce((a, b) => a + b, 0)

  // 单选切换：点击已选中的取消，点击未选中的替换
  const toggleFilter = (category, value) => {
    const current = filters[category] || []
    const newValues = current.includes(value) ? [] : [value]
    onFiltersChange({ ...filters, [category]: newValues })
  }

  const setUsageRange = (range) => {
    onFiltersChange({
      ...filters,
      usageRange: filters.usageRange === range ? null : range
    })
  }

  const clearAll = () => {
    onFiltersChange({
      subscriptions: [],
      statuses: [],
      providers: [],
      usageRange: null
    })
  }

  // 获取订阅类型颜色
  const getSubColor = (sub) => {
    if (sub.includes('PRO+')) return 'from-purple-500 to-pink-500'
    if (sub.includes('PRO')) return 'from-blue-500 to-cyan-500'
    return 'from-gray-400 to-gray-500'
  }

  // 获取状态颜色
  const getStatusColor = (status) => {
    if (status === 'banned') return 'bg-red-500'
    if (status === 'expired') return 'bg-orange-500'
    return 'bg-green-500'
  }

  // 获取提供商颜色
  const getProviderColor = (provider) => {
    if (provider === 'Google') return 'bg-red-500'
    if (provider === 'GitHub') return 'bg-gray-700'
    return 'bg-blue-500'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 ${colors.card} border ${colors.cardBorder} rounded-xl ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'} transition-all ${activeCount > 0 ? 'border-blue-500/50' : ''}`}
      >
        <Filter size={16} className={activeCount > 0 ? 'text-blue-500' : colors.textMuted} />
        <span className={`text-sm ${activeCount > 0 ? 'text-blue-500 font-medium' : colors.textMuted}`}>
          {t('filter.title')}
        </span>
        {activeCount > 0 && (
          <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full font-medium">
            {activeCount}
          </span>
        )}
        <ChevronDown size={14} className={`${colors.textMuted} transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* 弹出面板 */}
      {open && (
        <div className={`absolute right-0 top-full mt-2 w-80 ${colors.card} border ${colors.cardBorder} rounded-2xl shadow-2xl z-50 overflow-hidden`}>
          {/* 头部 */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${colors.cardBorder} ${colors.cardHover}`}>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-blue-500" />
              <span className={`text-sm font-medium ${colors.text}`}>{t('filter.title')}</span>
            </div>
            {activeCount > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                <X size={12} />
                {t('filter.clearAll')}
              </button>
            )}
          </div>

          <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
            {/* 订阅类型 */}
            <div>
              <div className={`text-xs font-medium ${colors.textMuted} mb-2 uppercase tracking-wide`}>
                {t('filter.subscription')}
              </div>
              <div className="flex flex-wrap gap-2">
                {SUBSCRIPTION_OPTIONS.map(sub => {
                  const isActive = (filters.subscriptions || []).includes(sub)
                  return (
                    <button
                      key={sub}
                      onClick={() => toggleFilter('subscriptions', sub)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? `bg-gradient-to-r ${getSubColor(sub)} text-white shadow-lg`
                          : `${colors.input} ${colors.text}`
                      }`}
                    >
                      {sub}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 状态 */}
            <div>
              <div className={`text-xs font-medium ${colors.textMuted} mb-2 uppercase tracking-wide`}>
                {t('filter.status')}
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(status => {
                  const isActive = (filters.statuses || []).includes(status)
                  return (
                    <button
                      key={status}
                      onClick={() => toggleFilter('statuses', status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        isActive
                          ? `${getStatusColor(status)} text-white shadow-lg`
                          : `${colors.input} ${colors.text}`
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white/50' : getStatusColor(status)}`} />
                      {t(`filter.status_${status}`)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 提供商 */}
            <div>
              <div className={`text-xs font-medium ${colors.textMuted} mb-2 uppercase tracking-wide`}>
                {t('filter.provider')}
              </div>
              <div className="flex flex-wrap gap-2">
                {PROVIDER_OPTIONS.map(provider => {
                  const isActive = (filters.providers || []).includes(provider)
                  return (
                    <button
                      key={provider}
                      onClick={() => toggleFilter('providers', provider)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        isActive
                          ? `${getProviderColor(provider)} text-white shadow-lg`
                          : `${colors.input} ${colors.text}`
                      }`}
                    >
                      {provider}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 使用率范围 */}
            <div>
              <div className={`text-xs font-medium ${colors.textMuted} mb-2 uppercase tracking-wide`}>
                {t('filter.usageRange')}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {USAGE_RANGES.map(range => {
                  const isActive = filters.usageRange === range.key
                  // 根据范围设置颜色
                  const rangeColor = range.max <= 25 ? 'from-green-500 to-emerald-500' :
                    range.max <= 50 ? 'from-blue-500 to-cyan-500' :
                    range.max <= 75 ? 'from-yellow-500 to-orange-500' :
                    'from-red-500 to-pink-500'
                  return (
                    <button
                      key={range.key}
                      onClick={() => setUsageRange(range.key)}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-all text-center ${
                        isActive
                          ? `bg-gradient-to-r ${rangeColor} text-white shadow-lg`
                          : `${colors.input} ${colors.text}`
                      }`}
                    >
                      {range.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 底部提示 */}
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
