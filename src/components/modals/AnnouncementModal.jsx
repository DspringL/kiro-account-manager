import { useState, useEffect } from 'react'
import { AlertTriangle, ExternalLink, MessageCircle } from 'lucide-react'
import { Checkbox } from '@mantine/core'
import { useApp } from '../../hooks/useApp'

// 公告 API
const ANNOUNCEMENT_API = 'https://kiro-website-six.vercel.app/api/announcement'

// 固定链接
const WEBSITE_URL = 'https://kiro-website-six.vercel.app'
const GITHUB_URL = 'https://github.com/hj01857655/kiro-account-manager'
const TUTORIAL_URL = 'https://xcn46cm1l4ir.feishu.cn/wiki/YfaAw3qnoixFJgkzTSmcgtPfntc'
const QQ_GROUP = '1020204332'
const QQ_GROUP_URL = 'https://qm.qq.com/q/Vh7mUrNpa8'

export default function AnnouncementModal() {
  const { t, colors } = useApp()
  const [show, setShow] = useState(false)
  const [announcement, setAnnouncement] = useState(null)
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    fetchAnnouncement()
  }, [])

  const fetchAnnouncement = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时
      
      // 从公告 API 获取公告列表
      const res = await fetch(ANNOUNCEMENT_API, {
        signal: controller.signal,
        cache: 'no-cache'
      })
      
      clearTimeout(timeoutId)
      
      if (!res.ok) {
        return
      }
      
      const data = await res.json()
      
      // 获取第一个启用的公告
      const announcement = data.announcements?.find(a => a.enabled)
      
      if (!announcement) {
        return
      }
      
      // 检查是否已读过此公告
      const readAnnouncements = JSON.parse(localStorage.getItem('readAnnouncements') || '[]')
      if (readAnnouncements.includes(announcement.id)) {
        return
      }
      
      // 补充固定链接（如果公告中没有）
      setAnnouncement({
        ...announcement,
        websiteUrl: announcement.websiteUrl || WEBSITE_URL,
        officialUrl: announcement.officialUrl || GITHUB_URL,
        tutorialUrl: announcement.tutorialUrl || TUTORIAL_URL,
        qqGroup: announcement.qqGroup || QQ_GROUP,
        qqGroupUrl: announcement.qqGroupUrl || QQ_GROUP_URL
      })
      setShow(true)
    } catch (e) {
      // 静默失败，不影响应用使用
      console.error('[Announcement] 获取失败:', e)
    }
  }

  const handleClose = (dontRemind = false) => {
    if (dontRemind && announcement) {
      // 保存已读状态
      const readAnnouncements = JSON.parse(localStorage.getItem('readAnnouncements') || '[]')
      if (!readAnnouncements.includes(announcement.id)) {
        readAnnouncements.push(announcement.id)
        localStorage.setItem('readAnnouncements', JSON.stringify(readAnnouncements))
      }
    }
    setShow(false)
  }

  if (!show) return null

  // 普通公告需要有内容才显示
  if (!announcement) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`relative w-[480px] max-w-[90vw] rounded-lg shadow-2xl border ${colors.card} ${colors.cardBorder} overflow-hidden animate-fade-in-up`}>
        {/* 顶部警告条 */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 flex items-center gap-3">
          <AlertTriangle size={24} className="text-white" />
          <span className="text-white font-bold text-lg">{announcement.title || t('announcement.title')}</span>
        </div>

        {/* 内容 */}
        <div className="p-6" style={{ padding: 'var(--mantine-spacing-md)' }}>
          <div className={`text-base leading-relaxed ${colors.text}`}>
            {announcement.content?.map((text, i) => (
              <p key={i} className={i === 0 ? 'mb-4 font-medium text-red-500' : 'mb-3'}>
                {text}
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
        <div className="px-6 pb-6" style={{ padding: 'var(--mantine-spacing-md)', paddingTop: 0 }}>
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
              onClick={() => handleClose(false)}
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
