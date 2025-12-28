import { useRef, useMemo, useState, useEffect, useCallback, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Users, Plus } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import AccountCard from './AccountCard'

// 根据容器宽度计算列数
function getColumnCount(width) {
  if (width >= 1280) return 4
  if (width >= 1024) return 3
  if (width >= 768) return 2
  return 1
}

function AccountTable({
  accounts,
  totalCount,
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
  onDeleteRemote,
  onAdd,
  refreshingId,
  switchingId,
  localToken,
  tagDefinitions = [],
}) {
  const { t, theme, colors } = useApp()
  const isDark = theme === 'dark'
  const containerRef = useRef(null)
  const scrollRef = useRef(null)
  const [columns, setColumns] = useState(4)

  useEffect(() => {
    if (!containerRef.current) return
    const updateColumns = () => {
      const width = containerRef.current?.offsetWidth - 48 || 0
      setColumns(getColumnCount(width))
    }
    updateColumns()
    const observer = new ResizeObserver(updateColumns)
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const rows = useMemo(() => {
    const result = []
    const items = [...accounts, { _isAddButton: true }]
    for (let i = 0; i < items.length; i += columns) {
      result.push(items.slice(i, i + columns))
    }
    return result
  }, [accounts, columns])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 360,
    overscan: 2,
  })

  const renderCard = useCallback((item) => {
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
        onDeleteRemote={onDeleteRemote}
        refreshingId={refreshingId}
        switchingId={switchingId}
        isCurrentAccount={localToken?.refreshToken && item.refreshToken === localToken.refreshToken}
        tagDefinitions={tagDefinitions}
      />
    )
  }, [selectedIds, copiedId, onCopy, onSwitch, onRefresh, onEdit, onEditLabel, onDelete, onDeleteRemote, onAdd, refreshingId, switchingId, localToken, isDark, colors, t, onSelectOne, tagDefinitions])

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden p-6">
      {accounts.length > 0 && (
        <div className="flex items-center justify-between mb-4 px-1 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.length === accounts.length && accounts.length > 0}
              onChange={(e) => onSelectAll(e.target.checked)}
              className="w-4 h-4 rounded transition-transform hover:scale-110"
            />
            <span className={`text-sm ${colors.textMuted}`}>
              {selectedIds.length > 0 ? `${t('common.selected')} ${selectedIds.length}` : t('common.selectAll')}
            </span>
          </label>
          <span className={`text-sm ${colors.textMuted}`}>
            {accounts.length === totalCount ? `共 ${totalCount} 个账号` : `${accounts.length} / ${totalCount} 个账号`}
          </span>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 ${colors.textMuted}`}>
          <div className={`w-20 h-20 rounded-full ${isDark ? 'bg-white/5' : 'bg-gray-100'} flex items-center justify-center animate-float mb-4`}>
            <Users size={40} strokeWidth={1} className="opacity-50" />
          </div>
          <p className="font-medium mb-1">{t('common.noAccounts')}</p>
          <p className="text-sm opacity-75">{t('common.addAccountHint')}</p>
          <button onClick={onAdd} className={`mt-4 px-4 py-2 rounded-xl ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}>
            <Plus size={16} className="inline mr-1" />
            {t('common.addAccount')}
          </button>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-auto">
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
                <div className="gap-4 pb-4" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                  {rows[virtualRow.index].map(renderCard)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const AddButton = memo(function AddButton({ onClick, isDark, colors, t }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border-2 border-dashed transition-all duration-200 min-h-[320px] flex flex-col items-center justify-center gap-3 ${isDark ? 'border-gray-700 hover:border-gray-500 hover:bg-white/5' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
        <Plus size={24} className={colors.textMuted} />
      </div>
      <span className={`text-sm font-medium ${colors.textMuted}`}>{t('common.addAccount')}</span>
    </button>
  )
})

export default AccountTable
