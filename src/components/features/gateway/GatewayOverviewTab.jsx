import { Check, Copy, FolderOpen, Radio, RefreshCw, Shield } from 'lucide-react'
import { Badge, Button, Card, Code, Group, Stack, Text } from '@mantine/core'

function GatewayOverviewTab({
  colors,
  loading,
  handleRefresh,
  effectiveBaseUrl,
  effectiveRoutingSummary,
  effectiveSecuritySummary,
  statusSummary,
  actionSummary,
  operationsChecklist,
  clientSamples,
  copyText,
  handleOpenLogDir,
  copySuccess,
  effectiveConfig,
  logDir,
  latestErrorEntry,
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] gap-4">
      <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Group gap="xs">
                <Radio size={16} />
                <Text fw={600} className={colors.text}>控制台总览</Text>
              </Group>
            </Stack>
            <Button variant="light" size="xs" leftSection={<RefreshCw size={14} />} onClick={handleRefresh} loading={loading}>
              刷新
            </Button>
          </Group>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Card withBorder radius="md">
              <Text size="xs" className={colors.textMuted}>客户端入口</Text>
              <Text fw={700} className={colors.text}>{effectiveBaseUrl}</Text>
            </Card>
            <Card withBorder radius="md">
              <Text size="xs" className={colors.textMuted}>{effectiveRoutingSummary.selectionLabel}</Text>
              <Text fw={700} className={colors.text}>{effectiveRoutingSummary.selectionValue}</Text>
            </Card>
            <Card withBorder radius="md">
              <Text size="xs" className={colors.textMuted}>客户端 Key</Text>
              <Text fw={700} className={colors.text}>{effectiveSecuritySummary.apiKeyState}</Text>
            </Card>
            <Card withBorder radius="md">
              <Text size="xs" className={colors.textMuted}>请求计数 / 错误</Text>
              <Text fw={700} className={colors.text}>{statusSummary.requests} / {statusSummary.errorCount}</Text>
            </Card>
          </div>

          <Card withBorder radius="md">
            <Stack gap={8}>
              <Group justify="space-between">
                <Text size="sm" fw={600}>当前建议动作</Text>
                <Badge color={actionSummary.tone}>{actionSummary.title}</Badge>
              </Group>
              <Text size="sm" className={colors.textMuted}>{actionSummary.description}</Text>
            </Stack>
          </Card>

          <Card withBorder radius="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" fw={600}>操作检查清单</Text>
                <Badge color={operationsChecklist.some(item => item.tone === 'red' || item.tone === 'orange') ? 'orange' : 'teal'}>
                  {operationsChecklist.length} 项
                </Badge>
              </Group>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {operationsChecklist.map((item) => (
                  <Card key={item.label} withBorder radius="md">
                    <Stack gap={6}>
                      <Group justify="space-between" align="flex-start">
                        <Text size="xs" className={colors.textMuted}>{item.label}</Text>
                        <Badge color={item.tone}>{item.status}</Badge>
                      </Group>
                      <Text fw={700} className={colors.text}>{item.status}</Text>
                      <Text size="sm" className={colors.textMuted}>{item.detail}</Text>
                    </Stack>
                  </Card>
                ))}
              </div>
            </Stack>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card withBorder radius="md">
              <Stack gap={8}>
                <Text size="xs" className={colors.textMuted}>快速复制</Text>
                <Text fw={700} className={colors.text}>基础入口</Text>
                <Button variant="light" size="xs" leftSection={<Copy size={14} />} onClick={() => copyText(effectiveBaseUrl, '网关入口已复制')}>
                  复制入口地址
                </Button>
              </Stack>
            </Card>
            <Card withBorder radius="md">
              <Stack gap={8}>
                <Text size="xs" className={colors.textMuted}>OpenAI 兼容接入</Text>
                <Text fw={700} className={colors.text}>OpenAI Responses 兼容</Text>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<Copy size={14} />}
                  onClick={() => copyText(clientSamples.openai.env, 'OpenAI 兼容配置已复制')}
                >
                  复制 OpenAI 兼容环境变量
                </Button>
              </Stack>
            </Card>
            <Card withBorder radius="md">
              <Stack gap={8}>
                <Text size="xs" className={colors.textMuted}>排障入口</Text>
                <Text fw={700} className={colors.text}>日志目录</Text>
                <Button variant="light" size="xs" leftSection={<FolderOpen size={14} />} onClick={handleOpenLogDir}>
                  打开日志目录
                </Button>
              </Stack>
            </Card>
          </div>

          {copySuccess ? <Badge color="green" leftSection={<Check size={12} />}>{copySuccess}</Badge> : null}
        </Stack>
      </Card>

      <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
        <Stack gap="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <Shield size={16} />
              <Text fw={600} className={colors.text}>状态与边界</Text>
            </Group>
            <Badge color={effectiveConfig.localOnly ? 'teal' : 'yellow'}>{effectiveSecuritySummary.exposureLabel}</Badge>
          </Group>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card withBorder radius="md">
              <Text size="xs" className={colors.textMuted}>路由模式</Text>
              <Text fw={700} className={colors.text}>{effectiveRoutingSummary.modeLabel}</Text>
            </Card>
            <Card withBorder radius="md">
              <Text size="xs" className={colors.textMuted}>池策略</Text>
              <Text fw={700} className={colors.text}>{effectiveRoutingSummary.strategySummary}</Text>
            </Card>
            <Card withBorder radius="md">
              <Text size="xs" className={colors.textMuted}>Region / 日志级别</Text>
              <Text fw={700} className={colors.text}>{statusSummary.region} / {statusSummary.logLevel}</Text>
            </Card>
            <Card withBorder radius="md">
              <Text size="xs" className={colors.textMuted}>最后同步</Text>
              <Text fw={700} className={colors.text}>{statusSummary.sync}</Text>
            </Card>
          </div>

          <Card withBorder radius="md">
            <Text size="xs" fw={600}>日志目录</Text>
            <Text size="xs" mt={6} style={{ fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>
              {logDir || '尚未获取'}
            </Text>
          </Card>

          <Card withBorder radius="md">
            <Stack gap={8}>
              <Group justify="space-between">
                <Text size="sm" fw={600}>最近风险</Text>
                <Badge color={latestErrorEntry ? 'orange' : 'teal'}>
                  {latestErrorEntry ? '需要排查' : '状态平稳'}
                </Badge>
              </Group>
              {latestErrorEntry ? (
                <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {`首次: ${latestErrorEntry.firstSeenAt}\n最近: ${latestErrorEntry.lastSeenAt}\n次数: ${latestErrorEntry.count}\n${latestErrorEntry.message}`}
                </Code>
              ) : (
                <Text size="sm" className={colors.textMuted}>最近没有流式或上游错误命中。</Text>
              )}
            </Stack>
          </Card>
        </Stack>
      </Card>
    </div>
  )
}

export default GatewayOverviewTab
