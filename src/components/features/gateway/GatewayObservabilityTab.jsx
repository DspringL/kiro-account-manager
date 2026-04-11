import { Activity, AlertTriangle, FolderOpen, Radio, RefreshCw, Search, Shield } from 'lucide-react'
import { Alert, Badge, Button, Card, Code, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { formatGatewayRequestDuration, getGatewayRequestOutcomeColor } from '../gatewayPageUtils'

function GatewayObservabilityTab({
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
          <Card key={item.label} withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
            <Text size="xs" className={colors.textMuted}>{item.label}</Text>
            <Text fw={700} className={colors.text} mt={4}>{item.value}</Text>
            <Text size="sm" className={colors.textMuted} mt={6}>{item.detail}</Text>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] gap-4">
        <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Shield size={16} />
                <Text fw={600} className={colors.text}>观测总览</Text>
              </Group>
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
            </Group>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>监听地址</Text>
                <Text fw={700} className={colors.text}>{statusSummary.listen}</Text>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>请求计数</Text>
                <Text fw={700} className={colors.text}>{statusSummary.requests}</Text>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>路由策略</Text>
                <Text fw={700} className={colors.text}>{statusSummary.routing}</Text>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>暴露范围</Text>
                <Text fw={700} className={colors.text}>{statusSummary.exposure}</Text>
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

            <Alert color={errorHistory.length ? 'orange' : 'teal'} variant="light" title="运行摘要">
              {`错误历史 ${statusSummary.errorCount}，当前${status.running ? '已启动' : '未启动'}，${hasUnsavedChanges ? '页面存在未保存变更。' : '页面配置已与已保存状态同步。'}`}
            </Alert>

            <Card withBorder radius="md">
              <Stack gap={8}>
                <Group justify="space-between">
                  <Text size="sm" fw={600}>运维建议</Text>
                  <Badge color={filteredRequestLogSummary.errors ? 'orange' : 'teal'}>
                    {filteredRequestLogSummary.errors ? '优先看错误明细' : '优先看请求趋势'}
                  </Badge>
                </Group>
                <Text size="sm" className={colors.textMuted}>
                  先看顶部指标判断是否是整体异常，再结合错误聚合确认是鉴权、限流、上游返回还是流式中断；最后下钻到最近请求明细核对请求体、响应体和上游来源。
                </Text>
              </Stack>
            </Card>
          </Stack>
        </Card>

        <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm" fw={600}>运维与排障</Text>
              <Badge color={errorHistory.length ? 'orange' : 'teal'}>{integrationSummary.errorDigest}</Badge>
            </Group>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>日志状态</Text>
                <Text fw={700} className={colors.text}>{integrationSummary.logDirState}</Text>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>错误摘要</Text>
                <Text fw={700} className={colors.text}>{integrationSummary.errorDigest}</Text>
              </Card>
            </div>

            <Card withBorder radius="md">
              <Text size="xs" fw={600}>日志目录</Text>
              <Text size="xs" mt={6} style={{ fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>
                {logDir || '尚未获取'}
              </Text>
              <Group mt="sm" gap="xs">
                <Button variant="light" leftSection={<FolderOpen size={16} />} onClick={handleOpenLogDir}>
                  打开日志目录
                </Button>
              </Group>
            </Card>

            <Card withBorder radius="md">
              <Text size="xs" fw={600}>流式 / 上游错误明细</Text>
              <Stack gap={6} mt="xs">
                {(errorHistory.length ? errorHistory : [{ message: '暂无流式错误', firstSeenAt: '-', lastSeenAt: '-', count: 1 }]).map((item, idx) => (
                  <Card key={`${item.message}-${idx}`} withBorder radius="md">
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
                  </Card>
                ))}
              </Stack>
            </Card>
          </Stack>
        </Card>
      </div>

      <Stack gap="md">
        <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Activity size={16} />
                <Text fw={600} className={colors.text}>请求日志</Text>
              </Group>
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
            </Group>

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
                placeholder="搜索模型、端点、IP、错误、原始请求或原始响应"
                value={requestLogQuery}
                onChange={(event) => setRequestLogQuery(event.currentTarget.value)}
                leftSection={<Search size={14} />}
                classNames={inputClassNames}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>显示中 / 总记录</Text>
                <Text fw={700} className={colors.text}>{filteredRequestLogSummary.total} / {requestLogSummary.total}</Text>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>成功 / 流式</Text>
                <Text fw={700} className={colors.text}>{filteredRequestLogSummary.success} / {filteredRequestLogSummary.streaming}</Text>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>错误数</Text>
                <Text fw={700} className={colors.text}>{filteredRequestLogSummary.errors}</Text>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>最新记录 / 最长耗时</Text>
                <Text fw={700} className={colors.text}>{filteredRequestLogSummary.latestOccurredAt}</Text>
                <Text size="sm" className={colors.textMuted} mt={4}>{filteredRequestLogSummary.maxDurationLabel}</Text>
              </Card>
            </div>

            <Card withBorder radius="md">
              <Text size="xs" fw={600}>日志目录</Text>
              <Text size="xs" mt={6} style={{ fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>
                {logDir || '尚未获取'}
              </Text>
            </Card>
          </Stack>
        </Card>

        <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Radio size={16} />
                <Text fw={600} className={colors.text}>统计视图</Text>
              </Group>
              <Badge color={requestMetrics.errorRateLabel === '0%' ? 'teal' : 'orange'}>
                成功率 {requestMetrics.successRateLabel} / 错误率 {requestMetrics.errorRateLabel}
              </Badge>
            </Group>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>平均耗时</Text>
                <Text fw={700} className={colors.text}>{requestMetrics.avgDurationLabel}</Text>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>模型数</Text>
                <Text fw={700} className={colors.text}>{requestMetrics.uniqueModels}</Text>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>上游来源数</Text>
                <Text fw={700} className={colors.text}>{requestMetrics.uniqueUpstreams}</Text>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>统计样本</Text>
                <Text fw={700} className={colors.text}>{requestMetrics.total}</Text>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <Card withBorder radius="md">
                <Text size="xs" fw={600}>热门模型</Text>
                <Stack mt="sm" gap={6}>
                  {renderMetricList(requestMetrics.topModels, '暂无模型统计')}
                </Stack>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" fw={600}>热门上游来源</Text>
                <Stack mt="sm" gap={6}>
                  {renderMetricList(requestMetrics.topUpstreams, '暂无上游来源统计')}
                </Stack>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" fw={600}>状态码分布</Text>
                <Stack mt="sm" gap={6}>
                  {renderMetricList(requestMetrics.topStatuses, '暂无状态码统计')}
                </Stack>
              </Card>
              <Card withBorder radius="md">
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
              </Card>
            </div>
          </Stack>
        </Card>

        <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
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
                  <Card
                    key={`${item.requestIndex || idx}-${item.occurredAt || idx}`}
                    withBorder
                    radius="md"
                  >
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
                        <Card withBorder radius="md">
                          <Text size="xs" className={colors.textMuted}>模型 / Region</Text>
                          <Text size="sm" fw={600} className={colors.text}>
                            {item.model || '未记录模型'} / {item.region || '-'}
                          </Text>
                        </Card>
                        <Card withBorder radius="md">
                          <Text size="xs" className={colors.textMuted}>上游来源</Text>
                          <Text size="sm" fw={600} className={colors.text}>
                            {item.upstreamSource || '未解析上游来源'}
                          </Text>
                        </Card>
                        <Card withBorder radius="md">
                          <Text size="xs" className={colors.textMuted}>客户端 / 计数</Text>
                          <Text size="sm" fw={600} className={colors.text}>
                            {item.clientIp || '-'} / #{item.requestIndex ?? '-'}
                          </Text>
                        </Card>
                        <Card withBorder radius="md">
                          <Text size="xs" className={colors.textMuted}>请求类型</Text>
                          <Text size="sm" fw={600} className={colors.text}>
                            {item.stream ? '流式返回' : '非流式返回'} / {item.endpoint || '-'}
                          </Text>
                        </Card>
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
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      </Stack>
    </>
  )
}

export default GatewayObservabilityTab
