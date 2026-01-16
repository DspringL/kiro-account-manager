import { useState } from 'react'
import { Zap, Server, Key, BookOpen, TestTube, KeyRound, BarChart3, ScrollText } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import ServerConfig from './ServerConfig'
import TokenManager from './TokenManager'
import ApiKeyManager from './ApiKeyManager'
import TestPage from './TestPage'
import UsageGuide from './UsageGuide'
import MetricsPage from './MetricsPage'
import LogsPage from './LogsPage'

const TABS = [
  { id: 'server', label: '服务器', icon: Server },
  { id: 'tokens', label: 'Token', icon: Key },
  { id: 'apikeys', label: 'API Key', icon: KeyRound },
  { id: 'test', label: '测试', icon: TestTube },
  { id: 'metrics', label: '统计', icon: BarChart3 },
  { id: 'logs', label: '日志', icon: ScrollText },
  { id: 'guide', label: '说明', icon: BookOpen },
]

function KiroGate() {
  const { colors } = useApp()
  const [activeTab, setActiveTab] = useState('server')

  return (
    <div className={`h-full ${colors.main} p-6 overflow-auto`}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Zap size={24} className="text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${colors.text}`}>KiroGate</h1>
            <p className={colors.textMuted}>OpenAI 兼容的 Kiro API 代理</p>
          </div>
        </div>

        {/* Tab 导航 */}
        <div className={`flex gap-1 p-1 rounded-xl ${colors.card} border ${colors.cardBorder} mb-6`}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                  : `${colors.textMuted} hover:bg-white/5`
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        {activeTab === 'server' && <ServerConfig />}
        {activeTab === 'tokens' && <TokenManager />}
        {activeTab === 'apikeys' && <ApiKeyManager />}
        {activeTab === 'test' && <TestPage />}
        {activeTab === 'metrics' && <MetricsPage />}
        {activeTab === 'logs' && <LogsPage />}
        {activeTab === 'guide' && <UsageGuide />}
      </div>
    </div>
  )
}

export default KiroGate
