import { Check, Copy } from 'lucide-react'
import { Badge, Button, Card, Code, Group, Stack, Text } from '@mantine/core'
import { GatewayCodeCard, GatewaySectionHeader, GatewayStatCard, GatewaySubCard, GatewaySurfaceCard } from './GatewayShared'

function GatewayIntegration({
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
      <GatewaySurfaceCard colors={colors}>
        <Stack gap="sm">
          <GatewaySectionHeader
            colors={colors}
            title="接入指南"
            badge={<Badge color="indigo">客户端接入</Badge>}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {integrationGuidance.map((item) => (
              <GatewayStatCard
                key={item.label}
                colors={colors}
                label={item.label}
                value={item.label}
                detail={item.detail}
                valueProps={{ size: 'sm' }}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GatewayStatCard
              colors={colors}
              label="接入地址"
              value={integrationSummary.endpointLabel}
              detail={`客户端应连接 ${effectiveConnectHost}`}
            />
            <GatewayStatCard colors={colors} label="认证头" value={integrationSummary.authLabel} />
          </div>

          <GatewaySubCard>
            <Stack gap="sm">
              <GatewaySectionHeader
                colors={colors}
                title="兼容能力矩阵"
                badge={<Badge color="blue">Protocol Surface</Badge>}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <GatewayStatCard colors={colors} label="Anthropic" value="Messages / 流式事件" detail="支持 Claude 兼容接入、消息级流式返回、账号路由与本地鉴权。" />
                <GatewayStatCard colors={colors} label="OpenAI" value="Responses / function call" detail="支持 /v1/responses、function call、流式 delta、done 与 completed 事件，并透传 tool_choice。" />
                <GatewayStatCard colors={colors} label="网关边界" value="本地入口 + 上游凭证托管" detail="客户端只接触本地网关客户端 Key（命中任意已配置 Key 即可）；Kiro access token 与区域信息由网关自动管理。" />
                <GatewayStatCard colors={colors} label="排障支持" value="日志 / 错误 / 请求元数据" detail="默认记录端点、状态码、耗时、模型、Region、上游来源等元数据；如旧日志里仍有 body，这里也会兼容展示。" />
              </div>
            </Stack>
          </GatewaySubCard>

          <GatewayCodeCard
            title="Claude / Anthropic"
            code={clientSamples.anthropic.env}
            actions={(
              <Button
                variant="light"
                size="xs"
                leftSection={<Copy size={14} />}
                onClick={() => copyText(clientSamples.anthropic.env, 'Claude / Anthropic 配置已复制')}
              >
                复制 Claude / Anthropic 配置
              </Button>
            )}
          />

          <GatewayCodeCard
            title="OpenAI Responses 兼容"
            code={clientSamples.openai.env}
            actions={(
              <>
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
              </>
            )}
          >
            <Text size="xs" mt={8} className={colors.textMuted}>
              OpenAI 兼容客户端仅支持 <Code>/v1/responses</Code>，示例 model 可替换为任意网关支持的模型。
            </Text>
            <Code block mt="xs">{clientSamples.openai.curl}</Code>
          </GatewayCodeCard>

          <GatewayCodeCard title="凭证口径">
            <Stack gap={6} mt="xs">
              <Text size="xs" className={colors.textMuted}>客户端 {'->'} 本地网关 使用 API Key</Text>
              <Code block>{integrationSummary.authLabel}</Code>
              <Text size="xs" className={colors.textMuted}>本地网关 {'->'} Kiro API 使用本地 access token</Text>
              <Code block>Authorization: Bearer &lt;local kiro access token&gt;</Code>
            </Stack>
          </GatewayCodeCard>
        </Stack>
      </GatewaySurfaceCard>
    </div>
  )
}

export default GatewayIntegration
