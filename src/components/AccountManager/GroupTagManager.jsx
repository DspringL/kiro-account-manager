import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { X, Tag, Plus, Trash2, Edit2, Check } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { useDialog } from '../../contexts/DialogContext'
import { getTags, setAccountTags } from '../../api/groupTag'

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

  useEffect(() => {
    if (!allTags) {
      getTags().then(setTags).catch(() => {})
    }
  }, [allTags])

  const actualTags = allTags || tags

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

  const handleSelectTag = (tag) => {
    // 点击已有标签时，填入输入框，允许用户编辑
    setNewTagName(tag.name)
  }

  const getTagById = (tagId) => actualTags.find(t => t.id === tagId)

  return (
    <div>
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
      {/* 添加新标签 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
          placeholder={t('tags.newTagPlaceholder')}
          className={`flex-1 px-3 py-1.5 border ${colors.cardBorder} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${colors.input} ${colors.text}`}
        />
        <button
          type="button"
          onClick={handleAddTag}
          disabled={!newTagName.trim()}
          className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1"
        >
          <Plus size={14} />
        </button>
      </div>
      {/* 已有标签快速选择 */}
      {actualTags.filter(t => !selectedTagIds.includes(t.id)).length > 0 && (
        <div className="mt-2">
          <span className={`text-xs ${colors.textMuted}`}>{t('tags.selectTags')}:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {actualTags.filter(t => !selectedTagIds.includes(t.id)).map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleSelectTag(tag)}
                className="text-xs px-2 py-0.5 rounded-full text-white opacity-80 hover:opacity-100"
                style={{ backgroundColor: tag.color || '#8b5cf6' }}
              >
                + {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 标签管理弹窗（全局标签管理）
function GroupTagManager({ onClose, onSuccess }) {
  const { t, theme, colors } = useApp()
  const { showError, showConfirm } = useDialog()
  const isLightTheme = theme === 'light'
  
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0])
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', color: '' })

  // 加载标签
  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    try {
      const data = await getTags()
      setTags(data)
    } catch (e) {
      console.error('加载标签失败:', e)
    } finally {
      setLoading(false)
    }
  }

  // 添加标签
  const handleAdd = async () => {
    const trimmed = newTagName.trim().slice(0, 20)
    if (!trimmed) return
    if (tags.some(t => t.name === trimmed)) {
      await showError(t('common.error'), t('tags.duplicateName') || '标签名已存在')
      return
    }
    try {
      const newTag = await invoke('add_tag', { name: trimmed, color: newTagColor })
      setTags([...tags, newTag])
      setNewTagName('')
      setNewTagColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)])
    } catch (e) {
      await showError(t('common.error'), e.toString())
    }
  }

  // 删除标签
  const handleDelete = async (tagId) => {
    const tag = tags.find(t => t.id === tagId)
    const confirmed = await showConfirm(
      t('tags.deleteTag') || '删除标签',
      `${t('tags.confirmDelete') || '确定删除标签'} "${tag?.name}"?`
    )
    if (!confirmed) return
    try {
      await invoke('delete_tag', { id: tagId })
      setTags(tags.filter(t => t.id !== tagId))
    } catch (e) {
      await showError(t('common.error'), e.toString())
    }
  }

  // 开始编辑
  const startEdit = (tag) => {
    setEditingId(tag.id)
    setEditForm({ name: tag.name, color: tag.color })
  }

  // 保存编辑
  const saveEdit = async () => {
    const trimmed = editForm.name.trim().slice(0, 20)
    if (!trimmed) return
    if (tags.some(t => t.id !== editingId && t.name === trimmed)) {
      await showError(t('common.error'), t('tags.duplicateName') || '标签名已存在')
      return
    }
    try {
      await invoke('update_tag', { id: editingId, name: trimmed, color: editForm.color })
      setTags(tags.map(t => t.id === editingId ? { ...t, name: trimmed, color: editForm.color } : t))
      setEditingId(null)
    } catch (e) {
      await showError(t('common.error'), e.toString())
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className={`${isLightTheme ? 'bg-white' : 'bg-[#1a1a2e]'} rounded-xl w-full max-w-md shadow-2xl max-h-[80vh] overflow-hidden flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${colors.cardBorder}`}>
          <div className="flex items-center gap-2">
            <Tag size={20} className="text-purple-500" />
            <h3 className={`font-medium ${colors.text}`}>{t('tags.manage')}</h3>
          </div>
          <button onClick={onClose} className={`p-1.5 ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} rounded-lg`}>
            <X size={18} className={colors.textMuted} />
          </button>
        </div>

        {/* 添加新标签 */}
        <div className={`px-5 py-4 border-b ${colors.cardBorder}`}>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={t('tags.newTagPlaceholder')}
              className={`flex-1 px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 ${colors.input} ${colors.text}`}
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border-0"
            />
            <button
              onClick={handleAdd}
              disabled={!newTagName.trim()}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </div>
          {/* 预设颜色 */}
          <div className="flex gap-1.5 mt-2">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setNewTagColor(color)}
                className={`w-6 h-6 rounded-full ${newTagColor === color ? 'ring-2 ring-offset-2 ring-purple-500' : ''}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* 标签列表 */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className={`text-center py-8 ${colors.textMuted}`}>{t('common.loading')}</div>
          ) : tags.length === 0 ? (
            <div className={`text-center py-8 ${colors.textMuted}`}>{t('tags.noTags')}</div>
          ) : (
            <div className="space-y-2">
              {tags.map(tag => (
                <div 
                  key={tag.id} 
                  className={`flex items-center gap-3 p-3 rounded-lg ${isLightTheme ? 'bg-gray-50' : 'bg-white/5'}`}
                >
                  {editingId === tag.id ? (
                    <>
                      <input
                        type="color"
                        value={editForm.color}
                        onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        className={`flex-1 px-2 py-1 border ${colors.cardBorder} rounded text-sm ${colors.input} ${colors.text}`}
                        autoFocus
                      />
                      <button onClick={saveEdit} className="p-1.5 text-green-500 hover:bg-green-500/10 rounded">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingId(null)} className={`p-1.5 ${colors.textMuted} hover:bg-gray-500/10 rounded`}>
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span 
                        className="w-4 h-4 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className={`flex-1 text-sm ${colors.text}`}>{tag.name}</span>
                      <button 
                        onClick={() => startEdit(tag)} 
                        className={`p-1.5 ${colors.textMuted} hover:text-blue-500 hover:bg-blue-500/10 rounded`}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete(tag.id)} 
                        className={`p-1.5 ${colors.textMuted} hover:text-red-500 hover:bg-red-500/10 rounded`}
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
            className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GroupTagManager
