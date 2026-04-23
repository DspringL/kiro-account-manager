import { useState, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useApp } from '../../../hooks/useApp'
import { Server, Settings2, FileText, Puzzle, Bot, Zap, FolderOpen, Link2, X } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import MCPPanel from './MCPPanel'
import SteeringPanel from './SteeringPanel'
import SkillsPanel from './SkillsPanel'
import HooksPanel from './HooksPanel'
import AgentsPanel from './AgentsPanel'
import PowersPanel from './PowersPanel'
import { handleUiError } from '../../../utils/errorLogger'
import { getThemeAccent } from './themeAccent'
import React from 'react'

// 定义配置页面使用的色彩系统
const colors = {
  inputFocus: 'focus:ring-primary/20 focus:border-primary',
  badgeActive: 'bg-primary/20 text-primary border border-primary/30',
  badgeDisabled: 'bg-muted/50 text-muted-foreground border border-border/50',
  btnDisabled: 'opacity-50 cursor-not-allowed grayscale',
  dialogHeader: 'border-b border-border bg-muted/30'
}

function KiroConfig() {
  const { t, theme } = useApp()
  const accent = useMemo(() => getThemeAccent(theme), [theme])
  const [activeTab, setActiveTab] = useState('mcp')
  const [mcpCount, setMcpCount] = useState(0)
  const [steeringCount, setSteeringCount] = useState(0)

  const [skillsCount, setSkillsCount] = useState(0)
  const [hooksCount, setHooksCount] = useState(0)
  const [agentsCount, setAgentsCount] = useState(0)
  const [powersCount, setPowersCount] = useState(0)
  const [projectDir, setProjectDir] = useState<string | null>(null)

  // 初始加载数量
  useEffect(() => {
    invoke<any[]>('get_steering_files', { projectDir: projectDir || null }).then(files => setSteeringCount(files?.length || 0)).catch(() => {})
    invoke<any[]>('get_skills', { projectDir: projectDir || null }).then(skills => setSkillsCount(skills?.length || 0)).catch(() => {})
    invoke<any[]>('get_custom_agents', { projectDir: projectDir || null }).then(agents => setAgentsCount(agents?.length || 0)).catch(() => {})

    if (projectDir) {
      invoke<any[]>('get_hooks', { projectDir }).then(hooks => setHooksCount(hooks?.length || 0)).catch(() => setHooksCount(0))
    } else {
      setHooksCount(0)
    }

    invoke<any[]>('get_powers').then(powers => setPowersCount(powers?.length || 0)).catch(() => {})
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
        setProjectDir(selected as string)
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
    <div className={`h-full flex flex-col max-w-full overflow-x-hidden glass-main`}>
      <div className="flex flex-col">
        {/* 头部 */}
        <div className={`glass-card border-b border-border px-6 py-4 flex items-center gap-4`}>

          <div className={`w-10 h-10 bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} rounded-xl flex items-center justify-center shadow-lg ${accent.shadow}`}>
            <Settings2 size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className={`text-xl font-bold text-foreground`}>{t('kiroConfig.title')}</h1>
            <p className={`text-sm text-muted-foreground`}>
              {t('kiroConfig.subtitle')}
            </p>
          </div>
          {/* 项目目录选择器 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectProjectDir}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer hover:bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 ${accent.ring}`}
              title={t('kiroConfig.selectProjectDir')}
            >
              <FolderOpen size={16} className="text-amber-500" />
              {projectDir ? (
                <span className="max-w-[200px] truncate text-xs">{projectDir.split(/[/\\]/).pop()}</span>
              ) : (
                <span className={`text-xs text-muted-foreground`}>{t('kiroConfig.noProjectDir')}</span>
              )}
            </button>
            {projectDir && (
              <button
                onClick={() => setProjectDir(null)}
                className={`p-1.5 rounded-lg hover:bg-muted/50 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 ${accent.ring}`}
                title={t('kiroConfig.clearProjectDir')}
              >
                <X size={14} className={"text-muted-foreground"} />
              </button>
            )}
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="px-6 py-3 border-b border-transparent">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              {TABS.map(tab => {
                const Icon = tab.icon
                const isDisabled = !!tab.disabled
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    disabled={isDisabled}
                    title={isDisabled ? t('kiroConfig.selectProjectDir') : ''}
                    className="flex items-center gap-2"
                  >
                    <Icon size={16} />
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        activeTab === tab.id ? colors.badgeActive : colors.badgeDisabled
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {/* 内容区 */}
            <div className="mt-4 flex-1">
              <TabsContent value="mcp">
                <MCPPanel onCountChange={setMcpCount} projectDir={projectDir} />
              </TabsContent>
              <TabsContent value="steering">
                <SteeringPanel onCountChange={setSteeringCount} projectDir={projectDir} />
              </TabsContent>
              <TabsContent value="skills">
                <SkillsPanel onCountChange={setSkillsCount} projectDir={projectDir} />
              </TabsContent>
              <TabsContent value="hooks">
                {projectDir
                  ? <HooksPanel onCountChange={setHooksCount} projectDir={projectDir} />
                  : <div className={`h-full flex items-center justify-center text-muted-foreground`}>{t('kiroConfig.selectProjectDir')}</div>
                }
              </TabsContent>
              <TabsContent value="agents">
                <AgentsPanel onCountChange={setAgentsCount} projectDir={projectDir} />
              </TabsContent>
              <TabsContent value="powers">
                <PowersPanel onCountChange={setPowersCount} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

    </div>
  )
}

export default KiroConfig
