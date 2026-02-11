import { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import { Server, Plus, Edit2, Trash2, Terminal, Search, X } from 'lucide-react'
import { TextInput } from '@mantine/core'
import AddMCPModal from '../MCPManager/AddMCPModal'
import EditMCPModal from '../MCPManager/EditMCPModal'
import { getThemeAccent, getGradientAccentButton } from './themeAccent'

// 搜索框组件
function SearchInput({ value, onChange, placeholder, colors, t, accent }) {
  return (
    <div className="flex-1 max-w-xs">
      <TextInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        size="sm"
        leftSection={<Search size={16} className={colors.textMuted} />}
        rightSection={value ? (
          <button
            type="button"
            aria-label={t('common.clear')}
            onClick={() => onChange('')}
            className={`p-1 rounded ${colors.cardHover} cursor-pointer transition-colors duration-200 focus:ring-2 ${accent.ring}`}
          >
            <X size={14} className={colors.textMuted} />
          </button>
        ) : null}
        classNames={{
          input: `${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-1 transition-colors duration-200`
        }}
      />
    </div>
  )
}

function MCPPanel({ onCountChange }) {
  const { t, theme, colors } = useApp()
  const accent = getThemeAccent(theme)
  const accentGradientButtonClass = getGradientAccentButton(accent)
  const { showConfirm } = useDialog()
  const [servers, setServers] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingServer, setEditingServer] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [toolCount, setToolCount] = useState(0)

  const loadConfig = useCallback(async () => {
    try {
      const config = await invoke('get_mcp_config')
      const mcpServers = config.mcpServers || {}
      setServers(mcpServers)
      onCountChange?.(Object.keys(mcpServers).length)
      
      // 加载工具统计
      const stats = await invoke('get_mcp_tool_stats')
      setToolCount(stats.estimatedTools)
    } catch (e) {
      console.error('加载 MCP 配置失败:', e)
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => { loadConfig() }, [loadConfig])

  const handleToggle = async (name, disabled) => {
    const oldDisabled = servers[name]?.disabled
    setServers(prev => ({ ...prev, [name]: { ...prev[name], disabled } }))
    try {
      await invoke('toggle_mcp_server', { name, disabled })
    } catch (e) {
      setServers(prev => ({ ...prev, [name]: { ...prev[name], disabled: oldDisabled } }))
      console.error('切换状态失败:', e)
    }
  }

  const handleDelete = async (name) => {
    if (!await showConfirm(t('mcp.confirmDelete'), `${t('common.confirm')} ${name}?`)) return
    try {
      await invoke('delete_mcp_server', { name })
      setServers(prev => { const next = { ...prev }; delete next[name]; return next })
    } catch (e) {
      console.error('删除失败:', e)
    }
  }

  const serverList = Object.entries(servers)
  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return serverList
    const q = searchQuery.toLowerCase()
    return serverList.filter(([name, cfg]) => 
      name.toLowerCase().includes(q) || [cfg.command, ...(cfg.args || [])].join(' ').toLowerCase().includes(q)
    )
  }, [serverList, searchQuery])

  return (
    <div className="h-full flex flex-col">
      {/* 警告横幅 */}
      {toolCount > 50 && (
        <div className={`mx-6 mt-4 mb-2 px-4 py-3 rounded-xl border-2 ${colors.warning} ${colors.warningBorder} flex items-start gap-3`}>
          <div className={`mt-0.5 ${colors.text}`}>
            ⚠️
          </div>
          <div className="flex-1">
            <div className={`text-sm font-medium ${colors.text} mb-1`}>
              MCP 工具数量较多
            </div>
            <div className={`text-xs ${colors.textMuted}`}>
              您已配置约 {toolCount} 个 MCP 工具（{serverList.length} 个服务器）。过多的工具可能导致工具选择性能下降和上下文消耗增加。建议禁用不常用的服务器。
            </div>
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <div className={`px-6 py-3 border-b ${colors.cardBorder} flex items-center justify-between gap-4`}>
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('common.search')}
          colors={colors}
          t={t}
          accent={accent}
        />
        <div className="flex items-center gap-3">
          <span className={`text-sm ${colors.textMuted}`}>{filteredServers.length}/{serverList.length}</span>
          <button
            onClick={() => setShowAddModal(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${accentGradientButtonClass}`}
          >
            <Plus size={14} />{t('mcp.add')}
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className={`text-center py-12 ${colors.textMuted}`}>{t('common.loading')}</div>
        ) : serverList.length === 0 ? (
          <div className="text-center py-12">
            <Server size={48} className={`mx-auto mb-4 ${colors.textMuted} opacity-50`} />
            <p className={colors.textMuted}>{t('mcp.noServers')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredServers.map(([name, config]) => (
              <MCPServerItem
                key={name}
                name={name}
                config={config}
                accent={accent}
                colors={colors}
                t={t}
                onToggle={(disabled) => handleToggle(name, disabled)}
                onEdit={() => setEditingServer({ name, config })}
                onDelete={() => handleDelete(name)}
              />
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddMCPModal onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); loadConfig() }} />
      )}
      {editingServer && (
        <EditMCPModal
          name={editingServer.name}
          config={editingServer.config}
          onClose={() => setEditingServer(null)}
          onSuccess={() => { setEditingServer(null); loadConfig() }}
        />
      )}
    </div>
  )
}

// MCP 服务器卡片
function MCPServerItem({ name, config, accent, colors, onToggle, onEdit, onDelete, t }) {
  const isDisabled = config.disabled
  const commandStr = [config.command, ...(config.args || [])].join(' ')
  const envCount = Object.keys(config.env || {}).length
  const autoApproveCount = config.autoApprove?.length || 0

  return (
    <div className={`${colors.card} border ${colors.cardBorder} rounded-xl p-4 flex items-center gap-4`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
        isDisabled ? colors.cardSecondary : colors.badgeActive
      }`}>
        <Server size={20} className={isDisabled ? colors.textMuted : accent.text} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold ${colors.text} ${isDisabled ? 'opacity-50' : ''}`}>{name}</h3>
          {isDisabled && (
            <span className={`text-xs px-2 py-0.5 rounded ${colors.badgeDisabled}`}>{t('mcp.disabled')}</span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 text-sm ${colors.textMuted} ${isDisabled ? 'opacity-50' : ''}`}>
          <Terminal size={12} />
          <code className="truncate">{commandStr}</code>
        </div>
        {(envCount > 0 || autoApproveCount > 0) && (
          <div className={`flex items-center gap-3 mt-1.5 text-xs ${colors.textMuted} ${isDisabled ? 'opacity-50' : ''}`}>
            {envCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded ${colors.badgeInfo}`}>
                {envCount} {t('mcpManager.envVars')}
              </span>
            )}
            {autoApproveCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded ${colors.badgeSuccess}`}>
                {config.autoApprove?.includes('*') ? `${t('mcpManager.autoApprove')} *` : `${t('mcpManager.autoApprove')} ${autoApproveCount} ${t('mcpManager.tools')}`}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle(!isDisabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${isDisabled ? colors.toggleOff : colors.toggleOn}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 ${colors.toggleThumb} rounded-full transition-transform ${isDisabled ? 'left-0.5' : 'left-5'}`} />
        </button>
        <button onClick={onEdit} className={`p-2 rounded-lg ${colors.cardHover}`}>
          <Edit2 size={16} className={colors.textMuted} />
        </button>
        <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-500/10">
          <Trash2 size={16} className="text-red-500" />
        </button>
      </div>
    </div>
  )
}

export default MCPPanel
