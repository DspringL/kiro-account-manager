import React from 'react'

export const noop = () => {}

export const colors = {
  text: 'text-white',
  textMuted: 'text-gray-400',
  card: 'bg-slate-900',
  cardBorder: 'border-slate-700',
}

export const inputClassNames = {
  input: 'input',
  label: 'label',
  description: 'description',
  error: 'error',
  section: 'section',
}

export const selectClassNames = {
  ...inputClassNames,
  dropdown: 'dropdown',
  option: 'option',
}

export const switchClassNames = {
  label: 'label',
  description: 'description',
}

export function renderMetricList(items, emptyLabel) {
  if (!items.length) {
    return React.createElement('div', null, emptyLabel)
  }

  return React.createElement(
    'ul',
    null,
    items.map(item => React.createElement('li', { key: `${item.label}-${item.count}` }, `${item.label}:${item.count}`))
  )
}

export function getOverviewProps() {
  return {
    colors,
    loading: false,
    handleRefresh: noop,
    effectiveBaseUrl: 'http://127.0.0.1:8765',
    effectiveRoutingSummary: {
      selectionLabel: '当前来源',
      selectionValue: '默认账号池',
      modeLabel: '按分组账号池',
      strategySummary: 'round_robin / 阈值 90%',
    },
    effectiveSecuritySummary: {
      apiKeyState: '已配置 2 个客户端 Key',
      exposureLabel: '仅本机访问',
    },
    statusSummary: {
      requests: 42,
      errorCount: 1,
      region: 'us-east-1',
      logLevel: 'debug',
      sync: '2026-04-21 08:00:00',
    },
    actionSummary: {
      tone: 'yellow',
      title: '建议重启',
      description: '当前运行参数与保存配置存在差异。',
    },
    operationsChecklist: [
      { label: '配置健康', tone: 'green', status: '正常', detail: '字段完整。' },
      { label: '运行状态', tone: 'green', status: '运行中', detail: '网关已在线。' },
    ],
    clientSamples: {
      openai: {
        env: 'OPENAI_BASE_URL=http://127.0.0.1:8765',
      },
    },
    copyText: noop,
    handleOpenLogDir: noop,
    copySuccess: '网关入口已复制',
    effectiveConfig: {
      localOnly: true,
    },
    logDir: 'C:/gateway/logs',
    latestErrorEntry: {
      firstSeenAt: '2026-04-21 07:59:00',
      lastSeenAt: '2026-04-21 08:00:00',
      count: 2,
      message: 'upstream timeout',
    },
  }
}

export function getIntegrationProps() {
  return {
    colors,
    integrationGuidance: [
      { label: 'Anthropic / Claude', detail: '使用 ANTHROPIC_BASE_URL 直连。' },
      { label: 'OpenAI Responses', detail: '使用 OPENAI_BASE_URL 接入。' },
    ],
    integrationSummary: {
      endpointLabel: 'http://127.0.0.1:8765',
      authLabel: 'Authorization: Bearer sk-primary',
    },
    effectiveConnectHost: '127.0.0.1',
    clientSamples: {
      anthropic: {
        env: 'ANTHROPIC_BASE_URL=http://127.0.0.1:8765',
      },
      openai: {
        env: 'OPENAI_BASE_URL=http://127.0.0.1:8765',
        curl: 'curl http://127.0.0.1:8765/v1/responses',
      },
    },
    copyText: noop,
    copySuccess: '兼容 Responses curl 已复制',
  }
}

