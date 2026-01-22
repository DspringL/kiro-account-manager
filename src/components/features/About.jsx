import { useState, useEffect } from 'react'
import { Github, Heart, Coffee, ExternalLink, Sparkles, Code2, Palette, Cpu, RefreshCw, X, BookOpen, ShoppingCart } from 'lucide-react'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { check } from '@tauri-apps/plugin-updater'
import { Card, Stack, Group, Text, Badge, Image, Button, List, Modal } from '@mantine/core'
import { useApp } from '../../hooks/useApp'
import { useDialog } from '../../contexts/DialogContext'
import alipayQR from '../../assets/donate/alipay.jpg'
import wechatQR from '../../assets/donate/wechat.jpg'

function About() {
  const { t, theme, colors } = useApp()
  const { showUpdate, showInfo } = useDialog()
  const isLightTheme = theme === 'light' || theme === 'purple' || theme === 'green'
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
    { icon: Code2, label: t('about.frontend'), value: 'React + Vite', color: 'cyan' },
    { icon: Palette, label: t('about.ui'), value: 'TailwindCSS', color: 'pink' },
    { icon: Cpu, label: t('about.backend'), value: 'Tauri + Rust', color: 'orange' },
  ]

  return (
    <div className={`h-full ${colors.main} p-8 overflow-auto flex justify-center`}>
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      
      <div className="max-w-3xl w-full space-y-6">
        {/* 头部卡片 */}
        <Card 
          className={`${colors.card} border ${colors.cardBorder}`} 
          shadow="lg" 
          radius="xl" 
          p="xl"
          styles={{ root: { backgroundColor: 'transparent' } }}
        >
          <Stack gap="md" align="center">
            {/* Logo */}
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

            <Text size="xl" fw={700} className={colors.text}>{t('about.appName')}</Text>
            
            <Group gap="sm">
              <Badge color="blue" size="lg" radius="xl">
                v{version || '...'}
              </Badge>
              <Button
                onClick={checkUpdate}
                loading={checking}
                leftSection={<RefreshCw size={12} />}
                variant="light"
                color="green"
                size="compact-sm"
                radius="xl"
              >
                {checking ? t('about.checking') : t('about.checkUpdate')}
              </Button>
            </Group>

            <Text size="sm" className={colors.textMuted} ta="center">{t('about.appDesc')}</Text>

            {/* 技术栈 */}
            <Group gap="sm" justify="center">
              {techStack.map(({ icon: Icon, label, value, color }) => (
                <Badge
                  key={label}
                  leftSection={<Icon size={14} />}
                  color={color}
                  variant="light"
                  size="lg"
                  radius="xl"
                >
                  {value}
                </Badge>
              ))}
            </Group>
          </Stack>
        </Card>

        {/* 链接 */}
        <Card 
          className={`${colors.card} border ${colors.cardBorder}`} 
          shadow="lg" 
          radius="xl" 
          p="lg"
          styles={{ root: { backgroundColor: 'transparent' } }}
        >
          <Text size="sm" fw={500} className={colors.text} ta="center" mb="md">{t('about.links')}</Text>
          <Stack gap="sm">
            {/* 第一行：官网、GitHub */}
            <Group gap="sm" grow>
              <Button
                component="a"
                href="https://vercel-api-lemon-five.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<ExternalLink size={18} />}
                variant="filled"
                color="cyan"
                radius="md"
              >
                {t('about.website')}
              </Button>
              <Button
                component="a"
                href="https://github.com/hj01857655/kiro-account-manager"
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<Github size={18} />}
                variant="filled"
                color="dark"
                radius="md"
              >
                Kiro Account Manager
              </Button>
            </Group>

            {/* 第二行：QQ群、Kiro Gateway */}
            <Group gap="sm" grow>
              <Button
                component="a"
                href="https://qm.qq.com/q/T9L311vb2s"
                target="_blank"
                rel="noopener noreferrer"
                leftSection={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-1.77 1.182 0 .686 4.078.43 6.29.43 2.213 0 6.29.256 6.29-.43 0-.687-1.77-1.182-1.77-1.182 2.085-1.77 1.905-3.967 1.905-3.967.845 1.588 1.634 2.072 1.746 2.072.111 0 .283-.36.283-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.29 3.364 14.268 2 12.003 2z"/>
                  </svg>
                }
                variant="filled"
                color="cyan"
                radius="md"
              >
                {t('about.qqGroup')}
              </Button>
              <Button
                component="a"
                href="https://github.com/hj01857655/kiro-gateway"
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<Github size={18} />}
                variant="filled"
                color="dark"
                radius="md"
              >
                {t('about.shop')}
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* 赞赏 */}
        <Card 
          className={`${colors.card} border ${colors.cardBorder}`} 
          shadow="lg" 
          radius="xl" 
          p="lg"
          styles={{ root: { backgroundColor: 'transparent' } }}
        >
          <Group gap="xs" justify="center" mb="lg">
            <Coffee size={18} className="text-amber-500" />
            <Text size="md" fw={500} className={colors.text}>{t('about.donate')}</Text>
          </Group>
          <Group justify="center" gap="xl">
            <Stack gap="xs" align="center" style={{ cursor: 'pointer' }} onClick={() => setPreviewImg(alipayQR)}>
              <Image src={alipayQR} alt={t('about.alipay')} w={112} h={112} radius="md" className="hover:scale-105 transition-transform" />
              <Text size="sm" className={colors.textMuted}>{t('about.alipay')}</Text>
            </Stack>
            <Stack gap="xs" align="center" style={{ cursor: 'pointer' }} onClick={() => setPreviewImg(wechatQR)}>
              <Image src={wechatQR} alt={t('about.wechat')} w={112} h={112} radius="md" className="hover:scale-105 transition-transform" />
              <Text size="sm" className={colors.textMuted}>{t('about.wechat')}</Text>
            </Stack>
          </Group>
          <Text size="xs" className={colors.textMuted} ta="center" mt="md">{t('about.clickToEnlarge')}</Text>
        </Card>

        {/* 底部 */}
        <Group gap="xs" justify="center" className="mt-6">
          <Text size="sm" className={colors.textMuted}>{t('about.madeWith')}</Text>
          <Heart size={14} className="text-red-500 fill-red-500" />
          <Text size="sm" className={colors.textMuted}>{t('about.by')} hj01857655</Text>
          <Text size="sm" className={colors.textMuted}>·</Text>
          <Text size="sm" className={colors.textMuted}>© 2025</Text>
        </Group>
      </div>

      {/* 图片预览弹窗 */}
      <Modal
        opened={!!previewImg}
        onClose={() => setPreviewImg(null)}
        centered
        withCloseButton={false}
        size="auto"
        padding={0}
        styles={{
          content: { background: 'transparent' },
          body: { padding: 0 }
        }}
      >
        <div className="relative">
          <Image src={previewImg} alt="预览" maw={320} mah={320} radius="xl" />
          <button 
            className={`absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform ${colors.card}`}
            onClick={() => setPreviewImg(null)}
          >
            <X size={16} className={colors.text} />
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default About
