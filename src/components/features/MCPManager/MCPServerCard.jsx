import { Server, Edit2, Trash2, Terminal } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'

function MCPServerCard({ name, config, onToggle, onEdit, onDelete }) {
  const { t, colors } = useApp()
  const isDisabled = config.disabled

  const commandStr = [config.command, ...(config.args || [])].join(' ')
  const autoApproveCount = config.autoApprove?.length || 0
  const envCount = Object.keys(config.env || {}).length

  return (
    <div className={`${colors.card} border ${colors.cardBorder} rounded-xl p-4 transition-all hover:shadow-lg`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* 状态指示器 */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDisabled ? colors.cardSecondary : colors.badgeActive
          }`}>
            <Server size={20} className={isDisabled ? colors.textMuted : 'text-green-500'} />
          </div>
          
          <div className="flex-1 min-w-0">
            {/* 名称 */}
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold ${colors.text} ${isDisabled ? 'opacity-50' : ''}`}>{name}</h3>
              {isDisabled && (
                <span className={`text-xs px-2 py-0.5 rounded ${colors.badgeDisabled}`}>
                  {t('mcpManager.disabled')}
                </span>
              )}
            </div>
            
            {/* 命令 */}
            <div className={`flex items-center gap-1.5 mt-1 ${colors.textMuted} ${isDisabled ? 'opacity-50' : ''}`}>
              <Terminal size={14} />
              <code className="text-sm truncate">{commandStr}</code>
            </div>
            
            {/* 标签 */}
            <div className="flex items-center gap-2 mt-2">
              {autoApproveCount > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded ${colors.badgeInfo}`}>
                  {t('mcpManager.autoApprove')}: {autoApproveCount} {t('mcpManager.tools')}
                </span>
              )}
              {envCount > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded ${colors.badgePurple}`}>
                  {t('mcpManager.envVars')}: {envCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 ml-4">
          {/* 开关 */}
          <button
            onClick={() => onToggle(!isDisabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isDisabled ? colors.toggleOff : colors.toggleOn
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${
              isDisabled ? 'left-1' : 'left-6'
            } ${colors.toggleThumb}`} />
          </button>
          
          <button
            onClick={onEdit}
            className={`p-2 rounded-lg ${colors.cardHover} transition-colors`}
            title={t('common.edit')}
          >
            <Edit2 size={16} className={colors.textMuted} />
          </button>
          
          <button
            onClick={onDelete}
            className={`p-2 rounded-lg hover:bg-red-500/10 transition-colors`}
            title={t('common.delete')}
          >
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default MCPServerCard
