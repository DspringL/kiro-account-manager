import { Card, Group, Stack, Skeleton } from '@mantine/core'

// 骨架屏加载状态
function LoadingSkeleton({ colors }) {
  return (
    <div className={`h-full overflow-auto ${colors.main}`}>
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      
      <div className="max-w-5xl mx-auto p-8 relative">
        {/* Header 骨架 */}
        <Stack gap="md" mb="xl">
          <Group gap="md">
            <Skeleton width={48} height={48} radius="xl" />
            <Skeleton width={256} height={32} radius="lg" />
          </Group>
          <Skeleton width={320} height={20} radius="lg" />
        </Stack>

        {/* 统计卡片骨架 */}
        <Group gap="md" mb="xl" grow>
          {[...Array(5)].map((_, i) => (
            <Card
              key={i}
              shadow="sm"
              padding="md"
              radius="xl"
              withBorder
              style={{ 
                background: colors.card,
                borderColor: colors.cardBorder
              }}
            >
              <Group gap="md" wrap="nowrap">
                <Skeleton width={36} height={36} radius="lg" />
                <Stack gap="xs" style={{ flex: 1 }}>
                  <Skeleton width="60%" height={28} />
                  <Skeleton width="80%" height={16} />
                </Stack>
              </Group>
            </Card>
          ))}
        </Group>

        {/* 主内容骨架 */}
        <Group gap="xl" align="flex-start" grow>
          <Card
            shadow="sm"
            padding={0}
            radius="xl"
            withBorder
            style={{ 
              background: colors.card,
              borderColor: colors.cardBorder
            }}
          >
            <div className={`px-6 py-4 border-b ${colors.cardBorder}`}>
              <Skeleton width={128} height={20} />
            </div>
            <Stack gap="md" p="xl">
              <Group gap="md">
                <Skeleton width={64} height={64} radius="xl" />
                <Stack gap="xs" style={{ flex: 1 }}>
                  <Skeleton width="40%" height={20} />
                  <Skeleton width="30%" height={16} />
                </Stack>
              </Group>
              <Skeleton width="100%" height={96} radius="xl" />
            </Stack>
          </Card>
          
          <Card
            shadow="sm"
            padding={0}
            radius="xl"
            withBorder
            style={{ 
              background: colors.card,
              borderColor: colors.cardBorder
            }}
          >
            <div className={`px-6 py-4 border-b ${colors.cardBorder}`}>
              <Skeleton width={96} height={20} />
            </div>
            <Stack gap="md" p="xl">
              <Skeleton width="100%" height={64} radius="xl" />
              <Group gap="md" grow>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} height={80} radius="xl" />
                ))}
              </Group>
            </Stack>
          </Card>
        </Group>
      </div>
    </div>
  )
}

export default LoadingSkeleton
