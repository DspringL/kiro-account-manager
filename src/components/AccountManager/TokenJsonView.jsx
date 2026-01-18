// Token 凭证 JSON 视图组件
import { useState, useRef, useEffect, useMemo } from 'react'
import { Copy, Check, ChevronDown, ChevronUp, Key, Clock } from 'lucide-react'
import { useApp } from '../../hooks/useApp'

// 构建凭证 JSON 对象
function buildCredentialsJson(account) {
  const json = {
    email: account.email,
    provider: account.provider,
    authMethod: account.authMethod || (account.provider === 'BuilderId' ? 'IdC' : 'social'),
    accessToken: account.accessToken || '',
    refreshToken: account.refreshToken || '',
  }
  
  if (account.expiresAt) json.expiresAt = account.expiresAt
  
  // BuilderId 专用字段
  if (account.provider === 'BuilderId') {
    if (account.clientId) json.clientId = account.clientId
    if (account.clientSecret) json.clientSecret = account.clientSecret
    if (account.clientIdHash) json.clientIdHash = account.clientIdHash
    if (account.region) json.region = account.region
    if (account.ssoSessionId) json.ssoSessionId = account.ssoSessionId
  }
  
  // Social 专用字段
  if (account.provider === 'Google' || account.provider === 'Github') {
    if (account.profileArn) json.profileArn = account.profileArn
    if (account.csrfToken) json.csrfToken = account.csrfToken
    if (account.sessionToken) json.sessionToken = account.sessionToken
  }
  
  if (account.machineId) json.machineId = account.machineId
  
  return json
}

// 可折叠的字符串值
function CollapsibleValue({ value, colors, threshold = 50 }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = value.length > threshold
  
  if (!isLong) {
    return <span className="text-emerald-500">"{value}"</span>
  }
  
  const displayValue = expanded ? value : `${value.slice(0, threshold)}...`
  
  return (
    <span className="inline">
      <span className="text-emerald-500">"{displayValue}"</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
        className={`ml-1 text-xs px-1 rounded ${colors.cardSecondary} ${colors.textMuted} ${colors.cardHover}`}
      >
        {expanded ? '收起' : `+${value.length - threshold}`}
      </button>
    </span>
  )
}

// JSON 渲染（带折叠）
function JsonRenderer({ json, colors, indent = 0 }) {
  const entries = Object.entries(json)
  const pad = '  '.repeat(indent)
  const padInner = '  '.repeat(indent + 1)
  
  return (
    <div className="text-xs font-mono">
      <span>{'{'}</span>
      {entries.map(([key, value], i) => (
        <div key={key}>
          <span>{padInner}</span>
          <span className="text-purple-500">"{key}"</span>
          <span>: </span>
          {typeof value === 'string' ? (
            <CollapsibleValue value={value} colors={colors} />
          ) : value === null ? (
            <span className="text-blue-500">null</span>
          ) : typeof value === 'boolean' ? (
            <span className="text-blue-500">{String(value)}</span>
          ) : typeof value === 'number' ? (
            <span className="text-amber-500">{value}</span>
          ) : (
            <span className="text-emerald-500">{JSON.stringify(value)}</span>
          )}
          {i < entries.length - 1 && <span>,</span>}
        </div>
      ))}
      <span>{pad}{'}'}</span>
    </div>
  )
}

// Token JSON 视图（只读）
export function TokenJsonView({ account, defaultExpanded = true }) {
  const { t, colors } = useApp()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef(null)
  
  const credentialsJson = useMemo(() => buildCredentialsJson(account), [account])
  const jsonStr = useMemo(() => JSON.stringify(credentialsJson, null, 2), [credentialsJson])
  
  useEffect(() => () => copiedTimerRef.current && clearTimeout(copiedTimerRef.current), [])
  
  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr).catch(e => console.error('Copy failed:', e))
    setCopied(true)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1500)
  }
  
  return (
    <div className={`${colors.card} rounded-xl shadow-sm overflow-hidden`}>
      <div 
        className={`flex items-center justify-between px-5 py-4 cursor-pointer ${colors.cardHover} transition-colors`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Key size={18} className={colors.textMuted} />
          <span className={`font-medium ${colors.text}`}>{t('detail.tokenCredentials') || 'Token 凭证'}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${colors.badgeInfo}`}>JSON</span>
        </div>
        <div className="flex items-center gap-3">
          {account.expiresAt && (
            <span className={`text-xs ${colors.textMuted} flex items-center gap-1`}>
              <Clock size={12} />{account.expiresAt}
            </span>
          )}
          {expanded ? <ChevronUp size={16} className={colors.textMuted} /> : <ChevronDown size={16} className={colors.textMuted} />}
        </div>
      </div>
      
      {expanded && (
        <div className={`px-5 pb-5 border-t ${colors.cardBorder} pt-4`}>
          <div className="flex items-center justify-end mb-2">
            <button 
              type="button" 
              onClick={handleCopy}
              className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1 px-2 py-1 rounded ${colors.cardHover}`}
            >
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              {copied ? t('common.copied') : t('common.copyAll')}
            </button>
          </div>
          <div className={`p-4 rounded-lg ${colors.cardSecondary} border ${colors.cardBorder} max-h-80 overflow-auto`}>
            <JsonRenderer json={credentialsJson} colors={colors} />
          </div>
        </div>
      )}
    </div>
  )
}

export default TokenJsonView
