import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../../hooks/useApp'
import { Server, Settings2, FileText } from 'lucide-react'
import MCPPanel from './MCPPanel'
import SteeringPanel from './SteeringPanel'

function KiroConfig() {
  const { t, theme, colors } = useApp()
  const isLightTheme = theme === 'light' || theme === 'purple' || theme === 'green'
  const [activeTab, setActiveTab] = useState('mcp')
  const [mcpCount, setMcpCount] = useState(0)
  const [steeringCount, setSteeringCount] = useState(0)

  // 初始加载 steering 数量
  useEffect(() => {
    invoke('get_steering_files').then(files => setSteeringCount(files?.length || 0)).catch(() => {})
  }, [])

  const TABS = [
    { id: 'mcp', label: t('kiroConfig.mcp'), icon: Server, count: mcpCount },
    { id: 'steering', label: t('kiroConfig.steering'), icon: FileText, count: steeringCount },
  ]

  return (
    <div className={`h-full flex flex-col ${colors.main}`}>
      <div className="flex-1 flex flex-col min-h-0">
      {/* 头部 */}
      <div className={`${colors.card} border-b ${colors.cardBorder} px-6 py-4`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Settings2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${colors.text}`}>{t('kiroConfig.title')}</h1>
            <p className={`text-sm ${colors.textMuted}`}>
              {t('kiroConfig.subtitle')}
            </p>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive ? colors.tagActive + ' ' + colors.text : colors.textMuted + ' ' + colors.tagHover
                }`}
              >
                <Icon size={16} />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? colors.badgeActive : colors.badgeDisabled
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'mcp' && <MCPPanel onCountChange={setMcpCount} />}
        {activeTab === 'steering' && <SteeringPanel onCountChange={setSteeringCount} />}
      </div>
      </div>
    </div>
  )
}

export default KiroConfig
