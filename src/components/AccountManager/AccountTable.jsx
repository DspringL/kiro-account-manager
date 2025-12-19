import { useRef, useMemo, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Users, Plus } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import AccountCard from './AccountCard'

// 根据容器宽度计算列数
function getColumnCount(width) {
  if (width >= 1280) return 4 // xl
  if (width >= 1024) return 3 // lg
  if (width >= 768) return 2  // md
  return 1
}

function AccountTable({
  accounts,
  filteredAccounts,
  selectedIds,
  onSelectAll,
  onSelectOne,
  copiedId,
  onCopy,
  onSwitch,
  onRefresh,
  onEdit,
  onEditLabel,
  onDelete,
  onAdd,
  refreshingId,
  switchingId,
  localToken,
}) {
  const { t, theme, colors } = useApp()
  const isDark = theme === 'dark'
  const parentRef = useRef(null)
  const [columns, setColumns] = useState(4)

  // 监听容器大小变化
  useEffect(() => {
    if (!parentRef.current) return
    const updateColumns = () => {
      const width = parentRef.current?.offsetWidth - 48 || 0
      setColumns(getColumnCount(width))
    }
    updateColumns()
    const observer = new ResizeObserver(updateColumns)
    observer.observe(parentRef.current)
    return () => observer.disconnect()
  }, [])

  // 将账号分组为行
  const rows = useMemo(() => {
    const result = []
    const items = [...accounts, { _isAddButton: true }]
    for (let i = 0; i < items.length; i += columns) {
      result.push(items.slice(i, i + columns))
    }
    return result
  }, [accounts, columns])

  // 虚拟化配置
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 296, // 卡片高度 280 + gap 16
    overscan: 2,
  })

  // 账号少于 20 个时不启用虚拟滚动
  const useVirtual = accounts.length >= 20

  // 渲染单个卡片
  const renderCard = (item) => {
    if (item._isAddButton) {
      return <AddButton key="add" onClick={onAdd} isDark={isDark} colors={colors} t={t} />
    }
    return (
      <AccountCard
        key={item.id}
        account={item}
        isSelected={selectedIds.includes(item.id)}
        onSelect={(checked) => onSelectOne(item.id, checked)}
        copiedId={copiedId}
        onCopy={onCopy}
        onSwitch={onSwitch}
        onRefresh={onRefresh}
        onEdit={onEdit}
        onEditLabel={onEditLabel}
        onDelete={onDelete}
        refreshingId={refreshingId}
        switchingId={switchingId}
        isCurrentAccount={localToken?.refreshToken && item.refreshToken === localToken.refreshToken}
      />
    )
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto p-6">
      {/* 全选控制栏 */}
      {accounts.length > 0 && (
        <div className="flex items-center gap-3 mb-4 px-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.length === filteredAccounts.length && filteredAccounts.length > 0}
              onChange={(e) => onSelectAll(e.target.checked)}
              className="w-4 h-4 rounded transition-transform hover:scale-110"
            />
            <span className={`text-sm ${colors.textMuted}`}>
              {selectedIds.length > 0 ? `${t('common.selected')} ${selectedIds.length}` : t('common.selectAll')}
            </span>
          </label>
        </div>
      )}

      {/* 空状态 */}
      {accounts.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 ${colors.textMuted}`}>
          <div className={`w-20 h-20 rounded-full ${isDark ? 'bg-white/5' : 'bg-gray-100'} flex items-center justify-center animate-float mb-4`}>
            <Users size={40} strokeWidth={1} className="opacity-50" />
          </div>
          <p className="font-medium mb-1">{t('common.noAccounts')}</p>
          <p className="text-sm opacity-75">{t('common.addAccountHint')}</p>
        </div>
      ) : useVirtual ? (
        /* 虚拟滚动网格 */
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div 
                className="gap-4 pb-4" 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` 
                }}
              >
                {rows[virtualRow.index].map(renderCard)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 普通网格 */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {accounts.map(renderCard)}
          <AddButton onClick={onAdd} isDark={isDark} colors={colors} t={t} />
        </div>
      )}
    </div>
  )
}

// 添加账号按钮
function AddButton({ onClick, isDark, colors, t }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border-2 border-dashed transition-all duration-200 min-h-[280px] flex flex-col items-center justify-center gap-3 ${
        isDark
          ? 'border-gray-700 hover:border-gray-500 hover:bg-white/5'
          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
      }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
        <Plus size={24} className={colors.textMuted} />
      </div>
      <span className={`text-sm font-medium ${colors.textMuted}`}>{t('common.addAccount')}</span>
    </button>
  )
}

export default AccountTable
