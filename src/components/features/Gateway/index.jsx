import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Activity, Play, RotateCcw, Square } from 'lucide-react'
import { Alert, Badge, Button, Card, Group, Stack, Tabs, Text } from '@mantine/core'
import { useApp } from '../../../hooks/useApp'
import GatewayAdvanced from './GatewayAdvanced'
import GatewayIntegration from './GatewayIntegration'
import GatewayObservability from './GatewayObservability'
import GatewayOverview from './GatewayOverview'
import { applyGatewayLocalOnlyChange, buildClientSamples, buildGatewayActionSummary, buildGatewayBaseUrl, buildGatewayConnectHost, buildGatewayIntegrationSummary, buildGatewayMetricsSummary, buildGatewayRequestLogSummary, buildGatewayRoutingSummary, buildGatewaySecuritySummary, buildGatewayStatusSummary, createGatewayFieldErrors, filterGatewayRequestLogs, formatGatewayAccountOptionLabel, formatGatewayTimestamp, mergeErrorHistory } from './gatewayPageUtils'
import {
  buildGatewayConfigSnapshot,
  buildGatewayRuntimeSnapshot,
  buildGatewayStatusState,
  clearGatewayRequestLogs,
  DEFAULT_GATEWAY_CONFIG,
  DEFAULT_GATEWAY_STATUS,
  fetchGatewayRequestLogs,
  hydrateGatewayConfig,
  loadGatewayPageData,
  openGatewayLogDir,
  saveGatewayConfig,
  startGateway,
  stopGateway,
} from './gatewayPageState'
import { useGatewayPolling } from './useGatewayPolling'

function ThemedAlert({ colors, title, children, ...props }) {
  return (
    <Alert
      {...props}
      title={<span className={colors.text}>{title}</span>}
    >
      {typeof children === 'string' ? (
        <Text size="sm" className={colors.textMuted}>
          {children}
        </Text>
      ) : children}
    </Alert>
  )
}

