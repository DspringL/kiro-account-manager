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
  const [apiFormat, setApiFormat] = useState('openai') // 'openai' | 'anthropic'
  const [stream, setStream] = useState(false)
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
      // 根据 API 格式选择端点和请求头
      const endpoint = apiFormat === 'openai' ? '/v1/chat/completions' : '/v1/messages'
      const headers = {
        'Content-Type': 'application/json'
      }
      
      if (apiFormat === 'openai') {
        headers['Authorization'] = `Bearer ${apiKey}`
      } else {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
      }

      // 根据 API 格式构建请求体
      const body = apiFormat === 'openai' ? {
        model: model,
        messages: [{ role: 'user', content: message }],
        stream: stream,
        max_tokens: 1000
      } : {
        model: model,
        messages: [{ role: 'user', content: message }],
        stream: stream,
        max_tokens: 1000
      }

      // 使用 Tauri HTTP 插件发请求，绕过 CORS
      const resp = await fetch(`${serverUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })

      const text = await resp.text()
      
      if (!resp.ok) {
        // 解析错误信息
        let serverMsg = ''
        try {
          const errorData = JSON.parse(text)
          if (typeof errorData.error === 'string') {
            serverMsg = errorData.error
          } else if (typeof errorData.error === 'object' && errorData.error?.message) {
            serverMsg = errorData.error.message
          } else if (errorData.detail) {
            serverMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail)
          } else if (errorData.message) {
            serverMsg = errorData.message
          }
        } catch {
          serverMsg = text
        }
        
        // 针对常见错误给出友好提示
        let errorMsg = ''
        if (resp.status === 401) {
          errorMsg = `认证失败 (401)\n\n可能原因：\n• API Key 无效或已过期\n• KiroGate Token 池为空，请先添加 Token`
        } else if (resp.status === 503) {
          errorMsg = `服务不可用 (503)\n\n可能原因：\n• KiroGate 服务未启动\n• 所有 Token 都已失效`
        } else if (resp.status === 429) {
          errorMsg = `请求过于频繁 (429)\n\n请稍后再试`
        } else {
          errorMsg = `请求失败 (${resp.status})${serverMsg ? `\n\n${serverMsg}` : ''}`
        }
        
        throw new Error(errorMsg)
      }

      if (stream) {
        // 解析 SSE 格式的响应
        parseStreamResponse(text)
      } else {
        // 解析普通响应
        parseNormalResponse(text)
      }
    } catch (error) {
      setResponse(`错误: ${error?.message || error || '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const parseNormalResponse = (text) => {
    try {
      const data = JSON.parse(text)
      if (apiFormat === 'openai') {
        setResponse(data.choices?.[0]?.message?.content || `无响应内容，原始数据: ${text}`)
      } else {
        const content = data.content?.find(c => c.type === 'text')?.text
        setResponse(content || `无响应内容，原始数据: ${text}`)
      }
    } catch {
      setResponse(`解析响应失败，原始数据: ${text}`)
    }
  }

  const parseStreamResponse = (text) => {
    let content = ''
    const lines = text.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (apiFormat === 'openai') {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const chunk = parsed.choices?.[0]?.delta?.content
            if (chunk) content += chunk
          } catch {}
        }
      } else {
        if (line.startsWith('event: content_block_delta')) {
          const nextLine = lines[i + 1]
          if (nextLine && nextLine.trim().startsWith('data: ')) {
            try {
              const data = JSON.parse(nextLine.trim().slice(6))
              const chunk = data.delta?.text
              if (chunk) content += chunk
            } catch {}
          }
        }
      }
    }
    
    setResponse(content || `无内容，原始响应: ${text.slice(0, 500)}...`)
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

        {/* API 格式选择 */}
        <div className="mb-4">
          <label className={`block text-sm mb-2 ${colors.textMuted}`}>API 格式</label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="apiFormat" 
                value="openai"
                checked={apiFormat === 'openai'}
                onChange={(e) => setApiFormat(e.target.value)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className={`text-sm ${colors.text}`}>OpenAI 格式</span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">/v1/chat/completions</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="apiFormat" 
                value="anthropic"
                checked={apiFormat === 'anthropic'}
                onChange={(e) => setApiFormat(e.target.value)}
                className="w-4 h-4 accent-purple-500"
              />
              <span className={`text-sm ${colors.text}`}>Anthropic 格式</span>
              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">/v1/messages</span>
            </label>
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

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={stream}
              onChange={(e) => setStream(e.target.checked)}
              className="w-4 h-4 accent-blue-500 rounded"
            />
            <span className={`text-sm ${colors.text}`}>流式输出</span>
          </label>
          <button 
            onClick={testApi}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
              loading ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90'
            } text-white`}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            发送请求
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
          <p>• 确保 KiroGate 服务器已启动（在「服务器」Tab 启动）</p>
          <p>• API Key 会自动加载，也可点击「重新加载」手动刷新</p>
          <p>• 勾选「流式输出」可测试流式响应</p>
        </div>
      </div>
    </div>
  )
}

export default TestPage
