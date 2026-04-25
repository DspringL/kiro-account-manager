// Token 凭证 JSON 视图组件
import { useState, useRef, useEffect, useMemo } from 'react'
import { Copy, Check, ChevronDown, Key, Clock } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'
import { getThemeAccent } from '../KiroConfig/themeAccent'

// 构建凭证 JSON 对象（直接使用整个账号对象）
function buildCredentialsJson(account) {
  // 直接返回整个账号对象，让后端的序列化逻辑处理
  return account
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
          bg-muted/30 text-muted-foreground hover:bg-muted/50
          transition-all duration-200 font-medium
        `}
      >
        {expanded ? '收起' : `展开 +${value.length - threshold}`}
      </button>
    </span>
  )
}

// JSON 渲染（带折叠，支持嵌套对象和数组）
function JsonRenderer({ json, colors, accent, indent = 0 }) {
  const entries = Object.entries(json).filter(([_, value]) => value !== undefined)
  const pad = '  '.repeat(indent)
  const padInner = '  '.repeat(indent + 1)
  
  return (
    <div className="text-sm font-mono leading-relaxed">
      <span className={"text-muted-foreground"}>{'{'}</span>
      {entries.map(([key, value], i) => (
        <div key={key} className="py-0.5">
          <span className={"text-muted-foreground"}>{padInner}</span>
          <span className={`${accent.text} font-semibold`}>"{key}"</span>
          <span className={"text-muted-foreground"}>: </span>
          {typeof value === 'string' ? (
            <CollapsibleValue value={value} colors={colors} />
          ) : value === null || value === undefined ? (
            <span className="text-orange-500 font-medium">null</span>
          ) : typeof value === 'boolean' ? (
            <span className={`${accent.text} font-medium`}>{String(value)}</span>
          ) : typeof value === 'number' ? (
            <span className="text-amber-500 font-medium">{value}</span>
          ) : Array.isArray(value) ? (
            <span className="text-emerald-500">[{value.length > 0 ? '...' : ''}]</span>
          ) : typeof value === 'object' ? (
            <span className="text-emerald-500">{'{...}'}</span>
          ) : (
            <span className="text-emerald-500">{JSON.stringify(value)}</span>
          )}
          {i < entries.length - 1 && <span className={"text-muted-foreground"}>,</span>}
        </div>
      ))}
      <span className={"text-muted-foreground"}>{pad}{'}'}</span>
    </div>
  )
}

// Token JSON 视图（只读）
export function TokenJsonView({ account, defaultExpanded = false }) {
  const { t, theme } = useApp()
  const accent = useMemo(() => getThemeAccent(theme), [theme])
  const colors = useMemo(() => ({
    inputFocus: 'focus:ring-primary/20 focus:border-primary'
  }), [])
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
    <div className={`border-b border-border`} style={{ margin: 0 }}>
      <div 
        className={`flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-all duration-200`}
        style={{ padding: '1.75rem 3rem' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-muted/30`}>
            <Key size={18} className={"text-muted-foreground"} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-semibold text-foreground`}>{t('detail.tokenCredentials') || 'Token 凭证'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-md info-badge font-medium`}>JSON</span>
            </div>
            {account.expiresAt && (
              <span className={`text-xs text-muted-foreground flex items-center gap-1 mt-1`}>
                <Clock size={11} />
                {t('detail.expiresAt') || '过期时间'}: {account.expiresAt}
              </span>
            )}
          </div>
        </div>
        <div className={`p-2 rounded-lg bg-muted/30 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          <ChevronDown size={16} className={"text-muted-foreground"} />
        </div>
      </div>
      
      {expanded && (
        <div className={`animate-in fade-in slide-in-from-top-2 duration-200`} style={{ margin: 0, padding: '1.25rem 3rem 2rem 3rem' }}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-medium text-muted-foreground`}>
              {Object.keys(credentialsJson).length} {t('detail.fields') || '个字段'}
            </span>
              <button 
                type="button" 
                onClick={handleCopy}
                className={`
                text-xs text-muted-foreground ${accent.textHover} 
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg 
                bg-muted/30 hover:bg-muted/50
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
            p-5 rounded-xl bg-muted/30 border border-border 
            max-h-96 overflow-auto
            scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent
          `}>
            <JsonRenderer json={credentialsJson} colors={colors} accent={accent} />
          </div>
        </div>
      )}
    </div>
  )
}

export default TokenJsonView
