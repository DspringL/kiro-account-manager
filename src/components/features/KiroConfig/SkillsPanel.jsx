import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import { Puzzle, RefreshCw, Trash2, Save, Plus, X, FolderOpen, Globe } from 'lucide-react'
import { TextInput, Select, Textarea } from '@mantine/core'
import {
  getThemeAccent,
  getSolidAccentButton,
  getGradientAccentButton,
  getThemeSurfaceStyles,
} from './themeAccent'

// 格式化文件大小
const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`

// 解析 SKILL.md frontmatter（name + description 必填）
const parseSkillFrontMatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { name: '', description: '', body: content }
  const [, fm, body] = match
  return {
    name: fm.match(/name:\s*['"]?([^'"\n]+)['"]?/)?.[1]?.trim() || '',
    description: fm.match(/description:\s*['"]?([^'"\n]+)['"]?/)?.[1]?.trim() || '',
    body
  }
}

// 组装 SKILL.md frontmatter
const buildSkillContent = (name, description, body) => {
  let fm = '---'
  if (name) fm += `\nname: "${name}"`
  if (description) fm += `\ndescription: "${description}"`
  return fm + '\n---\n' + body
}

// scope 徽章
const ScopeBadge = ({ scope, accent }) => {
  if (scope === 'project') {
    return (
      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30">
        <FolderOpen size={10} />项目
      </span>
    )
  }
  return (
    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${accent.scopeBadge}`}>
      <Globe size={10} />用户
    </span>
  )
}

