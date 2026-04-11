import { Check, Copy } from 'lucide-react'
import { Badge, Button, Card, Code, Group, Stack, Text } from '@mantine/core'

function GatewayIntegrationTab({
  colors,
  integrationGuidance,
  integrationSummary,
  effectiveConnectHost,
  clientSamples,
  copyText,
  copySuccess,
}) {
  return (
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
  )
}

export default GatewayIntegrationTab
