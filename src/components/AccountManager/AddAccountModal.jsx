import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Modal, TextInput, Button, SegmentedControl, Select, Stack, Group, Text, Alert } from '@mantine/core'
import { Download, Key, AlertCircle } from 'lucide-react'
import { useApp } from '../../hooks/useApp'

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
    <Modal
      opened
      onClose={onClose}
      title={t('addAccount.title')}
      size="md"
      centered
    >
      <Stack gap="md">
        {/* 保存本地账号 */}
        <Button
          onClick={handleSaveLocal}
          disabled={addLoading}
          variant="light"
          color="teal"
          leftSection={<Download size={18} />}
          fullWidth
          size="md"
        >
          <div className="text-left w-full">
            <div className="font-medium">{t('addAccount.saveLocal')}</div>
            <div className={`text-xs opacity-70 ${colors.textMuted}`}>{t('addAccount.saveLocalDesc')}</div>
          </div>
        </Button>

        <Text size="sm" className={colors.textMuted} ta="center">{t('addAccount.orManual')}</Text>

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
        <TextInput
          label={t('addAccount.refreshToken')}
          placeholder={accountType === 'idc' ? t('addAccount.idcPlaceholder') : t('addAccount.socialPlaceholder')}
          value={refreshToken}
          onChange={(e) => setRefreshToken(e.target.value)}
          required
          classNames={{
            input: `${colors.text} ${colors.input}`
          }}
        />

        {/* BuilderId 专用字段 */}
        {accountType === 'idc' && (
          <>
            <TextInput
              label={t('addAccount.clientId')}
              placeholder="OIDC Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              classNames={{
                input: `${colors.text} ${colors.input}`
              }}
            />
            <TextInput
              label={t('addAccount.clientSecret')}
              placeholder="OIDC Client Secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              type="password"
              required
              classNames={{
                input: `${colors.text} ${colors.input}`
              }}
            />
            <Select
              label={t('addAccount.awsRegion')}
              value={region}
              onChange={setRegion}
              data={awsRegions}
              classNames={{
                input: `${colors.text} ${colors.input}`,
                dropdown: `${colors.card} border ${colors.cardBorder}`,
                option: `${colors.text}`
              }}
            />
          </>
        )}

        {/* 机器码（可选） */}
        <TextInput
          label={`${t('addAccount.machineId')} (${t('common.optional')})`}
          placeholder={t('addAccount.machineIdPlaceholder')}
          value={machineId}
          onChange={(e) => setMachineId(e.target.value)}
          classNames={{
            input: `${colors.text} ${colors.input}`
          }}
        />

        {/* 错误提示 */}
        {addError && (
          <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
            {addError}
          </Alert>
        )}

        {/* 操作按钮 */}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleAddManual}
            loading={addLoading}
            disabled={!refreshToken}
            leftSection={<Key size={16} />}
          >
            {t('addAccount.add')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export default AddAccountModal
