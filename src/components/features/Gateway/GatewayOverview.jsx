import { Check, Copy, FolderOpen, Radio, RefreshCw, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Stack, Group, Badge, Card, Code, Text } from '@/components/shared/layout'
import { GatewayPathCard, GatewaySectionHeader, GatewayStatCard, GatewaySubCard, GatewaySurfaceCard } from './GatewayShared'

function GatewayOverview({
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
  const overviewTone = latestErrorEntry ? 'orange' : actionSummary.tone

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] gap-4">
      <GatewaySurfaceCard colors={colors}>
        <Stack gap="sm">
          <GatewaySectionHeader
            colors={colors}
            icon={Radio}
            title="控制台总览"
            actions={(
              <Button variant="light" size="xs" onClick={handleRefresh}>
                <RefreshCw size={14} className="mr-1" />
                刷新
              </Button>
            )}
            groupProps={{ align: 'flex-start' }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)] gap-3">
            <GatewaySubCard className="h-full">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Text size="xs" className={colors.textMuted}>首屏关注</Text>
                    <Text fw={700} className={colors.text}>先确认入口、暴露范围与风险状态</Text>
                    <Text size="sm" className={colors.textMuted}>
                      当前主入口为 {effectiveBaseUrl}，{effectiveSecuritySummary.exposureLabel}，{effectiveRoutingSummary.modeLabel}。
                    </Text>
                  </Stack>
                  <Badge color={overviewTone}>{latestErrorEntry ? '最近有风险' : actionSummary.title}</Badge>
                </Group>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <GatewayStatCard colors={colors} label="客户端入口" value={effectiveBaseUrl} />
                  <GatewayStatCard colors={colors} label="客户端鉴权" value={effectiveSecuritySummary.apiKeyState} />
                  <GatewayStatCard colors={colors} label={effectiveRoutingSummary.selectionLabel} value={effectiveRoutingSummary.selectionValue} />
                  <GatewayStatCard colors={colors} label="请求计数 / 错误" value={`${statusSummary.requests} / ${statusSummary.errorCount}`} />
                </div>
              </Stack>
            </GatewaySubCard>

            <GatewaySubCard className="h-full">
              <Stack gap={8}>
                <Text size="xs" className={colors.textMuted}>本轮主操作</Text>
                <Text fw={700} className={colors.text}>先保存，再决定是否重启</Text>
                <Text size="sm" className={colors.textMuted}>
                  {actionSummary.description}
                </Text>
                <Group gap="xs">
                  <Badge color={effectiveConfig.localOnly ? 'teal' : 'yellow'}>{effectiveSecuritySummary.exposureLabel}</Badge>
                  <Badge color={latestErrorEntry ? 'orange' : 'green'}>{latestErrorEntry ? '优先排查错误' : '可继续接入验证'}</Badge>
                </Group>
              </Stack>
            </GatewaySubCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <GatewayStatCard colors={colors} label="客户端入口" value={effectiveBaseUrl} />
            <GatewayStatCard colors={colors} label="暴露范围" value={effectiveSecuritySummary.exposureLabel} />
            <GatewayStatCard colors={colors} label="路由模式" value={effectiveRoutingSummary.modeLabel} />
            <GatewayStatCard colors={colors} label="Region / 日志级别" value={`${statusSummary.region} / ${statusSummary.logLevel}`} />
          </div>

          <GatewaySubCard>
            <Stack gap={8}>
              <Group justify="space-between">
                <Text size="sm" fw={600}>当前建议动作</Text>
                <Badge color={overviewTone}>{latestErrorEntry ? '建议先看风险' : actionSummary.title}</Badge>
              </Group>
              <Text size="sm" className={colors.textMuted}>
                {latestErrorEntry
                  ? '最近存在错误命中，建议先看右侧风险卡片和观测页错误历史，再决定是否重启或继续放量。'
                  : actionSummary.description}
              </Text>
            </Stack>
          </GatewaySubCard>

          <GatewaySubCard>
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
          </GatewaySubCard>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <GatewaySubCard>
              <Stack gap={8}>
                <Text size="xs" className={colors.textMuted}>快速复制</Text>
                <Text fw={700} className={colors.text}>基础入口</Text>
                <Button variant="light" size="xs" onClick={() => copyText(effectiveBaseUrl, '网关入口已复制')}>
                  <Copy size={14} className="mr-1" />
                  复制入口地址
                </Button>
              </Stack>
            </GatewaySubCard>
            <GatewaySubCard>
              <Stack gap={8}>
                <Text size="xs" className={colors.textMuted}>OpenAI 兼容接入</Text>
                <Text fw={700} className={colors.text}>OpenAI Responses 兼容</Text>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => copyText(clientSamples.openai.env, 'OpenAI 兼容配置已复制')}
                >
                  <Copy size={14} className="mr-1" />
                  复制 OpenAI 兼容环境变量
                </Button>
              </Stack>
            </GatewaySubCard>
            <GatewaySubCard>
              <Stack gap={8}>
                <Text size="xs" className={colors.textMuted}>排障入口</Text>
                <Text fw={700} className={colors.text}>日志目录</Text>
                <Button variant="light" size="xs" onClick={handleOpenLogDir}>
                  <FolderOpen size={14} className="mr-1" />
                  打开日志目录
                </Button>
              </Stack>
            </GatewaySubCard>
          </div>

          {copySuccess ? <Badge color="green"><Check size={12} className="mr-1" />{copySuccess}</Badge> : null}
        </Stack>
      </GatewaySurfaceCard>

      <GatewaySurfaceCard colors={colors}>
        <Stack gap="sm">
          <GatewaySectionHeader
            colors={colors}
            icon={Shield}
            title="状态与边界"
            badge={<Badge color={effectiveConfig.localOnly ? 'teal' : 'yellow'}>{effectiveSecuritySummary.exposureLabel}</Badge>}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GatewayStatCard colors={colors} label="路由模式" value={effectiveRoutingSummary.modeLabel} detail={effectiveRoutingSummary.selectionValue} />
            <GatewayStatCard colors={colors} label="池策略" value={effectiveRoutingSummary.strategySummary} />
            <GatewayStatCard colors={colors} label="运行快照" value={`${statusSummary.requests} 次请求`} detail={statusSummary.listen} />
            <GatewayStatCard colors={colors} label="最后同步" value={statusSummary.sync} />
          </div>

          <GatewayPathCard value={logDir || '尚未获取'} />

          <GatewaySubCard>
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
          </GatewaySubCard>
        </Stack>
      </GatewaySurfaceCard>
    </div>
  )
}

export default GatewayOverview
