import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { Server, Settings2, FileText } from 'lucide-react'
import MCPPanel from './MCPPanel'
import SteeringPanel from './SteeringPanel'

function KiroConfig() {
  const { t, theme, colors } = useApp()
  const isLightTheme = theme === 'light'
  const [activeTab, setActiveTab] = useState('mcp')

  const TABS = [
    { id: 'mcp', label: t('kiroConfig.mcp'), icon: Server },
    { id: 'steering', label: t('kiroConfig.steering'), icon: FileText },
  ]

  return (
    <div className={`h-full flex flex-col ${colors.main}`}>
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
                  isActive
                    ? (isLightTheme ? 'bg-gray-100 text-gray-900' : 'bg-white/10 text-white')
                    : (isLightTheme ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-50' : 'text-gray-400 hover:text-white hover:bg-white/5')
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'mcp' && <MCPPanel />}
        {activeTab === 'steering' && <SteeringPanel />}
      </div>
    </div>
  )
}

export default KiroConfig
