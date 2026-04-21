import { Activity, AlertTriangle, FolderOpen, Radio, RefreshCw, Search, Shield } from 'lucide-react'
import { Alert, Badge, Button, Card, Code, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { formatGatewayRequestDuration, getGatewayRequestOutcomeColor } from './gatewayPageUtils'
import { GatewayCodeCard, GatewayPathCard, GatewaySectionHeader, GatewayStatCard, GatewaySubCard, GatewaySurfaceCard } from './GatewayShared'

function GatewayMetricListCard({ title, children }) {
  return (
    <GatewaySubCard>
      <Text size="xs" fw={600}>{title}</Text>
      <Stack mt="sm" gap={6}>
        {children}
      </Stack>
    </GatewaySubCard>
  )
}

function GatewayErrorHistoryCard({ errorHistory }) {
  const entries = errorHistory.length
    ? errorHistory
    : [{ message: '暂无流式错误', firstSeenAt: '-', lastSeenAt: '-', count: 1 }]

  return (
    <GatewayCodeCard title="流式 / 上游错误明细">
      <Stack gap={6} mt="xs">
        {entries.map((item, idx) => (
          <GatewaySubCard key={`${item.message}-${idx}`}>
            <Group justify="space-between" align="flex-start" mb="xs">
              <Group gap="xs">
                <AlertTriangle size={14} />
                <Text size="sm" fw={600}>错误命中 {item.count} 次</Text>
              </Group>
              <Badge color="orange">{item.lastSeenAt}</Badge>
            </Group>
            <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {`首次: ${item.firstSeenAt}\n最近: ${item.lastSeenAt}\n次数: ${item.count}\n${item.message}`}
            </Code>
          </GatewaySubCard>
        ))}
      </Stack>
    </GatewayCodeCard>
  )
}

function GatewayRequestLogEntry({ colors, item, itemKey }) {
  return (
    <GatewaySubCard key={itemKey}>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Group gap="xs">
              <Badge color={getGatewayRequestOutcomeColor(item.outcome)}>{item.outcome || 'unknown'}</Badge>
              <Badge variant="light">{item.endpoint || '-'}</Badge>
              <Badge variant="light" color={item.statusCode >= 400 ? 'red' : 'gray'}>{item.statusCode || 0}</Badge>
              <Badge variant="light" color={item.stream ? 'blue' : 'gray'}>{item.stream ? 'stream' : 'non-stream'}</Badge>
            </Group>
            <Text size="sm" className={colors.textMuted}>
              #{item.requestIndex ?? '-'} · {item.occurredAt || '-'} · {item.clientIp || '-'}
            </Text>
          </Stack>
          <Text size="sm" fw={700} className={colors.text}>
            {formatGatewayRequestDuration(item.durationMs)}
          </Text>
        </Group>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <GatewayStatCard colors={colors} label="模型 / Region" value={`${item.model || '未记录模型'} / ${item.region || '-'}`} valueProps={{ size: 'sm' }} />
          <GatewayStatCard colors={colors} label="上游来源" value={item.upstreamSource || '未解析上游来源'} valueProps={{ size: 'sm' }} />
          <GatewayStatCard colors={colors} label="客户端 / 计数" value={`${item.clientIp || '-'} / #${item.requestIndex ?? '-'}`} valueProps={{ size: 'sm' }} />
          <GatewayStatCard colors={colors} label="请求类型" value={`${item.stream ? '流式返回' : '非流式返回'} / ${item.endpoint || '-'}`} valueProps={{ size: 'sm' }} />
        </div>

        {item.error ? (
          <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {item.error}
          </Code>
        ) : null}

        {item.requestBody || item.responseBody ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {item.requestBody ? (
              <details open={item.outcome === 'error'}>
                <summary className="cursor-pointer text-sm font-medium">原始请求</summary>
                <Code block mt="xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {item.requestBody}
                </Code>
              </details>
            ) : null}

            {item.responseBody ? (
              <details open={item.outcome === 'error'}>
                <summary className="cursor-pointer text-sm font-medium">原始响应</summary>
                <Code block mt="xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {item.responseBody}
                </Code>
              </details>
            ) : null}
          </div>
        ) : null}
      </Stack>
    </GatewaySubCard>
  )
}

