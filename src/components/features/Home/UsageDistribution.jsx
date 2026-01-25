import { Card, Group, Stack, Text, Progress } from '@mantine/core'
import { PieChart, BarChart2 } from 'lucide-react'
import { usePrivacy } from '../../../contexts/PrivacyContext'
import { formatUsage } from '../../../utils/accountStats'

// 使用率分布统计
function UsageDistribution({ tokens, isLightTheme, colors, t }) {
  const { maskEmail } = usePrivacy()
  
  // 计算使用率分组
  const getUsagePercent = (account) => {
    // 封禁账号返回 0
    const isBanned = account.status === 'banned' || account.status === '封禁' || account.status === '已封禁'
    if (isBanned) return 0

    const breakdown = account.usageData?.usageBreakdownList?.[0] || account.usageData?.usageBreakdown
    const used = breakdown?.currentUsage ?? 0
    const limit = breakdown?.usageLimit ?? 0
    return limit > 0 ? (used / limit) * 100 : 0
  }
  
  const usageGroups = {
    low: tokens.filter(a => getUsagePercent(a) < 30).length,
    medium: tokens.filter(a => { const p = getUsagePercent(a); return p >= 30 && p < 70 }).length,
    high: tokens.filter(a => getUsagePercent(a) >= 70).length
  }
  
  // 账号配额排行（前5）
  const topAccounts = [...tokens]
    .map(a => {
      // 封禁账号返回 0
      const isBanned = a.status === 'banned' || a.status === '封禁' || a.status === '已封禁'
      if (isBanned) {
        return { email: a.email, used: 0, limit: 0, percent: 0, usedStr: '0', limitStr: '0' }
      }

      const breakdown = a.usageData?.usageBreakdownList?.[0] || a.usageData?.usageBreakdown
      const used = breakdown?.currentUsage ?? 0
      const limit = breakdown?.usageLimit ?? 0
      return { 
        email: a.email, 
        used, 
        limit, 
        percent: limit > 0 ? Math.round((used / limit) * 100) : 0,
        usedStr: formatUsage(used),
        limitStr: formatUsage(limit)
      }
    })
    .sort((a, b) => b.limit - a.limit)
    .slice(0, 5)

  return (
    <div className="grid grid-cols-2 gap-6 mt-6">
      {/* 使用率分布 */}
      <Card
        className="card-glow animate-scale-in"
        shadow="sm"
        padding="lg"
        radius="xl"
        withBorder
      >
        <Group gap="xs" mb="md">
          <PieChart size={18} className="text-blue-500" />
          <Text fw={600} className={colors.text}>{t('stats.usageDistribution')}</Text>
        </Group>
        <Stack gap="md">
          {[
            { label: t('stats.lowUsage'), value: usageGroups.low, color: 'green', desc: '< 30%' },
            { label: t('stats.mediumUsage'), value: usageGroups.medium, color: 'yellow', desc: '30-70%' },
            { label: t('stats.highUsage'), value: usageGroups.high, color: 'red', desc: '> 70%' }
          ].map((item, i) => {
            const percent = tokens.length > 0 ? (item.value / tokens.length * 100) : 0
            return (
              <div key={i}>
                <Group justify="space-between" mb={4}>
                  <Text size="sm" className={colors.text}>
                    {item.label} <Text span className={colors.textMuted}>({item.desc})</Text>
                  </Text>
                  <Text size="sm" fw={500} className={colors.text}>
                    {item.value} {t('stats.accounts')}
                  </Text>
                </Group>
                <Progress
                  value={percent}
                  color={item.color}
                  size="sm"
                  radius="xl"
                  animated
                />
              </div>
            )
          })}
        </Stack>
      </Card>

      {/* 账号配额排行 */}
      <Card
        className="card-glow animate-scale-in"
        shadow="sm"
        padding="lg"
        radius="xl"
        withBorder
      >
        <Group gap="xs" mb="md">
          <BarChart2 size={18} className="text-indigo-500" />
          <Text fw={600} className={colors.text}>{t('stats.accountUsage')}</Text>
        </Group>
        <Stack gap="sm">
          {topAccounts.map((account, i) => {
            const progressColor = account.percent < 30 ? 'green'
              : account.percent < 70 ? 'yellow'
              : 'red'
            return (
              <div key={i}>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" className={colors.text} truncate style={{ maxWidth: 140 }}>
                    {maskEmail(account.email).split('@')[0]}
                  </Text>
                  <Text size="xs" className={colors.textMuted}>
                    {account.usedStr}/{account.limitStr} ({account.percent}%)
                  </Text>
                </Group>
                <Progress
                  value={account.percent}
                  color={progressColor}
                  size="xs"
                  radius="xl"
                  animated
                />
              </div>
            )
          })}
        </Stack>
      </Card>
    </div>
  )
}

export default UsageDistribution
