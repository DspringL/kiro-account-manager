import { useState, useRef } from 'react'
import { relaunch } from '@tauri-apps/plugin-process'
import { X, Download, RefreshCw, Sparkles, CheckCircle2, FileText } from 'lucide-react'
import { useApp } from '../hooks/useApp'

function UpdateDialog({ updateInfo, update, onClose }) {
  const { t, theme, colors } = useApp()
  const isLightTheme = theme === 'light'
  const [installing, setInstalling] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(null)
  const [downloadSpeed, setDownloadSpeed] = useState(0)
  const [error, setError] = useState('')
  const lastDownloadedRef = useRef(0)
  const lastTimeRef = useRef(Date.now())

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond) => formatBytes(bytesPerSecond) + '/s'

  const doUpdate = async () => {
    if (!update) return
    setInstalling(true)
    setError('')
    setDownloadProgress({ percent: 0, downloaded: 0, total: 0 })
    lastDownloadedRef.current = 0
    lastTimeRef.current = Date.now()

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          setDownloadProgress({ percent: 0, downloaded: 0, total: event.data.contentLength || 0 })
        } else if (event.event === 'Progress') {
          setDownloadProgress(prev => {
            const downloaded = (prev?.downloaded || 0) + event.data.chunkLength
            const total = prev?.total || 0
            const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0
            const now = Date.now()
            const timeDiff = (now - lastTimeRef.current) / 1000
            if (timeDiff >= 0.5) {
              const speed = (downloaded - lastDownloadedRef.current) / timeDiff
              setDownloadSpeed(speed)
              lastDownloadedRef.current = downloaded
              lastTimeRef.current = now
            }
            return { percent, downloaded, total }
          })
        } else if (event.event === 'Finished') {
          setDownloadProgress(prev => ({ ...prev, percent: 100 }))
          setDownloadComplete(true)
          setInstalling(false)
        }
      })
    } catch (e) {
      setError(t('update.installFailed') + ': ' + e)
      setInstalling(false)
      setDownloadProgress(null)
    }
  }

  const doRelaunch = async () => {
    try {
      await relaunch()
    } catch (e) {
      setError(e.toString())
    }
  }

  const handleClose = () => {
    if (!installing) onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        className={`${colors.card} rounded-xl w-[480px] shadow-2xl overflow-hidden border ${colors.cardBorder}`}
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部横幅 */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5 relative">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur">
              <Sparkles size={28} className="text-white" />
            </div>
            <div className="text-white">
              <h2 className="text-xl font-bold">{t('update.newVersionAvailable')}</h2>
              <p className="text-white/80 text-sm mt-0.5">
                v{updateInfo?.version} {t('update.readyToInstall')}
              </p>
            </div>
          </div>
          {!installing && !downloadComplete && (
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X size={20} className="text-white/80" />
            </button>
          )}
        </div>

        <div className="p-6">
          {downloadComplete ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 text-emerald-500">
                <CheckCircle2 size={24} />
                <span className="text-lg font-medium">{t('update.downloadComplete')}</span>
              </div>
              <p className={`text-sm ${colors.textMuted}`}>{t('update.restartToInstall')}</p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${colors.card} ${colors.cardHover} ${colors.text} border ${colors.cardBorder}`}
                >
                  {t('update.installLater')}
                </button>
                <button
                  onClick={doRelaunch}
                  className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw size={16} />
                  {t('update.restartNow')}
                </button>
              </div>
            </div>
          ) : installing && downloadProgress ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className={colors.text}>{t('update.downloading')}...</span>
                <span className="text-blue-500 font-medium">{downloadProgress.percent}%</span>
              </div>
              <div className={`h-2 rounded-full overflow-hidden ${colors.cardSecondary}`}>
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-200"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
              <div className={`flex justify-between text-xs ${colors.textMuted}`}>
                <span>{formatBytes(downloadProgress.downloaded)} / {formatBytes(downloadProgress.total)}</span>
                <span>{formatSpeed(downloadSpeed)}</span>
              </div>
              <p className={`text-xs ${colors.textMuted} flex items-center gap-1.5`}>
                <RefreshCw size={12} className="animate-spin" />
                {t('update.doNotClose')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {updateInfo?.body && (
                <div>
                  <div className={`flex items-center gap-2 text-sm font-medium ${colors.text} mb-2`}>
                    <FileText size={16} />
                    {t('update.releaseNotes')}
                  </div>
                  <div className={`text-sm ${colors.textMuted} max-h-40 overflow-y-auto p-3 rounded-lg whitespace-pre-wrap leading-relaxed ${colors.cardSecondary}`}>
                    {updateInfo.body}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${colors.card} ${colors.cardHover} ${colors.text} border ${colors.cardBorder}`}
                >
                  {t('update.later')}
                </button>
                <button
                  onClick={doUpdate}
                  className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Download size={16} />
                  {t('update.updateNow')}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className={`mt-4 text-sm text-red-500 p-3 rounded-lg ${colors.error}`}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UpdateDialog
