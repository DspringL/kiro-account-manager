import { useState, useEffect } from 'react'
import { Coffee, X } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import alipayQR from '../../assets/donate/alipay.jpg'
import wechatQR from '../../assets/donate/wechat.jpg'

function WelcomeModal() {
  const { colors } = useApp()
  const [open, setOpen] = useState(false)
  const [previewImg, setPreviewImg] = useState(null)

  useEffect(() => {
    // 重要提示弹窗已隐藏，如需恢复请取消下方注释
    // const lastShown = localStorage.getItem('welcome_last_shown')
    // const today = new Date().toDateString()
    // if (lastShown !== today) {
    //   setOpen(true)
    // }
  }, [])

  const handleClose = () => {
    setOpen(false)
    // 用户关闭弹窗时才记录今天已显示
    const today = new Date().toDateString()
    localStorage.setItem('welcome_last_shown', today)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${colors.card} rounded-2xl w-full max-w-[520px] shadow-2xl border ${colors.cardBorder} relative overflow-hidden`}>
        {/* 背景装饰 - 简化 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className={`absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 z-10 cursor-pointer focus:ring-2 focus:ring-blue-500/30 ${colors.cardHover}`}
        >
          <X size={18} className={colors.text} />
        </button>

        {/* 头部 */}
        <div className="px-6 pt-6 pb-4 relative">
          <div className="flex items-center gap-4">
            {/* Logo - 简化 */}
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 bg-gradient-to-br from-[#4361ee] to-[#7c3aed] rounded-2xl flex items-center justify-center shadow-lg">
                <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                  <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
                </svg>
              </div>
            </div>

            <div className="flex-1">
              <h2 className={`text-xl font-bold ${colors.text} mb-1`}>
                ⚠️ 重要提示
              </h2>
              <p className={`text-sm ${colors.textMuted}`}>
                本软件永久免费
              </p>
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4 space-y-4 relative">
          {/* 免费声明 - 简化 */}
          <div className={`border-l-4 border-amber-500 ${colors.cardSecondary} rounded-r-xl p-4`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <span className="text-lg">⚠️</span>
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${colors.text} mb-2`}>
                  重要提示：本软件永久免费
                </p>
                <div className={`text-xs ${colors.textMuted} space-y-1.5 leading-relaxed`}>
                  <p>• 本软件完全开源免费，任何人不得以任何形式收费</p>
                  <p>• 所有功能完全开放，无任何限制</p>
                  <p>• 如有人向您收费，请立即举报</p>
                </div>
              </div>
            </div>
          </div>

          {/* 赞助信息 */}
          <div>
              <div className="flex items-center gap-2 mb-3">
                <Coffee size={18} className="text-amber-500" />
                <p className={`text-base font-semibold ${colors.text}`}>
                  💖 支持开源项目持续维护
                </p>
              </div>
              
              <div className={`${colors.cardSecondary} rounded-xl p-4 space-y-3`}>
                <p className={`text-sm ${colors.textMuted}`}>
                  如果这个工具帮到了你，可以请我喝杯咖啡 ☕
                </p>
                
                {/* 赞助福利 */}
                <div className={`bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-3 space-y-2`}>
                  <p className={`text-xs font-medium ${colors.text}`}>赞助用户将获得：</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚡</span>
                      <p className={`text-sm ${colors.text}`}>Issues 优先响应</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎯</span>
                      <p className={`text-sm ${colors.text}`}>功能建议优先考虑</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔧</span>
                      <p className={`text-sm ${colors.text}`}>Bug 优先处理</p>
                    </div>
                  </div>
                </div>
                
                {/* 二维码 - 简化 */}
                <div className="flex justify-center gap-8 pt-2">
                  <div 
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                    onClick={() => setPreviewImg(alipayQR)}
                  >
                    <div className="bg-white p-2 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
                      <img 
                        src={alipayQR} 
                        alt="支付宝" 
                        className="w-24 h-24 rounded-lg"
                      />
                    </div>
                    <p className={`text-sm font-medium ${colors.text}`}>支付宝</p>
                  </div>
                  <div 
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                    onClick={() => setPreviewImg(wechatQR)}
                  >
                    <div className="bg-white p-2 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
                      <img 
                        src={wechatQR} 
                        alt="微信支付" 
                        className="w-24 h-24 rounded-lg"
                      />
                    </div>
                    <p className={`text-sm font-medium ${colors.text}`}>微信支付</p>
                  </div>
                </div>
                <p className={`text-xs ${colors.textMuted} text-center`}>点击图片可放大查看</p>
              </div>
            </div>
          
        </div>

        {/* 底部按钮 - 简化 */}
        <div className={`px-6 py-4 ${colors.dialogFooter} flex justify-end relative`}>
          <button
            onClick={handleClose}
            className="px-6 py-3 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 active:scale-[0.98]"
          >
            我知道了
          </button>
        </div>
      </div>

      {/* 图片预览弹窗 */}
      {previewImg && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setPreviewImg(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img 
              src={previewImg} 
              alt="预览" 
              className="max-w-[360px] max-h-[360px] rounded-2xl shadow-2xl"
            />
            <button 
              className={`absolute -top-3 -right-3 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors duration-200 cursor-pointer focus:ring-2 focus:ring-blue-500/30 ${colors.card} border ${colors.cardBorder}`}
              onClick={() => setPreviewImg(null)}
            >
              <X size={18} className={colors.text} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WelcomeModal