function SkillsPanel({ onCountChange, projectDir }) {
  const { t, theme, colors } = useApp()
  const { showConfirm, showError } = useDialog()
  const surface = getThemeSurfaceStyles(theme)
  const accent = getThemeAccent(theme)
  const accentSolidButtonClass = getSolidAccentButton(accent)
  const accentGradientButtonClass = getGradientAccentButton(accent)

  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [editState, setEditState] = useState({ name: '', description: '', body: '' })
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadSkills = useCallback(async () => {
    setLoading(true)
    try {
      const data = await invoke('get_skills', { projectDir: projectDir || null })
      setSkills(data)
      onCountChange?.(data?.length || 0)
    } catch (e) {
      console.error('加载 Skills 失败:', e)
    } finally {
      setLoading(false)
    }
  }, [onCountChange, projectDir])

  useEffect(() => {
    setSelectedSkill(null)
    setEditState({ name: '', description: '', body: '' })
    setHasChanges(false)
    loadSkills()
  }, [loadSkills])

  const handleSelect = async (skill) => {
    if (hasChanges && !await showConfirm(t('skills.unsavedChanges'), t('skills.confirmSwitch'))) return
    setSelectedSkill(skill)
    const parsed = parseSkillFrontMatter(skill.content)
    setEditState({ name: parsed.name, description: parsed.description, body: parsed.body })
    setHasChanges(false)
  }

  const updateEditState = (key, value) => {
    const newState = { ...editState, [key]: value }
    setEditState(newState)
    if (selectedSkill) {
      const newContent = buildSkillContent(newState.name, newState.description, newState.body)
      setHasChanges(newContent !== selectedSkill.content)
    }
  }

  const handleSave = async () => {
    if (!selectedSkill) return
    setSaving(true)
    try {
      const fullContent = buildSkillContent(editState.name, editState.description, editState.body)
      await invoke('save_skill', {
        name: selectedSkill.name,
        content: fullContent,
        scope: selectedSkill.scope,
        projectDir: projectDir || null
      })
      setSkills(skills.map(s => (s.name === selectedSkill.name && s.scope === selectedSkill.scope) ? { ...s, content: fullContent } : s))
      setSelectedSkill({ ...selectedSkill, content: fullContent })
      setHasChanges(false)
    } catch (e) {
      showError(t('skills.saveFailed'), String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (skill) => {
    if (!await showConfirm(t('skills.confirmDelete'), t('skills.confirmDeleteSkill', { name: skill.name }))) return
    try {
      await invoke('delete_skill', {
        name: skill.name,
        scope: skill.scope,
        projectDir: projectDir || null
      })
      const newSkills = skills.filter(s => !(s.name === skill.name && s.scope === skill.scope))
      setSkills(newSkills)
      onCountChange?.(newSkills.length)
      if (selectedSkill?.name === skill.name && selectedSkill?.scope === skill.scope) {
        setSelectedSkill(null)
        setEditState({ name: '', description: '', body: '' })
        setHasChanges(false)
      }
    } catch (e) {
      console.error('删除失败:', e)
    }
  }

  const handleCreate = async (skillName, description, scope) => {
    const body = '\n<!-- 在此编写 Skill 指令 -->\n'
    const content = buildSkillContent(skillName, description, body)
    try {
      const newSkill = await invoke('create_skill', {
        name: skillName,
        content,
        scope,
        projectDir: projectDir || null
      })
      const newSkills = [...skills, newSkill]
      setSkills(newSkills)
      onCountChange?.(newSkills.length)
      setShowCreateModal(false)
      handleSelect(newSkill)
    } catch (e) {
      showError(t('skills.createFailed'), String(e))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className={`animate-spin ${accent.text}`} size={24} />
      </div>
    )
  }

  return (
    <div className="h-full flex gap-4 p-4">
      {/* 左侧列表 */}
      <div className={`w-80 flex flex-col ${colors.card} border ${colors.cardBorder} rounded-2xl overflow-hidden shadow-lg`}>
        <div className={`p-4 border-b ${colors.cardBorder} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <Puzzle size={18} className={accent.text} />
            <span className={`text-sm font-semibold ${colors.text}`}>Skills</span>
            <span className={`text-xs ${colors.textMuted}`}>({skills.length})</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className={`p-2 rounded-lg ${colors.cardHover} transition-colors`}
              title={t('skills.create')}
            >
              <Plus size={16} className={accent.text} />
            </button>
            <button
              onClick={loadSkills}
              className={`p-2 rounded-lg ${colors.cardHover} transition-colors`}
              title={t('common.refresh')}
            >
              <RefreshCw size={16} className={colors.textMuted} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {skills.length === 0 ? (
            <div className={`text-center py-16 ${colors.textMuted}`}>
              <Puzzle size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">{t('skills.noSkills')}</p>
              <p className={`text-xs mt-2 ${colors.textMuted}`}>{t('skills.noSkillsHint')}</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className={`mt-4 px-4 py-2 rounded-lg text-sm transition-colors ${accentSolidButtonClass}`}
              >
                {t('skills.createFirst')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {skills.map(skill => {
                const isSelected = selectedSkill?.name === skill.name && selectedSkill?.scope === skill.scope
                const parsed = parseSkillFrontMatter(skill.content)
                return (
                  <div
                    key={`${skill.scope}-${skill.name}`}
                    onClick={() => handleSelect(skill)}
                    className={`p-4 rounded-xl cursor-pointer group transition-all duration-200 ${
                      isSelected
                        ? `${accent.bg} ring-2 ${accent.ring} shadow-xl border-2 ${accent.border} scale-[1.02]`
                        : `${colors.card} border ${colors.cardBorder} ${colors.cardHover} hover:shadow-lg hover:scale-[1.01]`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                          isSelected ? accent.bg : colors.cardSecondary
                        }`}>
                          <Puzzle
                            size={18}
                            className={`flex-shrink-0 ${isSelected ? accent.text : colors.textMuted}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`font-bold text-sm ${isSelected ? accent.text : colors.text} truncate block`}>
                            {skill.name}
                          </span>
                          {parsed.description && (
                            <span className={`text-xs ${colors.textMuted} truncate block mt-0.5`}>{parsed.description}</span>
                          )}
                        </div>
                        <ScopeBadge scope={skill.scope} accent={accent} />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(skill) }}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/20 flex-shrink-0 transition-all duration-200 hover:scale-110"
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </div>
                    <div className={`flex items-center gap-2.5 text-xs ${colors.textMuted} ml-11`}>
                      <span className={`px-2 py-1 rounded-md ${colors.cardSecondary} font-medium`}>
                        {formatSize(skill.size)}
                      </span>
                      {skill.extraFiles.length > 0 && (
                        <>
                          <span className="opacity-50">•</span>
                          <span className="flex items-center gap-1">
                            <FolderOpen size={12} />
                            +{skill.extraFiles.length} {t('skills.files')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 右侧编辑器 */}
      <div className={`flex-1 flex flex-col ${colors.card} border ${colors.cardBorder} rounded-2xl overflow-hidden shadow-lg`}>
        {selectedSkill ? (
          <>
            <div className={`p-4 border-b ${colors.cardBorder} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold ${colors.text}`}>{selectedSkill.name}/SKILL.md</h3>
                <ScopeBadge scope={selectedSkill.scope} accent={accent} />
                {hasChanges && <span className="text-xs text-orange-500">● {t('skills.unsaved')}</span>}
              </div>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  hasChanges ? accentSolidButtonClass : colors.btnDisabled
                } disabled:opacity-50`}
              >
                <Save size={14} />
                {saving ? t('skills.saving') : t('skills.save')}
              </button>
            </div>
            {/* frontmatter 编辑区 */}
            <div className={`px-4 py-3 border-b ${colors.cardBorder} flex items-center gap-4 flex-wrap`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${colors.textMuted}`}>{t('skills.fmName')}:</span>
                <TextInput
                  value={editState.name}
                  onChange={(e) => updateEditState('name', e.target.value)}
                  placeholder={t('skills.fmNamePlaceholder')}
                  size="xs"
                  classNames={{
                    input: `${colors.text} ${colors.input} ${colors.inputFocus}`
                  }}
                  styles={{ input: { width: '140px', borderRadius: '0.5rem' } }}
                />
              </div>
              <div className="flex items-center gap-2 flex-1">
                <span className={`text-xs ${colors.textMuted}`}>{t('skills.fmDescription')}:</span>
                <TextInput
                  value={editState.description}
                  onChange={(e) => updateEditState('description', e.target.value)}
                  placeholder={t('skills.fmDescriptionPlaceholder')}
                  size="xs"
                  classNames={{
                    input: `${colors.text} ${colors.input} ${colors.inputFocus}`
                  }}
                  styles={{ input: { flex: 1, minWidth: '200px', borderRadius: '0.5rem' } }}
                />
              </div>
            </div>
            {selectedSkill.extraFiles.length > 0 && (
              <div className={`px-4 py-2 border-b ${colors.cardBorder} flex items-center gap-2 text-xs ${colors.textMuted}`}>
                <FolderOpen size={14} />
                <span>{t('skills.extraFiles')}:</span>
                {selectedSkill.extraFiles.map(f => (
                  <code key={f} className={`px-2 py-0.5 rounded-md ${colors.cardSecondary} font-mono`}>{f}</code>
                ))}
              </div>
            )}
            <div className="flex-1 p-4 overflow-hidden">
              <Textarea
                value={editState.body}
                onChange={(e) => updateEditState('body', e.target.value)}
                placeholder={t('skills.contentPlaceholder')}
                classNames={{
                  input: `${colors.inputFocus}`
                }}
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
              <Puzzle size={48} className="mx-auto mb-2 opacity-30" />
              <p>{t('skills.selectToEdit')}</p>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateSkillModal
          onCreate={handleCreate}
          onClose={() => setShowCreateModal(false)}
          accent={accent}
          accentGradientButtonClass={accentGradientButtonClass}
          colors={colors}
          t={t}
          hasProjectDir={!!projectDir}
        />
      )}
    </div>
  )
}

// 创建 Skill 弹窗
function CreateSkillModal({ onCreate, onClose, accent, accentGradientButtonClass, colors, t, hasProjectDir }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState('user')

  const isValidName = name.trim() && /^[a-zA-Z0-9_-]+$/.test(name.trim())

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`${colors.card} rounded-2xl w-full max-w-[420px] shadow-2xl border ${colors.cardBorder} overflow-hidden`}
        onClick={e => e.stopPropagation()}
        style={{ animation: 'dialogIn 0.2s ease-out' }}
      >
        <div className={`flex items-center justify-between px-5 py-4 ${colors.dialogHeader}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${colors.info} flex items-center justify-center`}>
              <Puzzle size={20} className={accent.text} />
            </div>
            <h2 className={`text-base font-semibold ${colors.text}`}>{t('skills.newSkill')}</h2>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${colors.cardHover}`}>
            <X size={18} className={colors.textMuted} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('skills.skillName')}</label>
            <TextInput
              placeholder={t('skills.skillNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              size="md"
              classNames={{
                input: `${colors.text} ${colors.input} ${colors.inputFocus}`
              }}
              styles={{ input: { borderRadius: '0.5rem' } }}
            />
            <p className={`text-xs ${colors.textMuted} mt-1`}>{t('skills.skillNameHint')}</p>
          </div>

          <div>
            <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('skills.fmDescription')}</label>
            <TextInput
              placeholder={t('skills.fmDescriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              size="md"
              classNames={{
                input: `${colors.text} ${colors.input} ${colors.inputFocus}`
              }}
              styles={{ input: { borderRadius: '0.5rem' } }}
            />
            <p className={`text-xs ${colors.textMuted} mt-1`}>{t('skills.fmDescriptionHint')}</p>
          </div>

          {hasProjectDir && (
            <div>
              <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('kiroConfig.scope')}</label>
              <Select
                value={scope}
                onChange={setScope}
                data={[
                  { value: 'user', label: t('kiroConfig.scopeUser') },
                  { value: 'project', label: t('kiroConfig.scopeProject') },
                ]}
                size="md"
                classNames={{
                  input: `${colors.text} ${colors.input} ${colors.inputFocus}`,
                  dropdown: `${colors.card} border ${colors.cardBorder}`,
                  option: `${colors.text}`
                }}
                styles={{ input: { borderRadius: '0.5rem' } }}
              />
            </div>
          )}

          <button
            onClick={() => onCreate(name.trim(), description.trim(), scope)}
            disabled={!isValidName}
            className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${accentGradientButtonClass}`}
          >
            {t('common.add')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SkillsPanel
