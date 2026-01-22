// Token 凭证 JSON 视图组件
import { useState, useRef, useEffect, useMemo } from 'react'
import { Copy, Check, ChevronDown, ChevronUp, Key, Clock } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'

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
    return <span className="text-emerald-500 font-medium">"{value}"</span>
  }
  
  const displayValue = expanded ? value : `${value.slice(0, threshold)}...`
  
  return (
    <span className="inline">
      <span className="text-emerald-500 font-medium">"{displayValue}"</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
        className={`
          ml-2 text-xs px-2 py-0.5 rounded-md 
          ${colors.cardSecondary} ${colors.textMuted} ${colors.cardHover}
          transition-all duration-200 font-medium
        `}
      >
        {expanded ? '收起' : `展开 +${value.length - threshold}`}
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
    <div className="text-sm font-mono leading-relaxed">
      <span className={colors.textMuted}>{'{'}</span>
      {entries.map(([key, value], i) => (
        <div key={key} className="py-0.5">
          <span className={colors.textMuted}>{padInner}</span>
          <span className="text-blue-500 font-semibold">"{key}"</span>
          <span className={colors.textMuted}>: </span>
          {typeof value === 'string' ? (
            <CollapsibleValue value={value} colors={colors} />
          ) : value === null ? (
            <span className="text-orange-500 font-medium">null</span>
          ) : typeof value === 'boolean' ? (
            <span className="text-purple-500 font-medium">{String(value)}</span>
          ) : typeof value === 'number' ? (
            <span className="text-amber-500 font-medium">{value}</span>
          ) : (
            <span className="text-emerald-500">{JSON.stringify(value)}</span>
          )}
          {i < entries.length - 1 && <span className={colors.textMuted}>,</span>}
        </div>
      ))}
      <span className={colors.textMuted}>{pad}{'}'}</span>
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
    <div className={`${colors.card} rounded-none shadow-sm overflow-hidden border-y ${colors.cardBorder}`}>
      <div 
        className={`flex items-center justify-between px-8 py-6 cursor-pointer ${colors.cardHover} transition-all duration-200`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.cardSecondary}`}>
            <Key size={18} className={colors.textMuted} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${colors.text}`}>{t('detail.tokenCredentials') || 'Token 凭证'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-md ${colors.badgeInfo} font-medium`}>JSON</span>
            </div>
            {account.expiresAt && (
              <span className={`text-xs ${colors.textMuted} flex items-center gap-1 mt-1`}>
                <Clock size={11} />
                {t('detail.expiresAt') || '过期时间'}: {account.expiresAt}
              </span>
            )}
          </div>
        </div>
        <div className={`p-2 rounded-lg ${colors.cardSecondary} transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          <ChevronDown size={16} className={colors.textMuted} />
        </div>
      </div>
      
      {expanded && (
        <div className={`px-8 pb-8 border-t ${colors.cardBorder} pt-6 animate-in fade-in slide-in-from-top-2 duration-200`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-medium ${colors.textMuted}`}>
              {Object.keys(credentialsJson).length} {t('detail.fields') || '个字段'}
            </span>
            <button 
              type="button" 
              onClick={handleCopy}
              className={`
                text-xs ${colors.textMuted} hover:text-blue-500 
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg 
                ${colors.cardSecondary} ${colors.cardHover}
                transition-all duration-200 font-medium
              `}
            >
              {copied ? (
                <>
                  <Check size={13} className="text-green-500" />
                  <span className="text-green-500">{t('common.copied')}</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  {t('common.copyAll')}
                </>
              )}
            </button>
          </div>
          <div className={`
            p-5 rounded-xl ${colors.cardSecondary} border ${colors.cardBorder} 
            max-h-96 overflow-auto
            scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent
          `}>
            <JsonRenderer json={credentialsJson} colors={colors} />
          </div>
        </div>
      )}
    </div>
  )
}

export default TokenJsonView
