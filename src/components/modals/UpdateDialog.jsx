import { useState, useRef } from 'react'
import { relaunch } from '@tauri-apps/plugin-process'
import { X, Download, RefreshCw, Sparkles, CheckCircle2, FileText } from 'lucide-react'
import { Modal, Stack, Group, Text, Button, Progress, Alert } from '@mantine/core'
import { useApp } from '../../hooks/useApp'

function UpdateDialog({ updateInfo, update, onClose }) {
  const { t, theme, colors } = useApp()
  const isLightTheme = theme === 'light' || theme === 'purple' || theme === 'green'
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
    <Modal
      opened={true}
      onClose={handleClose}
      centered
      withCloseButton={false}
      size="lg"
      padding={0}
      radius="lg"
      styles={{
        content: { overflow: 'hidden' },
        body: { backgroundColor: 'transparent' }
      }}
      classNames={{
        content: colors.card
      }}
    >
      {/* 顶部横幅 */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5 relative">
        <Group gap="md">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur">
            <Sparkles size={28} className="text-white" />
          </div>
          <Stack gap={2}>
            <Text size="xl" fw={700} c="white">{t('update.newVersionAvailable')}</Text>
            <Text size="sm" c="white" opacity={0.8}>
              v{updateInfo?.version} {t('update.readyToInstall')}
            </Text>
          </Stack>
        </Group>
        {!installing && !downloadComplete && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors"
          >
            <X size={20} className="text-white/80" />
          </button>
        )}
      </div>

      <div className="p-6">
        {downloadComplete ? (
          <Stack gap="md">
            <Group gap="sm">
              <CheckCircle2 size={24} className="text-emerald-500" />
              <Text size="lg" fw={500} className="text-emerald-600">{t('update.downloadComplete')}</Text>
            </Group>
            <Text size="sm" className={colors.textMuted}>{t('update.restartToInstall')}</Text>
            <Group gap="sm" grow>
              <Button
                onClick={onClose}
                variant="outline"
                classNames={{
                  root: `border ${colors.cardBorder}`,
                  label: colors.text
                }}
              >
                {t('update.installLater')}
              </Button>
              <Button
                onClick={doRelaunch}
                leftSection={<RefreshCw size={16} />}
                variant="filled"
                color="blue"
              >
                {t('update.restartNow')}
              </Button>
            </Group>
          </Stack>
        ) : installing && downloadProgress ? (
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="sm" className={colors.text}>{t('update.downloading')}...</Text>
              <Text size="sm" fw={500} className="text-blue-600">{downloadProgress.percent}%</Text>
            </Group>
            <Progress value={downloadProgress.percent} color="blue" size="sm" radius="xl" />
            <Group justify="space-between">
              <Text size="xs" className={colors.textMuted}>
                {formatBytes(downloadProgress.downloaded)} / {formatBytes(downloadProgress.total)}
              </Text>
              <Text size="xs" className={colors.textMuted}>{formatSpeed(downloadSpeed)}</Text>
            </Group>
            <Group gap="xs">
              <RefreshCw size={12} className="animate-spin text-blue-500" />
              <Text size="xs" className={colors.textMuted}>{t('update.doNotClose')}</Text>
            </Group>
          </Stack>
        ) : (
          <Stack gap="md">
            {updateInfo?.body && (
              <Stack gap="xs">
                <Group gap="xs">
                  <FileText size={16} className={colors.text} />
                  <Text size="sm" fw={500} className={colors.text}>{t('update.releaseNotes')}</Text>
                </Group>
                <div className={`text-sm ${colors.textMuted} max-h-40 overflow-y-auto p-3 rounded-lg whitespace-pre-wrap leading-relaxed border ${colors.cardBorder} ${colors.cardSecondary}`}>
                  {updateInfo.body}
                </div>
              </Stack>
            )}
            <Group gap="sm" grow>
              <Button
                onClick={onClose}
                variant="outline"
                classNames={{
                  root: `border ${colors.cardBorder}`,
                  label: colors.text
                }}
              >
                {t('update.later')}
              </Button>
              <Button
                onClick={doUpdate}
                leftSection={<Download size={16} />}
                variant="filled"
                color="blue"
              >
                {t('update.updateNow')}
              </Button>
            </Group>
          </Stack>
        )}

        {error && (
          <Alert color="red" mt="md" radius="md">
            {error}
          </Alert>
        )}
      </div>
    </Modal>
  )
}

export default UpdateDialog
