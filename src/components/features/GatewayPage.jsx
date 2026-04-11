import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Activity, Play, RotateCcw, Square } from 'lucide-react'
import { Alert, Badge, Button, Card, Group, Stack, Tabs, Text } from '@mantine/core'
import { useApp } from '../../hooks/useApp'
import GatewayAdvancedTab from './gateway/GatewayAdvancedTab'
import GatewayIntegrationTab from './gateway/GatewayIntegrationTab'
import GatewayObservabilityTab from './gateway/GatewayObservabilityTab'
import GatewayOverviewTab from './gateway/GatewayOverviewTab'
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
  const clientSamples = useMemo(() => buildClientSamples(effectiveBaseUrl, effectiveConfig.apiKey), [effectiveBaseUrl, effectiveConfig.apiKey])
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
    () => buildGatewayIntegrationSummary({ baseUrl: effectiveBaseUrl, apiKey: effectiveConfig.apiKey, logDir, errorHistory }),
    [effectiveBaseUrl, effectiveConfig.apiKey, logDir, errorHistory]
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
  const capabilityCards = useMemo(() => {
    const exposureDetail = effectiveConfig.localOnly
      ? '仅 127.0.0.1 / ::1 可访问，远程请求会被拒绝。'
      : `允许远程访问${effectiveSecuritySummary.allowedIpsCount ? `，当前白名单 ${effectiveSecuritySummary.allowedIpsCount} 条` : '，建议配合白名单限制来源 IP'}。`

    return [
      {
        label: '协议兼容',
        title: 'Anthropic + OpenAI Responses',
        description: '同时覆盖 Claude Messages 与 OpenAI Responses 接入，统一落到 Kiro 上游。',
      },
      {
        label: '流式实现',
        title: 'AWS EventStream 二进制解码',
        description: '网关已按消息帧解析上游 EventStream，并完整转成前端与客户端可消费的流式事件。',
      },
      {
        label: '安全边界',
        title: effectiveConfig.localOnly ? '仅本机暴露' : '远程可访问',
        description: exposureDetail,
      },
      {
        label: '运维观测',
        title: '请求日志 + 错误聚合 + 指标统计',
        description: `最近请求 ${requestLogSummary.total} 条，错误历史 ${errorHistory.length} 条，日志最后同步 ${lastRequestLogsSyncAt}。`,
      },
    ]
  }, [effectiveConfig.localOnly, effectiveSecuritySummary.allowedIpsCount, requestLogSummary.total, errorHistory.length, lastRequestLogsSyncAt])
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
    setConfig(prev => ({ ...prev, apiKey: createGeneratedApiKey() }))
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
              </Stack>
              <Group gap="xs">
                <Badge color="indigo">Gateway Console</Badge>
                <Badge color={status.running ? 'green' : 'gray'}>{status.running ? '流量入口已在线' : '等待启动'}</Badge>
              </Group>
            </Group>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {capabilityCards.map((item) => (
                <Card key={item.label} withBorder radius="md">
                  <Text size="xs" className={colors.textMuted}>{item.label}</Text>
                  <Text fw={700} className={colors.text} mt={4}>{item.title}</Text>
                  <Text size="sm" className={colors.textMuted} mt={6}>{item.description}</Text>
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
          </Tabs.Panel>

          <Tabs.Panel value="advanced" pt="md">
            <div className="grid grid-cols-1 gap-4">
          <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
            <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="xs"><Server size={16} /><Text fw={600} className={colors.text}>高级配置</Text></Group>
                  <Group gap="xs">
                    {hasFieldErrors ? <Badge color="red">配置待修正</Badge> : null}
                    {hasUnsavedChanges ? <Badge color="yellow">未保存变更</Badge> : <Badge color="teal">已同步</Badge>}
                  </Group>
                </Group>

                <Text size="sm" className={colors.textMuted}>
                  监听地址、安全暴露、账号来源和池调度都收口到这里，属于低频但决定网关行为边界的配置。
                </Text>

              <Card withBorder radius="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>基础网络</Text>
                    <Badge color="indigo">基础配置</Badge>
                  </Group>

                  <TextInput
                    label="监听地址"
                    value={config.host}
                    onChange={(e) => setField('host', e.currentTarget.value || '127.0.0.1')}
                    error={fieldErrors.host}
                    classNames={inputClassNames}
                  />

                  <NumberInput
                    label="端口"
                    value={config.port}
                    min={1}
                    max={65535}
                    onChange={(v) => setField('port', Number(v) || 8765)}
                    error={fieldErrors.port}
                    classNames={inputClassNames}
                  />

                  <Stack gap={6}>
                    <TextInput
                      label="客户端 API Key"
                      description="客户端连接本地网关时始终使用。Kiro API 的 access token 由网关从本地账号自动读取；这里填写的是网关自己的客户端鉴权 Key，不是 Kiro access token。"
                      placeholder="sk-..."
                      value={config.apiKey}
                      onChange={(e) => setField('apiKey', e.currentTarget.value)}
                      error={fieldErrors.apiKey}
                      classNames={inputClassNames}
                    />
                    <Group justify="flex-end">
                      <Tooltip label="生成一个 sk- 格式的 API Key">
                        <Button size="xs" variant="light" onClick={handleGenerateApiKey}>生成客户端 Key</Button>
                      </Tooltip>
                    </Group>
                  </Stack>

                  <Select
                    label="Region"
                    data={[
                      { value: 'us-east-1', label: 'us-east-1' },
                      { value: 'eu-central-1', label: 'eu-central-1' },
                      { value: 'us-west-2', label: 'us-west-2' },
                      { value: 'ap-northeast-1', label: 'ap-northeast-1' },
                      { value: 'ap-southeast-1', label: 'ap-southeast-1' },
                      { value: 'us-gov-west-1', label: 'us-gov-west-1' },
                    ]}
                    value={config.region}
                    onChange={(v) => setField('region', v || 'us-east-1')}
                    error={fieldErrors.region}
                    classNames={selectClassNames}
                  />
                </Stack>
              </Card>

              <Card withBorder radius="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>安全访问</Text>
                    <Badge color={config.localOnly ? 'teal' : 'yellow'}>{securitySummary.exposureLabel}</Badge>
                  </Group>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Card withBorder radius="md">
                      <Text size="xs" className={colors.textMuted}>暴露范围</Text>
                      <Text fw={700} className={colors.text}>{securitySummary.exposureLabel}</Text>
                    </Card>
                    <Card withBorder radius="md">
                      <Text size="xs" className={colors.textMuted}>白名单条目</Text>
                      <Text fw={700} className={colors.text}>{securitySummary.allowedIpsCount}</Text>
                    </Card>
                    <Card withBorder radius="md">
                      <Text size="xs" className={colors.textMuted}>客户端 Key</Text>
                      <Text fw={700} className={colors.text}>{securitySummary.apiKeyState}</Text>
                    </Card>
                    <Card withBorder radius="md">
                      <Text size="xs" className={colors.textMuted}>日志级别</Text>
                      <Text fw={700} className={colors.text}>{securitySummary.logLevel}</Text>
                    </Card>
                  </div>

                  <Switch
                    label="随应用启动自动拉起网关"
                    description="仅影响下次启动应用时是否自动启动，不会立即修改当前运行状态。"
                    checked={!!config.enabled}
                    onChange={(e) => setField('enabled', e.currentTarget.checked)}
                    classNames={switchClassNames}
                  />

                  <Switch
                    label="仅允许本机访问"
                    description="开启后，网关会拒绝非 127.0.0.1 / ::1 请求，即使你把监听地址改成 0.0.0.0。无论是否开启，客户端都必须携带客户端 API Key。"
                    checked={!!config.localOnly}
                    onChange={(e) => {
                      const nextLocalOnly = e.currentTarget.checked
                      setConfig(prev => applyGatewayLocalOnlyChange(prev, nextLocalOnly, createGeneratedApiKey))
                    }}
                    classNames={switchClassNames}
                  />

                  <Textarea
                    label="IP 白名单"
                    description="支持单个 IP 或 CIDR，每行或逗号分隔；仅在关闭“仅允许本机访问”后生效。"
                    placeholder={'192.168.1.10\n10.0.0.0/24'}
                    autosize
                    minRows={3}
                    value={config.allowedIpsText}
                    onChange={(e) => setField('allowedIpsText', e.currentTarget.value)}
                    disabled={!!config.localOnly}
                    error={fieldErrors.allowedIpsText}
                    classNames={inputClassNames}
                  />

                  <Select
                    label="日志级别"
                    description="控制应用日志插件级别；保存后需重启应用才能完全生效。"
                    data={[
                      { value: 'debug', label: 'debug' },
                      { value: 'info', label: 'info' },
                      { value: 'warn', label: 'warn' },
                      { value: 'error', label: 'error' },
                    ]}
                    value={config.logLevel}
                    onChange={(v) => setField('logLevel', v || 'debug')}
                    classNames={selectClassNames}
                  />

                </Stack>
              </Card>

              <Card withBorder radius="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>账号来源与路由</Text>
                    <Badge color="blue">{routingSummary.modeLabel}</Badge>
                  </Group>
                  <Text size="sm" className={colors.textMuted}>{routingSummary.modeDescription}</Text>

                  <Select
                    label="账号来源"
                    data={[
                      { value: 'single', label: '指定单账号' },
                      { value: 'group', label: '按分组账号池' },
                    ]}
                    value={config.accountMode}
                    onChange={(v) => setField('accountMode', v || 'single')}
                    error={fieldErrors.accountMode}
                    classNames={selectClassNames}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Card withBorder radius="md">
                      <Text size="xs" className={colors.textMuted}>{routingSummary.selectionLabel}</Text>
                      <Text fw={700} className={colors.text}>{routingSummary.selectionValue}</Text>
                    </Card>
                    <Card withBorder radius="md">
                      <Text size="xs" className={colors.textMuted}>候选范围</Text>
                      <Text fw={700} className={colors.text}>{routingSummary.inventorySummary}</Text>
                    </Card>
                    <Card withBorder radius="md" className="sm:col-span-2">
                      <Text size="xs" className={colors.textMuted}>路由策略</Text>
                      <Text fw={700} className={colors.text}>{routingSummary.strategySummary}</Text>
                    </Card>
                  </div>

                  {config.accountMode === 'single' ? (
                    <Card withBorder radius="md">
                      <Select
                        searchable
                        label="指定账号"
                        placeholder="选择一个账号"
                        data={accountOptions}
                        value={config.accountId}
                        onChange={(v) => setField('accountId', v)}
                        error={fieldErrors.accountId}
                        classNames={selectClassNames}
                      />
                    </Card>
                  ) : null}

                  {config.accountMode === 'group' ? (
                    <Card withBorder radius="md">
                      <Select
                        searchable
                        label="账号分组"
                        placeholder="选择一个分组"
                        data={groupOptions}
                        value={config.groupId}
                        onChange={(v) => setField('groupId', v)}
                        error={fieldErrors.groupId}
                        classNames={selectClassNames}
                      />
                    </Card>
                  ) : null}

                  {config.accountMode !== 'local' ? (
                    <Card withBorder radius="md">
                      <Stack gap="sm">
                        <Text size="sm" fw={600}>账号池调度</Text>
                        <Select
                          label="账号策略"
                          data={[
                            { value: 'round_robin', label: '轮询 round_robin' },
                            { value: 'most_quota', label: '优先剩余额度 most_quota' },
                            { value: 'random', label: '随机 random' },
                          ]}
                          value={config.strategy}
                          onChange={(v) => setField('strategy', v || 'round_robin')}
                          classNames={selectClassNames}
                        />

                        <NumberInput
                          label="切换阈值"
                          description="当账号使用率达到该阈值且仍有其他候选账号时，网关会优先尝试下一个账号。"
                          value={config.threshold}
                          min={1}
                          max={100}
                          onChange={(v) => setField('threshold', Number(v) || 90)}
                          classNames={inputClassNames}
                        />
                      </Stack>
                    </Card>
                  ) : null}
                </Stack>
              </Card>

              {hasFieldErrors ? (
                <ThemedAlert color="red" variant="light" title="保存前需修正" colors={colors}>
                  <Text size="sm" className={colors.textMuted}>
                    {Object.values(fieldErrors).join('；')}
                  </Text>
                </ThemedAlert>
              ) : (
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
              )}
            </Stack>
          </Card>
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="integration" pt="md">
            <div className="grid grid-cols-1 gap-4">
              <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>接入指南</Text>
                    <Badge color="indigo">客户端接入</Badge>
                  </Group>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    {integrationGuidance.map((item) => (
                      <Card key={item.label} withBorder radius="md">
                        <Text size="xs" className={colors.textMuted}>{item.label}</Text>
                        <Text size="sm" fw={700} className={colors.text} mt={4}>{item.label}</Text>
                        <Text size="sm" className={colors.textMuted} mt={6}>{item.detail}</Text>
                      </Card>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Card withBorder radius="md">
                      <Text size="xs" className={colors.textMuted}>接入地址</Text>
                      <Text fw={700} className={colors.text}>{integrationSummary.endpointLabel}</Text>
                      <Text size="xs" className={colors.textMuted} mt={4}>客户端应连接 {effectiveConnectHost}</Text>
                    </Card>
                    <Card withBorder radius="md">
                      <Text size="xs" className={colors.textMuted}>认证头</Text>
                      <Text fw={700} className={colors.text}>{integrationSummary.authLabel}</Text>
                    </Card>
                  </div>

                  <Card withBorder radius="md">
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>兼容能力矩阵</Text>
                        <Badge color="blue">Protocol Surface</Badge>
                      </Group>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Card withBorder radius="md">
                          <Text size="xs" className={colors.textMuted}>Anthropic</Text>
                          <Text fw={700} className={colors.text}>Messages / 流式事件</Text>
                          <Text size="sm" className={colors.textMuted} mt={6}>支持 Claude 兼容接入、消息级流式返回、账号路由与本地鉴权。</Text>
                        </Card>
                        <Card withBorder radius="md">
                          <Text size="xs" className={colors.textMuted}>OpenAI</Text>
                          <Text fw={700} className={colors.text}>Responses / function call</Text>
                          <Text size="sm" className={colors.textMuted} mt={6}>支持 /v1/responses、function call、流式 delta、done 与 completed 事件，并透传 tool_choice。</Text>
                        </Card>
                        <Card withBorder radius="md">
                          <Text size="xs" className={colors.textMuted}>网关边界</Text>
                          <Text fw={700} className={colors.text}>本地入口 + 上游凭证托管</Text>
                          <Text size="sm" className={colors.textMuted} mt={6}>客户端只接触本地网关 API Key；Kiro access token 与区域信息由网关自动管理。</Text>
                        </Card>
                        <Card withBorder radius="md">
                          <Text size="xs" className={colors.textMuted}>排障支持</Text>
                          <Text fw={700} className={colors.text}>日志 / 错误 / 原始请求响应</Text>
                          <Text size="sm" className={colors.textMuted} mt={6}>出现兼容性问题时，可直接回到观测页按请求、错误、上游来源逐条定位。</Text>
                        </Card>
                      </div>
                    </Stack>
                  </Card>

                  <Card withBorder radius="md">
                    <Text size="xs" fw={600}>Claude / Anthropic</Text>
                    <Code block mt="xs">{clientSamples.anthropic.env}</Code>
                    <Group mt="sm" gap="xs">
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<Copy size={14} />}
                        onClick={() => copyText(clientSamples.anthropic.env, 'Claude / Anthropic 配置已复制')}
                      >
                        复制 Claude / Anthropic 配置
                      </Button>
                    </Group>
                  </Card>

                  <Card withBorder radius="md">
                     <Text size="xs" fw={600}>OpenAI Responses 兼容</Text>
                    <Code block mt="xs">{clientSamples.openai.env}</Code>
                    <Text size="xs" mt={8} className={colors.textMuted}>
                      OpenAI 兼容客户端仅支持 <Code>/v1/responses</Code>，示例 model 可替换为任意网关支持的模型。
                    </Text>
                    <Code block mt="xs">{clientSamples.openai.curl}</Code>
                    <Group mt="sm" gap="xs">
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<Copy size={14} />}
                        onClick={() => copyText(clientSamples.openai.env, 'OpenAI 兼容配置已复制')}
                      >
                        复制 OpenAI 兼容配置
                      </Button>
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<Copy size={14} />}
                        onClick={() => copyText(clientSamples.openai.curl, '兼容 Responses curl 已复制')}
                      >
                        复制兼容 Responses curl
                      </Button>
                      {copySuccess ? <Badge color="green" leftSection={<Check size={12} />}>{copySuccess}</Badge> : null}
                    </Group>
                  </Card>

                  <Card withBorder radius="md">
                    <Text size="xs" fw={600}>凭证口径</Text>
                    <Stack gap={6} mt="xs">
                      <Text size="xs" className={colors.textMuted}>客户端 {'->'} 本地网关 使用 API Key</Text>
                      <Code block>{integrationSummary.authLabel}</Code>
                      <Text size="xs" className={colors.textMuted}>本地网关 {'->'} Kiro API 使用本地 access token</Text>
                      <Code block>Authorization: Bearer &lt;local kiro access token&gt;</Code>
                    </Stack>
                  </Card>
                </Stack>
              </Card>

            </div>
          </Tabs.Panel>

          <Tabs.Panel value="observability" pt="md">
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

                  <ThemedAlert color={errorHistory.length ? 'orange' : 'teal'} variant="light" title="运行摘要" colors={colors}>
                    {`错误历史 ${statusSummary.errorCount}，当前${status.running ? '已启动' : '未启动'}，${hasUnsavedChanges ? '页面存在未保存变更。' : '页面配置已与已保存状态同步。'}`}
                  </ThemedAlert>

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
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </div>
  )
}

export default GatewayPage
