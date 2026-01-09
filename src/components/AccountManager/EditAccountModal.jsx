import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { X, Copy, Check, Folder, Plus } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { useDialog } from '../../contexts/DialogContext'
import { setAccountTags, setAccountGroup, getGroups, addGroup } from '../../api/groupTag'
import { TagSelector } from './GroupTagManager'
import { TokenJsonView } from './TokenJsonView'

// 预设颜色
const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
]

// 分组选择器（支持直接创建）
function GroupSelector({ groups, value, onChange, onGroupsChange }) {
  const { t, theme, colors } = useApp()
  const isLightTheme = theme === 'light'
  const [newGroupName, setNewGroupName] = useState('')
  const [showInput, setShowInput] = useState(false)

  const handleAddGroup = async () => {
    const trimmed = newGroupName.trim().slice(0, 20)
    if (!trimmed) return
    if (groups.some(g => g.name === trimmed)) {
      setNewGroupName('')
      return
    }
    const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    try {
      const newGroup = await addGroup(trimmed, color)
      onGroupsChange([...groups, newGroup])
      onChange(newGroup.id)
      setNewGroupName('')
      setShowInput(false)
    } catch (e) {
      console.error('创建分组失败:', e)
    }
  }

  return (
    <div>
      <label className={`block text-sm font-medium ${colors.textMuted} mb-2 flex items-center gap-1.5`}>
        <Folder size={14} />
        {t('groups.title') || '分组'}
      </label>
      <div className="flex gap-2">
        {showInput ? (
          <>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
              placeholder={t('groups.newGroupPlaceholder') || '输入新分组名...'}
              autoFocus
              className={`flex-1 px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${colors.input} ${colors.text}`}
            />
            <button
              type="button"
              onClick={handleAddGroup}
              disabled={!newGroupName.trim()}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={() => { setShowInput(false); setNewGroupName('') }}
              className={`px-3 py-2 ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} rounded-lg`}
            >
              <X size={16} className={colors.textMuted} />
            </button>
          </>
        ) : (
          <>
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={`flex-1 px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${colors.input} ${colors.text}`}
            >
              <option value="">{t('groups.noGroup') || '无分组'}</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowInput(true)}
              className={`px-3 py-2 ${isLightTheme ? 'bg-gray-100 hover:bg-gray-200' : 'bg-white/10 hover:bg-white/20'} rounded-lg`}
              title={t('common.add') || '添加'}
            >
              <Plus size={16} className="text-blue-500" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function EditAccountModal({ account, onClose, onSuccess }) {
  const { t, theme, colors } = useApp()
  const { showError } = useDialog()
  const isLightTheme = theme === 'light'
  
  const [form, setForm] = useState({
    label: account.label || '',
    accessToken: account.accessToken || '',
    refreshToken: account.refreshToken || '',
    clientId: account.clientId || '',
    clientSecret: account.clientSecret || '',
    machineId: account.machineId || '',
  })
  const [selectedTagIds, setSelectedTagIds] = useState(account.tags || [])
  const [selectedGroupId, setSelectedGroupId] = useState(account.groupId || '')
  const [groups, setGroups] = useState([])
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(null)
  const copiedTimerRef = useRef(null)

  // 加载分组列表
  useEffect(() => {
    getGroups().then(setGroups).catch(() => {})
  }, [])

  // 清理timer
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text).catch(e => console.error('Copy failed:', e))
    setCopied(field)
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = setTimeout(() => setCopied(null), 1500)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const params = {
        id: account.id,
        label: form.label || null,
        accessToken: form.accessToken || null,
        refreshToken: form.refreshToken || null,
        machineId: form.machineId || null,
      }
      // BuilderId 专用字段
      if (account.provider === 'BuilderId') {
        params.clientId = form.clientId || null
        params.clientSecret = form.clientSecret || null
      }
      await invoke('update_account', params)
      // 保存分组关联
      await setAccountGroup(account.id, selectedGroupId || null)
      // 保存标签关联
      await setAccountTags(account.id, selectedTagIds)
      onSuccess?.()
      onClose()
    } catch (e) {
      await showError(t('editAccount.saveFailed'), e.toString())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className={`${isLightTheme ? 'bg-white' : 'bg-[#1a1a2e]'} rounded-xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-hidden flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${colors.cardBorder}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              account.provider === 'Google' ? (isLightTheme ? 'bg-red-100' : 'bg-red-500/20') :
              account.provider === 'Github' ? (isLightTheme ? 'bg-gray-200' : 'bg-gray-600') :
              (isLightTheme ? 'bg-blue-100' : 'bg-blue-500/20')
            }`}>
              <span className="text-sm font-bold">{account.email[0].toUpperCase()}</span>
            </div>
            <div>
              <h3 className={`font-medium ${colors.text}`}>{t('editAccount.title')}</h3>
              <p className={`text-xs ${colors.textMuted}`}>{account.email}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} rounded-lg`}>
            <X size={18} className={colors.textMuted} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 备注标签 */}
          <div>
            <label className={`block text-sm font-medium ${colors.textMuted} mb-2`}>{t('accounts.remark')}</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder={t('editAccount.labelPlaceholder')}
              className={`w-full px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${colors.input} ${colors.text}`}
            />
          </div>

          {/* 机器码 */}
          <div>
            <label className={`block text-sm font-medium ${colors.textMuted} mb-2`}>{t('addAccount.machineId')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.machineId}
                onChange={(e) => setForm({ ...form, machineId: e.target.value })}
                placeholder={t('addAccount.machineIdPlaceholder')}
                className={`flex-1 px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${colors.input} ${colors.text}`}
              />
              <button
                type="button"
                onClick={() => handleCopy(form.machineId, 'machineId')}
                className={`px-3 py-2 ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} rounded-lg transition-colors`}
              >
                {copied === 'machineId' ? <Check size={16} className="text-green-500" /> : <Copy size={16} className={colors.textMuted} />}
              </button>
            </div>
          </div>

          {/* BuilderId 专用字段 */}
          {account.provider === 'BuilderId' && (
            <>
              <div>
                <label className={`block text-sm font-medium ${colors.textMuted} mb-2`}>Client ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.clientId}
                    onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                    placeholder="刷新 Token 需要"
                    className={`flex-1 px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${colors.input} ${colors.text}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(form.clientId, 'clientId')}
                    className={`px-3 py-2 ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} rounded-lg transition-colors`}
                  >
                    {copied === 'clientId' ? <Check size={16} className="text-green-500" /> : <Copy size={16} className={colors.textMuted} />}
                  </button>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${colors.textMuted} mb-2`}>Client Secret</label>
                <div className="flex gap-2">
                  <textarea
                    value={form.clientSecret}
                    onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                    placeholder="刷新 Token 需要"
                    rows={2}
                    className={`flex-1 px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${colors.input} ${colors.text} resize-none`}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(form.clientSecret, 'clientSecret')}
                    className={`px-3 py-2 ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} rounded-lg transition-colors self-start`}
                  >
                    {copied === 'clientSecret' ? <Check size={16} className="text-green-500" /> : <Copy size={16} className={colors.textMuted} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 分组选择 - 支持直接创建 */}
          <GroupSelector
            groups={groups}
            value={selectedGroupId}
            onChange={setSelectedGroupId}
            onGroupsChange={setGroups}
          />

          {/* 标签管理 */}
          <TagSelector 
            selectedTagIds={selectedTagIds} 
            onChange={setSelectedTagIds} 
          />

          {/* Token 凭证 JSON 视图（只读） */}
          <TokenJsonView account={account} defaultExpanded={false} />
        </div>
        
        <div className={`flex justify-end gap-3 px-5 py-4 border-t ${colors.cardBorder}`}>
          <button onClick={onClose} className={`px-4 py-2 ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} rounded-lg text-sm ${colors.text}`}>
            {t('common.cancel')}
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? t('settings.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditAccountModal
