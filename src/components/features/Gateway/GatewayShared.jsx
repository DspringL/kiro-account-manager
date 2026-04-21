import { Card, Code, Group, Stack, Text } from '@mantine/core'

export function GatewaySurfaceCard({ colors, className = '', children, ...props }) {
  return (
    <Card
      withBorder
      radius="md"
      className={`${colors.card} ${colors.cardBorder} ${className}`.trim()}
      {...props}
    >
      {children}
    </Card>
  )
}

export function GatewaySubCard({ className = '', children, ...props }) {
  return (
    <Card withBorder radius="md" className={className} {...props}>
      {children}
    </Card>
  )
}

export function GatewaySectionHeader({ colors, icon: Icon, title, badge, actions, groupProps = {} }) {
  return (
    <Group justify="space-between" {...groupProps}>
      <Group gap="xs">
        {Icon ? <Icon size={16} /> : null}
        <Text fw={600} className={colors.text}>{title}</Text>
      </Group>
      {actions || badge || null}
    </Group>
  )
}

export function GatewayStatCard({ colors, label, value, detail, valueProps = {}, className = '' }) {
  return (
    <GatewaySubCard className={className}>
      <Text size="xs" className={colors.textMuted}>{label}</Text>
      <Text fw={700} className={colors.text} mt={4} {...valueProps}>
        {value}
      </Text>
      {detail ? (
        <Text size="sm" className={colors.textMuted} mt={6}>
          {detail}
        </Text>
      ) : null}
    </GatewaySubCard>
  )
}

export function GatewayPathCard({ title = '日志目录', value, actions }) {
  return (
    <GatewaySubCard>
      <Text size="xs" fw={600}>{title}</Text>
      <Text size="xs" mt={6} style={{ fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>
        {value}
      </Text>
      {actions ? (
        <Group mt="sm" gap="xs">
          {actions}
        </Group>
      ) : null}
    </GatewaySubCard>
  )
}

export function GatewayCodeCard({ title, code, description, actions, children }) {
  return (
    <GatewaySubCard>
      {title ? <Text size="xs" fw={600}>{title}</Text> : null}
      {code ? <Code block mt={title ? 'xs' : undefined}>{code}</Code> : null}
      {description ? (
        <Text size="xs" mt={8}>
          {description}
        </Text>
      ) : null}
      {children || null}
      {actions ? (
        <Group mt="sm" gap="xs">
          {actions}
        </Group>
      ) : null}
    </GatewaySubCard>
  )
}
