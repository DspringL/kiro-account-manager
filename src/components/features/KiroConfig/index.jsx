import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useApp } from '../../../hooks/useApp'
import { Server, Settings2, FileText, Puzzle, Bot, Zap, FolderOpen, Link2, X } from 'lucide-react'
import MCPPanel from './MCPPanel'
import SteeringPanel from './SteeringPanel'
import SkillsPanel from './SkillsPanel'
import HooksPanel from './HooksPanel'
import AgentsPanel from './AgentsPanel'
import PowersPanel from './PowersPanel'
import { getThemeAccent } from './themeAccent'
import { handleUiError } from '../../../utils/errorLogger'

function KiroConfig() {
  const { t, theme, colors } = useApp()
  const accent = getThemeAccent(theme)
  const [activeTab, setActiveTab] = useState('mcp')
  const [mcpCount, setMcpCount] = useState(0)
  const [steeringCount, setSteeringCount] = useState(0)

  const [skillsCount, setSkillsCount] = useState(0)
  const [hooksCount, setHooksCount] = useState(0)
  const [agentsCount, setAgentsCount] = useState(0)
  const [powersCount, setPowersCount] = useState(0)
  const [projectDir, setProjectDir] = useState(null)

  // 初始加载数量
  useEffect(() => {
    invoke('get_steering_files', { projectDir: projectDir || null }).then(files => setSteeringCount(files?.length || 0)).catch(() => {})
    invoke('get_skills', { projectDir: projectDir || null }).then(skills => setSkillsCount(skills?.length || 0)).catch(() => {})
    invoke('get_custom_agents', { projectDir: projectDir || null }).then(agents => setAgentsCount(agents?.length || 0)).catch(() => {})

    if (projectDir) {
      invoke('get_hooks', { projectDir }).then(hooks => setHooksCount(hooks?.length || 0)).catch(() => setHooksCount(0))
    } else {
      setHooksCount(0)
    }

    invoke('get_powers').then(powers => setPowersCount(powers?.length || 0)).catch(() => {})
  }, [projectDir])

  useEffect(() => {
    if (!projectDir && activeTab === 'hooks') {
      setActiveTab('mcp')
    }
  }, [projectDir, activeTab])


  const handleSelectProjectDir = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: t('kiroConfig.selectProjectDir') })
      if (selected) {
        setProjectDir(selected)
      }
    } catch (e) {
      handleUiError('选择项目目录失败', e, { userMessage: '选择项目目录失败' })
    }
  }

  const TABS = [
    { id: 'mcp', label: t('kiroConfig.mcp'), icon: Server, count: mcpCount },
    { id: 'powers', label: t('kiroConfig.powers'), icon: Zap, count: powersCount },
    { id: 'agents', label: t('kiroConfig.agents'), icon: Bot, count: agentsCount },
    { id: 'skills', label: t('kiroConfig.skills'), icon: Puzzle, count: skillsCount },
    { id: 'hooks', label: t('kiroConfig.hooks'), icon: Link2, count: hooksCount, disabled: !projectDir },
    { id: 'steering', label: t('kiroConfig.steering'), icon: FileText, count: steeringCount },
  ]

  return (
    <div className={`h-full flex flex-col max-w-full overflow-x-hidden ${colors.main}`}>
      <div className="flex flex-col">
      {/* 头部 */}
      <div className={`${colors.card} border-b ${colors.cardBorder} px-6 py-4 flex items-center gap-4`}>

          <div className={`w-10 h-10 bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} rounded-xl flex items-center justify-center shadow-lg ${accent.shadow}`}>
            <Settings2 size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className={`text-xl font-bold ${colors.text}`}>{t('kiroConfig.title')}</h1>
            <p className={`text-sm ${colors.textMuted}`}>
              {t('kiroConfig.subtitle')}
            </p>
          </div>
          {/* 项目目录选择器 */}
          <div className="flex items-center gap-2">
              <button
                onClick={handleSelectProjectDir}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer ${colors.cardHover} border ${colors.cardBorder} ${colors.text} focus:outline-none focus:ring-2 ${accent.ring}`}
                title={t('kiroConfig.selectProjectDir')}
              >
              <FolderOpen size={16} className="text-amber-500" />
              {projectDir ? (
                <span className="max-w-[200px] truncate text-xs">{projectDir.split(/[/\\]/).pop()}</span>
              ) : (
                <span className={`text-xs ${colors.textMuted}`}>{t('kiroConfig.noProjectDir')}</span>
              )}
            </button>
            {projectDir && (
              <button
                onClick={() => setProjectDir(null)}
                className={`p-1.5 rounded-lg ${colors.cardHover} transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 ${accent.ring}`}
                title={t('kiroConfig.clearProjectDir')}
              >
                <X size={14} className={colors.textMuted} />
              </button>
            )}
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-1 px-6 py-3 border-b border-transparent">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const isDisabled = !!tab.disabled
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                title={isDisabled ? t('kiroConfig.selectProjectDir') : ''}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
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
      <div className="flex-1 min-h-0 overflow-hidden">
{activeTab === 'mcp' && <MCPPanel onCountChange={setMcpCount} projectDir={projectDir} />}
        {activeTab === 'steering' && <SteeringPanel onCountChange={setSteeringCount} projectDir={projectDir} />}
        {activeTab === 'skills' && <SkillsPanel onCountChange={setSkillsCount} projectDir={projectDir} />}
        {activeTab === 'hooks' && (
          projectDir
            ? <HooksPanel onCountChange={setHooksCount} projectDir={projectDir} />
            : <div className={`h-full flex items-center justify-center ${colors.textMuted}`}>{t('kiroConfig.selectProjectDir')}</div>
        )}
        {activeTab === 'agents' && <AgentsPanel onCountChange={setAgentsCount} projectDir={projectDir} />}
        {activeTab === 'powers' && <PowersPanel onCountChange={setPowersCount} />}
      </div>

    </div>
  )
}

export default KiroConfig
