import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../hooks/useApp'
import { useDialog } from '../../contexts/DialogContext'
import { FileText, RefreshCw, Trash2, Save, Plus, X } from 'lucide-react'
import { TextInput, Select, Textarea } from '@mantine/core'

// 解析 front-matter
const parseFrontMatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { inclusion: 'always', filePattern: '', body: content }
  const [, fm, body] = match
  return {
    inclusion: fm.match(/inclusion:\s*(\w+)/)?.[1] || 'always',
    filePattern: fm.match(/fileMatchPattern:\s*['"]?([^'"\n]+)['"]?/)?.[1] || '',
    body
  }
}

// 组装 front-matter
const buildContent = (inclusion, filePattern, body) => {
  let fm = `---\ninclusion: ${inclusion}`
  if (inclusion === 'fileMatch' && filePattern.trim()) fm += `\nfileMatchPattern: '${filePattern.trim()}'`
  return fm + '\n---\n' + body
}

// 格式化文件大小
const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`

// inclusion 标签颜色映射
const getInclusionStyle = (inclusion, colors) => {
  const styles = {
    always: colors.badgeSuccess,
    fileMatch: colors.badgeInfo,
    manual: colors.badgeWarning
  }
  return styles[inclusion] || colors.cardSecondary
}

function SteeringPanel({ onCountChange }) {
  const { t, theme, colors } = useApp()
  const { showConfirm, showError } = useDialog()
  const isLightTheme = theme === 'light'
  
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState(null)
  const [editState, setEditState] = useState({ content: '', inclusion: 'always', filePattern: '' })
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const data = await invoke('get_steering_files')
      setFiles(data)
      onCountChange?.(data?.length || 0)
    } catch (e) {
      console.error('加载 Steering 文件失败:', e)
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => { loadFiles() }, [loadFiles])

  const handleSelect = async (file) => {
    if (hasChanges && !await showConfirm(t('steering.unsavedChanges'), t('steering.confirmSwitch'))) return
    setSelectedFile(file)
    const parsed = parseFrontMatter(file.content)
    setEditState({ content: parsed.body, inclusion: parsed.inclusion, filePattern: parsed.filePattern })
    setHasChanges(false)
  }

  const updateEditState = (key, value) => {
    const newState = { ...editState, [key]: value }
    setEditState(newState)
    if (selectedFile) {
      const newContent = buildContent(newState.inclusion, newState.filePattern, newState.content)
      setHasChanges(newContent !== selectedFile.content)
    }
  }

  const handleSave = async () => {
    if (!selectedFile) return
    setSaving(true)
    try {
      const fullContent = buildContent(editState.inclusion, editState.filePattern, editState.content)
      await invoke('save_steering_file', { fileName: selectedFile.fileName, content: fullContent })
      setFiles(files.map(f => f.fileName === selectedFile.fileName ? { ...f, content: fullContent } : f))
      setSelectedFile({ ...selectedFile, content: fullContent })
      setHasChanges(false)
    } catch (e) {
      showError(t('steering.saveFailed'), String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (fileName) => {
    if (!await showConfirm(t('steering.confirmDelete'), t('steering.confirmDeleteFile', { fileName }))) return
    try {
      await invoke('delete_steering_file', { fileName })
      setFiles(files.filter(f => f.fileName !== fileName))
      if (selectedFile?.fileName === fileName) {
        setSelectedFile(null)
        setEditState({ content: '', inclusion: 'always', filePattern: '' })
        setHasChanges(false)
      }
    } catch (e) {
      console.error('删除失败:', e)
    }
  }

  const handleCreate = async (fileName, inclusion, filePattern) => {
    const name = fileName.endsWith('.md') ? fileName : `${fileName}.md`
    const content = buildContent(inclusion, filePattern, '\n<!-- 在此添加你的 steering 规则 -->\n')
    try {
      const newFile = await invoke('create_steering_file', { fileName: name, content })
      setFiles([...files, newFile])
      setShowCreateModal(false)
      handleSelect(newFile)
    } catch (e) {
      showError(t('steering.createFailed'), String(e))
    }
  }

  const inclusionOptions = [
    { value: 'always', label: t('steering.inclusionAlways'), desc: t('steering.inclusionAlwaysDesc') },
    { value: 'fileMatch', label: t('steering.inclusionFileMatch'), desc: t('steering.inclusionFileMatchDesc') },
    { value: 'manual', label: t('steering.inclusionManual'), desc: t('steering.inclusionManualDesc') },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="animate-spin text-blue-500" size={24} />
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* 左侧列表 */}
      <FileList
        files={files}
        selectedFile={selectedFile}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onRefresh={loadFiles}
        onCreate={() => setShowCreateModal(true)}
        isLightTheme={isLightTheme}
        colors={colors}
        t={t}
      />

      {/* 右侧编辑器 */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <Editor
            file={selectedFile}
            editState={editState}
            hasChanges={hasChanges}
            saving={saving}
            inclusionOptions={inclusionOptions}
            onContentChange={(v) => updateEditState('content', v)}
            onInclusionChange={(v) => updateEditState('inclusion', v)}
            onFilePatternChange={(v) => updateEditState('filePattern', v)}
            onSave={handleSave}
            isLightTheme={isLightTheme}
            colors={colors}
            t={t}
          />
        ) : (
          <div className={`flex-1 flex items-center justify-center ${colors.textMuted}`}>
            <div className="text-center">
              <FileText size={48} className="mx-auto mb-2 opacity-30" />
              <p>{t('steering.selectToEdit')}</p>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateModal
          inclusionOptions={inclusionOptions}
          onCreate={handleCreate}
          onClose={() => setShowCreateModal(false)}
          isLightTheme={isLightTheme}
          colors={colors}
          t={t}
        />
      )}
    </div>
  )
}

// 文件列表组件
function FileList({ files, selectedFile, onSelect, onDelete, onRefresh, onCreate, isLightTheme, colors, t }) {
  return (
    <div className={`w-64 border-r ${colors.cardBorder} flex flex-col`}>
      <div className={`p-4 border-b ${colors.cardBorder} flex items-center justify-between`}>
        <span className={`text-sm font-medium ${colors.text}`}>Steering ({files.length})</span>
        <div className="flex gap-1">
          <button onClick={onCreate} className={`p-1.5 rounded-lg ${colors.cardHover}`}>
            <Plus size={16} className={colors.textMuted} />
          </button>
          <button onClick={onRefresh} className={`p-1.5 rounded-lg ${colors.cardHover}`}>
            <RefreshCw size={16} className={colors.textMuted} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {files.length === 0 ? (
          <div className={`text-center py-8 ${colors.textMuted}`}>
            <FileText size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('steering.noFiles')}</p>
          </div>
        ) : (
          files.map(file => {
            const parsed = parseFrontMatter(file.content)
            const isSelected = selectedFile?.fileName === file.fileName
            return (
              <div
                key={file.fileName}
                onClick={() => onSelect(file)}
                className={`p-3 rounded-xl cursor-pointer transition-all group ${
                  isSelected ? colors.tagActive : colors.tagHover
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium text-sm ${colors.text} truncate`}>{file.fileName}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(file.fileName) }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className={`flex items-center gap-2 text-xs ${colors.textMuted} mt-1`}>
                  <span>{formatSize(file.size)}</span>
                  <span>·</span>
                  <span className={`px-1.5 py-0.5 rounded ${getInclusionStyle(parsed.inclusion, colors)}`}>
                    {t(`steering.inclusion${parsed.inclusion.charAt(0).toUpperCase() + parsed.inclusion.slice(1)}`)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// 编辑器组件
function Editor({ file, editState, hasChanges, saving, inclusionOptions, onContentChange, onInclusionChange, onFilePatternChange, onSave, isLightTheme, colors, t }) {
  return (
    <>
      <div className={`p-4 border-b ${colors.cardBorder} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold ${colors.text}`}>{file.fileName}</h3>
          {hasChanges && <span className="text-xs text-orange-500">● 未保存</span>}
        </div>
        <button
          onClick={onSave}
          disabled={!hasChanges || saving}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            hasChanges ? 'bg-blue-500 text-white hover:bg-blue-600' : colors.btnDisabled
          } disabled:opacity-50`}
        >
          <Save size={14} />
          {saving ? t('steering.saving') : t('steering.save')}
        </button>
      </div>
      <div className={`px-4 py-3 border-b ${colors.cardBorder} flex items-center gap-4`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${colors.textMuted}`}>{t('steering.inclusionMode')}:</span>
          <Select
            value={editState.inclusion}
            onChange={onInclusionChange}
            data={inclusionOptions.map(opt => ({ value: opt.value, label: opt.label }))}
            size="xs"
            classNames={{
              input: `${colors.text} ${colors.input} ${colors.inputFocus}`,
              dropdown: `${colors.card} border ${colors.cardBorder}`,
              option: `${colors.text}`
            }}
            styles={{ input: { minWidth: '120px', borderRadius: '0.5rem' } }}
          />
        </div>
        {editState.inclusion === 'fileMatch' && (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${colors.textMuted}`}>{t('steering.filePattern')}:</span>
            <TextInput
              value={editState.filePattern}
              onChange={(e) => onFilePatternChange(e.target.value)}
              placeholder="**/*.jsx"
              size="xs"
              classNames={{
                input: `${colors.text} ${colors.input} ${colors.inputFocus}`
              }}
              styles={{ input: { width: '128px', borderRadius: '0.5rem' } }}
            />
          </div>
        )}
      </div>
      <div className="flex-1 p-4">
        <Textarea
          value={editState.content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={t('steering.contentPlaceholder')}
          classNames={{
            input: `${colors.text} ${colors.input} ${colors.inputFocus}`
          }}
          styles={{
            input: {
              width: '100%',
              height: '100%',
              minHeight: '100%',
              padding: '1rem',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              resize: 'none'
            }
          }}
        />
      </div>
    </>
  )
}

