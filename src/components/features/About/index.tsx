import { useState, useEffect, useMemo, useCallback } from 'react'
import { Github, Heart, Coffee, ExternalLink, Sparkles, Code2, Palette, Cpu, RefreshCw, X, BookOpen, MessageCircle } from 'lucide-react'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { check } from '@tauri-apps/plugin-updater'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import alipayQR from '../../../assets/donate/alipay.jpg'
import wechatQR from '../../../assets/donate/wechat.jpg'
import { isLightTheme as checkIsLightTheme } from '../../../utils/themeMode'
import { getThemeAccent } from '../KiroConfig/themeAccent'
import React from 'react'

// 常量定义
const QQ_NUMBER = '1292548381'
const CURRENT_YEAR = new Date().getFullYear()

const LINKS = {
  website: 'https://kiro-website-six.vercel.app',
  github: 'https://github.com/hj01857655/kiro-account-manager',
  tutorial: 'https://xcn46cm1l4ir.feishu.cn/wiki/YfaAw3qnoixFJgkzTSmcgtPfntc',
  qqGroup: 'https://qm.qq.com/q/xi0AglEqGs',
  gateway: 'https://github.com/hj01857655/kiro-gateway'
}

// QQ 图标组件
const QQIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
    <path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-1.77 1.182 0 .686 4.078.43 6.29.43 2.213 0 6.29.256 6.29-.43 0-.687-1.77-1.182-1.77-1.182 2.085-1.77 1.905-3.967 1.905-3.967.845 1.588 1.634 2.072 1.746 2.072.111 0 .283-.36.283-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.29 3.364 14.268 2 12.003 2z"/>
  </svg>
)

// Logo 组件
const AppLogo = ({ accent, iconColors }: any) => (
  <div className="relative group">
    <div className={`absolute inset-0 bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-300`} />
    <div className={`relative w-20 h-20 bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} rounded-3xl flex items-center justify-center shadow-lg transition-shadow duration-300 group-hover:shadow-xl animate-float`}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
      </svg>
    </div>
    <div className={`absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-br ${iconColors.sparkles} rounded-lg flex items-center justify-center shadow-md animate-pulse`}>
      <Sparkles size={14} className="text-white" />
    </div>
  </div>
)

// 技术栈徽章组件
const TechBadge = ({ icon: Icon, value }: any) => (
  <Badge variant="secondary" className="transition-colors duration-200 hover:shadow-md cursor-default px-3 py-1.5 text-sm flex items-center gap-1.5">
    <Icon size={14} />
    {value}
  </Badge>
)

// 链接按钮组件
const LinkButton = ({ href, icon: Icon, children, fullWidth = false }: any) => (
  <Button
    asChild
    variant="default"
    className={`transition-all duration-200 hover:shadow-lg cursor-pointer ${fullWidth ? 'w-full' : ''}`}
  >
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
      <Icon size={18} />
      {children}
    </a>
  </Button>
)

// QR 码图片组件
const QRCodeImage = ({ src, alt, onClick, accent, colors, onKeyDown }: any) => (
  <div
    className="flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded-lg p-2"
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={onKeyDown}
    aria-label={alt}
  >
    <div className="relative group">
      <div className={`absolute inset-0 ${accent.bg} rounded-lg blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-200`} />
      <img
        src={src}
        alt={alt}
        className="relative w-[120px] h-[120px] rounded-md shadow-md transition-transform duration-200"
      />
    </div>
    <p className={`text-sm font-medium text-foreground`}>{alt}</p>
  </div>
)

// 信息卡片组件
const InfoCard = ({ title, items, colors }: any) => (
  <div className={`bg-muted/30 rounded-xl p-4 transition-colors duration-200 hover:shadow-md`}>
    {title && (
      <p className={`text-sm font-medium mb-2 text-foreground`}>
        {title}
      </p>
    )}
    <div className={`flex flex-col gap-2 text-foreground`}>
      {items.map((item: any, index: number) => (
        <p key={index} className="text-sm leading-relaxed">
          {item}
        </p>
      ))}
    </div>
  </div>
)

