import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface PrivacyContextValue {
    privacyMode: boolean;
    setPrivacyMode: (enabled: boolean) => Promise<void>;
    maskEmail: (email: string) => string;
    maskNickname: (name: string) => string;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacyMode, setPrivacyModeState] = useState(true) // 默认开启隐私模式

  // 从后端加载设置
  useEffect(() => {
    invoke<any>('get_app_settings').then(settings => {
      setPrivacyModeState(settings?.privacyMode ?? true) // 默认 true
    }).catch(() => {})
  }, [])

  // 保存设置到后端
  const setPrivacyMode = useCallback(async (enabled: boolean) => {
    setPrivacyModeState(enabled)
    try {
      await invoke('save_app_settings', { settings: { privacyMode: enabled } })
    } catch (err) {
      console.error('Failed to save privacy mode:', err)
    }
  }, [])

  // 邮箱始终明文展示，不脱敏
  const maskEmail = useCallback((email: string) => {
    return email || ''
  }, [])

  // 昵称/标签脱敏: MyNickname -> My***me
  const maskNickname = useCallback((name: string) => {
    if (!privacyMode || !name) return name
    if (name.length <= 2) return '*'.repeat(name.length)
    if (name.length <= 4) return name[0] + '***'
    return name.slice(0, 2) + '***' + name.slice(-2)
  }, [privacyMode])

  const value = useMemo(() => ({
    privacyMode,
    setPrivacyMode,
    maskEmail,
    maskNickname}), [privacyMode, maskEmail, maskNickname])

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

export function usePrivacy() {
  const context = useContext(PrivacyContext)
  if (!context) throw new Error('usePrivacy must be used within PrivacyProvider')
  return context
}