// 创建弹窗组件
function CreateModal({ inclusionOptions, onCreate, onClose, isLightTheme, colors, t }) {
  const [fileName, setFileName] = useState('')
  const [inclusion, setInclusion] = useState('always')
  const [filePattern, setFilePattern] = useState('')

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className={`${colors.card} rounded-2xl w-full max-w-[380px] shadow-2xl border ${colors.cardBorder} overflow-hidden`}
        onClick={e => e.stopPropagation()}
        style={{ animation: 'dialogIn 0.2s ease-out' }}
      >
        <div className={`flex items-center justify-between px-5 py-4 ${colors.dialogHeader}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${colors.info} flex items-center justify-center`}>
              <FileText size={20} className="text-blue-500" />
            </div>
            <h2 className={`text-base font-semibold ${colors.text}`}>{t('steering.newSteering')}</h2>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${colors.cardHover}`}>
            <X size={18} className={colors.textMuted} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('steering.fileName')}</label>
            <TextInput
              placeholder={t('steering.fileNamePlaceholder')}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              size="md"
              classNames={{
                input: `${colors.text} ${colors.input} ${colors.inputFocus}`
              }}
              styles={{ input: { borderRadius: '0.5rem' } }}
            />
            <p className={`text-xs ${colors.textMuted} mt-1`}>{t('steering.fileNameHint')}</p>
          </div>

          <div>
            <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('steering.inclusionMode')}</label>
            <Select
              value={inclusion}
              onChange={setInclusion}
              data={inclusionOptions.map(opt => ({ 
                value: opt.value, 
                label: `${opt.label} - ${opt.desc}` 
              }))}
              size="md"
              classNames={{
                input: `${colors.text} ${colors.input} ${colors.inputFocus}`,
                dropdown: `${colors.card} border ${colors.cardBorder}`,
                option: `${colors.text}`
              }}
              styles={{ input: { borderRadius: '0.5rem' } }}
            />
          </div>

          {inclusion === 'fileMatch' && (
            <div>
              <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('steering.filePattern')}</label>
              <TextInput
                placeholder={t('steering.filePatternPlaceholder')}
                value={filePattern}
                onChange={(e) => setFilePattern(e.target.value)}
                size="md"
                classNames={{
                  input: `${colors.text} ${colors.input} ${colors.inputFocus}`
                }}
                styles={{ input: { borderRadius: '0.5rem' } }}
              />
            </div>
          )}

          <button
            onClick={() => onCreate(fileName, inclusion, filePattern)}
            disabled={!fileName.trim()}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {t('common.add')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes dialogIn {
          from { opacity: 0; transform: scale(0.95) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default SteeringPanel
