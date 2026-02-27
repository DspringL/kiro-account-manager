import { useState, useEffect } from 'react'
import { X, Terminal, AlertCircle, Wand2, ClipboardPaste, Check, AlertTriangle } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { Textarea } from '@mantine/core'
import { useApp } from '../../../hooks/useApp'
import { MCP_TEMPLATES } from './MCPTemplates'
import { getThemeAccent, getGradientAccentButton } from '../KiroConfig/themeAccent'

function AddMCPModal({ onClose, onSuccess, projectDir }) {
  const { t, colors, theme } = useApp()
  const accent = getThemeAccent(theme)
  const accentGradientButtonClass = getGradientAccentButton(accent)

  const [jsonConfig, setJsonConfig] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [parseResult, setParseResult] = useState(null)
  const [existingServers, setExistingServers] = useState([])
  const [duplicates, setDuplicates] = useState([])

  // 加载现有服务列表
  useEffect(() => {
    invoke('get_mcp_config', { projectDir: projectDir || null }).then(config => {
      setExistingServers(Object.keys(config.mcpServers || {}))
    }).catch(() => {})
  }, [projectDir])

  // 初始化示例
  useEffect(() => {
    const example = { 'server-name': { command: 'uvx', args: ['package-name'] } }
    setJsonConfig(JSON.stringify(example, null, 2))
  }, [])

  // 实时解析 JSON
  useEffect(() => {
    if (!jsonConfig.trim()) {
      setParseResult(null)
      setDuplicates([])
      return
    }
    try {
      const parsed = JSON.parse(jsonConfig)
      const servers = []

      // 格式1: { mcpServers: { name: config, ... } }
      if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
        for (const [name, config] of Object.entries(parsed.mcpServers)) {
          if (config.command) servers.push({ name, config })
        }
      }
      // 格式2: { name: config, ... }
      else if (typeof parsed === 'object' && !parsed.command) {
        for (const [name, config] of Object.entries(parsed)) {
          if (config && typeof config === 'object' && config.command) {
            servers.push({ name, config })
          }
        }
      }
      // 格式3: { command: ... } - 单个配置
      else if (parsed.command) {
        setParseResult({ servers: [], error: '请包装为 { "name": { config } } 格式' })
        setDuplicates([])
        return
      }

      if (servers.length === 0) {
        setParseResult({ servers: [], error: '未找到有效配置' })
        setDuplicates([])
      } else {
        setParseResult({ servers, error: null })
        // 检测重名
        const dups = servers.filter(s => existingServers.includes(s.name)).map(s => s.name)
        setDuplicates(dups)
      }
    } catch (e) {
      setParseResult({ servers: [], error: 'JSON 格式错误' })
      setDuplicates([])
    }
  }, [jsonConfig, existingServers])

  // 应用模板
  const applyTemplate = (templateName) => {
    const config = { [templateName]: MCP_TEMPLATES[templateName] }
    setJsonConfig(JSON.stringify(config, null, 2))
    setError('')
  }

  // 格式化 JSON
  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonConfig)
      setJsonConfig(JSON.stringify(parsed, null, 2))
    } catch {}
  }

  // 从剪贴板粘贴
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = JSON.parse(text)
      setJsonConfig(JSON.stringify(parsed, null, 2))
      setError('')
    } catch {
      setError('剪贴板内容不是有效的 JSON')
    }
  }

  // 保存
  const handleSave = async () => {
    if (!parseResult || parseResult.servers.length === 0) {
      setError(parseResult?.error || '无有效配置')
      return
    }

    setSaving(true)
    setError('')

    const results = { success: [], failed: [] }

    for (const { name, config } of parseResult.servers) {
      try {
        const finalConfig = {
          command: config.command,
          args: config.args || [],
          env: config.env || {},
          disabled: config.disabled ?? false,
          autoApprove: config.autoApprove || []
        }
        await invoke('save_mcp_server', { name, config: finalConfig, projectDir: projectDir || null })
        results.success.push(name)
      } catch (e) {
        results.failed.push({ name, error: String(e) })
      }
    }

    setSaving(false)

    if (results.failed.length > 0) {
      const failedNames = results.failed.map(f => f.name).join(', ')
      if (results.success.length > 0) {
        setError(`部分失败: ${failedNames}（已成功: ${results.success.join(', ')}）`)
      } else {
        setError(`保存失败: ${failedNames}`)
      }
    } else {
      onSuccess()
    }
  }

  const serverCount = parseResult?.servers?.length || 0
  const serverNames = parseResult?.servers?.map(s => s.name) || []
  // 限制显示的名称数量
  const displayNames = serverNames.length > 3 
    ? serverNames.slice(0, 3).join(', ') + ` 等 ${serverNames.length} 个`
    : serverNames.join(', ')

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className={`relative overflow-hidden ${colors.card} border ${colors.cardBorder} rounded-lg shadow-2xl w-[560px] max-h-[85vh] flex flex-col`}
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
            <h2 className={`text-base font-semibold ${colors.text}`}>{t('mcpManager.addMCPServer')}</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${colors.cardHover}`}>
            <X size={18} className={colors.textMuted} />
          </button>
        </div>

        {/* 内容 */}
        <div className="relative flex-1 overflow-auto p-6 space-y-4" style={{ padding: 'var(--mantine-spacing-md)' }}>
          {/* 快速模板 */}
          <div>
            <label className={`block text-xs ${colors.textMuted} mb-1.5`}>快速填充</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(MCP_TEMPLATES).map(key => (
                <button
                  key={key}
                  onClick={() => applyTemplate(key)}
                  className={`px-2.5 py-1 text-xs rounded-lg border ${colors.cardBorder} ${colors.input} ${accent.hoverBorder} ${colors.text}`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* JSON 配置 */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <label className={`text-xs ${colors.textMuted} shrink-0`}>配置</label>
                {serverCount > 0 && !parseResult?.error && (
                  <span className="text-xs text-green-500 flex items-center gap-1 truncate">
                    <Check size={12} className="shrink-0" />
                    <span className="truncate">{displayNames}</span>
                  </span>
                )}
                {parseResult?.error && (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {parseResult.error}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={pasteFromClipboard}
                  className={`text-xs ${colors.textMuted} ${accent.textHover} flex items-center gap-1 transition-colors`}
                >
                  <ClipboardPaste size={12} />
                  粘贴
                </button>
                <button
                  onClick={formatJson}
                  className={`text-xs ${colors.textMuted} ${accent.textHover} flex items-center gap-1 transition-colors`}
                >
                  <Wand2 size={12} />
                  格式化
                </button>
              </div>
            </div>
            <Textarea
              value={jsonConfig}
              onChange={e => setJsonConfig(e.target.value)}
              rows={12}
              spellCheck={false}
              styles={{
                input: {
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.875rem',
                  borderRadius: '0.75rem',
                  padding: '0.75rem'
                }
              }}
            />
            <div className={`text-xs ${colors.textMuted} mt-1.5`}>
              支持 {`{ "name": config }`} 或 {`{ "mcpServers": { ... } }`} 格式
            </div>
          </div>

          {/* 重名警告 */}
          {duplicates.length > 0 && (
            <div className="text-xs text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>以下服务已存在，将被覆盖: {duplicates.join(', ')}</span>
            </div>
          )}

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
            disabled={saving || serverCount === 0}
            className={`px-6 py-2.5 ${accentGradientButtonClass} rounded-lg text-sm font-medium disabled:opacity-50`}
          >
            {saving ? t('common.saving') : serverCount > 1 ? `添加 ${serverCount} 个` : t('common.add')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddMCPModal
