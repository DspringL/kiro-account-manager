import { useState, useEffect } from 'react'
import { Copy, Check, Plus, Trash2, Key } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../hooks/useApp'
import { useKiroGateTokens } from '../../hooks/useKiroGateTokens'

function ApiKeyManager() {
  const { colors } = useApp()
  const { tokens } = useKiroGateTokens()
  
  const [apiKeys, setApiKeys] = useState([])
  const [selectedTokenId, setSelectedTokenId] = useState('')
  const [copied, setCopied] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      const keys = await invoke('get_api_keys')
      setApiKeys(keys)
    } catch (e) {
      console.error('加载 API Key 失败:', e)
    }
  }

  const handleGenerate = async () => {
    if (!selectedTokenId) {
      alert('请先选择一个 Token')
      return
    }
    
    setLoading(true)
    try {
      await invoke('generate_api_key', { tokenId: selectedTokenId })
      await loadApiKeys()
      setSelectedTokenId('')
    } catch (e) {
      alert('生成失败: ' + e)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除此 API Key？')) return
    try {
      await invoke('delete_api_key', { id })
      await loadApiKeys()
    } catch (e) {
      alert('删除失败: ' + e)
    }
  }

  const copyKey = async (key) => {
    await navigator.clipboard.writeText(key)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="space-y-5">
      {/* 统计 */}
      <div className={`${colors.card} rounded-xl p-4 border ${colors.cardBorder} text-center`}>
        <div className="text-3xl mb-1">🔑</div>
        <div className="text-2xl font-bold text-cyan-400">{apiKeys.length}</div>
        <div className={`text-xs ${colors.textMuted}`}>已生成 API Key</div>
      </div>

      {/* 生成区域 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <h3 className={`font-semibold ${colors.text} mb-4`}>生成新的 API Key</h3>
        
        <div className="mb-4">
          <label className={`block text-sm mb-2 ${colors.textMuted}`}>选择 Token</label>
          <select 
            value={selectedTokenId} 
            onChange={(e) => setSelectedTokenId(e.target.value)}
            className={`w-full px-4 py-2.5 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
          >
            <option value="">-- 请选择 --</option>
            {tokens.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={!selectedTokenId || loading}
          className={`w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
            selectedTokenId && !loading
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90'
              : `${colors.card} ${colors.textMuted} cursor-not-allowed border ${colors.cardBorder}`
          }`}
        >
          <Plus size={18} />
          生成 API Key
        </button>
      </div>

      {/* API Key 列表 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <h3 className={`font-semibold ${colors.text} mb-4`}>API Key 列表</h3>
        
        {apiKeys.length === 0 ? (
          <div className={`text-center py-8 ${colors.textMuted}`}>
            暂无 API Key，请先生成
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map(key => (
              <div key={key.id} className={`p-4 rounded-xl ${colors.card} border ${colors.cardBorder}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className={`font-medium ${colors.text} mb-1`}>{key.tokenName}</div>
                    <div className={`text-xs ${colors.textMuted}`}>
                      创建于 {new Date(key.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => copyKey(key.apiKey)}
                      className="p-2 rounded-lg hover:bg-white/10"
                    >
                      {copied === key.apiKey ? (
                        <Check size={16} className="text-green-500" />
                      ) : (
                        <Copy size={16} className={colors.textMuted} />
                      )}
                    </button>
                    <button 
                      onClick={() => handleDelete(key.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                </div>
                
                <div className={`p-3 rounded-lg bg-black/30 border ${colors.cardBorder}`}>
                  <code className={`text-xs ${colors.text} break-all font-mono`}>
                    {key.apiKey}
                  </code>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <h3 className={`font-semibold ${colors.text} mb-3`}>使用说明</h3>
        <div className={`text-sm ${colors.textMuted} space-y-2`}>
          <p>• 每个 API Key 绑定一个 Token，使用时会自动使用对应的 Token</p>
          <p>• API Key 格式为 sk-{'{48位十六进制}'}，兼容 OpenAI API 格式</p>
          <p>• 在「API 测试」页可以测试生成的 API Key</p>
          <p>• 删除 API Key 不会影响原始 Token</p>
        </div>
      </div>
    </div>
  )
}

export default ApiKeyManager
