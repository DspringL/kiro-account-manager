import { useState, useEffect, useMemo, useCallback } from 'react'
import { Users, Zap, Shield, TrendingUp, Sparkles, Server } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import { useAccount } from '../../../contexts/AccountContext'
import { usePrivacy } from '../../../contexts/PrivacyContext'
import { getThemeAccent } from '../KiroConfig/themeAccent'

// 子组件
import LoadingSkeleton from './LoadingSkeleton'
import StatCard from './StatCard'
import CurrentAccountCard from './CurrentAccountCard'
import QuotaOverviewCard from './QuotaOverviewCard'
import AccountQuotaDetail from './AccountQuotaDetail'
import UsageDistribution from './UsageDistribution'
import QuotaPieChart from './QuotaPieChart'
import UsageTrendChart from './UsageTrendChart'
import React from 'react'

interface HomeProps {
  onNavigate: (path: string) => void;
}

function Home({ onNavigate }: HomeProps) {
  const { t, theme } = useApp()
  const accent = useMemo(() => getThemeAccent(theme), [theme])
  const colors = useMemo(() => ({
    inputFocus: 'focus:ring-primary/20 focus:border-primary',
  }), [])

  const { showError } = useDialog()
  const { maskEmail } = usePrivacy()
  const { 
    accounts: tokens, 
    localToken, 
    loading, 
    refreshing,
    stats, 
    currentAccount,
    currentQuotaInfo,
    refresh,
    refreshAccount 
  } = useAccount()
  
  const [refreshingAccount, setRefreshingAccount] = useState(false)
  const [mcpToolCount, setMcpToolCount] = useState(0)

  const handleRefresh = useCallback(() => refresh(), [refresh])

  // 加载 MCP 工具数量
  useEffect(() => {
    const loadMcpToolCount = async () => {
      try {
        const statsResult = await invoke<any>('get_mcp_tool_stats', { projectDir: null })
        setMcpToolCount(statsResult.estimatedTools)
      } catch (e) {
        // 静默处理
      }
    }
    loadMcpToolCount()
  }, [])

  // 刷新当前账号的 token 和 usage（使用 useCallback 缓存）
  const handleRefreshCurrentAccount = useCallback(async () => {
    if (!currentAccount || refreshingAccount) return
    setRefreshingAccount(true)
    try {
      await refreshAccount(currentAccount.id)
    } catch (e) {
      showError(t('common.refreshFailed'), String(e))
    } finally {
      setRefreshingAccount(false)
    }
  }, [currentAccount, refreshingAccount, refreshAccount, showError, t])

  // 缓存 statCards，避免每次 render 都重新创建
  const statCards = useMemo(() => [
    { icon: Users, iconBg: "info-badge", iconColor: accent.text, value: stats.total, label: t('home.totalAccounts'), delay: 'delay-100' },
    { icon: Shield, iconBg: "success-badge", iconColor: accent.text, value: `${stats.active}/${stats.unavailable}`, label: t('home.activeVsUnavailable'), delay: 'delay-200' },
    { icon: Zap, iconBg: "bg-purple-500/10 text-purple-500", iconColor: accent.text, value: stats.proPlus + stats.pro, label: t('home.proAccounts'), delay: 'delay-300' },
    { icon: TrendingUp, iconBg: "warning-badge", iconColor: 'text-orange-500', value: `${stats.usagePercent}%`, label: t('home.usagePercent'), delay: 'delay-400' },
    { 
      icon: Server, 
      iconBg: "bg-cyan-500/10 text-cyan-500", 
      iconColor: accent.text,
      value: mcpToolCount, 
      label: 'MCP 工具', 
      delay: 'delay-500',
      onClick: () => onNavigate?.('kiroConfig'),
      warning: mcpToolCount > 50
    },
  ], [accent, stats, mcpToolCount, t, onNavigate])

  if (loading) {
    return <LoadingSkeleton colors={colors} />
  }

  return (
    <div className="h-full overflow-auto flex flex-col items-center">
      {/* 背景装饰光晕 */}
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      
      <div className="w-full p-8 relative">
        {/* Header */}
        <div className="mb-8 animate-bounce-in">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-12 h-12 bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} rounded-2xl flex items-center justify-center shadow-lg ${accent.shadow} animate-float`}>
              <Sparkles size={24} className="text-white" />
            </div>
            <h1 className={`text-2xl font-bold text-foreground`}>{t('home.title')}</h1>
          </div>
          <p className={"text-muted-foreground"}>{t('home.subtitle')}</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-5 gap-6 mb-6">
          {statCards.map((card, index) => (
            <StatCard key={index} {...card} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* 当前账号 */}
          <CurrentAccountCard 
            localToken={localToken}
            refreshing={refreshing}
            handleRefresh={handleRefresh}
            colors={colors}
            t={t}
          />

          {/* 配额总览 */}
          <QuotaOverviewCard 
            stats={stats}
            colors={colors}
            t={t}
          />
        </div>

        {/* 当前账号配额详情 */}
        {localToken && currentAccount && (
          <AccountQuotaDetail 
            currentAccount={currentAccount}
            currentQuotaInfo={currentQuotaInfo}
            refreshingAccount={refreshingAccount}
            handleRefreshCurrentAccount={handleRefreshCurrentAccount}
            maskEmail={maskEmail}
            theme={theme}
            colors={colors}
            t={t}
          />
        )}

        {/* 使用率分布统计 */}
        {tokens.length > 0 && (
          <UsageDistribution 
            tokens={tokens}
            colors={colors}
            t={t}
          />
        )}

        {/* 配额分布饼图 + 使用量趋势图 */}
        {tokens.length > 0 && (
          <div className="grid grid-cols-2 gap-6 mt-6">
            <QuotaPieChart accounts={tokens} />
            <UsageTrendChart accounts={tokens} stats={stats} />
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
