import { useState } from 'react'
import { Copy, Check, Plus, Trash2, Edit2 } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { useKiroGateTokens } from '../../hooks/useKiroGateTokens'
import TokenModal from './TokenModal'

function TokenManager() {
  const { colors } = useApp()
  const { settings } = useAppSettings()
  const { tokens, addToken, updateToken, deleteToken } = useKiroGateTokens()
  
  const [selectedTokenId, setSelectedTokenId] = useState('')
  const [generatedKey, setGeneratedKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingToken, setEditingToken] = useState(null)

  const proxyKey = settings?.kiroGateProxyKey || ''

  const generateApiKey = () => {
    if (!selectedTokenId || !proxyKey) return
    // API Key 格式: PROXY_API_KEY:TOKEN_ID
    setGeneratedKey(`${proxyKey}:${selectedTokenId}`)
  }

  const copyKey = async () => {
    await navigator.clipboard.writeText(generatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openAddModal = () => { setEditingToken(null); setShowModal(true) }
  const openEditModal = (t) => { setEditingToken(t); setShowModal(true) }

  const handleSave = async (name, refreshToken) => {
    if (editingToken) await updateToken(editingToken.id, name, refreshToken)
    else await addToken(name, refreshToken)
    setShowModal(false)
  }

  const handleBatchSave = async (tokenList) => {
    for (const t of tokenList) {
      await addToken(t)
    }
    setShowModal(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除此 Token？')) return
    await deleteToken(id)
    if (selectedTokenId === id) { setSelectedTokenId(''); setGeneratedKey('') }
  }

  return (
    <div className="space-y-5">
      {/* 统计 */}
      <div className={`${colors.card} rounded-xl p-4 border ${colors.cardBorder} text-center`}>
        <div className="text-3xl mb-1">👥</div>
        <div className="text-2xl font-bold text-purple-400">{tokens.length}</div>
        <div className={`text-xs ${colors.textMuted}`}>已添加 Token</div>
      </div>

      {/* Token 列表 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`font-semibold ${colors.text}`}>Token 列表</h3>
          <button onClick={openAddModal} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 text-sm">
            <Plus size={14} />添加
          </button>
        </div>

        {tokens.length === 0 ? (
          <div className={`text-center py-8 ${colors.textMuted}`}>暂无 Token，点击上方添加</div>
        ) : (
          <div className="space-y-2 mb-4">
            {tokens.map(t => (
              <div key={t.id} className={`flex items-center justify-between p-3 rounded-xl ${colors.card} border ${colors.cardBorder}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" name="token" checked={selectedTokenId === t.id}
                    onChange={() => { setSelectedTokenId(t.id); setGeneratedKey('') }} className="w-4 h-4 accent-yellow-500" />
                  <div>
                    <div className={`font-medium ${colors.text}`}>{t.name}</div>
                    <div className={`text-xs ${colors.textMuted}`}>{t.refreshToken.slice(0, 20)}...</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditModal(t)} className="p-1.5 rounded-lg hover:bg-white/10"><Edit2 size={14} className={colors.textMuted} /></button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-500/20"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!proxyKey && (
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-4 text-center">
            <span className="text-yellow-400 text-sm">请先在「服务器」页配置 PROXY_API_KEY</span>
          </div>
        )}

        <button onClick={generateApiKey} disabled={!selectedTokenId || !proxyKey}
          className={`w-full py-2.5 rounded-xl font-medium transition-all ${
            selectedTokenId && proxyKey ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white' : `${colors.card} ${colors.textMuted} cursor-not-allowed`
          }`}>
          生成 API Key
        </button>

        {generatedKey && (
          <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-400">✅ API Key</span>
              <button onClick={copyKey} className="p-2 rounded-lg hover:bg-white/10">
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className={colors.textMuted} />}
              </button>
            </div>
            <code className={`block text-xs break-all ${colors.text} bg-black/30 p-3 rounded-lg`}>{generatedKey}</code>
          </div>
        )}
      </div>

      <TokenModal show={showModal} token={editingToken} onClose={() => setShowModal(false)} onSave={handleSave} onBatchSave={handleBatchSave} />
    </div>
  )
}

export default TokenManager
