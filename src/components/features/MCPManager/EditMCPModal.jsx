import { useState, useEffect } from 'react'
import { X, Terminal, AlertCircle, Wand2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { Textarea } from '@mantine/core'
import { useApp } from '../../../hooks/useApp'
import { getThemeAccent, getGradientAccentButton } from '../KiroConfig/themeAccent'

function EditMCPModal({ name, config, onClose, onSuccess, projectDir }) {
  const { t, colors, theme } = useApp()
  const accent = getThemeAccent(theme)
  const accentGradientButtonClass = getGradientAccentButton(accent)

  const [jsonConfig, setJsonConfig] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [parseError, setParseError] = useState('')

  // 初始化 JSON
  useEffect(() => {
    const configObj = {
      command: config.command || '',
      args: config.args || [],
      env: config.env || {},
      disabled: config.disabled || false,
      autoApprove: config.autoApprove || []
    }
    setJsonConfig(JSON.stringify(configObj, null, 2))
  }, [config])

  // 实时校验 JSON
  useEffect(() => {
    if (!jsonConfig.trim()) {
      setParseError('')
      return
    }
    try {
      const parsed = JSON.parse(jsonConfig)
      if (!parsed.command) {
        setParseError('缺少 command 字段')
        return
      }
      setParseError('')
    } catch (e) {
      setParseError('JSON 格式错误')
    }
  }, [jsonConfig])

  // 格式化 JSON
  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonConfig)
      setJsonConfig(JSON.stringify(parsed, null, 2))
    } catch {}
  }

  // 保存
  const handleSave = async () => {
    let parsed
    try {
      parsed = JSON.parse(jsonConfig)
    } catch (e) {
      setError('JSON 格式错误: ' + e.message)
      return
    }

    if (!parsed.command) {
      setError(t('mcpManager.errorNoCommand'))
      return
    }

    setSaving(true)
    setError('')

    try {
      const newConfig = {
        command: parsed.command,
        args: parsed.args || [],
        env: parsed.env || {},
        disabled: parsed.disabled ?? config.disabled ?? false,
        autoApprove: parsed.autoApprove || []
      }

      await invoke('save_mcp_server', { name, config: newConfig, projectDir: projectDir || null })
      onSuccess()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className={`relative overflow-hidden ${colors.card} border ${colors.cardBorder} rounded-lg shadow-2xl w-[520px] max-h-[85vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
        
      >
        {/* 顶部渐变装饰 */}
        <div className={`absolute top-0 left-0 right-0 h-24 ${accent.bgSoft} pointer-events-none`} />
        
        {/* 标题 */}
        <div className={`relative flex items-center justify-between px-6 py-4 border-b ${colors.cardBorder}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} flex items-center justify-center shadow-lg ${accent.shadow}`}>
              <Terminal size={20} className="text-white" />
            </div>
            <h2 className={`text-base font-semibold ${colors.text}`}>{t('common.edit')}: {name}</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${colors.cardHover}`}>
            <X size={18} className={colors.textMuted} />
          </button>
        </div>

        {/* 内容 */}
        <div className="relative flex-1 overflow-auto p-6 space-y-4" style={{ padding: 'var(--mantine-spacing-md)' }}>
          {/* JSON 配置 */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <label className={`text-xs ${colors.textMuted}`}>配置</label>
                {parseError && (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {parseError}
                  </span>
                )}
              </div>
              <button
                onClick={formatJson}
                className={`text-xs ${colors.textMuted} ${accent.textHover} flex items-center gap-1 transition-colors`}
              >
                <Wand2 size={12} />
                格式化
              </button>
            </div>
            <Textarea
              value={jsonConfig}
              onChange={e => setJsonConfig(e.target.value)}
              rows={16}
              spellCheck={false}
              styles={(theme) => ({
                input: {
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.875rem',
                  borderColor: parseError ? 'rgba(239, 68, 68, 0.5)' : undefined,
                  borderRadius: '0.75rem',
                  padding: '0.75rem'
                }
              })}
              classNames={{
                input: `${colors.text} ${colors.input} ${colors.inputFocus}`
              }}
            />
            <p className={`text-xs ${colors.textMuted} mt-2 flex items-start gap-1.5`}>
              <span className={`${accent.text} font-medium`}>💡</span>
              <span>autoApprove 支持通配符 <code className={`px-1.5 py-0.5 ${accent.bgSoft} ${accent.text} rounded`}>["*"]</code> 自动批准该服务器的所有工具</span>
            </p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="text-red-500 text-xs bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className={`relative flex justify-end gap-3 px-6 py-4 border-t ${colors.cardBorder}`}>
          <button
            onClick={onClose}
            className={`px-5 py-2.5 rounded-lg text-sm ${colors.text} ${colors.cardHover}`}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !!parseError}
            className={`px-6 py-2.5 ${accentGradientButtonClass} rounded-lg text-sm font-medium disabled:opacity-50`}
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditMCPModal
