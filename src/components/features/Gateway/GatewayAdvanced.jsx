import { Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { GatewaySectionHeader, GatewayStatCard, GatewaySubCard, GatewaySurfaceCard } from './GatewayShared'

function GatewayAdvanced({
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
      <GatewaySurfaceCard colors={colors}>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Server size={16} />
              <div className={`font-semibold ${colors.text}`}>高级配置</div>
            </div>
            <div className="flex items-center gap-2">
              {hasFieldErrors ? <Badge variant="destructive">配置待修正</Badge> : null}
              {hasUnsavedChanges ? <Badge variant="secondary">未保存变更</Badge> : <Badge variant="default">已同步</Badge>}
            </div>
          </div>

          <div className={`text-sm ${colors.textMuted}`}>
            监听地址、安全暴露、账号来源和池调度都收口到这里，属于低频但决定网关行为边界的配置。
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <GatewayStatCard colors={colors} label="暴露范围" value={securitySummary.exposureLabel} />
            <GatewayStatCard colors={colors} label="客户端鉴权" value={securitySummary.apiKeyState} />
            <GatewayStatCard colors={colors} label="候选范围" value={routingSummary.inventorySummary} />
            <GatewayStatCard colors={colors} label="路由策略" value={routingSummary.strategySummary} />
          </div>

          <Accordion type="multiple" defaultValue={['common', 'routing']} className="w-full">
            <AccordionItem value="common">
              <AccordionTrigger>
                <div className="flex justify-between items-center w-full pr-4">
                  <div className="flex flex-col gap-0.5 items-start">
                    <div className="font-semibold">常用配置</div>
                    <div className={`text-sm ${colors.textMuted}`}>先处理监听地址、客户端 Key 和最常改的接入项。</div>
                  </div>
                  <Badge variant="secondary">高频</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>监听地址</Label>
                      <Input
                        value={config.host}
                        onChange={(e) => setField('host', e.target.value || '127.0.0.1')}
                        className={fieldErrors.host ? 'border-red-500' : ''}
                      />
                      {fieldErrors.host && <div className="text-xs text-red-500">{fieldErrors.host}</div>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>端口</Label>
                      <Input
                        type="number"
                        value={config.port}
                        min={1}
                        max={65535}
                        onChange={(e) => setField('port', Number(e.target.value) || 8765)}
                        className={fieldErrors.port ? 'border-red-500' : ''}
                      />
                      {fieldErrors.port && <div className="text-xs text-red-500">{fieldErrors.port}</div>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>客户端 API Keys</Label>
                    <div className="text-xs text-muted-foreground">每行一个客户端 Key。客户端连接本地网关时可使用其中任意一个；Kiro API 的 access token 仍由网关从本地账号自动读取。</div>
                    <Textarea
                      placeholder={'sk-primary\nsk-secondary'}
                      rows={3}
                      value={config.clientApiKeysText}
                      onChange={(e) => {
                        const clientApiKeysText = e.target.value
                        const primaryApiKey = clientApiKeysText
                          .split(/[\n,]+/)
                          .map(item => item.trim())
                          .find(Boolean) || ''
                        setConfig(prev => ({ ...prev, clientApiKeysText, apiKey: primaryApiKey }))
                      }}
                      className={fieldErrors.clientApiKeysText ? 'border-red-500' : ''}
                      autoComplete="off"
                    />
                    {fieldErrors.clientApiKeysText && <div className="text-xs text-red-500">{fieldErrors.clientApiKeysText}</div>}
                    <div className="flex justify-end">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="outline" onClick={handleGenerateApiKey}>追加客户端 Key</Button>
                        </TooltipTrigger>
                        <TooltipContent>生成一个 sk- 格式的 API Key</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>账号来源</Label>
                    <Select value={config.accountMode} onValueChange={(v) => setField('accountMode', v || 'single')}>
                      <SelectTrigger className={fieldErrors.accountMode ? 'border-red-500' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">指定单账号</SelectItem>
                        <SelectItem value="group">按分组账号池</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldErrors.accountMode && <div className="text-xs text-red-500">{fieldErrors.accountMode}</div>}
                  </div>

                  {config.accountMode === 'single' ? (
                    <div className="flex flex-col gap-1.5">
                      <Label>指定账号</Label>
                      <Select value={config.accountId} onValueChange={(v) => setField('accountId', v)}>
                        <SelectTrigger className={fieldErrors.accountId ? 'border-red-500' : ''}>
                          <SelectValue placeholder="选择一个账号" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldErrors.accountId && <div className="text-xs text-red-500">{fieldErrors.accountId}</div>}
                    </div>
                  ) : null}

                  {config.accountMode === 'group' ? (
                    <div className="flex flex-col gap-1.5">
                      <Label>账号分组</Label>
                      <Select value={config.groupId} onValueChange={(v) => setField('groupId', v)}>
                        <SelectTrigger className={fieldErrors.groupId ? 'border-red-500' : ''}>
                          <SelectValue placeholder="选择一个分组" />
                        </SelectTrigger>
                        <SelectContent>
                          {groupOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldErrors.groupId && <div className="text-xs text-red-500">{fieldErrors.groupId}</div>}
                    </div>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="security">
              <AccordionTrigger>
                <div className="flex justify-between items-center w-full pr-4">
                  <div className="flex flex-col gap-0.5 items-start">
                    <div className="font-semibold">安全访问</div>
                    <div className={`text-sm ${colors.textMuted}`}>集中处理暴露范围、白名单和自动启动偏好。</div>
                  </div>
                  <Badge variant={config.localOnly ? 'default' : 'secondary'}>{securitySummary.exposureLabel}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <GatewayStatCard colors={colors} label="暴露范围" value={securitySummary.exposureLabel} />
                    <GatewayStatCard colors={colors} label="白名单条目" value={securitySummary.allowedIpsCount} />
                    <GatewayStatCard colors={colors} label="客户端鉴权" value={securitySummary.apiKeyState} />
                    <GatewayStatCard colors={colors} label="日志级别" value={securitySummary.logLevel} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Label>随应用启动自动拉起网关</Label>
                      <div className="text-xs text-muted-foreground">仅影响下次启动应用时是否自动启动，不会立即修改当前运行状态。</div>
                    </div>
                    <Switch
                      checked={!!config.enabled}
                      onCheckedChange={(checked) => setField('enabled', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Label>仅允许本机访问</Label>
                      <div className="text-xs text-muted-foreground">开启后，网关会拒绝非 127.0.0.1 / ::1 请求，即使你把监听地址改成 0.0.0.0。无论是否开启，客户端都必须携带任意一个已配置的客户端 API Key。</div>
                    </div>
                    <Switch
                      checked={!!config.localOnly}
                      onCheckedChange={(checked) => {
                        setConfig(prev => applyGatewayLocalOnlyChange(prev, checked, createGeneratedApiKey))
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>IP 白名单</Label>
                    <div className="text-xs text-muted-foreground">支持单个 IP 或 CIDR，每行或逗号分隔；仅在关闭"仅允许本机访问"后生效。</div>
                    <Textarea
                      placeholder={'192.168.1.10\n10.0.0.0/24'}
                      rows={3}
                      value={config.allowedIpsText}
                      onChange={(e) => setField('allowedIpsText', e.target.value)}
                      disabled={!!config.localOnly}
                      className={fieldErrors.allowedIpsText ? 'border-red-500' : ''}
                    />
                    {fieldErrors.allowedIpsText && <div className="text-xs text-red-500">{fieldErrors.allowedIpsText}</div>}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="routing">
              <AccordionTrigger>
                <div className="flex justify-between items-center w-full pr-4">
                  <div className="flex flex-col gap-0.5 items-start">
                    <div className="font-semibold">账号来源与路由</div>
                    <div className={`text-sm ${colors.textMuted}`}>{routingSummary.modeDescription}</div>
                  </div>
                  <Badge variant="secondary">{routingSummary.modeLabel}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <GatewayStatCard colors={colors} label={routingSummary.selectionLabel} value={routingSummary.selectionValue} />
                    <GatewayStatCard colors={colors} label="候选范围" value={routingSummary.inventorySummary} />
                    <GatewayStatCard colors={colors} label="路由策略" value={routingSummary.strategySummary} className="sm:col-span-2" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Region</Label>
                    <Select value={config.region} onValueChange={(v) => setField('region', v || 'us-east-1')}>
                      <SelectTrigger className={fieldErrors.region ? 'border-red-500' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us-east-1">us-east-1</SelectItem>
                        <SelectItem value="eu-central-1">eu-central-1</SelectItem>
                        <SelectItem value="us-west-2">us-west-2</SelectItem>
                        <SelectItem value="ap-northeast-1">ap-northeast-1</SelectItem>
                        <SelectItem value="ap-southeast-1">ap-southeast-1</SelectItem>
                        <SelectItem value="us-gov-west-1">us-gov-west-1</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldErrors.region && <div className="text-xs text-red-500">{fieldErrors.region}</div>}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>账号策略</Label>
                    <Select value={config.strategy} onValueChange={(v) => setField('strategy', v || 'round_robin')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round_robin">轮询 round_robin</SelectItem>
                        <SelectItem value="most_quota">优先剩余额度 most_quota</SelectItem>
                        <SelectItem value="random">随机 random</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>切换阈值</Label>
                    <div className="text-xs text-muted-foreground">当账号使用率达到该阈值且仍有其他候选账号时，网关会优先尝试下一个账号。</div>
                    <Input
                      type="number"
                      value={config.threshold}
                      min={1}
                      max={100}
                      onChange={(e) => setField('threshold', Number(e.target.value) || 90)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>日志级别</Label>
                    <div className="text-xs text-muted-foreground">控制应用日志插件级别；保存后需重启应用才能完全生效。</div>
                    <Select value={config.logLevel} onValueChange={(v) => setField('logLevel', v || 'debug')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debug">debug</SelectItem>
                        <SelectItem value="info">info</SelectItem>
                        <SelectItem value="warn">warn</SelectItem>
                        <SelectItem value="error">error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {hasFieldErrors ? (
            <ThemedAlert color="red" variant="light" title="保存前需修正" colors={colors}>
              <div className={`text-sm ${colors.textMuted}`}>
                {Object.values(fieldErrors).join('；')}
              </div>
            </ThemedAlert>
          ) : (
            <ThemedAlert
              color={actionSummary.tone}
              variant="light"
              colors={colors}
              title={actionSummary.title}
            >
              <div className={`text-sm ${colors.textMuted}`}>
                {actionSummary.description}
              </div>
            </ThemedAlert>
          )}
        </div>
      </GatewaySurfaceCard>
    </div>
  )
}

export default GatewayAdvanced
