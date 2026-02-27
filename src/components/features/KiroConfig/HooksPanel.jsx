import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Textarea, TextInput } from '@mantine/core'
import { FolderOpen, Link2, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import { getThemeAccent, getGradientAccentButton, getSolidAccentButton, getThemeSurfaceStyles } from './themeAccent'

const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`


function HooksPanel({ onCountChange, projectDir }) {
  const { t, theme, colors } = useApp()
  const { showConfirm, showError } = useDialog()
  const accent = getThemeAccent(theme)
  const surface = getThemeSurfaceStyles(theme)
  const accentSolidButtonClass = getSolidAccentButton(accent)
  const accentGradientButtonClass = getGradientAccentButton(accent)

  const [hooks, setHooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedHook, setSelectedHook] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadHooks = useCallback(async () => {
    if (!projectDir) {
      setHooks([])
      setSelectedHook(null)
      setEditContent('')
      setHasChanges(false)
      onCountChange?.(0)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const data = await invoke('get_hooks', { projectDir })
      setHooks(data)
      onCountChange?.(data?.length || 0)
    } catch (e) {
      console.error('加载 Hooks 失败:', e)
    } finally {
      setLoading(false)
    }
  }, [onCountChange, projectDir])

  useEffect(() => {
    setSelectedHook(null)
    setEditContent('')
    setHasChanges(false)
    loadHooks()
  }, [loadHooks])

  const handleSelect = async (hookFile) => {
    if (hasChanges && !await showConfirm(t('hooks.unsavedChanges'), t('hooks.confirmSwitch'))) return
    setSelectedHook(hookFile)
    setEditContent(hookFile.content || '')
    setHasChanges(false)
  }

  const handleSave = async () => {
    if (!selectedHook || !projectDir) return

    setSaving(true)
    try {
      await invoke('save_hook', {
        fileName: selectedHook.fileName,
        content: editContent,
        projectDir
      })
      const newList = hooks.map(h => (h.fileName === selectedHook.fileName)
        ? { ...h, content: editContent }
        : h)
      setHooks(newList)
      setSelectedHook({ ...selectedHook, content: editContent })
      setHasChanges(false)
    } catch (e) {
      showError(t('hooks.saveFailed'), String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (hookFile) => {
    if (!projectDir) return
    if (!await showConfirm(t('hooks.confirmDelete'), t('hooks.confirmDeleteFile', { fileName: hookFile.fileName }))) return
    try {
      await invoke('delete_hook', {
        fileName: hookFile.fileName,
        projectDir
      })
      const next = hooks.filter(h => h.fileName !== hookFile.fileName)
      setHooks(next)
      onCountChange?.(next.length)
      if (selectedHook?.fileName === hookFile.fileName) {
        setSelectedHook(null)
        setEditContent('')
        setHasChanges(false)
      }
    } catch (e) {
      showError(t('hooks.deleteFailed'), String(e))
    }
  }

  const handleCreate = async (fileName) => {
    if (!projectDir) return false

    const raw = fileName.trim()
    if (!raw) {
      showError(t('hooks.createFailed'), t('hooks.fileNameRequired'))
      return false
    }

    const normalized = raw.endsWith('.kiro.hook') ? raw : `${raw}.kiro.hook`
    if (!/^[A-Za-z0-9._-]+\.kiro\.hook$/.test(normalized)) {
      showError(t('hooks.createFailed'), t('hooks.fileNameInvalid'))
      return false
    }

    const exists = hooks.some(h => h.fileName.toLowerCase() === normalized.toLowerCase())
    if (exists) {
      showError(t('hooks.createFailed'), t('hooks.fileNameDuplicate'))
      return false
    }

    const baseName = normalized.replace(/\.kiro\.hook$/i, '')
    const template = `{
  "enabled": true,
  "name": "${baseName}",
  "description": "",
  "version": "1",
  "when": {
    "type": "userTriggered",
    "filePattern": null
  },
  "then": {
    "type": "askAgent",
    "prompt": "请在这里填写执行说明"
  },
  "workspaceFolderName": "",
  "shortName": "${baseName}",
  "fileName": "${normalized}"
}
`
    try {
      const newHook = await invoke('create_hook', {
        fileName: normalized,
        content: template,
        projectDir
      })
      const next = [...hooks, newHook]
      setHooks(next)
      onCountChange?.(next.length)
      setShowCreateModal(false)
      handleSelect(newHook)
      return true
    } catch (e) {
      showError(t('hooks.createFailed'), String(e))
      return false
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><RefreshCw className={`animate-spin ${accent.text}`} size={24} /></div>
  }

  return (
    <div className="flex h-full min-h-0 gap-4 p-4 overflow-hidden">
      <div className={`w-80 min-h-0 flex flex-col ${colors.card} border ${colors.cardBorder} rounded-2xl overflow-hidden shadow-lg max-w-full`}>
        <div className={`p-4 border-b ${colors.cardBorder}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
            <Link2 size={18} className={accent.text} />
            <span className={`text-sm font-semibold ${colors.text}`}>{t('hooks.title')}</span>
            <span className={`text-xs ${colors.textMuted}`}>({hooks.length})</span>
          </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={!projectDir}
                className={`p-2 rounded-lg ${colors.cardHover} transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                title={projectDir ? t('hooks.newHook') : t('kiroConfig.selectProjectDir')}
              >
                <Plus size={16} className={accent.text} />
              </button>
              <button onClick={loadHooks} className={`p-2 rounded-lg ${colors.cardHover} transition-colors cursor-pointer`} title={t('common.refresh')}>
                <RefreshCw size={16} className={colors.textMuted} />
              </button>
            </div>
          </div>
          <div className={`mt-2 text-[11px] ${colors.textMuted} leading-relaxed`}>{t('hooks.projectOnly')}</div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {hooks.length === 0 ? (
            <div className={`text-center py-16 ${colors.textMuted}`}>
              <Link2 size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">{projectDir ? t('hooks.noHooks') : t('kiroConfig.selectProjectDir')}</p>
              {projectDir && (
                <button onClick={() => setShowCreateModal(true)} className={`mt-4 px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer ${accentSolidButtonClass}`}>
                  {t('hooks.createFirst')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {hooks.map(h => {
                const isSelected = selectedHook?.fileName === h.fileName
                return (
                  <div
                    key={h.fileName}
                    onClick={() => handleSelect(h)}
                    className={`p-4 rounded-xl cursor-pointer group transition-all duration-200 ${
                      isSelected
                        ? `${accent.bg} ring-2 ${accent.ring} shadow-xl border-2 ${accent.border}`
                        : `${colors.card} border ${colors.cardBorder} ${colors.cardHover} hover:shadow-lg`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isSelected ? accent.bg : colors.cardSecondary}`}>
                          <Link2 size={16} className={isSelected ? accent.text : colors.textMuted} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-sm truncate ${isSelected ? accent.text : colors.text}`}>{h.fileName}</div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(h) }}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/20 flex-shrink-0 transition-all duration-200 cursor-pointer"
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </div>
                    <div className={`flex items-center gap-2.5 text-xs ${colors.textMuted} ml-11`}>
                      <span className={`px-2 py-1 rounded-md ${colors.cardSecondary} font-medium`}>{formatSize(h.size)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 min-h-0 flex flex-col ${colors.card} border ${colors.cardBorder} rounded-2xl overflow-hidden shadow-lg`}>
        {!projectDir ? (
          <div className={`flex-1 flex items-center justify-center ${colors.textMuted}`}>
            <div className="text-center px-6">
              <FolderOpen size={44} className="mx-auto mb-2 opacity-30" />
              <p>{t('kiroConfig.selectProjectDir')}</p>
            </div>
          </div>
        ) : selectedHook ? (
          <>
            <div className={`p-4 border-b ${colors.cardBorder} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold ${colors.text}`}>{selectedHook.fileName}</h3>
                {hasChanges && <span className="text-xs text-orange-500">● {t('hooks.unsaved')}</span>}
              </div>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${hasChanges ? accentSolidButtonClass : colors.btnDisabled} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Save size={14} />
                {saving ? t('hooks.saving') : t('hooks.save')}
              </button>
            </div>
            <div className="flex-1 p-4 overflow-hidden">
              <Textarea
                value={editContent}
                onChange={(e) => {
                  const next = e.target.value
                  setEditContent(next)
                  setHasChanges(next !== (selectedHook.content || ''))
                }}
                placeholder={t('hooks.contentPlaceholder')}
                classNames={{ input: `${colors.inputFocus}` }}
                styles={{
                  root: { height: '100%', display: 'flex', flexDirection: 'column' },
                  wrapper: { flex: 1, display: 'flex' },
                  input: {
                    flex: 1,
                    height: '100%',
                    minHeight: '400px',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    resize: 'none',
                    color: surface.editorText,
                    backgroundColor: surface.editorBg,
                    borderColor: surface.editorBorder,
                  }
                }}
              />
            </div>
          </>
        ) : (
          <div className={`flex-1 flex items-center justify-center ${colors.textMuted}`}>
            <div className="text-center">
              <Link2 size={48} className="mx-auto mb-2 opacity-30" />
              <p>{t('hooks.selectToEdit')}</p>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateHookModal
          onCreate={handleCreate}
          onClose={() => setShowCreateModal(false)}
          colors={colors}
          t={t}
          accent={accent}
          accentGradientButtonClass={accentGradientButtonClass}
          existingFileNames={hooks.map(h => h.fileName)}
        />
      )}
    </div>
  )
}

function CreateHookModal({ onCreate, onClose, colors, t, accent, accentGradientButtonClass, existingFileNames }) {
  const [fileName, setFileName] = useState('')
  const [creating, setCreating] = useState(false)

  const raw = fileName.trim()
  const normalized = raw ? (raw.endsWith('.kiro.hook') ? raw : `${raw}.kiro.hook`) : ''
  const invalidName = raw && !/^[A-Za-z0-9._-]+(\.kiro\.hook)?$/.test(raw)
  const duplicateName = normalized && existingFileNames.some(name => name.toLowerCase() === normalized.toLowerCase())
  const canSubmit = !!raw && !invalidName && !duplicateName && !creating

  const handleSubmit = async () => {
    if (!canSubmit) return
    setCreating(true)
    try {
      await onCreate(raw)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`${colors.card} rounded-2xl w-full max-w-[420px] shadow-2xl border ${colors.cardBorder} overflow-hidden`} onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 ${colors.dialogHeader}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${colors.info} flex items-center justify-center`}>
              <Link2 size={20} className={accent.text} />
            </div>
            <h2 className={`text-base font-semibold ${colors.text}`}>{t('hooks.newHook')}</h2>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${colors.cardHover} cursor-pointer`}>
            <X size={18} className={colors.textMuted} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('hooks.fileName')}</label>
            <TextInput
              placeholder={t('hooks.fileNamePlaceholder')}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              size="md"
              classNames={{ input: `${colors.text} ${colors.input} ${colors.inputFocus}` }}
              styles={{ input: { borderRadius: '0.5rem' } }}
            />
            <p className={`text-xs ${colors.textMuted} mt-1`}>{t('hooks.fileNameHint')}</p>
            {!!normalized && <p className={`text-xs mt-1 ${colors.textMuted}`}>{t('hooks.fileNamePreview')}: {normalized}</p>}
            {invalidName && <p className="text-xs mt-1 text-red-500">{t('hooks.fileNameInvalid')}</p>}
            {duplicateName && <p className="text-xs mt-1 text-red-500">{t('hooks.fileNameDuplicate')}</p>}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer ${accentGradientButtonClass}`}
          >
            {creating ? t('hooks.saving') : t('common.add')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default HooksPanel
