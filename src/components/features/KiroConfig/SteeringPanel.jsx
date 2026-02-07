import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
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
  const isLightTheme = theme === 'light' || theme === 'purple' || theme === 'green'
  
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
    { value: 'auto', label: t('steering.inclusionAuto'), desc: t('steering.inclusionAutoDesc') },
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
    <div className="h-full flex gap-4 p-4">
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
      <div className={`flex-1 flex flex-col ${colors.card} border ${colors.cardBorder} rounded-2xl overflow-hidden shadow-lg`}>
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
            theme={theme}
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
  // 按 inclusion 分组
  const groupedFiles = {
    always: files.filter(f => parseFrontMatter(f.content).inclusion === 'always'),
    auto: files.filter(f => parseFrontMatter(f.content).inclusion === 'auto'),
    fileMatch: files.filter(f => parseFrontMatter(f.content).inclusion === 'fileMatch'),
    manual: files.filter(f => parseFrontMatter(f.content).inclusion === 'manual'),
  }

  const renderFileGroup = (title, files, icon, badgeColor) => {
    if (files.length === 0) return null
    return (
      <div className="mb-8">
        {/* 分组标题 */}
        <div className={`flex items-center gap-3 px-4 py-3 mb-4 rounded-xl ${colors.cardSecondary} border ${colors.cardBorder} shadow-sm`}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/10">
            {icon}
          </div>
          <span className={`text-sm font-bold ${colors.text} tracking-wide flex-1`}>{title}</span>
          <span className={`text-xs px-3 py-1 rounded-full bg-gradient-to-r ${badgeColor} text-white font-semibold shadow-sm`}>
            {files.length}
          </span>
        </div>
        
        {/* 文件列表 */}
        <div className="space-y-3">
          {files.map(file => {
            const parsed = parseFrontMatter(file.content)
            const isSelected = selectedFile?.fileName === file.fileName
            return (
              <div
                key={file.fileName}
                onClick={() => onSelect(file)}
                className={`p-4 rounded-xl cursor-pointer group transition-all duration-200 ${
                  isSelected 
                    ? `bg-gradient-to-r from-blue-500/20 to-purple-500/10 ring-2 ring-blue-500/60 shadow-xl border-2 border-blue-500/50 scale-[1.02]` 
                    : `${colors.card} border ${colors.cardBorder} ${colors.cardHover} hover:shadow-lg hover:scale-[1.01]`
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                      isSelected ? 'bg-blue-500/20' : 'bg-gray-500/10'
                    }`}>
                      <FileText 
                        size={18} 
                        className={`flex-shrink-0 ${isSelected ? 'text-blue-500' : colors.textMuted}`} 
                      />
                    </div>
                    <span className={`font-bold text-sm ${isSelected ? 'text-blue-500' : colors.text} truncate`}>
                      {file.fileName.replace('.md', '')}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(file.fileName) }}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/20 flex-shrink-0 transition-all duration-200 hover:scale-110"
                    title="删除"
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
                <div className={`flex items-center gap-2.5 text-xs ${colors.textMuted} ml-11`}>
                  <span className={`px-2 py-1 rounded-md ${colors.cardSecondary} font-medium`}>
                    {formatSize(file.size)}
                  </span>
                  {parsed.filePattern && (
                    <>
                      <span className="opacity-50">•</span>
                      <code className={`px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 font-mono text-xs text-blue-400`}>
                        {parsed.filePattern}
                      </code>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={`w-80 flex flex-col ${colors.card} border ${colors.cardBorder} rounded-2xl overflow-hidden shadow-lg`}>
      <div className={`p-4 border-b ${colors.cardBorder} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-blue-500" />
          <span className={`text-sm font-semibold ${colors.text}`}>Steering 规则</span>
          <span className={`text-xs ${colors.textMuted}`}>({files.length})</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onCreate} 
            className={`p-2 rounded-lg ${colors.cardHover} transition-colors`}
            title="新建规则"
          >
            <Plus size={16} className="text-green-500" />
          </button>
          <button 
            onClick={onRefresh} 
            className={`p-2 rounded-lg ${colors.cardHover} transition-colors`}
            title="刷新列表"
          >
            <RefreshCw size={16} className={colors.textMuted} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {files.length === 0 ? (
          <div className={`text-center py-16 ${colors.textMuted}`}>
            <FileText size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">{t('steering.noFiles')}</p>
            <button
              onClick={onCreate}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
            >
              创建第一个规则
            </button>
          </div>
        ) : (
          <>
            {renderFileGroup(
              '始终包含',
              groupedFiles.always,
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />,
              'from-green-500 to-emerald-600'
            )}
            {renderFileGroup(
              '自动激活',
              groupedFiles.auto,
              <div className="w-3 h-3 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50" />,
              'from-purple-500 to-pink-600'
            )}
            {renderFileGroup(
              '文件匹配',
              groupedFiles.fileMatch,
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />,
              'from-blue-500 to-indigo-600'
            )}
            {renderFileGroup(
              '手动引用',
              groupedFiles.manual,
              <div className="w-3 h-3 rounded-full bg-orange-500 shadow-lg shadow-orange-500/50" />,
              'from-orange-500 to-amber-600'
            )}
          </>
        )}
      </div>
    </div>
  )
}

// 编辑器组件
function Editor({ file, editState, hasChanges, saving, inclusionOptions, onContentChange, onInclusionChange, onFilePatternChange, onSave, isLightTheme, theme, colors, t }) {
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
      <div className="flex-1 p-4 overflow-hidden">
        <Textarea
          value={editState.content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={t('steering.contentPlaceholder')}
          classNames={{
            input: `${colors.inputFocus}`
          }}
          styles={{
            root: {
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            },
            wrapper: {
              flex: 1,
              display: 'flex',
            },
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
              color: isLightTheme 
                ? (theme === 'purple' ? '#4c1d95' : '#1f2937')
                : '#e5e7eb',
              backgroundColor: isLightTheme 
                ? (theme === 'purple' ? 'rgba(233, 213, 255, 0.4)' : 'rgba(243, 244, 246, 0.5)')
                : 'rgba(30, 30, 50, 0.5)',
              borderColor: isLightTheme 
                ? (theme === 'purple' ? 'rgba(196, 181, 253, 0.6)' : 'rgba(209, 213, 219, 0.5)')
                : 'rgba(255, 255, 255, 0.1)',
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


    </div>
  )
}

export default SteeringPanel
