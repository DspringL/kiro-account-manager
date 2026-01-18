import { Card, Progress, Group, Stack, Text, Badge } from '@mantine/core'
import { TrendingUp } from 'lucide-react'

// 配额总览卡片
function QuotaOverviewCard({ stats, isLightTheme, colors, t }) {
  const getProgressColor = (percent) => {
    if (percent > 80) return 'red'
    if (percent > 50) return 'yellow'
    return 'green'
  }

  const getBadgeColor = (percent) => {
    if (percent > 80) return 'red'
    if (percent > 50) return 'yellow'
    return 'green'
  }

  return (
    <Card
      className="card-glow animate-scale-in delay-400"
      shadow="sm"
      padding="lg"
      radius="xl"
      withBorder
    >
      <Group gap="sm" mb="md">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.cardSecondary}`}>
          <TrendingUp size={20} className="text-emerald-500" />
        </div>
        <Text fw={600} className={colors.text}>{t('home.quotaOverview')}</Text>
      </Group>
      
      <Group gap="md" mb="sm">
        <Progress
          value={stats.usagePercent}
          color={getProgressColor(stats.usagePercent)}
          size="md"
          radius="xl"
          style={{ flex: 1 }}
          animated
        />
        <Badge
          color={getBadgeColor(stats.usagePercent)}
          variant={isLightTheme ? 'light' : 'filled'}
          size="sm"
        >
          {stats.usagePercent}%
        </Badge>
      </Group>
      
      <Group justify="space-between">
        <Text size="sm" c="dimmed">{t('home.usedTotal')}</Text>
        <Text size="sm" fw={500} className={colors.text}>
          {stats.totalUsedStr} / {stats.totalQuotaStr}
        </Text>
      </Group>
    </Card>
  )
}

export default QuotaOverviewCard