export function getAdvancedProps() {
  return {
    colors,
    config: {
      host: '127.0.0.1',
      port: 8765,
      clientApiKeysText: 'sk-primary\nsk-secondary',
      region: 'us-east-1',
      enabled: true,
      localOnly: true,
      allowedIpsText: '',
      logLevel: 'debug',
      accountMode: 'group',
      accountId: null,
      groupId: 'group-1',
      strategy: 'round_robin',
      threshold: 90,
    },
    hasFieldErrors: false,
    hasUnsavedChanges: true,
    fieldErrors: {},
    inputClassNames,
    selectClassNames,
    switchClassNames,
    setField: noop,
    handleGenerateApiKey: noop,
    securitySummary: {
      exposureLabel: '仅本机访问',
      allowedIpsCount: 0,
      apiKeyState: '已配置 2 个客户端 Key',
      logLevel: 'debug',
    },
    routingSummary: {
      modeLabel: '按分组账号池',
      modeDescription: '从分组候选账号中选取上游。',
      selectionLabel: '当前分组',
      selectionValue: '默认组',
      inventorySummary: '共 3 个候选账号',
      strategySummary: 'round_robin / 阈值 90%',
    },
    accountOptions: [
      { value: 'acc-1', label: 'acc-1' },
    ],
    groupOptions: [
      { value: 'group-1', label: '默认组' },
    ],
    actionSummary: {
      tone: 'yellow',
      title: '建议保存',
      description: '当前表单有未保存改动。',
    },
    ThemedAlert: ({ title, children }) => React.createElement('section', null, title, children),
    setConfig: noop,
    applyGatewayLocalOnlyChange: value => value,
    createGeneratedApiKey: () => 'sk-generated',
  }
}

export function getObservabilityProps() {
  return {
    colors,
    observabilityHighlights: [
      { label: '流式请求', value: '4', detail: '最近 stream 数量。' },
      { label: '成功率', value: '75%', detail: '统计样本 8 条。' },
    ],
    effectiveConfig: {
      strategy: 'round_robin',
      localOnly: true,
    },
    status: {
      running: true,
    },
    loading: false,
    handleRefresh: noop,
    handleClearErrors: noop,
    errorHistory: [
      { message: 'rate limited', firstSeenAt: '2026-04-21 08:01:00', lastSeenAt: '2026-04-21 08:02:00', count: 3 },
    ],
    statusSummary: {
      listen: '127.0.0.1:8765',
      requests: 8,
      routing: 'group / round_robin',
      exposure: '仅本机',
      region: 'us-east-1',
      logLevel: 'debug',
      sync: '2026-04-21 08:02:30',
      errorCount: 1,
    },
    hasUnsavedChanges: false,
    filteredRequestLogSummary: {
      errors: 1,
      total: 1,
      success: 0,
      streaming: 1,
      latestOccurredAt: '2026-04-21 08:02:00',
      maxDurationLabel: '1.2s',
    },
    integrationSummary: {
      errorDigest: '最近 1 条错误',
      logDirState: '已启用',
    },
    logDir: 'C:/gateway/logs',
    handleOpenLogDir: noop,
    loadRequestLogs: noop,
    requestLogsLoading: false,
    handleClearRequestLogs: noop,
    requestLogs: [
      { requestIndex: 1 },
    ],
    lastRequestLogsSyncAt: '2026-04-21 08:02:30',
    requestLogOutcome: 'all',
    setRequestLogOutcome: noop,
    selectClassNames,
    requestLogQuery: '',
    setRequestLogQuery: noop,
    inputClassNames,
    requestLogSummary: {
      total: 1,
    },
    requestMetrics: {
      errorRateLabel: '25%',
      successRateLabel: '75%',
      avgDurationLabel: '1.2s',
      uniqueModels: 1,
      uniqueUpstreams: 1,
      total: 1,
      topModels: [{ label: 'claude-sonnet-4-5', count: 1 }],
      topUpstreams: [{ label: 'group-1/acc-1', count: 1 }],
      topStatuses: [{ label: '429', count: 1 }],
      topEndpoints: [{ label: '/v1/responses', count: 1 }],
      topRegions: [{ label: 'us-east-1', count: 1 }],
    },
    renderMetricList,
    filteredRequestLogs: [
      {
        outcome: 'error',
        endpoint: '/v1/responses',
        statusCode: 429,
        stream: true,
        requestIndex: 1,
        occurredAt: '2026-04-21 08:02:00',
        clientIp: '127.0.0.1',
        durationMs: 1200,
        model: 'claude-sonnet-4-5',
        region: 'us-east-1',
        upstreamSource: 'group-1/acc-1',
        error: 'rate limited',
        requestBody: '{"stream":true}',
        responseBody: '{"error":"rate limited"}',
      },
    ],
  }
}