function About() {
  const { t, theme} = useApp()
  const { showUpdate, showInfo, showSuccess } = useDialog()
  const [version, setVersion] = useState('')
  const [checking, setChecking] = useState(false)
  const [previewImg, setPreviewImg] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  // 定义色彩系统
  const colors = useMemo(() => ({
    inputFocus: 'focus:ring-primary/20 focus:border-primary',
  }), [])

  // 使用 useMemo 缓存主题相关计算
  const accent = useMemo(() => getThemeAccent(theme), [theme])

  // 图标颜色（适配主题）
  const iconColors = useMemo(() => {
    const isLight = checkIsLightTheme(theme)
    return {
      coffee: isLight ? 'text-amber-500' : 'text-amber-400',
      heart: isLight ? 'text-red-500 fill-red-500' : 'text-red-400 fill-red-400',
      sparkles: isLight
        ? 'from-amber-400 to-orange-500'
        : 'from-amber-300 to-orange-400'
    }
  }, [theme])

  // 技术栈配置
  const techStack = useMemo(() => [
    { icon: Code2, label: t('about.frontend'), value: 'React + Vite' },
    { icon: Palette, label: t('about.ui'), value: 'TailwindCSS' },
    { icon: Cpu, label: t('about.backend'), value: 'Tauri + Rust' },
  ], [t])

  // 赞助福利列表
  const sponsorBenefits = useMemo(() => [
    t('about.benefit1'),
    t('about.benefit2'),
    t('about.benefit3')
  ], [t])

  // 付费服务列表
  const paidServices = useMemo(() => [
    t('about.service1'),
    t('about.service2'),
    t('about.service3')
  ], [t])

  useEffect(() => {
    getVersion().then(setVersion)
    setMounted(true)
  }, [])

  const checkUpdate = useCallback(async () => {
    setChecking(true)
    try {
      const result = await invoke<any>('check_update')

      if (result.has_update && result.latest_version) {
        const updateResult = await check()
        if (updateResult) {
          showUpdate(
            { version: result.latest_version, body: result.notes },
            updateResult
          )
        } else {
          showInfo(t('about.checkUpdate'), t('about.updateFailed'))
        }
      } else {
        showInfo(t('about.checkUpdate'), t('about.upToDate'))
      }
    } catch (e) {
      console.error('Check update failed:', e)
      showInfo(t('about.checkUpdate'), t('about.updateFailed'))
    } finally {
      setChecking(false)
    }
  }, [showUpdate, showInfo, t])

  const handlePreviewKeyDown = useCallback((event: any, imageSrc: any) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setPreviewImg(imageSrc)
    }
  }, [])

  const handleContactQQ = useCallback(async () => {
    try {
      await openUrl(`tencent://message/?uin=${QQ_NUMBER}&Site=&Menu=yes`)
    } catch {
      try {
        await navigator.clipboard.writeText(QQ_NUMBER)
        showSuccess(t('common.copied'), `QQ: ${QQ_NUMBER}`)
      } catch {
        showInfo(t('about.contactQQ'), `QQ: ${QQ_NUMBER}`)
      }
    }
  }, [showSuccess, showInfo, t])

  const closePreview = useCallback(() => setPreviewImg(null), [])

  return (
    <div className={`h-full glass-main overflow-auto`}>
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* 头部卡片 */}
        <div className={`transition-all duration-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Card className={`glass-card border border-border shadow-lg`}>
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col items-center gap-4">
                <AppLogo accent={accent} iconColors={iconColors} />

                <h1 className={`text-xl font-bold text-foreground`}>{t('about.appName')}</h1>

                <div className="flex items-center gap-2">
                  <Badge variant="default" className="px-3 py-1">
                    v{version || '...'}
                  </Badge>
                  <Button
                    onClick={checkUpdate}
                    disabled={checking}
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                  >
                    <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
                    {checking ? t('about.checking') : t('about.checkUpdate')}
                  </Button>
                </div>

                <p className={`text-sm text-center max-w-[500px] text-muted-foreground`}>
                  {t('about.appDesc')}
                </p>

                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {techStack.map(({ icon, label, value }) => (
                    <TechBadge key={label} icon={icon} value={value} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 链接 */}
        <div className={`transition-all duration-400 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Card className={`glass-card border border-border shadow-lg`}>
            <CardContent className="p-4 sm:p-6">
              <p className={`text-sm font-medium text-center mb-4 text-foreground`}>{t('about.links')}</p>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <LinkButton href={LINKS.website} icon={ExternalLink}>
                    {t('about.website')}
                  </LinkButton>
                  <LinkButton href={LINKS.github} icon={Github}>
                    GitHub
                  </LinkButton>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <LinkButton href={LINKS.tutorial} icon={BookOpen}>
                    {t('about.tutorial')}
                  </LinkButton>
                  <LinkButton href={LINKS.qqGroup} icon={QQIcon}>
                    {t('about.qqGroup')}
                  </LinkButton>
                </div>

                <LinkButton href={LINKS.gateway} icon={Github} fullWidth>
                  {t('about.shop')}
                </LinkButton>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 赞赏 */}
        <div className={`transition-all duration-400 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Card className={`glass-card border border-border shadow-lg`}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-center gap-2">
                  <Coffee size={20} className={`${iconColors.coffee} animate-bounce`} />
                  <h2 className={`text-lg font-semibold text-foreground`}>{t('about.donate')}</h2>
                </div>

                <p className={`text-sm text-center leading-relaxed text-foreground`}>
                  {t('about.donateDesc')}
                </p>

                <InfoCard
                  title={t('about.sponsorBenefits')}
                  items={sponsorBenefits}
                  colors={colors}
                />

                <div className="flex items-center justify-center gap-8 mt-2">
                  <QRCodeImage
                    src={alipayQR}
                    alt={t('about.alipay')}
                    onClick={() => setPreviewImg(alipayQR)}
                    accent={accent}
                    colors={colors}
                    onKeyDown={(e: any) => handlePreviewKeyDown(e, alipayQR)}
                  />
                  <QRCodeImage
                    src={wechatQR}
                    alt={t('about.wechat')}
                    onClick={() => setPreviewImg(wechatQR)}
                    accent={accent}
                    colors={colors}
                    onKeyDown={(e: any) => handlePreviewKeyDown(e, wechatQR)}
                  />
                </div>

                <p className={`text-xs text-center mt-1 text-muted-foreground`}>
                  {t('about.clickToEnlarge')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 付费服务 */}
        <div className={`transition-all duration-400 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Card className={`glass-card border border-border shadow-lg`}>
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-center gap-2">
                  <MessageCircle size={20} className={accent.text} />
                  <h2 className={`text-lg font-semibold text-foreground`}>{t('about.paidServices')}</h2>
                </div>

                <p className={`text-sm text-center leading-relaxed text-foreground`}>
                  {t('about.paidServicesDesc')}
                </p>

                <InfoCard items={paidServices} colors={colors} />

                <div className="flex items-center justify-center gap-4 mt-2">
                  <Button
                    onClick={handleContactQQ}
                    variant="secondary"
                    className="gap-2 transition-all duration-200 hover:shadow-lg"
                  >
                    <MessageCircle size={16} />
                    {t('about.contactQQ')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 底部 */}
        <div className={`transition-all duration-400 delay-400 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center justify-center gap-2 py-4">
            <span className={`text-sm text-muted-foreground`}>{t('about.madeWith')}</span>
            <Heart size={14} className={`${iconColors.heart} animate-pulse`} />
            <span className={`text-sm text-muted-foreground`}>{t('about.by')} hj01857655</span>
            <span className={`text-sm text-muted-foreground`}>·</span>
            <span className={`text-sm text-muted-foreground`}>© {CURRENT_YEAR}</span>
          </div>
        </div>
      </div>

      {/* 图片预览弹窗 */}
      <Dialog open={!!previewImg} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-fit p-0 bg-transparent border-none shadow-none">
          <div className="relative">
            <img src={previewImg} alt="预览" className="max-w-[320px] max-h-[320px] rounded-xl" />
            <button
              className={`absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 glass-card`}
              onClick={closePreview}
              aria-label="关闭预览"
            >
              <X size={16} className={"text-foreground"} />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default About
