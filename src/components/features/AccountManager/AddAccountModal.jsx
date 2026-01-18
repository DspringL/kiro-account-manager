import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { SegmentedControl, Stack, Alert, Button as MantineButton } from '@mantine/core'
import { Download, Key, AlertCircle } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '../../ui/modal'
import { Button } from '../ui/button'

function AddAccountModal({ onClose, onSuccess }) {
  const { t, colors } = useApp()
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [accountType, setAccountType] = useState('social')
  const [socialProvider, setSocialProvider] = useState('Google')
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
    <Modal open={true} onOpenChange={(open) => !open && onClose()}>
      <ModalContent maxWidth="480px">
        <ModalHeader icon={Key} iconColor="text-blue-400" iconBg="bg-gradient-to-br from-blue-500/20 to-purple-500/10">
          <ModalTitle>{t('addAccount.title')}</ModalTitle>
          <p className={`text-xs ${colors.textMuted} mt-0.5`}>{t('addAccount.subtitle') || '添加新账号到管理器'}</p>
        </ModalHeader>

        <ModalDescription>
          <Stack gap="xl" p="md">
            {/* 保存本地账号 */}
            <div className={`p-5 rounded-xl border-2 border-dashed ${colors.cardBorder} ${colors.cardSecondary} hover:border-teal-500/50 group`}>
              <MantineButton
                onClick={handleSaveLocal}
                disabled={addLoading}
                variant="light"
                color="teal"
                leftSection={<Download size={18} />}
                fullWidth
                size="lg"
                classNames={{
                  root: 'h-auto py-4 rounded-xl'
                }}
              >
                <div className="text-left w-full">
                  <div className="font-semibold text-base">{t('addAccount.saveLocal')}</div>
                  <div className={`text-xs mt-1 opacity-70 ${colors.textMuted}`}>{t('addAccount.saveLocalDesc')}</div>
                </div>
              </MantineButton>
            </div>

            <div className="relative">
              <div className={`absolute inset-0 flex items-center`}>
                <div className={`w-full border-t ${colors.cardBorder}`}></div>
              </div>
              <div className="relative flex justify-center">
                <span className={`px-4 text-sm ${colors.textMuted} ${colors.card}`}>{t('addAccount.orManual')}</span>
              </div>
            </div>

            {/* 账号类型选择 */}
            <SegmentedControl
              value={accountType}
              onChange={setAccountType}
              data={[
                { value: 'social', label: 'Google/Github' },
                { value: 'idc', label: 'BuilderId' }
              ]}
              fullWidth
            />

            {/* Social Provider 选择 */}
            {accountType === 'social' && (
              <SegmentedControl
                value={socialProvider}
                onChange={setSocialProvider}
                data={[
                  { value: 'Google', label: 'Google' },
                  { value: 'Github', label: 'Github' }
                ]}
                fullWidth
              />
            )}

            {/* Refresh Token */}
            <div>
              <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                {t('addAccount.refreshToken')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder={accountType === 'idc' ? t('addAccount.idcPlaceholder') : t('addAccount.socialPlaceholder')}
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2`}
              />
            </div>

            {/* BuilderId 专用字段 */}
            {accountType === 'idc' && (
              <>
                <div>
                  <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                    {t('addAccount.clientId')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="OIDC Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                    {t('addAccount.clientSecret')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="OIDC Client Secret"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                    {t('addAccount.awsRegion')}
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2`}
                  >
                    {awsRegions.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* 机器码（可选） */}
            <div>
              <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                {t('addAccount.machineId')} ({t('common.optional')})
              </label>
              <input
                type="text"
                placeholder={t('addAccount.machineIdPlaceholder')}
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2`}
              />
            </div>

            {/* 错误提示 */}
            {addError && (
              <Alert icon={<AlertCircle size={16} />} color="red" variant="light" radius="xl">
                {addError}
              </Alert>
            )}
          </Stack>
        </ModalDescription>

        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleAddManual}
            disabled={addLoading || !refreshToken}
            loading={addLoading}
          >
            <Key size={16} className="mr-1.5" />
            {t('addAccount.add')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default AddAccountModal
