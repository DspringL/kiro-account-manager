import { useState, useEffect } from 'react'
import { sessionApi } from '@/api/sessionApi'
import { SessionSummary, IdeSession } from '@/types/session'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Search, Trash2, Download, MessageSquare, ChevronRight, ChevronDown } from 'lucide-react'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { useDialog } from '@/contexts/DialogContext'
import { showSuccess, showError, showWarning } from '@/utils/toast'

export default function SessionManager() {
  const { showConfirm } = useDialog()
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null)
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set())
  const [workspaceSessions, setWorkspaceSessions] = useState<Map<string, SessionSummary[]>>(new Map())
  const [selectedSession, setSelectedSession] = useState<IdeSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWorkspaceHashes, setSelectedWorkspaceHashes] = useState<Set<string>>(new Set())

  // 加载 workspaces
  useEffect(() => {
    loadWorkspaces()
  }, [])

  const toggleWorkspace = async (workspaceHash: string) => {
    const newExpanded = new Set(expandedWorkspaces)

    if (newExpanded.has(workspaceHash)) {
      // 折叠
      newExpanded.delete(workspaceHash)
    } else {
      // 展开 - 加载该工作区的 sessions
      newExpanded.add(workspaceHash)
      if (!workspaceSessions.has(workspaceHash)) {
        await loadSessionsForWorkspace(workspaceHash)
      }
    }

    setExpandedWorkspaces(newExpanded)
  }

  const loadSessionsForWorkspace = async (workspaceHash: string) => {
    try {
      const data = await sessionApi.listSessions(workspaceHash)
      setWorkspaceSessions(prev => new Map(prev).set(workspaceHash, data))
    } catch (error) {
      console.error('Failed to load sessions:', error)
      showError('加载会话列表失败：' + error)
    }
  }

  const decodeWorkspaceName = (hash: string) => {
    try {
      // 移除末尾的 __ 或 _
      const cleaned = hash.replace(/_+$/, '')
      // Base64 解码
      const decoded = atob(cleaned)
      // 提取最后一个路径段作为显示名称
      const parts = decoded.split(/[/\\]/)
      const name = parts[parts.length - 1] || parts[parts.length - 2] || decoded
      return name
    } catch {
      return hash
    }
  }

  const loadWorkspaces = async () => {
    try {
      setLoading(true)
      const data = await sessionApi.listWorkspaces()
      setWorkspaces(data)
    } catch (error) {
      console.error('Failed to load workspaces:', error)
      showError('加载工作区失败：' + error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSession = async (workspaceHash: string, session: SessionSummary) => {
    // 如果点击的是当前已选中的 session，不重复加载
    if (selectedSession?.sessionId === session.sessionId) {
      return
    }

    try {
      setLoading(true)
      setSelectedSession(null) // 先清空，避免显示旧数据
      const data = await sessionApi.loadSession(workspaceHash, session.sessionId)
      setSelectedSession(data)
    } catch (error) {
      console.error('Failed to load session:', error)
      showError('加载失败：' + error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteWorkspace = async (workspaceHash: string) => {
    const workspaceName = decodeWorkspaceName(workspaceHash)

    const confirmed = await showConfirm(
      '删除工作区',
      `确定要删除工作区 "${workspaceName}" 及其所有会话吗？\n\n此操作不可恢复！`
    )

    if (!confirmed) return

    try {
      setLoading(true)

      // 直接删除整个工作区目录
      await sessionApi.deleteWorkspace(workspaceHash)

      // 重新加载工作区列表
      await loadWorkspaces()

      // 清空相关状态
      setExpandedWorkspaces(prev => {
        const newSet = new Set(prev)
        newSet.delete(workspaceHash)
        return newSet
      })
      setWorkspaceSessions(prev => {
        const newMap = new Map(prev)
        newMap.delete(workspaceHash)
        return newMap
      })
      if (selectedWorkspace === workspaceHash) {
        setSelectedWorkspace(null)
        setSelectedSession(null)
      }

      showSuccess(`成功删除工作区 "${workspaceName}"`)
    } catch (error) {
      console.error('Failed to delete workspace:', error)
      showError('删除工作区失败：' + error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (workspaceHash: string, session: SessionSummary) => {
    const confirmed = await showConfirm(
      '删除会话',
      `确定要删除会话 "${session.title}" 吗？`
    )

    if (!confirmed) return

    try {
      await sessionApi.deleteSession(session.workspaceHash, session.sessionId)

      // 重新加载该工作区的会话列表
      await loadSessionsForWorkspace(workspaceHash)

      // 如果删除的是当前选中的 session，清空详情
      if (selectedSession?.sessionId === session.sessionId) {
        setSelectedSession(null)
      }
      showSuccess('会话已删除')
    } catch (error) {
      console.error('Failed to delete session:', error)
      showError('删除失败：' + error)
    }
  }

  const toggleWorkspaceSelection = (workspaceHash: string) => {
    const newSelected = new Set(selectedWorkspaceHashes)
    if (newSelected.has(workspaceHash)) {
      newSelected.delete(workspaceHash)
    } else {
      newSelected.add(workspaceHash)
    }
    setSelectedWorkspaceHashes(newSelected)
  }

  const toggleSelectAllWorkspaces = () => {
    if (selectedWorkspaceHashes.size === workspaces.length) {
      setSelectedWorkspaceHashes(new Set())
    } else {
      setSelectedWorkspaceHashes(new Set(workspaces))
    }
  }

  const handleBatchDeleteWorkspaces = async () => {
    if (selectedWorkspaceHashes.size === 0) {
      showWarning('请先选择要删除的工作区')
      return
    }

    const workspaceNames = Array.from(selectedWorkspaceHashes)
      .map(hash => decodeWorkspaceName(hash))
      .join('、')

    const confirmed = await showConfirm(
      '批量删除工作区',
      `确定要删除选中的 ${selectedWorkspaceHashes.size} 个工作区及其所有会话吗？\n\n工作区：${workspaceNames}\n\n此操作不可恢复！`
    )

    if (!confirmed) return

    try {
      setLoading(true)

      // 直接删除所有选中的工作区目录
      for (const workspaceHash of selectedWorkspaceHashes) {
        await sessionApi.deleteWorkspace(workspaceHash)
      }

      // 重新加载工作区列表
      await loadWorkspaces()

      // 清空相关状态
      setExpandedWorkspaces(new Set())
      setWorkspaceSessions(new Map())
      setSelectedWorkspaceHashes(new Set())
      setSelectedWorkspace(null)
      setSelectedSession(null)

      showSuccess(`成功删除 ${selectedWorkspaceHashes.size} 个工作区`)
    } catch (error) {
      console.error('Failed to batch delete workspaces:', error)
      showError('批量删除失败：' + error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportSession = async (format: 'json' | 'markdown') => {
    if (!selectedSession) return

    try {
      // 从 workspaceSessions 中找到对应的 session 获取 workspaceHash
      let workspaceHash = ''
      for (const [hash, sessions] of workspaceSessions.entries()) {
        if (sessions.some(s => s.sessionId === selectedSession.sessionId)) {
          workspaceHash = hash
          break
        }
      }

      if (!workspaceHash) {
        showError('无法找到会话所属的工作区')
        return
      }

      const content = await sessionApi.exportSession(
        workspaceHash,
        selectedSession.sessionId,
        format
      )

      const ext = format === 'json' ? 'json' : 'md'
      const defaultPath = `${selectedSession.title}.${ext}`

      const filePath = await save({
        defaultPath,
        filters: [{
          name: format === 'json' ? 'JSON' : 'Markdown',
          extensions: [ext]
        }]
      })

      if (filePath) {
        await writeTextFile(filePath, content)
        showSuccess('导出成功！')
      }
    } catch (error) {
      console.error('Failed to export session:', error)
      showError('导出失败：' + error)
    }
  }

  const filteredSessions = searchQuery
    ? Array.from(workspaceSessions.values())
      .flat()
      .filter(session => session.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-'
    return new Date(timestamp * 1000).toLocaleString('zh-CN')
  }

  // 获取工作区的会话列表
  const getWorkspaceSessions = (workspaceHash: string) => {
    return workspaceSessions.get(workspaceHash) || []
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold">会话管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理 Kiro IDE 的 chat sessions
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Workspaces with expandable sessions */}
        <div className="w-80 border-r flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">工作区与会话</h2>
              {selectedWorkspaceHashes.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBatchDeleteWorkspaces}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  删除 ({selectedWorkspaceHashes.size})
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
              <span>{workspaces.length} 个工作区</span>
              {workspaces.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={toggleSelectAllWorkspaces}
                >
                  {selectedWorkspaceHashes.size === workspaces.length ? '取消全选' : '全选'}
                </Button>
              )}
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索会话..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {/* 搜索模式：显示所有匹配的会话 */}
              {searchQuery && (
                <div className="space-y-2">
                  {filteredSessions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      未找到匹配的会话
                    </div>
                  ) : (
                    filteredSessions.map(session => (
                      <Card
                        key={session.sessionId}
                        className={`p-3 cursor-pointer hover:bg-accent transition-colors ${selectedSession?.sessionId === session.sessionId ? 'bg-accent' : ''
                          }`}
                        onClick={() => handleSelectSession(session.workspaceHash, session)}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm line-clamp-2">
                                {session.title}
                              </h3>
                              <p className="text-xs text-muted-foreground truncate mt-1">
                                {decodeWorkspaceName(session.workspaceHash)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 hover:bg-destructive hover:text-destructive-foreground"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteSession(session.workspaceHash, session)
                              }}
                              title="删除会话"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              {session.sessionType}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {session.messageCount}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(session.fileSize)}
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* 正常模式：显示工作区树 */}
              {!searchQuery && workspaces.map(workspace => {
                const isExpanded = expandedWorkspaces.has(workspace)
                const sessions = getWorkspaceSessions(workspace)

                return (
                  <div key={workspace} className="space-y-1">
                    {/* Workspace Row */}
                    <div
                      className={`group relative rounded-md transition-all ${selectedWorkspace === workspace
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : ''
                        }`}
                    >
                      <div className="flex items-center gap-2 px-2 py-2">
                        {/* Expand/Collapse Icon */}
                        <button
                          onClick={() => toggleWorkspace(workspace)}
                          className="shrink-0 hover:bg-accent rounded p-1"
                          title={isExpanded ? '折叠' : '展开'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>

                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedWorkspaceHashes.has(workspace)}
                          onChange={(e) => {
                            e.stopPropagation()
                            toggleWorkspaceSelection(workspace)
                          }}
                          className="h-4 w-4 rounded border-gray-300 cursor-pointer shrink-0"
                        />

                        {/* Workspace Name */}
                        <button
                          onClick={() => setSelectedWorkspace(workspace)}
                          className={`flex-1 text-left text-sm transition-all rounded-md px-2 py-1 ${selectedWorkspace === workspace
                              ? ''
                              : 'hover:bg-accent'
                            }`}
                          title={workspace}
                        >
                          <div className="truncate font-medium">
                            {decodeWorkspaceName(workspace)}
                          </div>
                          {isExpanded && sessions.length > 0 && (
                            <div className="text-xs opacity-70 mt-0.5">
                              {sessions.length} 个会话
                            </div>
                          )}
                        </button>

                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 shrink-0 ${selectedWorkspace === workspace
                              ? 'text-primary-foreground hover:bg-primary-foreground/20'
                              : 'hover:bg-destructive hover:text-destructive-foreground'
                            }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteWorkspace(workspace)
                          }}
                          title="删除工作区"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Sessions under this workspace (when expanded) */}
                    {isExpanded && (
                      <div className="ml-6 space-y-1">
                        {loading && sessions.length === 0 ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : sessions.length === 0 ? (
                          <div className="text-xs text-muted-foreground py-2 px-3">
                            暂无会话
                          </div>
                        ) : (
                          sessions.map(session => (
                            <Card
                              key={session.sessionId}
                              className={`p-2 cursor-pointer hover:bg-accent transition-colors ${selectedSession?.sessionId === session.sessionId ? 'bg-accent' : ''
                                }`}
                              onClick={() => handleSelectSession(workspace, session)}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="font-medium text-xs line-clamp-2 flex-1">
                                    {session.title}
                                  </h3>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 shrink-0 hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteSession(workspace, session)
                                    }}
                                    title="删除会话"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="secondary" className="text-xs h-4 px-1.5">
                                    {session.sessionType}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MessageSquare className="h-2.5 w-2.5" />
                                    {session.messageCount}
                                  </span>
                                </div>
                              </div>
                            </Card>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Session Detail */}
        <div className="flex-1 flex flex-col">
          {loading && selectedSession === null ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : selectedSession ? (
            <>
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold truncate">{selectedSession.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {selectedSession.workspaceDirectory}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportSession('json')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportSession('markdown')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Markdown
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4 max-w-4xl">
                  {/* Conversation Summary - 从第一条消息中提取 */}
                  {selectedSession.history.length > 0 &&
                    selectedSession.history[0].message.role === 'user' &&
                    selectedSession.history[0].message.content.length > 0 &&
                    (selectedSession.history[0].message.content[0].text.includes('CONTEXT TRANSFER') ||
                      selectedSession.history[0].message.content[0].text.includes('## TASK') ||
                      selectedSession.title.includes('(Continued)')) && (
                      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl shrink-0">📝</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium mb-2 text-blue-900 dark:text-blue-100">
                              对话摘要（上下文压缩）
                            </div>
                            <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap break-words">
                              {selectedSession.history[0].message.content[0].text}
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}

                  {/* Messages */}
                  {selectedSession.history.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      此会话没有消息
                    </div>
                  ) : (
                    selectedSession.history.map((item, index) => {
                      // 跳过第一条摘要消息（如果是压缩会话）
                      const isSummaryMessage = index === 0 &&
                        item.message.role === 'user' &&
                        item.message.content.length > 0 &&
                        (item.message.content[0].text.includes('CONTEXT TRANSFER') ||
                          item.message.content[0].text.includes('## TASK') ||
                          selectedSession.title.includes('(Continued)'))

                      if (isSummaryMessage) {
                        return null
                      }

                      return (
                        <Card key={item.message.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="text-2xl shrink-0">
                              {item.message.role === 'user' ? '👤' : '🤖'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium mb-2">
                                {item.message.role === 'user' ? 'User' : 'Assistant'}
                              </div>
                              {item.message.content.map((content, i) => (
                                <div key={i} className="whitespace-pre-wrap text-sm break-words">
                                  {content.text}
                                </div>
                              ))}
                            </div>
                          </div>
                        </Card>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">选择一个会话查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
