import { memo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// 右键菜单组件（使用 Portal 渲染到 body）
const ContextMenu = memo(function ContextMenu({ x, y, onClose, items, isLightTheme }) {
  const menuRef = useRef(null)
  const [position, setPosition] = useState({ x, y })

  // 计算菜单位置，确保不超出视口
  useEffect(() => {
    if (!menuRef.current) return
    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    let newX = x
    let newY = y
    
    // 右边超出
    if (x + rect.width > viewportWidth - 10) {
      newX = viewportWidth - rect.width - 10
    }
    // 下边超出
    if (y + rect.height > viewportHeight - 10) {
      newY = viewportHeight - rect.height - 10
    }
    
    setPosition({ x: newX, y: newY })
  }, [x, y])

  useEffect(() => {
    const handleClick = () => onClose()
    const handleScroll = () => onClose()
    document.addEventListener('click', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose])

  // 使用 Portal 渲染到 body，避免被父元素的 transform 影响
  return createPortal(
    <div
      ref={menuRef}
      className={`fixed z-[9999] min-w-[180px] py-2 rounded-xl shadow-2xl border backdrop-blur-sm ${
        isLightTheme ? 'bg-white/95 border-gray-200/80' : 'bg-gray-800/95 border-gray-600/50'
      }`}
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, idx) =>
        item.divider ? (
          <div key={idx} className={`my-1.5 mx-3 border-t ${isLightTheme ? 'border-gray-200' : 'border-gray-600/50'}`} />
        ) : (
          <button
            key={idx}
            onClick={() => { item.onClick(); onClose() }}
            disabled={item.disabled}
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              item.danger
                ? (isLightTheme ? 'text-red-600 hover:bg-red-50' : 'text-red-400 hover:bg-red-500/20')
                : (isLightTheme ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-200 hover:bg-white/10')
            }`}
          >
            {item.icon && <item.icon size={16} className={item.danger ? '' : (isLightTheme ? 'text-gray-500' : 'text-gray-400')} />}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && <span className={`text-xs ${isLightTheme ? 'text-gray-400' : 'text-gray-500'}`}>{item.shortcut}</span>}
          </button>
        )
      )}
    </div>,
    document.body
  )
})

export default ContextMenu
