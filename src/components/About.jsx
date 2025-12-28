import { useState, useEffect } from 'react'
import { Github, Heart, Coffee, ExternalLink, Sparkles, Code2, Palette, Cpu, RefreshCw, X, BookOpen, ShoppingCart } from 'lucide-react'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { check } from '@tauri-apps/plugin-updater'
import { useApp } from '../hooks/useApp'
import { useDialog } from '../contexts/DialogContext'
import alipayQR from '../assets/donate/alipay.jpg'
import wechatQR from '../assets/donate/wechat.jpg'

function About() {
  const { t, theme, colors } = useApp()
  const { showUpdate, showInfo } = useDialog()
  const isDark = theme === 'dark'
  const [version, setVersion] = useState('')
  const [checking, setChecking] = useState(false)
  const [previewImg, setPreviewImg] = useState(null)

  useEffect(() => {
    getVersion().then(setVersion)
  }, [])

  const checkUpdate = async () => {
    setChecking(true)
    try {
      // 先用自定义命令检查（支持代理）
      const result = await invoke('check_update')
      console.log('[Update] 检查结果:', result)

      if (result.has_update && result.latest_version) {
        // 有更新，再用 Tauri updater 获取完整的 update 对象
        const updateResult = await check()
        if (updateResult) {
          // 显示更新弹窗
          showUpdate(
            { version: result.latest_version, body: result.notes },
            updateResult
          )
        }
      } else {
        // 已是最新版本
        showInfo(t('about.checkUpdate'), t('about.upToDate'))
      }
    } catch (e) {
      console.error('Check update failed:', e)
      // 网络错误等情况，显示已是最新版本
      showInfo(t('about.checkUpdate'), t('about.upToDate'))
    } finally {
      setChecking(false)
    }
  }

  const techStack = [
    { icon: Code2, label: t('about.frontend'), value: 'React + Vite', color: 'text-cyan-500' },
    { icon: Palette, label: t('about.ui'), value: 'TailwindCSS', color: 'text-pink-500' },
    { icon: Cpu, label: t('about.backend'), value: 'Tauri + Rust', color: 'text-orange-500' },
  ]

  return (
    <div className={`h-full ${colors.main} p-6 overflow-auto`}>
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      
      <div className="max-w-2xl mx-auto">
        {/* 头部卡片 */}
        <div className={`card-glow ${colors.card} rounded-2xl p-8 shadow-lg border ${colors.cardBorder} text-center mb-6 opacity-0 animate-scale-in`}>
          {/* Logo */}
          <div className="flex justify-center mb-5">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />
              <div className="relative w-20 h-20 bg-gradient-to-br from-[#4361ee] to-[#7c3aed] rounded-3xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-all animate-float">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
                </svg>
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shadow-md">
                <Sparkles size={14} className="text-white" />
              </div>
            </div>
          </div>

          <h1 className={`text-2xl font-bold ${colors.text} mb-3`}>{t('about.appName')}</h1>
          
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className={`px-3 py-1 ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'} rounded-full text-sm font-medium`}>
              v{version || '...'}
            </span>
            <button
              onClick={checkUpdate}
              disabled={checking}
              className={`btn-icon px-3 py-1 ${isDark ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-green-100 text-green-600 hover:bg-green-200'} rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors`}
            >
              <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
              {checking ? t('about.checking') : t('about.checkUpdate')}
            </button>
          </div>

          <p className={`${colors.textMuted} text-sm mb-5`}>{t('about.appDesc')}</p>

          {/* 技术栈 */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {techStack.map(({ icon: Icon, label, value, color }) => (
              <div key={label} className={`flex items-center gap-1.5 px-3 py-1.5 ${isDark ? 'bg-white/5' : 'bg-gray-100'} rounded-full`}>
                <Icon size={14} className={color} />
                <span className={`text-xs ${colors.textMuted}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 链接 */}
        <div className={`card-glow ${colors.card} rounded-2xl p-6 shadow-lg border ${colors.cardBorder} mb-6 opacity-0 animate-fade-in-up delay-100`}>
          <h3 className={`text-sm font-medium ${colors.text} mb-4 text-center`}>{t('about.links')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <a 
              href="https://www.kdocs.cn/l/cv2n0PViyD7a" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`flex items-center gap-3 ${isDark ? 'bg-purple-600 hover:bg-purple-500' : 'bg-purple-500 hover:bg-purple-600'} rounded-xl p-3 transition-colors group`}
            >
              <BookOpen size={18} className="text-white" />
              <span className="text-white text-sm font-medium">{t('about.tutorial')}</span>
              <ExternalLink size={14} className="text-white/50 ml-auto group-hover:text-white" />
            </a>
            <a 
              href="https://github.com/hj01857655/kiro-account-manager" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`flex items-center gap-3 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-900 hover:bg-gray-800'} rounded-xl p-3 transition-colors group`}
            >
              <Github size={18} className="text-white" />
              <span className="text-white text-sm font-medium">GitHub</span>
              <ExternalLink size={14} className="text-white/50 ml-auto group-hover:text-white" />
            </a>
            <a 
              href="https://qm.qq.com/q/Vh7mUrNpa8" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`flex items-center gap-3 ${isDark ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-500 hover:bg-blue-600'} rounded-xl p-3 transition-colors group`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-1.77 1.182 0 .686 4.078.43 6.29.43 2.213 0 6.29.256 6.29-.43 0-.687-1.77-1.182-1.77-1.182 2.085-1.77 1.905-3.967 1.905-3.967.845 1.588 1.634 2.072 1.746 2.072.111 0 .283-.36.283-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.29 3.364 14.268 2 12.003 2z"/>
              </svg>
              <span className="text-white text-sm font-medium">{t('about.qqGroup')}</span>
              <ExternalLink size={14} className="text-white/50 ml-auto group-hover:text-white" />
            </a>
            <a 
              href="https://pay.ldxp.cn/shop/hj01857655" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`flex items-center gap-3 ${isDark ? 'bg-amber-600 hover:bg-amber-500' : 'bg-amber-500 hover:bg-amber-600'} rounded-xl p-3 transition-colors group`}
            >
              <ShoppingCart size={18} className="text-white" />
              <span className="text-white text-sm font-medium">{t('about.shop')}</span>
              <ExternalLink size={14} className="text-white/50 ml-auto group-hover:text-white" />
            </a>
          </div>
        </div>

        {/* 赞赏 */}
        <div className={`card-glow ${colors.card} rounded-2xl p-6 shadow-lg border ${colors.cardBorder} mb-6 opacity-0 animate-fade-in-up delay-300`}>
          <div className="flex items-center justify-center gap-2 mb-5">
            <Coffee size={18} className="text-amber-500" />
            <span className={`text-base font-medium ${colors.text}`}>{t('about.donate')}</span>
          </div>
          <div className="flex justify-center gap-10">
            <div className="text-center cursor-pointer group" onClick={() => setPreviewImg(alipayQR)}>
              <img src={alipayQR} alt={t('about.alipay')} className="w-28 h-28 rounded-xl object-cover mb-2 group-hover:scale-105 transition-transform shadow-lg" />
              <span className={`text-sm ${colors.textMuted}`}>{t('about.alipay')}</span>
            </div>
            <div className="text-center cursor-pointer group" onClick={() => setPreviewImg(wechatQR)}>
              <img src={wechatQR} alt={t('about.wechat')} className="w-28 h-28 rounded-xl object-cover mb-2 group-hover:scale-105 transition-transform shadow-lg" />
              <span className={`text-sm ${colors.textMuted}`}>{t('about.wechat')}</span>
            </div>
          </div>
          <p className={`text-xs ${colors.textMuted} text-center mt-4`}>{t('about.clickToEnlarge')}</p>
        </div>

        {/* 底部 */}
        <div className={`flex items-center justify-center gap-2 text-sm ${colors.textMuted} opacity-0 animate-fade-in delay-400`}>
          <span>{t('about.madeWith')}</span>
          <Heart size={14} className="text-red-500 fill-red-500" />
          <span>{t('about.by')} hj01857655</span>
          <span className="mx-1">·</span>
          <span>© 2025</span>
        </div>
      </div>

      {/* 图片预览弹窗 */}
      {previewImg && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setPreviewImg(null)}
        >
          <div className="relative">
            <img src={previewImg} alt="预览" className="max-w-[320px] max-h-[320px] rounded-2xl shadow-2xl" />
            <button 
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              onClick={() => setPreviewImg(null)}
            >
              <X size={16} className="text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default About
