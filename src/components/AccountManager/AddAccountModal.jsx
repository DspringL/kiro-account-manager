import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { X, Download, Key, Shield, ChevronDown } from 'lucide-react'
import { useApp } from '../../hooks/useApp'

function AddAccountModal({ onClose, onSuccess }) {
  const { t, theme, colors } = useApp()
  const isLightTheme = theme === 'light'
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [accountType, setAccountType] = useState('social') // 'social' | 'idc'
  const [socialProvider, setSocialProvider] = useState('Google') // 'Google' | 'Github'
  const [refreshToken, setRefreshToken] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [region, setRegion] = useState('us-east-1')
  const [machineId, setMachineId] = useState('')

  const awsRegions = [
    { value: 'us-east-1', label: 'us-east-1 (N. Virginia)' },
    { value: 'us-west-2', label: 'us-west-2 (Oregon)' },
    { value: 'eu-west-1', label: 'eu-west-1 (Ireland)' },
  ]

  const handleSaveLocal = async () => {
    setAddLoading(true)
    setAddError('')
    try {
      await invoke('add_local_kiro_account')
      onSuccess()
      onClose()
    } catch (e) {
      setAddError(e.toString())
    } finally {
      setAddLoading(false)
    }
  }

  const handleAddManual = async () => {
    if (!refreshToken) {
      setAddError(t('addAccount.errorNoToken'))
      return
    }
    
    // 校验 token 格式
    // Social (Google/Github) 的 refreshToken 以 aor 开头
    if (accountType === 'social' && !refreshToken.startsWith('aor')) {
      setAddError(t('addAccount.errorSocialFormat'))
      return
    }
    
    setAddLoading(true)
    setAddError('')
    try {
      if (accountType === 'idc') {
        if (!clientId || !clientSecret) {
          setAddError(t('addAccount.errorNoClientId'))
          setAddLoading(false)
          return
        }
        await invoke('add_account_by_idc', { 
          refreshToken, 
          clientId, 
          clientSecret, 
          region,
          machineId: machineId.trim() || null
        })
      } else {
        // Social 账号，使用用户选择的 provider
        await invoke('add_account_by_social', { 
          refreshToken, 
          provider: socialProvider,
          machineId: machineId.trim() || null
        })
      }
      onSuccess()
      onClose()
    } catch (e) {
      setAddError(e.toString())
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className={`${colors.card} rounded-2xl w-full max-w-[420px] shadow-2xl border ${colors.cardBorder} overflow-hidden`} 
        onClick={e => e.stopPropagation()}
        style={{ animation: 'dialogIn 0.2s ease-out' }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 ${isLightTheme ? 'bg-gray-50/50' : 'bg-white/[0.02]'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isLightTheme ? 'bg-blue-50' : 'bg-blue-500/15'} flex items-center justify-center`}>
              <Key size={20} className="text-blue-500" />
            </div>
            <h2 className={`text-base font-semibold ${colors.text}`}>{t('addAccount.title')}</h2>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isLightTheme ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}>
            <X size={18} className={colors.textMuted} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 保存本地账号 */}
          <button 
            onClick={handleSaveLocal} 
            disabled={addLoading} 
            className={`w-full flex items-center gap-4 px-4 py-4 ${isLightTheme ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15'} border rounded-xl transition-all disabled:opacity-50 active:scale-[0.98]`}
          >
            <div className={`w-10 h-10 rounded-xl ${isLightTheme ? 'bg-emerald-100' : 'bg-emerald-500/20'} flex items-center justify-center`}>
              <Download size={20} className="text-emerald-500" />
            </div>
            <div className="text-left">
              <div className={`font-medium ${colors.text}`}>{t('addAccount.saveLocal')}</div>
              <div className={`text-xs ${colors.textMuted}`}>{t('addAccount.saveLocalDesc')}</div>
            </div>
          </button>

          {/* 分隔线 */}
          <div className="flex items-center gap-3">
            <div className={`flex-1 h-px ${isLightTheme ? 'bg-gray-200' : 'bg-white/10'}`}></div>
            <span className={`text-xs ${colors.textMuted}`}>{t('addAccount.orManual')}</span>
            <div className={`flex-1 h-px ${isLightTheme ? 'bg-gray-200' : 'bg-white/10'}`}></div>
          </div>

          {/* 账号类型选择 */}
          <div className={`grid grid-cols-2 gap-1 p-1 rounded-xl ${isLightTheme ? 'bg-gray-100' : 'bg-white/5'}`}>
            <button 
              type="button" 
              onClick={() => setAccountType('social')} 
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${accountType === 'social' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : `${colors.text} hover:bg-white/10`}`}
            >
              <Key size={14} />
              <span>Google/Github</span>
            </button>
            <button 
              type="button" 
              onClick={() => setAccountType('idc')} 
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${accountType === 'idc' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : `${colors.text} hover:bg-white/10`}`}
            >
              <Shield size={14} />
              <span>BuilderId</span>
            </button>
          </div>

          {/* 表单 */}
          <div className="space-y-3">
            {/* Social 账号 Provider 选择 */}
            {accountType === 'social' && (
              <div>
                <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSocialProvider('Google')}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      socialProvider === 'Google'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                        : `${isLightTheme ? 'border-gray-200 hover:border-gray-300' : 'border-white/10 hover:border-white/20'} ${colors.text}`
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </button>
                  <button
                    type="button"
                    onClick={() => setSocialProvider('Github')}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      socialProvider === 'Github'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                        : `${isLightTheme ? 'border-gray-200 hover:border-gray-300' : 'border-white/10 hover:border-white/20'} ${colors.text}`
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    Github
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('addAccount.refreshToken')}</label>
              <input 
                type="text" 
                placeholder={accountType === 'idc' ? t('addAccount.idcPlaceholder') : t('addAccount.socialPlaceholder')}
                value={refreshToken} 
                onChange={(e) => setRefreshToken(e.target.value)} 
                className={`w-full px-4 py-3 border rounded-xl text-sm ${colors.text} ${isLightTheme ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'} focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all`} 
              />
            </div>

            {accountType === 'idc' && (
              <>
                <div>
                  <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('addAccount.clientId')}</label>
                  <input 
                    type="text" 
                    placeholder="OIDC Client ID" 
                    value={clientId} 
                    onChange={(e) => setClientId(e.target.value)} 
                    className={`w-full px-4 py-3 border rounded-xl text-sm ${colors.text} ${isLightTheme ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'} focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all`} 
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('addAccount.clientSecret')}</label>
                  <input 
                    type="password" 
                    placeholder="OIDC Client Secret" 
                    value={clientSecret} 
                    onChange={(e) => setClientSecret(e.target.value)} 
                    className={`w-full px-4 py-3 border rounded-xl text-sm ${colors.text} ${isLightTheme ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'} focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all`} 
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('addAccount.awsRegion')}</label>
                  <div className="relative">
                    <select 
                      value={region} 
                      onChange={(e) => setRegion(e.target.value)} 
                      className={`w-full px-4 py-3 border rounded-xl text-sm ${colors.text} ${isLightTheme ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'} focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all appearance-none cursor-pointer`}
                    >
                      {awsRegions.map((r) => (<option key={r.value} value={r.value} className="text-gray-900 bg-white">{r.label}</option>))}
                    </select>
                    <ChevronDown size={16} className={`absolute right-4 top-1/2 -translate-y-1/2 ${colors.textMuted} pointer-events-none`} />
                  </div>
                </div>
              </>
            )}

            {/* 机器码（可选） */}
            <div>
              <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>
                {t('addAccount.machineId')} <span className="opacity-50">({t('common.optional')})</span>
              </label>
              <input 
                type="text" 
                placeholder={t('addAccount.machineIdPlaceholder')}
                value={machineId} 
                onChange={(e) => setMachineId(e.target.value)} 
                className={`w-full px-4 py-3 border rounded-xl text-sm ${colors.text} ${isLightTheme ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'} focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-mono`} 
              />
            </div>

            <button 
              onClick={handleAddManual} 
              disabled={addLoading || !refreshToken} 
              className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {addLoading ? t('addAccount.verifying') : t('addAccount.add')}
            </button>
          </div>

          {/* Error */}
          {addError && (
            <div className={`text-sm text-red-500 ${isLightTheme ? 'bg-red-50 border-red-200' : 'bg-red-500/10 border-red-500/20'} border px-4 py-3 rounded-xl`}>
              {addError}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dialogIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

export default AddAccountModal
