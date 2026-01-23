import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { SegmentedControl, Alert } from '@mantine/core'
import { Key, AlertCircle } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '../../ui/dialog'
import { Button } from '../../ui/button'

function AddAccountModal({ onClose, onSuccess }) {
  const { t, colors } = useApp()
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [accountType, setAccountType] = useState('social')
  const [socialProvider, setSocialProvider] = useState('Google')
  const [idcProvider, setIdcProvider] = useState('BuilderId')
  const [startUrl, setStartUrl] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [region, setRegion] = useState('us-east-1')
  const [machineId, setMachineId] = useState('')

  const awsRegions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-east-2', label: 'US East (Ohio)' },
    { value: 'us-west-1', label: 'US West (N. California)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
    { value: 'ca-central-1', label: 'Canada (Central)' },
    { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'eu-west-2', label: 'Europe (London)' },
    { value: 'eu-west-3', label: 'Europe (Paris)' },
    { value: 'eu-north-1', label: 'Europe (Stockholm)' },
    { value: 'sa-east-1', label: 'South America (São Paulo)' },
  ]

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
        // Enterprise 需要 Start URL
        if (idcProvider === 'Enterprise' && !startUrl.trim()) {
          setAddError('Enterprise 账号需要输入 Start URL')
          setAddLoading(false)
          return
        }
        await invoke('add_account_by_idc', { 
          refreshToken, 
          clientId, 
          clientSecret, 
          region,
          machineId: machineId.trim() || null,
          provider: idcProvider,
          startUrl: startUrl.trim() || null
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
    <DialogRoot open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent maxWidth="480px">
        <DialogHeader icon={Key} iconColor="text-blue-400" iconBg="bg-gradient-to-br from-blue-500/20 to-purple-500/10">
          <DialogTitle>{t('addAccount.title')}</DialogTitle>
          <DialogDescription>{t('addAccount.subtitle')}</DialogDescription>
        </DialogHeader>

        <DialogBody gap="xl">
          {/* 账号类型选择 */}
          <SegmentedControl
            value={accountType}
            onChange={setAccountType}
            data={[
              { value: 'social', label: 'Google/Github' },
              { value: 'idc', label: 'BuilderId/Enterprise' }
            ]}
            fullWidth
          />

          {/* Social Provider 选择 */}
          {accountType === 'social' && (
            <div>
              <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                登录方式
              </label>
              <select
                value={socialProvider}
                onChange={(e) => setSocialProvider(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2`}
              >
                <option value="Google">Google</option>
                <option value="Github">Github</option>
              </select>
            </div>
          )}

          {/* IdC Provider 选择 */}
          {accountType === 'idc' && (
            <>
              <div>
                <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                  Provider
                </label>
                <select
                  value={idcProvider}
                  onChange={(e) => setIdcProvider(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2`}
                >
                  <option value="BuilderId">BuilderId (个人开发者)</option>
                  <option value="Enterprise">Enterprise (企业账号)</option>
                </select>
              </div>

              {/* Enterprise Start URL */}
              {idcProvider === 'Enterprise' && (
                <div>
                  <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                    Start URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="https://mycompany.awsapps.com/start"
                    value={startUrl}
                    onChange={(e) => setStartUrl(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2`}
                  />
                  <p className={`text-xs ${colors.textMuted} mt-1.5`}>
                    请输入您企业的 IAM Identity Center Start URL
                  </p>
                </div>
              )}
            </>
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
        </DialogBody>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}

export default AddAccountModal
