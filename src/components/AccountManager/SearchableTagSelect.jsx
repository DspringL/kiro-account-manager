import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown, Tag } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

/**
 * 可搜索的标签选择下拉框
 */
function SearchableTagSelect({
  tags = [],
  value,
  onChange,
  placeholder = '搜索标签...',
  showAllOption = false,
  showNoneOption = false,
  allLabel = '全部',
  noneLabel = '无标签',
  hasLabel = '有标签',
  className = '',
}) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 打开时聚焦输入框
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  // 过滤标签
  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(search.toLowerCase())
  )

  // 获取当前选中的标签
  const selectedTag = tags.find(t => t.id === value)

  // 选择标签
  const handleSelect = (tagId) => {
    onChange(tagId)
    setOpen(false)
    setSearch('')
  }

  // 显示文本
  const displayText = value === '__none__' ? noneLabel : value === '__has__' ? hasLabel : (selectedTag?.name || '')

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* 输入框（可搜索） */}
      <div className={`w-full flex items-center border rounded-lg text-sm ${colors.input} ${open ? 'ring-2 ring-blue-500/30 border-blue-500' : colors.cardBorder}`}>
        {selectedTag && (
          <span className="ml-3 w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedTag.color }} />
        )}
        <input
          ref={inputRef}
          type="text"
          value={open ? search : displayText}
          onChange={(e) => { setSearch(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`flex-1 px-3 py-2 bg-transparent text-sm ${colors.text} focus:outline-none`}
        />
        {value && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); setSearch('') }} className="p-1 mr-1 hover:bg-red-500/20 rounded">
            <X size={14} className="text-red-500" />
          </button>
        )}
        <button type="button" onClick={() => setOpen(!open)} className="pr-3">
          <ChevronDown size={14} className={`${colors.textMuted} transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* 下拉面板 */}
      {open && (
        <div className={`absolute left-0 right-0 top-full mt-1 ${colors.card} border ${colors.cardBorder} rounded-lg shadow-xl z-50 overflow-hidden`}>
          <div className="max-h-48 overflow-y-auto">
            {/* 全部选项 */}
            {showAllOption && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                  !value ? 'bg-blue-500/10 text-blue-500' : `${colors.text} ${colors.cardHover}`
                }`}
              >
                <Tag size={14} className={colors.textMuted} />
                {allLabel}
              </button>
            )}

            {/* 有标签选项 */}
            {showNoneOption && (
              <button
                type="button"
                onClick={() => handleSelect('__has__')}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                  value === '__has__' ? 'bg-blue-500/10 text-blue-500' : `${colors.text} ${colors.cardHover}`
                }`}
              >
                <span className={`w-3 h-3 rounded-full bg-green-500`} />
                {hasLabel}
              </button>
            )}

            {/* 无标签选项 */}
            {showNoneOption && (
              <button
                type="button"
                onClick={() => handleSelect('__none__')}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                  value === '__none__' ? 'bg-blue-500/10 text-blue-500' : `${colors.text} ${colors.cardHover}`
                }`}
              >
                <span className={`w-3 h-3 rounded-full border-2 border-dashed ${colors.cardBorder}`} />
                {noneLabel}
              </button>
            )}

            {/* 标签列表 */}
            {filteredTags.length > 0 ? (
              filteredTags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleSelect(tag.id)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                    value === tag.id ? 'bg-blue-500/10 text-blue-500' : `${colors.text} ${colors.cardHover}`
                  }`}
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))
            ) : search ? (
              <div className={`px-3 py-4 text-center text-sm ${colors.textMuted}`}>
                未找到匹配的标签
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchableTagSelect
