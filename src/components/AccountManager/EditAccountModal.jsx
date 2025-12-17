import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { X, Key, Copy, Check, Shield, ChevronDown, ChevronUp, Clock, Tag, Plus } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { useDialog } from '../../contexts/DialogContext'

function EditAccountModal({ account, onClose, onSuccess }) {
  const { t, theme, colors } = useApp()
  const { showError } = useDialog()
  const isDark = theme === 'dark'
  
  const [form, setForm] = useState({
    label: account.label || '',
    accessToken: account.accessToken || '',
    refreshToken: account.refreshToken || '',
    // BuilderId SSO 字段
    clientId: account.clientId || '',
    clientSecret: account.clientSecret || '',
  })
  const [tags, setTags] = useState(account.tags || [])
  const [allTags, setAllTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(null)
  const [showTokens, setShowTokens] = useState(true)

  // 加载所有标签
  useEffect(() => {
    invoke('get_all_tags').then(setAllTags).catch(() => {})
  }, [])

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 1500)
  }

  const handleAddTag = () => {
    // 去除首尾空格，限制长度 20 字符
    const trimmed = newTag.trim().slice(0, 20)
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  const handleSelectExistingTag = (tag) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const params = {
        id: account.id,
        label: form.label || null,
        accessToken: form.accessToken || null,
        refreshToken: form.refreshToken || null,
      }
      // BuilderId 专用字段
      if (account.provider === 'BuilderId') {
        params.clientId = form.clientId || null
        params.clientSecret = form.clientSecret || null
      }
      await invoke('update_account', params)
      // 保存标签
      await invoke('update_account_tags', { id: account.id, tags })
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
        className={`${isDark ? 'bg-[#1a1a2e]' : 'bg-white'} rounded-xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-hidden flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${colors.cardBorder}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              account.provider === 'Google' ? (isDark ? 'bg-red-500/20' : 'bg-red-100') :
              account.provider === 'Github' ? (isDark ? 'bg-gray-600' : 'bg-gray-200') :
              (isDark ? 'bg-blue-500/20' : 'bg-blue-100')
            }`}>
              <span className="text-sm font-bold">{account.email[0].toUpperCase()}</span>
            </div>
            <div>
              <h3 className={`font-medium ${colors.text}`}>{t('editAccount.title')}</h3>
              <p className={`text-xs ${colors.textMuted}`}>{account.email}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-lg`}>
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

          {/* 标签管理 */}
          <div>
            <label className={`block text-sm font-medium ${colors.textMuted} mb-2 flex items-center gap-1.5`}>
              <Tag size={14} />
              {t('tags.title')}
            </label>
            {/* 已选标签 */}
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {tags.map(tag => (
                <span 
                  key={tag} 
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-600'}`}
                >
                  {tag}
                  <button 
                    type="button" 
                    onClick={() => handleRemoveTag(tag)} 
                    className="hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <span className={`text-xs ${colors.textMuted}`}>{t('tags.noTags')}</span>
              )}
            </div>
            {/* 添加新标签 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder={t('tags.newTagPlaceholder')}
                className={`flex-1 px-3 py-1.5 border ${colors.cardBorder} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${colors.input} ${colors.text}`}
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!newTag.trim()}
                className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1"
              >
                <Plus size={14} />
              </button>
            </div>
            {/* 已有标签快速选择 */}
            {allTags.filter(t => !tags.includes(t)).length > 0 && (
              <div className="mt-2">
                <span className={`text-xs ${colors.textMuted}`}>{t('tags.selectTags')}:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {allTags.filter(t => !tags.includes(t)).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleSelectExistingTag(tag)}
                      className={`text-xs px-2 py-0.5 rounded-full border ${isDark ? 'border-gray-600 hover:bg-white/10' : 'border-gray-300 hover:bg-gray-100'} ${colors.text}`}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Token 凭证 */}
          <div className={`${colors.card} rounded-xl shadow-sm overflow-hidden`}>
            <div 
              className={`flex items-center justify-between px-4 py-3 cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition-colors`} 
              onClick={() => setShowTokens(!showTokens)}
            >
              <div className="flex items-center gap-2">
                <Key size={16} className={colors.textMuted} />
                <span className={`text-sm font-medium ${colors.text}`}>{t('editAccount.tokenCredentials')}</span>
              </div>
              <div className="flex items-center gap-2">
                {account.expiresAt && (
                  <span className={`text-xs ${colors.textMuted} flex items-center gap-1`}>
                    <Clock size={12} />{account.expiresAt}
                  </span>
                )}
                {showTokens ? <ChevronUp size={16} className={colors.textMuted} /> : <ChevronDown size={16} className={colors.textMuted} />}
              </div>
            </div>
            
            {showTokens && (
              <div className={`px-4 pb-4 space-y-3 border-t ${colors.cardBorder} pt-3`}>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-medium ${colors.textMuted}`}>{t('editAccount.accessToken')}</span>
                    <button type="button" onClick={() => handleCopy(form.accessToken, 'access')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                      {copied === 'access' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      {copied === 'access' ? t('common.copied') : t('common.copy')}
                    </button>
                  </div>
                  <textarea 
                    value={form.accessToken} 
                    onChange={(e) => setForm({ ...form, accessToken: e.target.value })} 
                    placeholder="eyJ..."
                    className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg resize-none h-14 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${colors.text}`} 
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-medium ${colors.textMuted}`}>{t('editAccount.refreshToken')}</span>
                    <button type="button" onClick={() => handleCopy(form.refreshToken, 'refresh')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                      {copied === 'refresh' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      {copied === 'refresh' ? t('common.copied') : t('common.copy')}
                    </button>
                  </div>
                  <textarea 
                    value={form.refreshToken} 
                    onChange={(e) => setForm({ ...form, refreshToken: e.target.value })} 
                    placeholder="aor..."
                    className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg resize-none h-14 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${colors.text}`} 
                  />
                </div>
                
                {/* BuilderId SSO 专用字段 */}
                {account.provider === 'BuilderId' && (
                  <div className={`pt-3 border-t ${colors.cardBorder} space-y-3`}>
                    <div className={`text-xs font-medium ${colors.textMuted} flex items-center gap-1`}>
                      <Shield size={12} />
                      {t('editAccount.ssoCredentials')}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`text-xs ${colors.textMuted}`}>Client ID Hash</label>
                        <button type="button" onClick={() => handleCopy(account.clientIdHash, 'clientIdHash')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                          {copied === 'clientIdHash' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <input type="text" value={account.clientIdHash || '-'} readOnly className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg ${colors.text} opacity-60`} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-xs ${colors.textMuted} mb-1`}>Region</label>
                        <input type="text" value={account.region || 'us-east-1'} readOnly className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg ${colors.text} opacity-60`} />
                      </div>
                      <div>
                        <label className={`block text-xs ${colors.textMuted} mb-1`}>Session ID</label>
                        <input type="text" value={account.ssoSessionId || '-'} readOnly className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg ${colors.text} opacity-60 truncate`} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`text-xs ${colors.textMuted}`}>Client ID</label>
                        <button type="button" onClick={() => handleCopy(form.clientId, 'clientId')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                          {copied === 'clientId' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <input 
                        type="text" 
                        value={form.clientId} 
                        onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                        className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500/20`} 
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`text-xs ${colors.textMuted}`}>Client Secret</label>
                        <button type="button" onClick={() => handleCopy(form.clientSecret, 'clientSecret')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                          {copied === 'clientSecret' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <textarea 
                        value={form.clientSecret} 
                        onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                        className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg resize-none h-14 ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500/20`} 
                      />
                    </div>
                  </div>
                )}
                
                {/* Social 专用字段 */}
                {(account.provider === 'Google' || account.provider === 'Github') && account.profileArn && (
                  <div className={`pt-3 border-t ${colors.cardBorder} space-y-3`}>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`text-xs ${colors.textMuted}`}>Profile ARN</label>
                        <button type="button" onClick={() => handleCopy(account.profileArn, 'profileArn')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                          {copied === 'profileArn' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <input 
                        type="text" 
                        value={account.profileArn} 
                        readOnly
                        className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg ${colors.text} opacity-60`} 
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className={`flex justify-end gap-3 px-5 py-4 border-t ${colors.cardBorder}`}>
          <button onClick={onClose} className={`px-4 py-2 ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-lg text-sm ${colors.text}`}>
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