function GatewayPage() {
  const { colors } = useApp()
  const [config, setConfig] = useState(DEFAULT_GATEWAY_CONFIG)
  const [status, setStatus] = useState(DEFAULT_GATEWAY_STATUS)
  const [errorHistory, setErrorHistory] = useState([])
  const [accounts, setAccounts] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copySuccess, setCopySuccess] = useState('')
  const [logDir, setLogDir] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [requestLogs, setRequestLogs] = useState([])
  const [requestLogsLoading, setRequestLogsLoading] = useState(false)
  const [requestLogOutcome, setRequestLogOutcome] = useState('all')
  const [requestLogQuery, setRequestLogQuery] = useState('')
  const [lastRequestLogsSyncAt, setLastRequestLogsSyncAt] = useState('-')
  const [savedConfigSnapshot, setSavedConfigSnapshot] = useState(() => buildGatewayConfigSnapshot(DEFAULT_GATEWAY_CONFIG))
  const [appliedRuntimeSnapshot, setAppliedRuntimeSnapshot] = useState(null)
  const [lastStatusSyncAt, setLastStatusSyncAt] = useState('-')

  const accountOptions = useMemo(
    () => accounts.map(account => ({
      value: account.id,
      label: formatGatewayAccountOptionLabel(account),
    })),
    [accounts]
  )

  const groupOptions = useMemo(
    () => groups.map(group => ({ value: group.id, label: group.name })),
    [groups]
  )

  const fieldErrors = useMemo(() => createGatewayFieldErrors(config), [config])
  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  const configSnapshot = useMemo(() => buildGatewayConfigSnapshot(config), [config])
  const runtimeSnapshot = useMemo(() => buildGatewayRuntimeSnapshot(config), [config])
  const hasUnsavedChanges = configSnapshot !== savedConfigSnapshot
  const hasRuntimeChanges = !!status.running && !!appliedRuntimeSnapshot && runtimeSnapshot !== appliedRuntimeSnapshot
  const effectiveConfig = useMemo(
    () => (status.running && status.runtimeConfig ? status.runtimeConfig : config),
    [status.running, status.runtimeConfig, config]
  )
  const effectiveBaseUrl = useMemo(
    () => buildGatewayBaseUrl(effectiveConfig.host, effectiveConfig.port, effectiveConfig.localOnly),
    [effectiveConfig.host, effectiveConfig.port, effectiveConfig.localOnly]
  )
  const effectiveConnectHost = useMemo(
    () => buildGatewayConnectHost(effectiveConfig.host, effectiveConfig.localOnly),
    [effectiveConfig.host, effectiveConfig.localOnly]
  )
  const clientSamples = useMemo(
    () => buildClientSamples(effectiveBaseUrl, effectiveConfig.clientApiKeysText || effectiveConfig.apiKey),
    [effectiveBaseUrl, effectiveConfig.clientApiKeysText, effectiveConfig.apiKey]
  )
  const statusSummary = useMemo(
    () => buildGatewayStatusSummary({ config: effectiveConfig, status, errorHistory, lastStatusSyncAt }),
    [effectiveConfig, status, errorHistory, lastStatusSyncAt]
  )
  const actionSummary = useMemo(
    () => buildGatewayActionSummary({ running: status.running, hasUnsavedChanges, hasRuntimeChanges, hasFieldErrors }),
    [status.running, hasUnsavedChanges, hasRuntimeChanges, hasFieldErrors]
  )
  const securitySummary = useMemo(
    () => buildGatewaySecuritySummary({ config }),
    [config]
  )
  const effectiveSecuritySummary = useMemo(
    () => buildGatewaySecuritySummary({ config: effectiveConfig }),
    [effectiveConfig]
  )
  const integrationSummary = useMemo(
    () => buildGatewayIntegrationSummary({
      baseUrl: effectiveBaseUrl,
      clientApiKeysText: effectiveConfig.clientApiKeysText || effectiveConfig.apiKey,
      logDir,
      errorHistory,
    }),
    [effectiveBaseUrl, effectiveConfig.clientApiKeysText, effectiveConfig.apiKey, logDir, errorHistory]
  )
  const deferredRequestLogQuery = useDeferredValue(requestLogQuery)
  const isObservabilityTab = activeTab === 'observability'
  const requestLogSummary = useMemo(
    () => isObservabilityTab ? buildGatewayRequestLogSummary(requestLogs) : buildGatewayRequestLogSummary([]),
    [isObservabilityTab, requestLogs]
  )
  const filteredRequestLogs = useMemo(
    () => isObservabilityTab
      ? filterGatewayRequestLogs(requestLogs, { outcome: requestLogOutcome, query: deferredRequestLogQuery })
      : [],
    [isObservabilityTab, requestLogs, requestLogOutcome, deferredRequestLogQuery]
  )
  const filteredRequestLogSummary = useMemo(
    () => buildGatewayRequestLogSummary(filteredRequestLogs),
    [filteredRequestLogs]
  )
  const requestMetrics = useMemo(
    () => buildGatewayMetricsSummary(filteredRequestLogs),
    [filteredRequestLogs]
  )
  const routingSummary = useMemo(
    () => buildGatewayRoutingSummary({
      config,
      counts: {
        accounts: accounts.length,
        groups: groups.length,
      },
      selectedLabels: {
        single: accountOptions.find(item => item.value === config.accountId)?.label,
        group: groupOptions.find(item => item.value === config.groupId)?.label,
      },
    }),
    [config, accounts.length, groups.length, accountOptions, groupOptions]
  )
  const effectiveRoutingSummary = useMemo(() => buildGatewayRoutingSummary({
    config: effectiveConfig,
    counts: {
      accounts: accounts.length,
      groups: groups.length,
    },
    selectedLabels: {
      single: accountOptions.find(item => item.value === effectiveConfig.accountId)?.label,
      group: groupOptions.find(item => item.value === effectiveConfig.groupId)?.label,
    },
  }), [effectiveConfig, accounts.length, groups.length, accountOptions, groupOptions])

  const latestErrorEntry = useMemo(
    () => errorHistory[0] || null,
    [errorHistory]
  )
  const runtimeBadgeColor = status.running ? 'green' : 'gray'
  const endpointBadgeColor = effectiveConfig.localOnly ? 'teal' : 'yellow'
  const consoleHighlights = useMemo(() => ([
    {
      label: '当前入口',
      value: effectiveBaseUrl,
      detail: `${effectiveConfig.localOnly ? '仅本机访问' : '允许远程访问'} · ${status.running ? '运行中' : '待启动'}`,
    },
    {
      label: '客户端 Key',
      value: effectiveSecuritySummary.apiKeyState,
      detail: integrationSummary.authLabel,
    },
    {
      label: '路由模式',
      value: effectiveRoutingSummary.modeLabel,
      detail: `${effectiveRoutingSummary.selectionLabel}：${effectiveRoutingSummary.selectionValue}`,
    },
    {
      label: '最近风险',
      value: latestErrorEntry ? '需要排查' : '状态平稳',
      detail: latestErrorEntry?.message || `最后同步 ${lastStatusSyncAt}`,
    },
    {
      label: '观测样本',
      value: `${requestLogSummary.total} 条请求`,
      detail: `成功率 ${requestMetrics.successRateLabel} · 错误率 ${requestMetrics.errorRateLabel}`,
    },
    {
      label: '运行差异',
      value: hasRuntimeChanges ? '需重启生效' : '运行态已对齐',
      detail: hasUnsavedChanges ? '页面有未保存配置' : '配置已保存',
    },
  ]), [
    effectiveBaseUrl,
    effectiveConfig.localOnly,
    status.running,
    effectiveSecuritySummary.apiKeyState,
    integrationSummary.authLabel,
    effectiveRoutingSummary.modeLabel,
    effectiveRoutingSummary.selectionLabel,
    effectiveRoutingSummary.selectionValue,
    latestErrorEntry,
    lastStatusSyncAt,
    requestLogSummary.total,
    requestMetrics.successRateLabel,
    requestMetrics.errorRateLabel,
    hasRuntimeChanges,
    hasUnsavedChanges,
  ])
  const operationsChecklist = useMemo(() => {
    const checks = [
      {
        label: '配置健康',
        status: hasFieldErrors ? '待修正' : '正常',
        tone: hasFieldErrors ? 'red' : 'green',
        detail: hasFieldErrors ? '存在表单错误，保存和启动会被拦截。' : '当前表单字段满足网关启动要求。',
      },
      {
        label: '运行状态',
        status: status.running ? '运行中' : '未启动',
        tone: status.running ? 'green' : 'gray',
        detail: status.running
          ? `当前监听 ${statusSummary.listen}，请求计数 ${statusSummary.requests}。`
          : '当前尚未拉起网关，可直接使用现有配置启动。',
      },
      {
        label: '配置同步',
        status: hasUnsavedChanges ? '未保存' : '已保存',
        tone: hasUnsavedChanges ? 'yellow' : 'teal',
        detail: hasUnsavedChanges
          ? '页面配置已经变化，如需长期保留请先保存配置。'
          : '页面配置已与配置文件保持一致。',
      },
      {
        label: '运行差异',
        status: hasRuntimeChanges ? '待重启' : '已对齐',
        tone: hasRuntimeChanges ? 'orange' : 'teal',
        detail: hasRuntimeChanges
          ? '网关仍在使用旧运行参数，需要重启后才会切换到新配置。'
          : '当前运行参数与页面快照一致。',
      },
    ]

    if (latestErrorEntry) {
      checks.push({
        label: '最近风险',
        status: `${latestErrorEntry.count} 次`,
        tone: 'orange',
        detail: latestErrorEntry.message,
      })
    }

    return checks
  }, [hasFieldErrors, status.running, statusSummary.listen, statusSummary.requests, hasUnsavedChanges, hasRuntimeChanges, latestErrorEntry])
  const observabilityHighlights = useMemo(() => ([
    {
      label: '流式请求',
      value: String(requestLogSummary.streaming),
      detail: '最近请求日志中被识别为 stream 的记录数。',
    },
    {
      label: '成功率',
      value: requestMetrics.successRateLabel,
      detail: `统计样本 ${requestMetrics.total} 条，平均耗时 ${requestMetrics.avgDurationLabel}。`,
    },
    {
      label: '错误率',
      value: requestMetrics.errorRateLabel,
      detail: '结合错误聚合与请求日志，可快速定位上游错误、鉴权失败和流式异常。',
    },
    {
      label: '模型覆盖',
      value: `${requestMetrics.uniqueModels} / ${requestMetrics.uniqueUpstreams}`,
      detail: '分别表示模型数 / 上游来源数，用于判断路由与账号池是否均衡。',
    },
  ]), [requestLogSummary.streaming, requestMetrics.successRateLabel, requestMetrics.total, requestMetrics.avgDurationLabel, requestMetrics.errorRateLabel, requestMetrics.uniqueModels, requestMetrics.uniqueUpstreams])
  const integrationGuidance = useMemo(() => ([
    {
      label: 'Anthropic / Claude',
      detail: '使用 ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY 直连本地网关，适合 Claude Code / Claude Desktop 兼容链路。',
    },
    {
      label: 'OpenAI Responses',
      detail: '使用 OPENAI_BASE_URL + OPENAI_API_KEY，网关会把 /v1/responses 请求映射到 Kiro 上游并保留流式事件序列。',
    },
    {
      label: '客户端鉴权',
      detail: '客户端永远只看本地网关 API Key；网关到 Kiro 的 access token 由本地账号自动托管。',
    },
    {
      label: '排障入口',
      detail: '日志目录、错误历史、请求明细都统一收口在观测页，不需要再翻系统日志。',
    },
  ]), [])
  const pollingFallbackConfig = useMemo(
    () => ({
      host: config.host,
      port: config.port,
    }),
    [config.host, config.port]
  )
  const renderMetricList = (items, emptyLabel) => {
    if (!items.length) {
      return <Text size="sm" className={colors.textMuted}>{emptyLabel}</Text>
    }

    return (
      <Stack gap={6}>
        {items.map(item => (
          <Group key={`${item.label}-${item.count}`} justify="space-between" gap="xs">
            <Text size="sm" className={colors.text} style={{ wordBreak: 'break-word' }}>{item.label}</Text>
            <Badge variant="light">{item.count}</Badge>
          </Group>
        ))}
      </Stack>
    )
  }

  const inputClassNames = useMemo(() => ({
    input: `${colors.text} ${colors.input} ${colors.inputFocus}`,
    label: colors.text,
    description: colors.textMuted,
    error: 'text-red-400',
    section: colors.textMuted,
  }), [colors])

  const selectClassNames = useMemo(() => ({
    ...inputClassNames,
    dropdown: `${colors.card} border ${colors.cardBorder}`,
    option: colors.text,
  }), [colors, inputClassNames])

  const switchClassNames = useMemo(() => ({
    label: colors.text,
    description: colors.textMuted,
  }), [colors])

  const pushError = (msg) => {
    const normalized = String(msg?.message || msg || '').trim()
    if (!normalized) return
    setErrorHistory(prev => mergeErrorHistory(prev, normalized, formatGatewayTimestamp(), 8))
  }

  const loadRequestLogs = useCallback(async (limit = 120) => {
    setRequestLogsLoading(true)
    try {
      const logs = await fetchGatewayRequestLogs(limit)
      setRequestLogs(logs)
      setLastRequestLogsSyncAt(formatGatewayTimestamp())
    } catch (e) {
      pushError(e)
    } finally {
      setRequestLogsLoading(false)
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const { gatewayConfig, gatewayStatus, accounts: accountList, groups: groupList, logDir: gatewayLogDir } = await loadGatewayPageData()

      const nextConfig = hydrateGatewayConfig(gatewayConfig)
      const nextStatus = buildGatewayStatusState(gatewayStatus, gatewayConfig, nextConfig)
      const runtimeConfig = gatewayStatus?.running && nextStatus.runtimeConfig ? nextStatus.runtimeConfig : null
      setConfig(nextConfig)
      setSavedConfigSnapshot(buildGatewayConfigSnapshot(nextConfig))
      setAppliedRuntimeSnapshot(runtimeConfig ? buildGatewayRuntimeSnapshot(runtimeConfig) : null)
      setStatus(nextStatus)
      setLastStatusSyncAt(formatGatewayTimestamp())
      setAccounts(accountList)
      setGroups(groupList)
      setLogDir(gatewayLogDir)

      if (gatewayStatus?.lastError) {
        pushError(gatewayStatus.lastError)
      }
    } catch (e) {
      pushError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => {
      loadAll()
    })
  }, [loadAll])

  const handleStatusPoll = useCallback(({ status: nextStatus, fallbackConfig, syncedAt }) => {
    const nextState = buildGatewayStatusState(nextStatus, nextStatus, fallbackConfig)
    setStatus(nextState)
    setAppliedRuntimeSnapshot(nextState.running && nextState.runtimeConfig
      ? buildGatewayRuntimeSnapshot(nextState.runtimeConfig)
      : null)
    setLastStatusSyncAt(syncedAt)
    if (nextStatus?.lastError) {
      pushError(nextStatus.lastError)
    }
  }, [])

  const handleRequestLogsPoll = useCallback(({ logs, syncedAt }) => {
    setRequestLogs(logs)
    setLastRequestLogsSyncAt(syncedAt)
  }, [])

  useGatewayPolling({
    activeTab,
    fallbackConfig: pollingFallbackConfig,
    onStatus: handleStatusPoll,
    onRequestLogs: handleRequestLogsPoll,
  })

  const setField = (key, value) => setConfig(prev => ({ ...prev, [key]: value }))

  const createGeneratedApiKey = () => {
    const random = crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}${Math.random().toString(36).slice(2)}`
    return `sk-${random}`
  }

  const handleRefresh = async () => {
    await loadAll()
  }

  const handleClearErrors = () => {
    setErrorHistory([])
  }

  const handleGenerateApiKey = () => {
    setConfig(prev => {
      const generatedKey = createGeneratedApiKey()
      const existingKeys = String(prev.clientApiKeysText || prev.apiKey || '').trim()
      const clientApiKeysText = existingKeys ? `${existingKeys}\n${generatedKey}` : generatedKey
      return {
        ...prev,
        apiKey: generatedKey,
        clientApiKeysText,
      }
    })
  }

  const handleOpenLogDir = async () => {
    try {
      const dir = await openGatewayLogDir()
      setLogDir(String(dir || ''))
    } catch (e) {
      pushError(e)
    }
  }

  const handleClearRequestLogs = async () => {
    setRequestLogsLoading(true)
    try {
      await clearGatewayRequestLogs()
      setRequestLogs([])
      setLastRequestLogsSyncAt(formatGatewayTimestamp())
    } catch (e) {
      pushError(e)
    } finally {
      setRequestLogsLoading(false)
    }
  }

  const guardInvalidConfig = () => {
    if (!hasFieldErrors) {
      return false
    }
    pushError('请先修正表单错误后再继续')
    return true
  }

  const handleSave = async () => {
    if (guardInvalidConfig()) return
    setSaving(true)
    try {
      await saveGatewayConfig(config)
      setSavedConfigSnapshot(buildGatewayConfigSnapshot(config))
    } catch (e) {
      pushError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleStart = async () => {
    if (guardInvalidConfig()) return
    setSaving(true)
    try {
      const st = await startGateway(config)
      const nextStatus = buildGatewayStatusState(st, st, config)
      setStatus(nextStatus)
      setAppliedRuntimeSnapshot(nextStatus.runtimeConfig ? buildGatewayRuntimeSnapshot(nextStatus.runtimeConfig) : buildGatewayRuntimeSnapshot(config))
      setLastStatusSyncAt(formatGatewayTimestamp())
    } catch (e) {
      pushError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleRestart = async () => {
    if (guardInvalidConfig()) return
    setSaving(true)
    try {
      if (status.running) {
        await stopGateway()
      }
      const st = await startGateway(config)
      const nextStatus = buildGatewayStatusState(st, st, config)
      setStatus(nextStatus)
      setAppliedRuntimeSnapshot(nextStatus.runtimeConfig ? buildGatewayRuntimeSnapshot(nextStatus.runtimeConfig) : buildGatewayRuntimeSnapshot(config))
      setLastStatusSyncAt(formatGatewayTimestamp())
    } catch (e) {
      pushError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleStop = async () => {
    setSaving(true)
    try {
      await stopGateway()
      setStatus(prev => ({ ...prev, running: false }))
      setAppliedRuntimeSnapshot(null)
      setLastStatusSyncAt(formatGatewayTimestamp())
    } catch (e) {
      pushError(e)
    } finally {
      setSaving(false)
    }
  }

  const copyText = async (text, successMessage) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess(successMessage)
      setTimeout(() => setCopySuccess(''), 1600)
    } catch (e) {
      pushError(e)
    }
  }

  return (
    <div className={`h-full overflow-y-auto p-6 ${colors.main}`}>
      <Stack gap="md">
        <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap={6}>
                <Text fw={700} className={colors.text}>Kiro API 网关</Text>
                <Text size="sm" className={colors.textMuted}>
                  把入口状态、客户端接入、安全边界和观测线索压到一屏里，优先处理保存/启动/重启这几类主动作。
                </Text>
              </Stack>
              <Group gap="xs">
                <Badge color="indigo">Gateway Console</Badge>
                <Badge color={status.running ? 'green' : 'gray'}>{status.running ? '流量入口已在线' : '等待启动'}</Badge>
              </Group>
            </Group>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {consoleHighlights.map((item) => (
                <Card key={item.label} withBorder radius="md">
                  <Text size="xs" className={colors.textMuted}>{item.label}</Text>
                  <Text fw={700} className={colors.text} mt={4}>{item.value}</Text>
                  <Text size="sm" className={colors.textMuted} mt={6}>{item.detail}</Text>
                </Card>
              ))}
            </div>
          </Stack>
        </Card>

        <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Group gap="xs">
                  <Badge color={runtimeBadgeColor}>{status.running ? '网关运行中' : '网关未启动'}</Badge>
                  <Badge color={endpointBadgeColor}>{effectiveConfig.localOnly ? '仅本机访问' : '允许远程访问'}</Badge>
                  <Badge variant="light" color={hasUnsavedChanges ? 'yellow' : 'teal'}>
                    {hasUnsavedChanges ? '存在未保存配置' : '配置已保存'}
                  </Badge>
                </Group>
                <Text fw={700} className={colors.text}>当前入口 {effectiveBaseUrl}</Text>
                <Text size="sm" className={colors.textMuted}>
                  {effectiveRoutingSummary.modeLabel} · {effectiveRoutingSummary.selectionValue} · {effectiveSecuritySummary.apiKeyState}
                </Text>
              </Stack>

              <Group gap="xs">
                <Button
                  variant="default"
                  leftSection={<Activity size={16} />}
                  onClick={handleSave}
                  loading={saving || loading}
                  disabled={!hasUnsavedChanges || hasFieldErrors || saving || loading}
                >
                  保存配置
                </Button>
                {status.running ? (
                  <Button
                    variant="light"
                    leftSection={<RotateCcw size={16} />}
                    onClick={handleRestart}
                    loading={saving || loading}
                    disabled={hasFieldErrors || saving || loading}
                  >
                    重启网关
                  </Button>
                ) : null}
                {!status.running ? (
                  <Button
                    color="green"
                    leftSection={<Play size={16} />}
                    onClick={handleStart}
                    loading={saving || loading}
                    disabled={hasFieldErrors || saving || loading}
                  >
                    启动网关
                  </Button>
                ) : (
                  <Button
                    color="red"
                    leftSection={<Square size={16} />}
                    onClick={handleStop}
                    loading={saving || loading}
                    disabled={saving || loading}
                  >
                    停止网关
                  </Button>
                )}
              </Group>
            </Group>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>运行快照</Text>
                <Text fw={700} className={colors.text}>{statusSummary.listen}</Text>
                <Text size="sm" className={colors.textMuted} mt={4}>
                  {statusSummary.routing} · {statusSummary.region}
                </Text>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>接入与鉴权</Text>
                <Text fw={700} className={colors.text}>{integrationSummary.endpointLabel}</Text>
                <Text size="sm" className={colors.textMuted} mt={4}>
                  {integrationSummary.authLabel}
                </Text>
              </Card>
              <Card withBorder radius="md">
                <Text size="xs" className={colors.textMuted}>最新风险</Text>
                <Text fw={700} className={colors.text}>
                  {latestErrorEntry ? '最近有错误请求' : '最近未发现错误'}
                </Text>
                <Text size="sm" className={colors.textMuted} mt={4}>
                  {latestErrorEntry?.lastSeenAt || lastStatusSyncAt}
                </Text>
              </Card>
            </div>

            <ThemedAlert
              color={actionSummary.tone}
              variant="light"
              colors={colors}
              title={actionSummary.title}
            >
              <Text size="sm" className={colors.textMuted}>
                {actionSummary.description}
              </Text>
            </ThemedAlert>
          </Stack>
        </Card>

        <Tabs
          value={activeTab}
          keepMounted={false}
          onChange={(value) => {
            startTransition(() => {
              setActiveTab(value || 'overview')
            })
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="overview">总览</Tabs.Tab>
            <Tabs.Tab value="integration">接入</Tabs.Tab>
            <Tabs.Tab value="observability">观测</Tabs.Tab>
            <Tabs.Tab value="advanced">高级</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <GatewayOverview
              colors={colors}
              loading={loading}
              handleRefresh={handleRefresh}
              effectiveBaseUrl={effectiveBaseUrl}
              effectiveRoutingSummary={effectiveRoutingSummary}
              effectiveSecuritySummary={effectiveSecuritySummary}
              statusSummary={statusSummary}
              actionSummary={actionSummary}
              operationsChecklist={operationsChecklist}
              clientSamples={clientSamples}
              copyText={copyText}
              handleOpenLogDir={handleOpenLogDir}
              copySuccess={copySuccess}
              effectiveConfig={effectiveConfig}
              logDir={logDir}
              latestErrorEntry={latestErrorEntry}
            />
          </Tabs.Panel>

          <Tabs.Panel value="integration" pt="md">
            <GatewayIntegration
              colors={colors}
              integrationGuidance={integrationGuidance}
              integrationSummary={integrationSummary}
              effectiveConnectHost={effectiveConnectHost}
              clientSamples={clientSamples}
              copyText={copyText}
              copySuccess={copySuccess}
            />
          </Tabs.Panel>

          <Tabs.Panel value="observability" pt="md">
            <GatewayObservability
              colors={colors}
              observabilityHighlights={observabilityHighlights}
              effectiveConfig={effectiveConfig}
              status={status}
              loading={loading}
              handleRefresh={handleRefresh}
              handleClearErrors={handleClearErrors}
              errorHistory={errorHistory}
              statusSummary={statusSummary}
              hasUnsavedChanges={hasUnsavedChanges}
              filteredRequestLogSummary={filteredRequestLogSummary}
              integrationSummary={integrationSummary}
              logDir={logDir}
              handleOpenLogDir={handleOpenLogDir}
              loadRequestLogs={loadRequestLogs}
              requestLogsLoading={requestLogsLoading}
              handleClearRequestLogs={handleClearRequestLogs}
              requestLogs={requestLogs}
              lastRequestLogsSyncAt={lastRequestLogsSyncAt}
              requestLogOutcome={requestLogOutcome}
              setRequestLogOutcome={setRequestLogOutcome}
              selectClassNames={selectClassNames}
              requestLogQuery={requestLogQuery}
              setRequestLogQuery={setRequestLogQuery}
              inputClassNames={inputClassNames}
              requestLogSummary={requestLogSummary}
              requestMetrics={requestMetrics}
              renderMetricList={renderMetricList}
              filteredRequestLogs={filteredRequestLogs}
            />
          </Tabs.Panel>

          <Tabs.Panel value="advanced" pt="md">
            <GatewayAdvanced
              colors={colors}
              config={config}
              hasFieldErrors={hasFieldErrors}
              hasUnsavedChanges={hasUnsavedChanges}
              fieldErrors={fieldErrors}
              inputClassNames={inputClassNames}
              selectClassNames={selectClassNames}
              switchClassNames={switchClassNames}
              setField={setField}
              handleGenerateApiKey={handleGenerateApiKey}
              securitySummary={securitySummary}
              routingSummary={routingSummary}
              accountOptions={accountOptions}
              groupOptions={groupOptions}
              actionSummary={actionSummary}
              ThemedAlert={ThemedAlert}
              setConfig={setConfig}
              applyGatewayLocalOnlyChange={applyGatewayLocalOnlyChange}
              createGeneratedApiKey={createGeneratedApiKey}
            />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </div>
  )
}

export default GatewayPage
