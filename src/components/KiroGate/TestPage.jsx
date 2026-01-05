import { useState, useEffect } from 'react'
import { Send, Copy, Check, Loader2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { fetch } from '@tauri-apps/plugin-http'
import { useApp } from '../../hooks/useApp'
import { useAppSettings } from '../../contexts/AppSettingsContext'

function TestPage() {
  const { colors } = useApp()
  const { settings } = useAppSettings()
  
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState('你好，请介绍一下你自己。')
  const [model, setModel] = useState('claude-sonnet-4-5')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const port = settings?.kiroGatePort || 8000
  const serverUrl = `http://127.0.0.1:${port}`

  const models = [
    'claude-sonnet-4-5',
    'claude-sonnet-4',
    'claude-opus-4-5',
    'claude-haiku-4-5',
    'claude-3-7-sonnet-20250219'
  ]

  // 组件加载时自动加载 API Key
  useEffect(() => {
    loadApiKeyFromStorage(true)
  }, [])

  const loadApiKeyFromStorage = async (silent = false) => {
    try {
      const keys = await invoke('get_api_keys')
      if (keys.length > 0) {
        setApiKey(keys[keys.length - 1].apiKey)
      } else if (!silent) {
        alert('没有找到 API Key，请先在「API Key」页面生成')
      }
    } catch (e) {
      if (!silent) {
        alert('加载 API Key 失败: ' + e)
      }
    }
  }

  const testApi = async () => {
    if (!apiKey.trim() || !message.trim()) {
      alert('请填写 API Key 和消息内容')
      return
    }

    setLoading(true)
    setResponse('')

    try {
      // 使用 Tauri HTTP 插件发请求，绕过 CORS
      const resp = await fetch(`${serverUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: message }
          ],
          stream: false,
          max_tokens: 1000
        })
      })

      const text = await resp.text()
      
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${text}`)
      }

      try {
        const data = JSON.parse(text)
        setResponse(data.choices?.[0]?.message?.content || `无响应内容，原始数据: ${text}`)
      } catch {
        setResponse(`解析响应失败，原始数据: ${text}`)
      }
    } catch (error) {
      setResponse(`错误: ${error?.message || error || '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const testStreamApi = async () => {
    if (!apiKey.trim() || !message.trim()) {
      alert('请填写 API Key 和消息内容')
      return
    }

    setLoading(true)
    setResponse('')

    try {
      // 使用 Tauri HTTP 插件发请求
      const resp = await fetch(`${serverUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: message }
          ],
          stream: true,
          max_tokens: 1000
        })
      })

      if (!resp.ok) {
        const errorText = await resp.text()
        throw new Error(`HTTP ${resp.status}: ${errorText}`)
      }

      // Tauri HTTP 插件可能不支持流式读取，尝试直接读取全部内容
      const text = await resp.text()
      
      // 解析 SSE 格式的响应
      let content = ''
      const lines = text.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          
          try {
            const parsed = JSON.parse(data)
            const chunk = parsed.choices?.[0]?.delta?.content
            if (chunk) {
              content += chunk
              setResponse(content)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
      
      if (!content) {
        setResponse(`无内容，原始响应: ${text.slice(0, 500)}...`)
      }
    } catch (error) {
      setResponse(`错误: ${error?.message || error || '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const copyResponse = async () => {
    await navigator.clipboard.writeText(response)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      {/* 配置区域 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <h3 className={`font-semibold ${colors.text} mb-4`}>API 测试配置</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={`block text-sm mb-2 ${colors.textMuted}`}>服务地址</label>
            <input 
              type="text" 
              value={serverUrl}
              readOnly
              className={`w-full px-4 py-2.5 border rounded-xl ${colors.text} font-mono text-sm bg-blue-500/10 border-blue-500/30 cursor-default`}
            />
          </div>
          <div>
            <label className={`block text-sm mb-2 ${colors.textMuted}`}>模型</label>
            <select 
              value={model} 
              onChange={(e) => setModel(e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
            >
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className={`text-sm ${colors.textMuted}`}>API Key</label>
            <button 
              onClick={() => loadApiKeyFromStorage(false)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              重新加载
            </button>
          </div>
          <input 
            type="text" 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className={`w-full px-4 py-2.5 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all font-mono text-sm`}
          />
        </div>

        <div className="mb-4">
          <label className={`block text-sm mb-2 ${colors.textMuted}`}>测试消息</label>
          <textarea 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 resize-none`}
          />
        </div>

        <div className="flex gap-3">
          <button 
            onClick={testApi}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
              loading ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90'
            } text-white`}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            普通请求
          </button>
          <button 
            onClick={testStreamApi}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
              loading ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-teal-600 hover:opacity-90'
            } text-white`}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            流式请求
          </button>
        </div>
      </div>

      {/* 响应区域 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`font-semibold ${colors.text}`}>API 响应</h3>
          {response && (
            <button 
              onClick={copyResponse}
              className="p-2 rounded-lg hover:bg-white/10"
            >
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className={colors.textMuted} />}
            </button>
          )}
        </div>
        
        <div className={`min-h-[200px] p-4 rounded-xl bg-black/30 border ${colors.cardBorder}`}>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={24} className="animate-spin text-blue-400" />
              <span className="ml-2 text-blue-400">请求中...</span>
            </div>
          ) : response ? (
            <pre className={`text-sm ${colors.text} whitespace-pre-wrap break-words`}>
              {response}
            </pre>
          ) : (
            <div className={`text-center ${colors.textMuted} py-16`}>
              点击上方按钮开始测试 API
            </div>
          )}
        </div>
      </div>

      {/* 使用说明 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <h3 className={`font-semibold ${colors.text} mb-3`}>使用说明</h3>
        <div className={`text-sm ${colors.textMuted} space-y-2`}>
          <p>• 确保 KiroGate 服务器已启动</p>
          <p>• 在「Token 管理」页生成 API Key 后，点击「从本地加载」自动填入</p>
          <p>• 普通请求：一次性返回完整响应</p>
          <p>• 流式请求：实时显示生成过程，体验更好</p>
          <p>• 支持所有 Claude 模型，可以切换测试不同模型的效果</p>
        </div>
      </div>
    </div>
  )
}

export default TestPage
