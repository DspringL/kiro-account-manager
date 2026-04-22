import { Activity, AlertTriangle, FolderOpen, Radio, RefreshCw, Search, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatGatewayRequestDuration, getGatewayRequestOutcomeColor } from './gatewayPageUtils'
import { GatewayCodeCard, GatewayPathCard, GatewaySectionHeader, GatewayStatCard, GatewaySubCard, GatewaySurfaceCard } from './GatewayShared'

function GatewayMetricListCard({ title, children }) {
  return (
    <GatewaySubCard>
      <div className="text-xs font-semibold">{title}</div>
      <div className="flex flex-col gap-1.5 mt-3">
        {children}
      </div>
    </GatewaySubCard>
  )
}

function GatewayErrorHistoryCard({ errorHistory }) {
  const entries = errorHistory.length
    ? errorHistory
    : [{ message: '暂无流式错误', firstSeenAt: '-', lastSeenAt: '-', count: 1 }]

  return (
    <GatewayCodeCard title="流式 / 上游错误明细">
      <div className="flex flex-col gap-1.5 mt-2">
        {entries.map((item, idx) => (
          <GatewaySubCard key={`${item.message}-${idx}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} />
                <div className="text-sm font-semibold">错误命中 {item.count} 次</div>
              </div>
              <Badge variant="secondary">{item.lastSeenAt}</Badge>
            </div>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words">
              {`首次: ${item.firstSeenAt}\n最近: ${item.lastSeenAt}\n次数: ${item.count}\n${item.message}`}
            </pre>
          </GatewaySubCard>
        ))}
      </div>
    </GatewayCodeCard>
  )
}

function GatewayRequestLogEntry({ colors, item, itemKey }) {
  return (
    <GatewaySubCard key={itemKey}>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Badge variant={item.outcome === 'success' ? 'default' : 'destructive'}>{item.outcome || 'unknown'}</Badge>
              <Badge variant="outline">{item.endpoint || '-'}</Badge>
              <Badge variant="outline" className={item.statusCode >= 400 ? 'border-red-500 text-red-500' : ''}>{item.statusCode || 0}</Badge>
              <Badge variant="outline" className={item.stream ? 'border-blue-500 text-blue-500' : ''}>{item.stream ? 'stream' : 'non-stream'}</Badge>
            </div>
            <div className={`text-sm ${colors.textMuted}`}>
              #{item.requestIndex ?? '-'} · {item.occurredAt || '-'} · {item.clientIp || '-'}
            </div>
          </div>
          <div className={`text-sm font-bold ${colors.text}`}>
            {formatGatewayRequestDuration(item.durationMs)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <GatewayStatCard colors={colors} label="模型 / Region" value={`${item.model || '未记录模型'} / ${item.region || '-'}`} valueProps={{ size: 'sm' }} />
          <GatewayStatCard colors={colors} label="上游来源" value={item.upstreamSource || '未解析上游来源'} valueProps={{ size: 'sm' }} />
          <GatewayStatCard colors={colors} label="客户端 / 计数" value={`${item.clientIp || '-'} / #${item.requestIndex ?? '-'}`} valueProps={{ size: 'sm' }} />
          <GatewayStatCard colors={colors} label="请求类型" value={`${item.stream ? '流式返回' : '非流式返回'} / ${item.endpoint || '-'}`} valueProps={{ size: 'sm' }} />
        </div>

        {item.error ? (
          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words">
            {item.error}
          </pre>
        ) : null}

        {item.requestBody || item.responseBody ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {item.requestBody ? (
              <details open={item.outcome === 'error'}>
                <summary className="cursor-pointer text-sm font-medium">原始请求</summary>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words mt-2">
                  {item.requestBody}
                </pre>
              </details>
            ) : null}

            {item.responseBody ? (
              <details open={item.outcome === 'error'}>
                <summary className="cursor-pointer text-sm font-medium">原始响应</summary>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words mt-2">
                  {item.responseBody}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
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
          <div className="flex flex-col gap-3">
            <GatewaySectionHeader
              colors={colors}
              icon={Shield}
              title="观测总览"
              actions={(
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="flex items-center gap-1">
                    <Radio size={12} />
                    {`账号池 ${effectiveConfig.strategy}`}
                  </Badge>
                  <Badge variant={effectiveConfig.localOnly ? 'default' : 'secondary'}>{effectiveConfig.localOnly ? '仅本机' : '允许远程'}</Badge>
                  <Badge variant={status.running ? 'default' : 'destructive'}>{status.running ? '运行中' : '已停止'}</Badge>
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                    <RefreshCw size={14} className="mr-1" />
                    刷新状态
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearErrors} disabled={!errorHistory.length}>
                    清空错误
                  </Button>
                </div>
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

            <Alert variant={errorHistory.length ? 'default' : 'default'}>
              <AlertTitle>运行摘要</AlertTitle>
              <AlertDescription>
                {`错误历史 ${statusSummary.errorCount}，当前${status.running ? '已启动' : '未启动'}，${hasUnsavedChanges ? '页面存在未保存变更。' : '页面配置已与已保存状态同步。'}`}
              </AlertDescription>
            </Alert>

            <GatewaySubCard>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="text-sm font-semibold">运维建议</div>
                  <Badge variant={filteredRequestLogSummary.errors ? 'secondary' : 'default'}>
                    {filteredRequestLogSummary.errors ? '优先看错误明细' : '优先看请求趋势'}
                  </Badge>
                </div>
                <div className={`text-sm ${colors.textMuted}`}>
                  先看顶部指标判断是否是整体异常，再结合错误聚合确认是鉴权、限流、上游返回还是流式中断；最后下钻到最近请求明细核对状态码、模型、Region、上游来源与错误信息。
                </div>
              </div>
            </GatewaySubCard>
          </div>
        </GatewaySurfaceCard>

        <GatewaySurfaceCard colors={colors}>
          <div className="flex flex-col gap-3">
            <GatewaySectionHeader
              colors={colors}
              title="运维与排障"
              badge={<Badge variant={errorHistory.length ? 'secondary' : 'default'}>{integrationSummary.errorDigest}</Badge>}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <GatewayStatCard colors={colors} label="日志状态" value={integrationSummary.logDirState} />
              <GatewayStatCard colors={colors} label="错误摘要" value={integrationSummary.errorDigest} />
            </div>

            <GatewayPathCard
              value={logDir || '尚未获取'}
              actions={(
                <Button variant="outline" onClick={handleOpenLogDir}>
                  <FolderOpen size={16} className="mr-1" />
                  打开日志目录
                </Button>
              )}
            />

            <GatewayErrorHistoryCard errorHistory={errorHistory} />
          </div>
        </GatewaySurfaceCard>
      </div>

      <div className="flex flex-col gap-4">
        <GatewaySurfaceCard colors={colors}>
          <div className="flex flex-col gap-3">
            <GatewaySectionHeader
              colors={colors}
              icon={Activity}
              title="请求日志"
              actions={(
                <div className="flex items-center gap-2">
                  <Badge variant="default">gateway-request-log.jsonl</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadRequestLogs()}
                    disabled={requestLogsLoading}
                  >
                    <RefreshCw size={14} className="mr-1" />
                    刷新日志
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearRequestLogs}
                    disabled={requestLogsLoading || !requestLogs.length}
                  >
                    清空日志
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenLogDir}
                  >
                    <FolderOpen size={14} className="mr-1" />
                    打开目录
                  </Button>
                </div>
              )}
            />

            <div className={`text-sm ${colors.textMuted}`}>
              这里展示最近 120 条网关请求记录，按时间倒序读取本地 JSONL 文件。最后同步时间：{lastRequestLogsSyncAt}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="outcome-filter">结果过滤</Label>
                <Select value={requestLogOutcome} onValueChange={(value) => setRequestLogOutcome(value || 'all')}>
                  <SelectTrigger id="outcome-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部结果</SelectItem>
                    <SelectItem value="success">仅成功</SelectItem>
                    <SelectItem value="stream">仅流式</SelectItem>
                    <SelectItem value="error">仅错误</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="query-search">关键词搜索</Label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="query-search"
                    placeholder="搜索模型、端点、IP、错误、上游来源或 Region"
                    value={requestLogQuery}
                    onChange={(event) => setRequestLogQuery(event.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <GatewayStatCard colors={colors} label="显示中 / 总记录" value={`${filteredRequestLogSummary.total} / ${requestLogSummary.total}`} />
              <GatewayStatCard colors={colors} label="成功 / 流式" value={`${filteredRequestLogSummary.success} / ${filteredRequestLogSummary.streaming}`} />
              <GatewayStatCard colors={colors} label="错误数" value={filteredRequestLogSummary.errors} />
              <GatewayStatCard colors={colors} label="最新记录 / 最长耗时" value={filteredRequestLogSummary.latestOccurredAt} detail={filteredRequestLogSummary.maxDurationLabel} />
            </div>

            <GatewayPathCard value={logDir || '尚未获取'} />
          </div>
        </GatewaySurfaceCard>

        <GatewaySurfaceCard colors={colors}>
          <div className="flex flex-col gap-3">
            <GatewaySectionHeader
              colors={colors}
              icon={Radio}
              title="统计视图"
              badge={(
                <Badge variant={requestMetrics.errorRateLabel === '0%' ? 'default' : 'secondary'}>
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
                <div className="text-xs font-semibold">端点 / Region</div>
                <div className="flex flex-col gap-2 mt-3">
                  <div>
                    <div className={`text-xs ${colors.textMuted}`}>端点</div>
                    <div className="flex flex-col gap-1.5 mt-1.5">
                      {renderMetricList(requestMetrics.topEndpoints, '暂无端点统计')}
                    </div>
                  </div>
                  <div>
                    <div className={`text-xs ${colors.textMuted}`}>Region</div>
                    <div className="flex flex-col gap-1.5 mt-1.5">
                      {renderMetricList(requestMetrics.topRegions, '暂无 Region 统计')}
                    </div>
                  </div>
                </div>
              </GatewaySubCard>
            </div>
          </div>
        </GatewaySurfaceCard>

        <GatewaySurfaceCard colors={colors}>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className={`font-semibold ${colors.text}`}>最近请求明细</div>
              <Badge variant={filteredRequestLogSummary.errors ? 'destructive' : 'default'}>
                {filteredRequestLogSummary.errors ? `${filteredRequestLogSummary.errors} 条错误` : '无错误记录'}
              </Badge>
            </div>

            {!filteredRequestLogs.length ? (
              <Alert>
                <AlertTitle>暂无请求日志</AlertTitle>
                <AlertDescription>
                  {requestLogs.length
                    ? '当前筛选条件下没有匹配结果，请调整结果过滤或搜索关键词。'
                    : '当前还没有网关请求写入本地日志文件。启动网关并发起请求后，这里会显示最新记录。'}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredRequestLogs.map((item, idx) => (
                  <GatewayRequestLogEntry
                    key={`${item.requestIndex || idx}-${item.occurredAt || idx}`}
                    colors={colors}
                    item={item}
                    itemKey={`${item.requestIndex || idx}-${item.occurredAt || idx}`}
                  />
                ))}
              </div>
            )}
          </div>
        </GatewaySurfaceCard>
      </div>
    </>
  )
}

export default GatewayObservability
