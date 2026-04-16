import { Card, Badge, Group, Stack, Text } from '@mantine/core'
import { useApp } from '../../../hooks/useApp'

// 统计卡片组件 - 紧凑版
function StatCard({ icon: Icon, iconBg, iconColor, value, label, delay, onClick, warning }) {
  const { colors } = useApp()
  
  return (
    <Card
      onClick={onClick}
      className={`card-glow animate-scale-in ${delay} ${onClick ? `cursor-pointer ${colors.cardHover} transition-colors duration-200` : ''}`}
      shadow="sm"
      padding="md"
      radius="xl"
      withBorder
      style={warning ? { borderColor: 'rgba(249, 115, 22, 0.5)', borderWidth: '2px' } : undefined}
    >
      <Group gap="md" wrap="nowrap">
        <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center relative flex-shrink-0`}>
          <Icon size={18} className={iconColor} />
          {warning && (
            <Badge
              size="xs"
              circle
              color="orange"
              className="absolute -top-1 -right-1 animate-pulse"
              style={{ width: 12, height: 12, padding: 0 }}
            />
          )}
        </div>
        <Stack gap={0}>
          <Text size="xl" fw={700} className={`stat-number ${colors.text}`}>
            {value}
          </Text>
          <Text size="xs" className={colors.textMuted}>{label}</Text>
        </Stack>
      </Group>
    </Card>
  )
}

export default StatCard
