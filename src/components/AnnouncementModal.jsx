import { useState, useEffect } from 'react'
import { AlertTriangle, ExternalLink, MessageCircle, Download, Loader2 } from 'lucide-react'
import { Checkbox } from '@mantine/core'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { useApp } from '../hooks/useApp'

// 公告 API 地址
const ANNOUNCEMENT_API = 'https://vercel-api-lemon-five.vercel.app/api/announcement'
const CURRENT_VERSION = __APP_VERSION__ || '0.0.0'

// 版本比较
const compareVersions = (v1, v2) => {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number)
  const parts2 = v2.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 < p2) return -1
    if (p1 > p2) return 1
  }
  return 0
}

export default function AnnouncementModal() {
  const { t, theme, colors } = useApp()
  const isLightTheme = theme === 'light'
  const [show, setShow] = useState(false)
  const [announcement, setAnnouncement] = useState(null)
  const [forceUpdate, setForceUpdate] = useState(null)
  const [agreed, setAgreed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    fetchAnnouncement()
  }, [])

  const fetchAnnouncement = async () => {
    try {
      const res = await fetch(ANNOUNCEMENT_API)
      if (!res.ok) return
      
      const data = await res.json()
      
      // 检查强制更新
      if (data.forceUpdate?.enabled) {
        const needUpdate = compareVersions(CURRENT_VERSION, data.forceUpdate.minVersion) < 0
        if (needUpdate) {
          setForceUpdate(data.forceUpdate)
          setShow(true)
          return
        }
      }
      
      // 处理公告（兼容新旧格式）
      const list = data.announcements || (Array.isArray(data) ? data : [data])
      const readIds = JSON.parse(localStorage.getItem('announcement_read_ids') || '[]')
      
      // 找到第一个未读的启用公告
      const unread = list.find(a => a.enabled && !readIds.includes(a.id))
      if (!unread) return
      
      setAnnouncement(unread)
      setShow(true)
    } catch (e) {
      console.log('[Announcement] 获取公告失败:', e)
    }
  }

  const handleClose = () => {
    // 强制更新不允许关闭
    if (forceUpdate) return
    
    if (announcement?.id) {
      const readIds = JSON.parse(localStorage.getItem('announcement_read_ids') || '[]')
      if (!readIds.includes(announcement.id)) {
        readIds.push(announcement.id)
        localStorage.setItem('announcement_read_ids', JSON.stringify(readIds))
      }
    }
    setShow(false)
  }

  const handleUpdate = async () => {
    setUpdating(true)
    try {
      const update = await check()
      if (update) {
        let downloaded = 0
        await update.downloadAndInstall((event) => {
          if (event.event === 'Started' && event.data.contentLength) {
            setProgress(0)
          } else if (event.event === 'Progress') {
            downloaded += event.data.chunkLength
            // 简单进度显示
            setProgress(prev => Math.min(prev + 1, 99))
          } else if (event.event === 'Finished') {
            setProgress(100)
          }
        })
        await relaunch()
      }
    } catch (e) {
      console.error('[Update] 更新失败:', e)
      // 失败时跳转到下载页面
      window.open('https://github.com/hj01857655/kiro-account-manager/releases/latest', '_blank')
    }
    setUpdating(false)
  }

  const handleDownload = () => {
    window.open('https://github.com/hj01857655/kiro-account-manager/releases/latest', '_blank')
  }

  if (!show) return null

  // 强制更新弹窗
  if (forceUpdate) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className={`relative w-[420px] max-w-[90vw] rounded-2xl shadow-2xl border ${colors.card} ${colors.cardBorder} overflow-hidden`}>
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 flex items-center gap-3">
            <AlertTriangle size={24} className="text-white" />
            <span className="text-white font-bold text-lg">需要更新</span>
          </div>
          <div className="p-6">
            <p className={`text-base mb-4 ${colors.text}`}>{forceUpdate.message}</p>
            <p className={`text-sm ${colors.textMuted}`}>
              当前版本: v{CURRENT_VERSION} → 最低要求: v{forceUpdate.minVersion}
            </p>
            {updating && progress > 0 && (
              <div className="mt-4">
                <div className={`h-2 rounded-full ${colors.cardSecondary}`}>
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className={`text-xs mt-1 ${colors.textMuted}`}>下载中... {progress}%</p>
              </div>
            )}
          </div>
          <div className="px-6 pb-6 space-y-2">
            <button
              onClick={handleUpdate}
              disabled={updating}
              className="w-full py-3 rounded-xl font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
            >
              {updating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {updating ? '更新中...' : '立即更新'}
            </button>
            <button
              onClick={handleDownload}
              className={`w-full py-2 rounded-xl text-sm ${colors.textMuted} hover:underline transition-all`}
            >
              手动下载
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 普通公告需要有内容才显示
  if (!announcement) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`relative w-[480px] max-w-[90vw] rounded-2xl shadow-2xl border ${colors.card} ${colors.cardBorder} overflow-hidden animate-fade-in-up`}>
        {/* 顶部警告条 */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 flex items-center gap-3">
          <AlertTriangle size={24} className="text-white" />
          <span className="text-white font-bold text-lg">{announcement.title || t('announcement.title')}</span>
        </div>

        {/* 内容 */}
        <div className="p-6">
          <div className={`text-base leading-relaxed ${colors.text}`}>
            {announcement.content?.map((text, i) => (
              <p key={i} className={i === 0 ? 'mb-4 font-medium text-red-500' : 'mb-3'}>
                {i === 0 && '⚠️ '}{text}
              </p>
            ))}
          </div>

          {/* 官方开源信息 */}
          {(announcement.websiteUrl || announcement.officialUrl || announcement.qqGroup) && (
            <div className={`mt-5 p-4 rounded-xl ${colors.cardSecondary}`}>
              <p className={`text-sm font-medium mb-3 ${colors.text}`}>相关链接</p>
              <div className="flex flex-wrap gap-2">
                {announcement.websiteUrl && (
                  <a 
                    href={announcement.websiteUrl}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm hover:opacity-90 transition"
                  >
                    <span>🌐</span>
                    <span>官网</span>
                  </a>
                )}
                {announcement.officialUrl && (
                  <a 
                    href={announcement.officialUrl}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${colors.cardHover} ${colors.text}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                    <span>GitHub</span>
                  </a>
                )}
                {announcement.tutorialUrl && (
                  <a 
                    href={announcement.tutorialUrl}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${colors.cardHover} ${colors.primary}`}
                  >
                    <span>📖</span>
                    <span>教程</span>
                  </a>
                )}
                {announcement.qqGroup && (
                  <a 
                    href={announcement.qqGroupUrl || '#'}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${colors.cardHover} ${colors.primary}`}
                  >
                    <MessageCircle size={14} />
                    <span>QQ群</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* 续杯交流群 */}
          {announcement.buyGroup && (
            <div className={`mt-3 p-4 rounded-xl ${colors.cardSecondary}`}>
              <p className={`text-sm font-medium mb-3 ${colors.text}`}>账号购买需求：</p>
              <div className="space-y-2">
                {announcement.buyUrl && (
                  <a 
                    href={announcement.buyUrl}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:text-blue-400 text-sm"
                  >
                    <ExternalLink size={14} className="shrink-0" />
                    <span>在线购买</span>
                  </a>
                )}
                {announcement.refillTutorialUrl && (
                  <a 
                    href={announcement.refillTutorialUrl}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:text-blue-400 text-sm"
                  >
                    <ExternalLink size={14} className="shrink-0" />
                    <span>Kiro续杯教程</span>
                  </a>
                )}
                <a 
                  href={announcement.buyGroupUrl || '#'}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-500 hover:text-blue-400 text-sm"
                >
                  <MessageCircle size={14} className="shrink-0" />
                  <span>{announcement.buyGroup}</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-6 pb-6">
          <label className={`flex items-center gap-3 mb-4 cursor-pointer select-none ${colors.text}`}>
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.currentTarget.checked)}
              classNames={{
                input: 'cursor-pointer'
              }}
            />
            <span className="text-sm">我已阅读并知晓以上内容</span>
          </label>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={!agreed}
              className={`flex-1 py-3 rounded-xl border font-medium transition-all ${
                agreed 
                  ? `${colors.cardBorder} ${colors.text} ${colors.cardHover}`
                  : `${colors.cardBorder} ${colors.textMuted} cursor-not-allowed opacity-50`
              }`}
            >
              {t('announcement.dontRemind')}
            </button>
            <button
              onClick={handleClose}
              disabled={!agreed}
              className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                agreed 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90' 
                  : `${colors.btnDisabled} cursor-not-allowed`
              }`}
            >
              {t('announcement.understand')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