function GatewayObservability({
  colors,
  observabilityHighlights,
  effectiveConfig,
  status,
  loading,
  handleRefresh,
  handleClearErrors,
  errorHistory,
  statusSummary,
  hasUnsavedChanges,
  filteredRequestLogSummary,
  integrationSummary,
  logDir,
  handleOpenLogDir,
  loadRequestLogs,
  requestLogsLoading,
  handleClearRequestLogs,
  requestLogs,
  lastRequestLogsSyncAt,
  requestLogOutcome,
  setRequestLogOutcome,
  selectClassNames,
  requestLogQuery,
  setRequestLogQuery,
  inputClassNames,
  requestLogSummary,
  requestMetrics,
  renderMetricList,
  filteredRequestLogs,
}) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {observabilityHighlights.map((item) => (
          <GatewayStatCard
            key={item.label}
            colors={colors}
            label={item.label}
            value={item.value}
            detail={item.detail}
            className={`${colors.card} ${colors.cardBorder}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] gap-4">
        <GatewaySurfaceCard colors={colors}>
          <Stack gap="sm">
            <GatewaySectionHeader
              colors={colors}
              icon={Shield}
              title="观测总览"
              actions={(
                <Group gap="xs">
                  <Badge color="blue" leftSection={<Radio size={12} />}>{`账号池 ${effectiveConfig.strategy}`}</Badge>
                  <Badge color={effectiveConfig.localOnly ? 'teal' : 'yellow'}>{effectiveConfig.localOnly ? '仅本机' : '允许远程'}</Badge>
                  <Badge color={status.running ? 'green' : 'red'}>{status.running ? '运行中' : '已停止'}</Badge>
                  <Button variant="light" size="xs" leftSection={<RefreshCw size={14} />} onClick={handleRefresh} loading={loading}>
                    刷新状态
                  </Button>
                  <Button variant="light" size="xs" color="gray" onClick={handleClearErrors} disabled={!errorHistory.length}>
                    清空错误
                  </Button>
                </Group>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <GatewayStatCard colors={colors} label="监听地址" value={statusSummary.listen} />
              <GatewayStatCard colors={colors} label="请求计数" value={statusSummary.requests} />
              <GatewayStatCard colors={colors} label="路由策略" value={statusSummary.routing} />
              <GatewayStatCard colors={colors} label="暴露范围" value={statusSummary.exposure} />
              <GatewayStatCard colors={colors} label="Region / 日志级别" value={`${statusSummary.region} / ${statusSummary.logLevel}`} />
              <GatewayStatCard colors={colors} label="最后同步" value={statusSummary.sync} />
            </div>

            <Alert color={errorHistory.length ? 'orange' : 'teal'} variant="light" title="运行摘要">
              {`错误历史 ${statusSummary.errorCount}，当前${status.running ? '已启动' : '未启动'}，${hasUnsavedChanges ? '页面存在未保存变更。' : '页面配置已与已保存状态同步。'}`}
            </Alert>

            <GatewaySubCard>
              <Stack gap={8}>
                <Group justify="space-between">
                  <Text size="sm" fw={600}>运维建议</Text>
                  <Badge color={filteredRequestLogSummary.errors ? 'orange' : 'teal'}>
                    {filteredRequestLogSummary.errors ? '优先看错误明细' : '优先看请求趋势'}
                  </Badge>
                </Group>
                <Text size="sm" className={colors.textMuted}>
                  先看顶部指标判断是否是整体异常，再结合错误聚合确认是鉴权、限流、上游返回还是流式中断；最后下钻到最近请求明细核对状态码、模型、Region、上游来源与错误信息。
                </Text>
              </Stack>
            </GatewaySubCard>
          </Stack>
        </GatewaySurfaceCard>

        <GatewaySurfaceCard colors={colors}>
          <Stack gap="sm">
            <GatewaySectionHeader
              colors={colors}
              title="运维与排障"
              badge={<Badge color={errorHistory.length ? 'orange' : 'teal'}>{integrationSummary.errorDigest}</Badge>}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <GatewayStatCard colors={colors} label="日志状态" value={integrationSummary.logDirState} />
              <GatewayStatCard colors={colors} label="错误摘要" value={integrationSummary.errorDigest} />
            </div>

            <GatewayPathCard
              value={logDir || '尚未获取'}
              actions={(
                <Button variant="light" leftSection={<FolderOpen size={16} />} onClick={handleOpenLogDir}>
                  打开日志目录
                </Button>
              )}
            />

            <GatewayErrorHistoryCard errorHistory={errorHistory} />
          </Stack>
        </GatewaySurfaceCard>
      </div>

      <Stack gap="md">
        <GatewaySurfaceCard colors={colors}>
          <Stack gap="sm">
            <GatewaySectionHeader
              colors={colors}
              icon={Activity}
              title="请求日志"
              actions={(
                <Group gap="xs">
                  <Badge color="indigo">gateway-request-log.jsonl</Badge>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<RefreshCw size={14} />}
                    onClick={() => loadRequestLogs()}
                    loading={requestLogsLoading}
                  >
                    刷新日志
                  </Button>
                  <Button
                    variant="light"
                    size="xs"
                    color="red"
                    onClick={handleClearRequestLogs}
                    loading={requestLogsLoading}
                    disabled={!requestLogs.length}
                  >
                    清空日志
                  </Button>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<FolderOpen size={14} />}
                    onClick={handleOpenLogDir}
                  >
                    打开目录
                  </Button>
                </Group>
              )}
            />

            <Text size="sm" className={colors.textMuted}>
              这里展示最近 120 条网关请求记录，按时间倒序读取本地 JSONL 文件。最后同步时间：{lastRequestLogsSyncAt}
            </Text>

            <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-3">
              <Select
                label="结果过滤"
                data={[
                  { value: 'all', label: '全部结果' },
                  { value: 'success', label: '仅成功' },
                  { value: 'stream', label: '仅流式' },
                  { value: 'error', label: '仅错误' },
                ]}
                value={requestLogOutcome}
                onChange={(value) => setRequestLogOutcome(value || 'all')}
                classNames={selectClassNames}
              />
              <TextInput
                label="关键词搜索"
                placeholder="搜索模型、端点、IP、错误、上游来源或 Region"
                value={requestLogQuery}
                onChange={(event) => setRequestLogQuery(event.currentTarget.value)}
                leftSection={<Search size={14} />}
                classNames={inputClassNames}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <GatewayStatCard colors={colors} label="显示中 / 总记录" value={`${filteredRequestLogSummary.total} / ${requestLogSummary.total}`} />
              <GatewayStatCard colors={colors} label="成功 / 流式" value={`${filteredRequestLogSummary.success} / ${filteredRequestLogSummary.streaming}`} />
              <GatewayStatCard colors={colors} label="错误数" value={filteredRequestLogSummary.errors} />
              <GatewayStatCard colors={colors} label="最新记录 / 最长耗时" value={filteredRequestLogSummary.latestOccurredAt} detail={filteredRequestLogSummary.maxDurationLabel} />
            </div>

            <GatewayPathCard value={logDir || '尚未获取'} />
          </Stack>
        </GatewaySurfaceCard>

        <GatewaySurfaceCard colors={colors}>
          <Stack gap="sm">
            <GatewaySectionHeader
              colors={colors}
              icon={Radio}
              title="统计视图"
              badge={(
                <Badge color={requestMetrics.errorRateLabel === '0%' ? 'teal' : 'orange'}>
                  成功率 {requestMetrics.successRateLabel} / 错误率 {requestMetrics.errorRateLabel}
                </Badge>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <GatewayStatCard colors={colors} label="平均耗时" value={requestMetrics.avgDurationLabel} />
              <GatewayStatCard colors={colors} label="模型数" value={requestMetrics.uniqueModels} />
              <GatewayStatCard colors={colors} label="上游来源数" value={requestMetrics.uniqueUpstreams} />
              <GatewayStatCard colors={colors} label="统计样本" value={requestMetrics.total} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <GatewayMetricListCard title="热门模型">
                {renderMetricList(requestMetrics.topModels, '暂无模型统计')}
              </GatewayMetricListCard>
              <GatewayMetricListCard title="热门上游来源">
                {renderMetricList(requestMetrics.topUpstreams, '暂无上游来源统计')}
              </GatewayMetricListCard>
              <GatewayMetricListCard title="状态码分布">
                {renderMetricList(requestMetrics.topStatuses, '暂无状态码统计')}
              </GatewayMetricListCard>
              <GatewaySubCard>
                <Text size="xs" fw={600}>端点 / Region</Text>
                <Stack mt="sm" gap="xs">
                  <div>
                    <Text size="xs" className={colors.textMuted}>端点</Text>
                    <Stack mt={6} gap={6}>
                      {renderMetricList(requestMetrics.topEndpoints, '暂无端点统计')}
                    </Stack>
                  </div>
                  <div>
                    <Text size="xs" className={colors.textMuted}>Region</Text>
                    <Stack mt={6} gap={6}>
                      {renderMetricList(requestMetrics.topRegions, '暂无 Region 统计')}
                    </Stack>
                  </div>
                </Stack>
              </GatewaySubCard>
            </div>
          </Stack>
        </GatewaySurfaceCard>

        <GatewaySurfaceCard colors={colors}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600} className={colors.text}>最近请求明细</Text>
              <Badge color={filteredRequestLogSummary.errors ? 'red' : 'teal'}>
                {filteredRequestLogSummary.errors ? `${filteredRequestLogSummary.errors} 条错误` : '无错误记录'}
              </Badge>
            </Group>

            {!filteredRequestLogs.length ? (
              <Alert color="gray" variant="light" title="暂无请求日志">
                {requestLogs.length
                  ? '当前筛选条件下没有匹配结果，请调整结果过滤或搜索关键词。'
                  : '当前还没有网关请求写入本地日志文件。启动网关并发起请求后，这里会显示最新记录。'}
              </Alert>
            ) : (
              <Stack gap="sm">
                {filteredRequestLogs.map((item, idx) => (
                  <GatewayRequestLogEntry
                    key={`${item.requestIndex || idx}-${item.occurredAt || idx}`}
                    colors={colors}
                    item={item}
                    itemKey={`${item.requestIndex || idx}-${item.occurredAt || idx}`}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </GatewaySurfaceCard>
      </Stack>
    </>
  )
}

export default GatewayObservability
