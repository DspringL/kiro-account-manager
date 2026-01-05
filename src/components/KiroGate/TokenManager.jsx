import { useState } from 'react'
import { Trash2, Edit2, Download, Upload } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { useKiroGateTokens } from '../../hooks/useKiroGateTokens'
import TokenModal from './TokenModal'

function TokenManager() {
  const { colors } = useApp()
  const { tokens, addToken, updateToken, deleteToken } = useKiroGateTokens()
  
  const [showModal, setShowModal] = useState(false)
  const [editingToken, setEditingToken] = useState(null)

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
  }

  // 导出 Token
  const handleExport = () => {
    if (tokens.length === 0) return alert('没有可导出的 Token')
    const data = tokens.map(t => ({
      name: t.name,
      refreshToken: t.refreshToken,
      authMethod: t.authMethod,
      profileArn: t.profileArn,
      clientId: t.clientId,
      clientSecret: t.clientSecret,
      region: t.region
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kirogate-tokens-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
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
          <div className="flex items-center gap-2">
            <button onClick={handleExport} disabled={tokens.length === 0}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                tokens.length > 0 
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                  : `${colors.card} ${colors.textMuted} cursor-not-allowed`
              }`}>
              <Download size={14} />导出
            </button>
            <button onClick={openAddModal} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 text-sm">
              <Upload size={14} />导入
            </button>
          </div>
        </div>

        {tokens.length === 0 ? (
          <div className={`text-center py-8 ${colors.textMuted}`}>暂无 Token，点击上方添加</div>
        ) : (
          <div className="space-y-2">
            {tokens.map(t => (
              <div key={t.id} className={`flex items-center justify-between p-3 rounded-xl ${colors.card} border ${colors.cardBorder}`}>
                <div>
                  <div className={`font-medium ${colors.text}`}>{t.name}</div>
                  <div className={`text-xs ${colors.textMuted}`}>{t.refreshToken.slice(0, 20)}...</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditModal(t)} className="p-1.5 rounded-lg hover:bg-white/10"><Edit2 size={14} className={colors.textMuted} /></button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-500/20"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TokenModal show={showModal} token={editingToken} onClose={() => setShowModal(false)} onSave={handleSave} onBatchSave={handleBatchSave} />
    </div>
  )
}

export default TokenManager
