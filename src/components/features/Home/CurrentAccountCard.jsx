import { Card, Badge, Group, Stack, Text, ActionIcon, Tooltip } from '@mantine/core'
import { RefreshCw, Users, Clock } from 'lucide-react'

// 当前账号卡片
function CurrentAccountCard({ localToken, refreshing, handleRefresh, isLightTheme, colors, t }) {
  return (
    <Card
      className="card-glow animate-scale-in delay-300"
      shadow="sm"
      padding={0}
      radius="xl"
      withBorder
    >
      <Group justify="space-between" p="md" className={`border-b ${colors.cardBorder}`}>
        <Text fw={600} className={colors.text}>{t('home.currentAccount')}</Text>
        <Tooltip label={t('common.refresh')}>
          <ActionIcon
            onClick={handleRefresh}
            variant="subtle"
            radius="xl"
            loading={refreshing}
            className={refreshing ? 'spinning' : ''}
          >
            <RefreshCw size={16} className={colors.textMuted} />
          </ActionIcon>
        </Tooltip>
      </Group>
      
      <div className="p-6">
        {localToken ? (
          <Group gap="md" className="group relative">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg transition-transform hover:scale-105 flex-shrink-0 ${
              localToken.provider === 'Google' ? 'bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/25' :
              localToken.provider === 'Github' ? 'bg-gradient-to-br from-gray-700 to-gray-900 shadow-gray-500/25' :
              'bg-gradient-to-br from-blue-500 to-purple-600 shadow-blue-500/25'
            }`}>
              {localToken.provider?.[0] || 'K'}
            </div>
            <Stack gap={4} style={{ flex: 1 }}>
              <Group gap="xs">
                <Text fw={600} size="lg" className={colors.text}>
                  {localToken.provider || t('home.unknown')}
                </Text>
                <Badge
                  color="green"
                  variant="light"
                  size="sm"
                  className="pulse-ring"
                >
                  {t('home.loggedIn')}
                </Badge>
              </Group>
              <Text size="sm" className={colors.textMuted}>{localToken.authMethod || 'social'}</Text>
            </Stack>
            
            {/* Hover 显示 Token 详情 */}
            <TokenDetailPopover localToken={localToken} isLightTheme={isLightTheme} colors={colors} t={t} />
          </Group>
        ) : (
          <Stack align="center" gap="sm" py="lg">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center animate-float ${colors.cardSecondary}`}>
              <Users size={28} className={colors.textMuted} />
            </div>
            <Text className={colors.textMuted} fw={500}>{t('home.notLoggedIn')}</Text>
            <Text size="sm" className={colors.textMuted}>{t('home.clickToSwitch')}</Text>
          </Stack>
        )}
      </div>
    </Card>
  )
}

// Token 详情悬浮框
function TokenDetailPopover({ localToken, isLightTheme, colors, t }) {
  return (
    <Card
      className="absolute left-16 top-0 w-72 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none"
      shadow="xl"
      padding="sm"
      radius="xl"
      withBorder
    >
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="xs" className={colors.textMuted}>Access Token</Text>
          <Tooltip label={localToken.accessToken}>
            <Text size="xs" className={`font-mono truncate ${colors.textMuted}`} style={{ maxWidth: 140 }}>
              {localToken.accessToken?.substring(0, 12)}...
            </Text>
          </Tooltip>
        </Group>
        <Group justify="space-between">
          <Text size="xs" className={colors.textMuted}>Refresh Token</Text>
          <Tooltip label={localToken.refreshToken}>
            <Text size="xs" className={`font-mono truncate ${colors.textMuted}`} style={{ maxWidth: 140 }}>
              {localToken.refreshToken?.substring(0, 12)}...
            </Text>
          </Tooltip>
        </Group>
        {localToken.authMethod === 'IdC' ? (
          <>
            <Group justify="space-between">
              <Text size="xs" className={colors.textMuted}>Client ID Hash</Text>
              <Text size="xs" className={`font-mono truncate ${colors.textMuted}`} style={{ maxWidth: 140 }}>
                {localToken.clientIdHash || '-'}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" className={colors.textMuted}>Region</Text>
              <Text size="xs" className={`font-mono ${colors.textMuted}`}>{localToken.region || '-'}</Text>
            </Group>
          </>
        ) : (
          <Group justify="space-between">
            <Text size="xs" className={colors.textMuted}>Profile ARN</Text>
            <Tooltip label={localToken.profileArn}>
              <Text size="xs" className={`font-mono truncate ${colors.textMuted}`} style={{ maxWidth: 140 }}>
                {localToken.profileArn || '-'}
              </Text>
            </Tooltip>
          </Group>
        )}
        <Group justify="space-between">
          <Text size="xs" className={colors.textMuted}>{t('home.expiresAt')}</Text>
          <Group gap={4}>
            <Clock size={10} />
            <Text size="xs" className={colors.text}>
              {localToken.expiresAt ? new Date(localToken.expiresAt).toLocaleString() : t('home.unknown')}
            </Text>
          </Group>
        </Group>
      </Stack>
    </Card>
  )
}

export default CurrentAccountCard
