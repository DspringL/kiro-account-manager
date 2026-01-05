import { useState, useEffect } from 'react'
import { X, AlertCircle, CheckCircle } from 'lucide-react'
import { useApp } from '../../hooks/useApp'

// 验证 Refresh Token（aor 开头，冒号分隔两部分）
const validateRefreshToken = (token) => {
  if (!token) return false
  const trimmed = token.trim()
  if (!trimmed.startsWith('aor')) return false
  const parts = trimmed.split(':')
  return parts.length === 2 && parts[0].length >= 50 && parts[1].length >= 50
}

// 验证 Social Token
const validateSocialToken = (item) => {
  return validateRefreshToken(item.refreshToken) && item.profileArn
}

// 验证 IdC Token
const validateIdcToken = (item) => {
  return validateRefreshToken(item.refreshToken) && item.clientId && item.clientSecret
}

// 判断是否为 IdC 类型（BuilderId/Enterprise）
const isIdcType = (item) => {
  if (item.authMethod === 'IdC') return true
  if (item.provider === 'BuilderId' || item.provider === 'Enterprise') return true
  if (item.clientId && item.clientSecret) return true
  return false
}

// 解析 JSON 输入（支持单个对象或数组）
const parseJsonInput = (input) => {
  if (!input.trim()) return { tokens: [], error: '' }
  try {
    const parsed = JSON.parse(input.trim())
    // 支持单个对象或数组
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    const tokens = arr.map((item, i) => {
      const isIdc = isIdcType(item)
      return {
        name: item.name || item.label || item.email || `Token ${i + 1}`,
        refreshToken: item.refreshToken || '',
        authMethod: isIdc ? 'IdC' : 'social',
        profileArn: item.profileArn || null,
        clientId: item.clientId || null,
        clientSecret: item.clientSecret || null,
        region: item.region || 'us-east-1',
        valid: isIdc ? validateIdcToken(item) : validateSocialToken(item)
      }
    })
    return { tokens, error: '' }
  } catch {
    return { tokens: [], error: 'JSON 格式错误' }
  }
}

const PLACEHOLDER = `[
  { "name": "Google账号", "refreshToken": "aor...", "profileArn": "arn:aws:..." },
  { "name": "BuilderId", "refreshToken": "aor...", "clientId": "xxx", "clientSecret": "xxx", "region": "us-east-1" }
]`

function TokenModal({ show, onClose, onBatchSave }) {
  const { colors } = useApp()
  const [jsonInput, setJsonInput] = useState('')
  const [parseResult, setParseResult] = useState({ tokens: [], error: '' })

  useEffect(() => {
    if (show) { setJsonInput(''); setParseResult({ tokens: [], error: '' }) }
  }, [show])

  useEffect(() => {
    setParseResult(parseJsonInput(jsonInput))
  }, [jsonInput])

  if (!show) return null

  const { tokens, error } = parseResult
  const validCount = tokens.filter(t => t.valid).length
  const canSave = validCount > 0

  const handleSave = () => {
    if (!canSave) return
    const validTokens = tokens.filter(t => t.valid).map(t => ({
      name: t.name,
      refreshToken: t.refreshToken.trim(),
      authMethod: t.authMethod,
      profileArn: t.profileArn,
      clientId: t.clientId,
      clientSecret: t.clientSecret,
      region: t.authMethod === 'IdC' ? t.region : null
    }))
    onBatchSave(validTokens)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className={`${colors.card} rounded-2xl p-6 w-full max-w-lg border ${colors.cardBorder}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`font-semibold ${colors.text}`}>添加 Token</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10"><X size={18} className={colors.textMuted} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm mb-2 ${colors.textMuted}`}>
              JSON 数组 <span className="text-xs opacity-60">（支持批量导入）</span>
            </label>
            <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} 
              placeholder={PLACEHOLDER}
              rows={10} className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} resize-none font-mono text-xs`} />
            {jsonInput && (
              <div className="mt-2">
                {error ? (
                  <div className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle size={14} /><span>{error}</span>
                  </div>
                ) : tokens.length > 0 && (
                  <div className={`flex items-center gap-1.5 text-xs ${validCount === tokens.length ? 'text-green-500' : 'text-yellow-400'}`}>
                    {validCount === tokens.length ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    <span>解析到 {tokens.length} 个，{validCount} 个有效</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={`text-xs ${colors.textMuted} space-y-1`}>
            <p>💡 Google/GitHub：需要 refreshToken + profileArn</p>
            <p>💡 BuilderId/Enterprise：需要 refreshToken + clientId + clientSecret</p>
          </div>
          <button onClick={handleSave} disabled={!canSave}
            className={`w-full py-2.5 rounded-xl font-medium transition-all ${
              canSave ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90' : `${colors.card} ${colors.textMuted} cursor-not-allowed border ${colors.cardBorder}`
            }`}>
            {canSave ? `添加 ${validCount} 个 Token` : '添加'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TokenModal
