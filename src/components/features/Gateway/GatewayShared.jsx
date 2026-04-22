import { Card, CardContent } from '@/components/ui/card'

export function GatewaySurfaceCard({ colors, className = '', children, ...props }) {
  return (
    <Card
      className={`${colors.card} ${colors.cardBorder} border rounded-md ${className}`.trim()}
      {...props}
    >
      <CardContent className="p-4">
        {children}
      </CardContent>
    </Card>
  )
}

export function GatewaySubCard({ className = '', children, ...props }) {
  return (
    <Card className={`border rounded-md ${className}`} {...props}>
      <CardContent className="p-4">
        {children}
      </CardContent>
    </Card>
  )
}

export function GatewaySectionHeader({ colors, icon: Icon, title, badge, actions, groupProps = {} }) {
  return (
    <div className="flex items-center justify-between" {...groupProps}>
      <div className="flex items-center gap-2">
        {Icon ? <Icon size={16} /> : null}
        <h3 className={`font-semibold ${colors.text}`}>{title}</h3>
      </div>
      {actions || badge || null}
    </div>
  )
}

export function GatewayStatCard({ colors, label, value, detail, valueProps = {}, className = '' }) {
  return (
    <GatewaySubCard className={className}>
      <p className={`text-xs ${colors.textMuted}`}>{label}</p>
      <p className={`font-bold mt-1 ${colors.text}`} {...valueProps}>
        {value}
      </p>
      {detail ? (
        <p className={`text-sm mt-1.5 ${colors.textMuted}`}>
          {detail}
        </p>
      ) : null}
    </GatewaySubCard>
  )
}

export function GatewayPathCard({ title = '日志目录', value, actions }) {
  return (
    <GatewaySubCard>
      <p className="text-xs font-semibold">{title}</p>
      <p className="text-xs mt-1.5 font-mono break-all">
        {value}
      </p>
      {actions ? (
        <div className="mt-3 flex items-center gap-2">
          {actions}
        </div>
      ) : null}
    </GatewaySubCard>
  )
}

export function GatewayCodeCard({ title, code, description, actions, children }) {
  return (
    <GatewaySubCard>
      {title ? <p className="text-xs font-semibold">{title}</p> : null}
      {code ? (
        <pre className={`bg-muted rounded-md p-3 overflow-x-auto text-xs font-mono ${title ? 'mt-2' : ''}`}>
          <code>{code}</code>
        </pre>
      ) : null}
      {description ? (
        <p className="text-xs mt-2">
          {description}
        </p>
      ) : null}
      {children || null}
      {actions ? (
        <div className="mt-3 flex items-center gap-2">
          {actions}
        </div>
      ) : null}
    </GatewaySubCard>
  )
}
