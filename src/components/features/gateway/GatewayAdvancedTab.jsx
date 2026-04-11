import { Server } from 'lucide-react'
import { Badge, Button, Card, Group, NumberInput, Select, Stack, Switch, Text, TextInput, Textarea, Tooltip } from '@mantine/core'

function GatewayAdvancedTab({
  colors,
  config,
  hasFieldErrors,
  hasUnsavedChanges,
  fieldErrors,
  inputClassNames,
  selectClassNames,
  switchClassNames,
  setField,
  handleGenerateApiKey,
  securitySummary,
  routingSummary,
  accountOptions,
  groupOptions,
  actionSummary,
  ThemedAlert,
  setConfig,
  applyGatewayLocalOnlyChange,
  createGeneratedApiKey,
}) {
  return (
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
  )
}

export default GatewayAdvancedTab
