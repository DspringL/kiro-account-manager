// 配额分布饼图组件
import { Card, Group, Stack, Text } from '@mantine/core'
import { PieChart } from 'lucide-react'
import { useMemo } from 'react'
import { useApp } from '../../../hooks/useApp'
import { usePrivacy } from '../../../contexts/PrivacyContext'
import { getAccountDisplayName } from '../../../utils/accountStats'
import { getThemeAccent } from '../KiroConfig/themeAccent'

import { getQuota as getQuotaFromUtils } from '../../../utils/accountStats'

// 饼图颜色
const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

export default function QuotaPieChart({ accounts }) {
  const { t, theme, colors } = useApp()
  const { maskEmail } = usePrivacy()
  const accent = getThemeAccent(theme)

  // 计算总配额（使用统一的 getQuota 函数）
  const totalQuota = useMemo(() => 
    accounts.reduce((sum, a) => sum + getQuotaFromUtils(a), 0), 
    [accounts]
  )

  // 计算饼图扇形数据
  const pieSlices = useMemo(() => {
    if (accounts.length === 0 || totalQuota === 0) return []
    
    // 按配额排序，取前8个
    const sorted = [...accounts]
      .map(a => ({ email: a.email, quota: getQuotaFromUtils(a) }))
      .sort((a, b) => b.quota - a.quota)
      .slice(0, 8)
    
    let startAngle = 0
    return sorted.map((account, i) => {
      const percentage = account.quota / totalQuota
      const angle = percentage * 360
      const slice = {
        email: getAccountDisplayName(account),
        percentage: (percentage * 100).toFixed(1),
        startAngle,
        endAngle: startAngle + angle,
        color: PIE_COLORS[i % PIE_COLORS.length]
      }
      startAngle += angle
      return slice
    })
  }, [accounts, totalQuota])

  if (accounts.length === 0) return null

  return (
    <Card
      className="card-glow animate-scale-in"
      shadow="sm"
      padding="lg"
      radius="xl"
      withBorder
    >
      <Group gap="xs" mb="md">
        <PieChart size={18} className={accent.text} />
        <Text fw={600} className={colors.text}>{t('stats.quotaDistribution')}</Text>
      </Group>

      <Group align="flex-start" gap="xl">
        {/* SVG 饼图 */}
        <div className="relative w-36 h-36 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {pieSlices.map((slice, i) => {
              const largeArcFlag = slice.endAngle - slice.startAngle > 180 ? 1 : 0
              const startX = 50 + 40 * Math.cos(slice.startAngle * Math.PI / 180)
              const startY = 50 + 40 * Math.sin(slice.startAngle * Math.PI / 180)
              const endX = 50 + 40 * Math.cos(slice.endAngle * Math.PI / 180)
              const endY = 50 + 40 * Math.sin(slice.endAngle * Math.PI / 180)
              const d = `M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY} Z`
              return (
                <path
                  key={i}
                  d={d}
                  fill={slice.color}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                >
                  <title>{maskEmail(slice.email)}: {slice.percentage}%</title>
                </path>
              )
            })}
          </svg>
        </div>

        {/* 图例 */}
        <Stack gap={6} style={{ flex: 1, maxHeight: 144, overflowY: 'auto' }}>
          {pieSlices.map((slice, i) => (
            <Group key={i} gap="xs" wrap="nowrap">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: slice.color }} />
              <Text size="xs" className={colors.text} truncate style={{ flex: 1 }}>
                {maskEmail(slice.email).split('@')[0]}
              </Text>
              <Text size="xs" className={`${colors.textMuted} flex-shrink-0`}>
                {slice.percentage}%
              </Text>
            </Group>
          ))}
        </Stack>
      </Group>
    </Card>
  )
}
