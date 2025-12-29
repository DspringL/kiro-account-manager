import { useState, useEffect } from 'react'
import { X, Tag, Plus } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { useDialog } from '../../contexts/DialogContext'
import { getTags, setAccountTags } from '../../api/groupTag'
import { invoke } from '@tauri-apps/api/core'

const PRESET_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', 
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16'
]

function BatchTagModal({ accountIds, onClose, onSuccess }) {
  const { t, theme, colors } = useApp()
  const { showError } = useDialog()
  const isLightTheme = theme === 'light'
  
  const [tags, setTags] = useState([])
  const [selectedTagIds, setSelectedTagIds] = useState([])
  const [newTagName, setNewTagName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getTags().then(setTags).catch(() => {})
  }, [])

  const handleToggleTag = (tagId) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  const handleAddTag = async () => {
    const trimmed = newTagName.trim().slice(0, 20)
    if (!trimmed) return
    if (tags.some(t => t.name === trimmed)) {
      const existing = tags.find(t => t.name === trimmed)
      if (!selectedTagIds.includes(existing.id)) {
        setSelectedTagIds([...selectedTagIds, existing.id])
      }
      setNewTagName('')
      return
    }
    const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    try {
      const newTag = await invoke('add_tag', { name: trimmed, color })
      setTags([...tags, newTag])
      setSelectedTagIds([...selectedTagIds, newTag.id])
      setNewTagName('')
    } catch (e) {
      await showError(t('common.error'), e.toString())
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await Promise.all(accountIds.map(id => setAccountTags(id, selectedTagIds)))
      onSuccess?.()
      onClose()
    } catch (e) {
      await showError(t('common.error'), e.toString())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`${isLightTheme ? 'bg-white' : 'bg-[#1a1a2e]'} rounded-xl w-full max-w-md shadow-2xl`} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${colors.cardBorder}`}>
          <div className="flex items-center gap-2">
            <Tag size={20} className="text-purple-500" />
            <h3 className={`font-medium ${colors.text}`}>{t('tags.batchSet')}</h3>
            <span className={`text-sm ${colors.textMuted}`}>({accountIds.length})</span>
          </div>
          <button onClick={onClose} className={`p-1.5 ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} rounded-lg`}>
            <X size={18} className={colors.textMuted} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5 space-y-4">
          {/* 已选标签 */}
          <div>
            <label className={`block text-sm font-medium ${colors.textMuted} mb-2`}>{t('tags.selected')}</label>
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {selectedTagIds.length === 0 ? (
                <span className={`text-sm ${colors.textMuted}`}>{t('tags.noTags')}</span>
              ) : (
                selectedTagIds.map(tagId => {
                  const tag = tags.find(t => t.id === tagId)
                  if (!tag) return null
                  return (
                    <span key={tagId} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full text-white cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: tag.color || '#8b5cf6' }}
                      onClick={() => handleToggleTag(tagId)}
                    >
                      {tag.name}
                      <X size={12} />
                    </span>
                  )
                })
              )}
            </div>
          </div>

          {/* 可选标签 */}
          {tags.filter(t => !selectedTagIds.includes(t.id)).length > 0 && (
            <div>
              <label className={`block text-sm font-medium ${colors.textMuted} mb-2`}>{t('tags.available')}</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.filter(t => !selectedTagIds.includes(t.id)).map(tag => (
                  <button key={tag.id} type="button" onClick={() => handleToggleTag(tag.id)}
                    className="text-xs px-2 py-1 rounded-full text-white opacity-70 hover:opacity-100"
                    style={{ backgroundColor: tag.color || '#8b5cf6' }}
                  >
                    + {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 新建标签 */}
          <div>
            <label className={`block text-sm font-medium ${colors.textMuted} mb-2`}>{t('tags.createNew')}</label>
            <div className="flex gap-2">
              <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder={t('tags.newTagPlaceholder')}
                className={`flex-1 px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm ${colors.input} ${colors.text}`}
              />
              <button type="button" onClick={handleAddTag} disabled={!newTagName.trim()}
                className="px-3 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className={`flex justify-end gap-3 px-5 py-4 border-t ${colors.cardBorder}`}>
          <button onClick={onClose} className={`px-4 py-2 ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} rounded-lg text-sm ${colors.text}`}>
            {t('common.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 disabled:opacity-50"
          >
            {loading ? t('common.saving') : t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BatchTagModal
