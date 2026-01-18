import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { X, Tag, Plus, Trash2, Edit2, Check, Folder } from 'lucide-react'
import { TextInput, ColorInput } from '@mantine/core'
import { useApp } from '../../hooks/useApp'
import { useDialog } from '../../contexts/DialogContext'
import { getTags, getGroups } from '../../api/groupTag'

// 预设颜色
const PRESET_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', 
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16'
]

// 标签选择器（用于账号编辑）
export function TagSelector({ selectedTagIds, onChange, allTags }) {
  const { t, colors } = useApp()
  const [newTagName, setNewTagName] = useState('')
  const [tags, setTags] = useState(allTags || [])
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!allTags) {
      getTags().then(setTags).catch(() => {})
    }
  }, [allTags])

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const actualTags = allTags || tags
  const unselectedTags = actualTags.filter(t => !selectedTagIds.includes(t.id))
  
  // 过滤：有输入时过滤，没输入时显示全部未选中的
  const filteredTags = newTagName.trim()
    ? unselectedTags.filter(t => t.name.toLowerCase().includes(newTagName.toLowerCase()))
    : unselectedTags

  // 添加新标签
  const handleAddTag = async () => {
    const trimmed = newTagName.trim().slice(0, 20)
    if (!trimmed) return
    
    const existing = actualTags.find(t => t.name === trimmed)
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) {
        onChange([...selectedTagIds, existing.id])
      }
    } else {
      const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
      try {
        const newTag = await invoke('add_tag', { name: trimmed, color })
        setTags([...actualTags, newTag])
        onChange([...selectedTagIds, newTag.id])
      } catch (e) {
        console.error('创建标签失败:', e)
      }
    }
    setNewTagName('')
  }

  const handleRemoveTag = (tagId) => {
    onChange(selectedTagIds.filter(id => id !== tagId))
  }

  const getTagById = (tagId) => actualTags.find(t => t.id === tagId)

  return (
    <div ref={containerRef}>
      <label className={`block text-sm font-medium ${colors.textMuted} mb-2 flex items-center gap-1.5`}>
        <Tag size={14} />
        {t('tags.title')}
      </label>
      {/* 已选标签 */}
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {selectedTagIds.map(tagId => {
          const tag = getTagById(tagId)
          if (!tag) return null
          return (
            <span 
              key={tagId} 
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full text-white"
              style={{ backgroundColor: tag.color || '#8b5cf6' }}
            >
              {tag.name}
              <button type="button" onClick={() => handleRemoveTag(tagId)} className="hover:opacity-70">
                <X size={12} />
              </button>
            </span>
          )
        })}
        {selectedTagIds.length === 0 && (
          <span className={`text-xs ${colors.textMuted}`}>{t('tags.noTags')}</span>
        )}
      </div>
      {/* 搜索/添加标签 - 合并输入框 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <TextInput
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            placeholder={t('tags.searchOrCreate') || '搜索或输入新标签...'}
            classNames={{
              input: `${colors.input} ${colors.text} border-${colors.cardBorder}`
            }}
            styles={{
              input: {
                fontSize: '0.875rem',
                padding: '0.375rem 0.75rem',
                borderRadius: '0.5rem'
              }
            }}
          />
          {/* 搜索建议下拉 - 聚焦就显示 */}
          {showDropdown && unselectedTags.length > 0 && (
            <div className={`absolute top-full left-0 right-0 mt-1 ${colors.card} border ${colors.cardBorder} rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto`}>
              {filteredTags.map(tag => (
                <button 
                  key={tag.id} 
                  type="button"
                  onClick={() => { onChange([...selectedTagIds, tag.id]); setNewTagName(''); setShowDropdown(false) }}
                  className={`w-full px-3 py-2 text-left text-sm ${colors.text} hover:opacity-80 flex items-center gap-2 transition-colors ${colors.cardHover}`}
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
              {filteredTags.length === 0 && newTagName.trim() && (
                <div className={`px-3 py-2 text-sm ${colors.textMuted}`}>
                  按回车创建 "{newTagName.trim()}"
                </div>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddTag}
          disabled={!newTagName.trim()}
          className={`px-3 py-1.5 ${colors.accentBg || 'bg-purple-500'} text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-1`}
          title={t('tags.addTag')}
        >
          <Plus size={14} />
        </button>
      </div>
      <p className={`text-xs ${colors.textMuted} mt-1.5`}>{t('tags.hint') || '输入搜索已有标签，或直接输入创建新标签'}</p>
    </div>
  )
}

// 标签管理弹窗（全局标签和分组管理）
function GroupTagManager({ onClose, onSuccess, defaultTab = 'tags' }) {
  const { t, colors } = useApp()
  const { showError, showConfirm } = useDialog()
  
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [tags, setTags] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', color: '' })

  // 加载数据
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [tagsData, groupsData] = await Promise.all([getTags(), getGroups()])
      setTags(tagsData)
      setGroups(groupsData)
    } catch (e) {
      console.error('加载数据失败:', e)
    } finally {
      setLoading(false)
    }
  }

  const isTagMode = activeTab === 'tags'
  const items = isTagMode ? tags : groups
  const setItems = isTagMode ? setTags : setGroups

  // 添加
  const handleAdd = async () => {
    const trimmed = newName.trim().slice(0, 20)
    if (!trimmed) return
    if (items.some(item => item.name === trimmed)) {
      await showError(t('common.error'), isTagMode ? (t('tags.duplicateName') || '标签名已存在') : (t('groups.duplicateName') || '分组名已存在'))
      return
    }
    try {
      const cmd = isTagMode ? 'add_tag' : 'add_group'
      const newItem = await invoke(cmd, { name: trimmed, color: newColor })
      setItems([...items, newItem])
      setNewName('')
      setNewColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)])
    } catch (e) {
      await showError(t('common.error'), e.toString())
    }
  }

  // 删除
  const handleDelete = async (id) => {
    const item = items.find(i => i.id === id)
    const title = isTagMode ? (t('tags.deleteTag') || '删除标签') : (t('groups.deleteGroup') || '删除分组')
    const msg = isTagMode 
      ? `${t('tags.confirmDelete') || '确定删除标签'} "${item?.name}"?`
      : `${t('groups.confirmDelete') || '确定删除分组'} "${item?.name}"?`
    const confirmed = await showConfirm(title, msg)
    if (!confirmed) return
    try {
      const cmd = isTagMode ? 'delete_tag' : 'delete_group'
      await invoke(cmd, { id })
      setItems(items.filter(i => i.id !== id))
    } catch (e) {
      await showError(t('common.error'), e.toString())
    }
  }

  // 开始编辑
  const startEdit = (item) => {
    setEditingId(item.id)
    setEditForm({ name: item.name, color: item.color })
  }

  // 保存编辑
  const saveEdit = async () => {
    const trimmed = editForm.name.trim().slice(0, 20)
    if (!trimmed) return
    if (items.some(i => i.id !== editingId && i.name === trimmed)) {
      await showError(t('common.error'), isTagMode ? (t('tags.duplicateName') || '标签名已存在') : (t('groups.duplicateName') || '分组名已存在'))
      return
    }
    try {
      const cmd = isTagMode ? 'update_tag' : 'update_group'
      await invoke(cmd, { id: editingId, name: trimmed, color: editForm.color })
      setItems(items.map(i => i.id === editingId ? { ...i, name: trimmed, color: editForm.color } : i))
      setEditingId(null)
    } catch (e) {
      await showError(t('common.error'), e.toString())
    }
  }

  // 切换 Tab 时重置编辑状态
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setEditingId(null)
    setNewName('')
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div 
        className={`${colors.card} border ${colors.cardBorder} rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] overflow-hidden flex flex-col`}
        onClick={e => e.stopPropagation()}
        style={{ animation: 'modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* 头部 + Tab */}
        <div className={`px-5 py-4 border-b ${colors.cardBorder}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`font-medium ${colors.text}`}>{t('tags.manage') || '管理标签和分组'}</h3>
            <button onClick={onClose} className={`p-1.5 hover:opacity-80 rounded-lg`}>
              <X size={18} className={colors.textMuted} />
            </button>
          </div>
          {/* Tab 切换 */}
          <div className="flex gap-2">
            <button
              onClick={() => handleTabChange('tags')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'tags'
                  ? `${colors.accentBg || 'bg-purple-500'} text-white`
                  : `${colors.text} ${colors.cardSecondary} ${colors.cardHover}`
              }`}
            >
              <Tag size={16} />
              {t('tags.title') || '标签'}
            </button>
            <button
              onClick={() => handleTabChange('groups')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'groups'
                  ? `${colors.primary} bg-blue-500 text-white`
                  : `${colors.text} ${colors.cardSecondary} ${colors.cardHover}`
              }`}
            >
              <Folder size={16} />
              {t('groups.title') || '分组'}
            </button>
          </div>
        </div>

        {/* 添加新项 */}
        <div className={`px-5 py-4 border-b ${colors.cardBorder}`}>
          <div className="flex gap-2">
            <TextInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={isTagMode ? (t('tags.newTagPlaceholder') || '输入新标签...') : (t('groups.newGroupPlaceholder') || '输入新分组...')}
              classNames={{
                input: `${colors.input} ${colors.text}`
              }}
              styles={{
                root: { flex: 1 },
                input: {
                  fontSize: '0.875rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem'
                }
              }}
            />
            <ColorInput
              value={newColor}
              onChange={setNewColor}
              format="hex"
              swatches={PRESET_COLORS}
              classNames={{
                input: `${colors.input}`
              }}
              styles={{
                input: {
                  width: '40px',
                  height: '40px',
                  padding: 0,
                  borderRadius: '0.5rem',
                  cursor: 'pointer'
                }
              }}
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className={`px-4 py-2 text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50 ${isTagMode ? (colors.accentBg || 'bg-purple-500') : 'bg-blue-500'}`}
            >
              <Plus size={16} />
            </button>
          </div>
          {/* 预设颜色 */}
          <div className="flex gap-1.5 mt-2">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={`w-6 h-6 rounded-full ${newColor === color ? `ring-2 ring-offset-2 ${isTagMode ? (colors.accentBg || 'ring-purple-500') : 'ring-blue-500'}` : ''}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className={`text-center py-8 ${colors.textMuted}`}>{t('common.loading')}</div>
          ) : items.length === 0 ? (
            <div className={`text-center py-8 ${colors.textMuted}`}>
              {isTagMode ? (t('tags.noTags') || '暂无标签') : (t('groups.noGroups') || '暂无分组')}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div 
                  key={item.id} 
                  className={`flex items-center gap-3 p-3 rounded-lg ${colors.cardSecondary}`}
                >
                  {editingId === item.id ? (
                    <>
                      <ColorInput
                        value={editForm.color}
                        onChange={(color) => setEditForm({ ...editForm, color })}
                        format="hex"
                        styles={{
                          input: {
                            width: '32px',
                            height: '32px',
                            padding: 0,
                            borderRadius: '0.25rem',
                            cursor: 'pointer'
                          }
                        }}
                      />
                      <TextInput
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        classNames={{
                          input: `${colors.input} ${colors.text}`
                        }}
                        styles={{
                          root: { flex: 1 },
                          input: {
                            fontSize: '0.875rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem'
                          }
                        }}
                        autoFocus
                      />
                      <button onClick={saveEdit} className={`p-1.5 ${colors.iconSuccess} rounded transition-colors ${colors.hoverBg || 'hover:bg-green-500/10'}`}>
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingId(null)} className={`p-1.5 ${colors.textMuted} ${colors.cardHover} rounded`}>
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span 
                        className={`w-4 h-4 flex-shrink-0 ${isTagMode ? 'rounded-full' : 'rounded'}`}
                        style={{ backgroundColor: item.color }}
                      />
                      <span className={`flex-1 text-sm ${colors.text}`}>{item.name}</span>
                      {item.createdAt && (
                        <span className={`text-xs ${colors.textMuted}`}>{item.createdAt}</span>
                      )}
                      <button 
                        onClick={() => startEdit(item)} 
                        className={`p-1.5 ${colors.textMuted} rounded transition-colors ${colors.cardHover}`}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)} 
                        className={`p-1.5 ${colors.textMuted} rounded transition-colors ${colors.dangerHover || 'hover:bg-red-500/10'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className={`flex justify-end px-5 py-4 border-t ${colors.cardBorder}`}>
          <button 
            onClick={() => { onSuccess?.(); onClose() }} 
            className={`px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 ${isTagMode ? (colors.accentBg || 'bg-purple-500') : 'bg-blue-500'}`}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GroupTagManager
