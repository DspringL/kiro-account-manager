import { useState, useEffect, useRef } from 'react'
import { Trash2, Download, Pause, Play, Filter } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { listen } from '@tauri-apps/api/event'

// 日志级别颜色
const LEVEL_COLORS = {
  ERROR: 'text-red-400',
  WARN: 'text-yellow-400',
  INFO: 'text-blue-400',
  DEBUG: 'text-gray-400',
  TRACE: 'text-gray-500',
}

// 日志级别过滤选项
const LOG_LEVELS = ['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG']

function LogsPage() {
  const { colors } = useApp()
  const [logs, setLogs] = useState([])
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const logsEndRef = useRef(null)
  const maxLogs = 500

  // 监听日志事件
  useEffect(() => {
    const unlisten = listen('kirogate-log', (event) => {
      if (paused) return
      
      const log = event.payload
      setLogs(prev => {
        const newLogs = [...prev, { ...log, id: Date.now() + Math.random() }]
        // 限制日志数量
        if (newLogs.length > maxLogs) {
          return newLogs.slice(-maxLogs)
        }
        return newLogs
      })
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [paused])

  // 自动滚动到底部
  useEffect(() => {
    if (!paused && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, paused])

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    // 级别过滤
    if (filter !== 'ALL') {
      const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']
      const filterIndex = levels.indexOf(filter)
      const logIndex = levels.indexOf(log.level)
      if (logIndex > filterIndex) return false
    }
    // 搜索过滤
    if (search) {
      return log.message.toLowerCase().includes(search.toLowerCase()) ||
             log.target?.toLowerCase().includes(search.toLowerCase())
    }
    return true
  })

  // 清空日志
  const clearLogs = () => setLogs([])

  // 导出日志
  const exportLogs = () => {
    const content = filteredLogs.map(log => 
      `[${log.timestamp}][${log.level}][${log.target}] ${log.message}`
    ).join('\n')
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kirogate-logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={`${colors.card} border ${colors.cardBorder} rounded-2xl p-4`}>
      {/* 工具栏 */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setPaused(!paused)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
            paused 
              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
              : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
          }`}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
          {paused ? '继续' : '暂停'}
        </button>

        <button
          onClick={clearLogs}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${colors.textMuted} hover:bg-white/5 transition-all`}
        >
          <Trash2 size={14} />
          清空
        </button>

        <button
          onClick={exportLogs}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${colors.textMuted} hover:bg-white/5 transition-all`}
        >
          <Download size={14} />
          导出
        </button>

        <div className="flex-1" />

        {/* 级别过滤 */}
        <div className="flex items-center gap-2">
          <Filter size={14} className={colors.textMuted} />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={`px-2 py-1 rounded-lg text-sm ${colors.input} ${colors.text} border-none outline-none`}
          >
            {LOG_LEVELS.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>

        {/* 搜索 */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索..."
          className={`px-3 py-1.5 rounded-lg text-sm ${colors.input} ${colors.text} w-40`}
        />

        <span className={`text-xs ${colors.textMuted}`}>
          {filteredLogs.length} / {logs.length}
        </span>
      </div>

      {/* 日志列表 */}
      <div className={`h-96 overflow-auto font-mono text-xs ${colors.input} rounded-xl p-3`}>
        {filteredLogs.length === 0 ? (
          <div className={`flex items-center justify-center h-full ${colors.textMuted}`}>
            {logs.length === 0 ? '暂无日志，启动服务器后会显示日志' : '没有匹配的日志'}
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className="py-0.5 hover:bg-white/5 rounded">
              <span className="text-gray-500">[{log.timestamp?.split('T')[1]?.slice(0, 8) || ''}]</span>
              <span className={`mx-1 ${LEVEL_COLORS[log.level] || 'text-gray-400'}`}>[{log.level}]</span>
              <span className="text-purple-400">[{log.target?.split('::').pop() || ''}]</span>
              <span className={colors.text}> {log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* 提示 */}
      <p className={`text-xs ${colors.textMuted} mt-3`}>
        💡 日志实时显示 KiroGate 服务器的运行状态，最多保留 {maxLogs} 条
      </p>
    </div>
  )
}

export default LogsPage
