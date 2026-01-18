import { useState, useRef } from 'react'
import { Tabs, Textarea, Select, Stack, Group, Text, Alert, Progress, FileButton, Button } from '@mantine/core'
import { Upload, FileJson, Key, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../hooks/useApp'
import { getConcurrency } from '../../utils/concurrency'

function validateAccount(item, index) {
  const errors = []
  const refreshToken = item.refreshToken
  if (!refreshToken) {
    errors.push(`第${index + 1}条: 缺少 refreshToken`)
    return { valid: false, errors, type: null }
  }
  
  if (!refreshToken.startsWith('aor')) {
    errors.push(`第${index + 1}条: refreshToken 格式无效（应以 aor 开头）`)
    return { valid: false, errors, type: null }
  }
  
  const hasClientCredentials = item.clientId && item.clientSecret
  const isIdC = hasClientCredentials
  const isSocial = !hasClientCredentials
  
  let provider = item.provider
  if (!provider) {
    provider = isSocial ? 'Google' : 'BuilderId'
  }
  
  const validProviders = ['Google', 'Github', 'BuilderId', 'Enterprise']
  if (!validProviders.includes(provider)) {
    errors.push(`第${index + 1}条: provider 必须是 ${validProviders.join('/')}`)
    return { valid: false, errors, type: null }
  }
  
  if (isSocial && !['Google', 'Github'].includes(provider)) {
    errors.push(`第${index + 1}条: Social 账号的 provider 应为 Google/Github`)
    return { valid: false, errors, type: null }
  }
  
  if (isIdC && !['BuilderId', 'Enterprise'].includes(provider)) {
    errors.push(`第${index + 1}条: IdC 账号的 provider 应为 BuilderId/Enterprise`)
    return { valid: false, errors, type: null }
  }
  
  return { valid: true, errors: [], type: isSocial ? 'social' : 'idc', inferredProvider: provider }
}

function ImportAccountModal({ onClose, onSuccess }) {
  const { t, colors } = useApp()
  const [activeTab, setActiveTab] = useState('json')
  const [jsonText, setJsonText] = useState('')
  const [parseResult, setParseResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [importResult, setImportResult] = useState(null)
  const [ssoToken, setSsoToken] = useState('')
  const [ssoRegion, setSsoRegion] = useState('us-east-1')
  const [ssoImporting, setSsoImporting] = useState(false)
  const [ssoProgress, setSsoProgress] = useState({ current: 0, total: 0 })
  const [ssoResult, setSsoResult] = useState(null)

  const parseJson = (text) => {
    if (!text.trim()) {
      setParseResult(null)
      return
    }
    
    try {
      let data = JSON.parse(text)
      if (!Array.isArray(data)) data = [data]
      
      const valid = []
      const invalid = []
      const errors = []
      
      data.forEach((item, index) => {
        const result = validateAccount(item, index)
        if (result.valid) {
          valid.push({ ...item, _type: result.type, _index: index, _inferredProvider: result.inferredProvider })
        } else {
          invalid.push({ ...item, _index: index })
          errors.push(...result.errors)
        }
      })
      
      setParseResult({ valid, invalid, errors })
    } catch (e) {
      setParseResult({ valid: [], invalid: [], errors: [`JSON 解析失败: ${e.message}`] })
    }
  }

  const handleFileSelect = async (file) => {
    if (!file) return
    const text = await file.text()
    setJsonText(text)
    parseJson(text)
  }

  const runConcurrent = async (items, handler, onProgress) => {
    const results = []
    let completed = 0
    const concurrency = getConcurrency(items.length)
    
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map(async (item) => {
          const result = await handler(item)
          completed++
          onProgress(completed)
          return result
        })
      )
      results.push(...batchResults)
    }
    return results
  }

  const handleJsonImport = async () => {
    if (!parseResult?.valid.length) return
    
    setImporting(true)
    setImportProgress({ current: 0, total: parseResult.valid.length })
    
    const success = []
    const failed = []
    
    const importOne = async (item) => {
      try {
        let account
        const provider = item._inferredProvider || item.provider
        if (item._type === 'social') {
          account = await invoke('add_account_by_social', {
            refreshToken: item.refreshToken,
            provider: provider,
            machineId: item.machineId || null,
            accessToken: item.accessToken || null
          })
        } else {
          account = await invoke('add_account_by_idc', {
            refreshToken: item.refreshToken,
            clientId: item.clientId,
            clientSecret: item.clientSecret,
            region: item.region || null,
            machineId: item.machineId || null,
            accessToken: item.accessToken || null,
            password: item.password || null
          })
        }
        if (account.status === 'banned') {
          return { success: true, index: item._index + 1, email: account.email, banned: true }
        }
        return { success: true, index: item._index + 1, email: account.email }
      } catch (e) {
        const errorMsg = String(e)
        if (errorMsg.includes('BANNED')) {
          return { success: false, index: item._index + 1, error: '账号已封禁', banned: true }
        }
        return { success: false, index: item._index + 1, error: errorMsg.slice(0, 50) }
      }
    }
    
    const results = await runConcurrent(
      parseResult.valid,
      importOne,
      (completed) => setImportProgress({ current: completed, total: parseResult.valid.length })
    )
    
    results.forEach(r => {
      if (r.success) {
        success.push({ index: r.index, email: r.email })
      } else {
        failed.push({ index: r.index, error: r.error })
      }
    })
    
    setImportResult({ success, failed })
    setImporting(false)
    if (success.length > 0) onSuccess?.()
  }

  const handleSsoImport = async () => {
    const tokens = ssoToken.split('\n').map(t => t.trim()).filter(t => t)
    if (tokens.length === 0) return
    
    setSsoImporting(true)
    setSsoProgress({ current: 0, total: tokens.length })
    
    const success = []
    const failed = []
    
    const importOne = async (token, index) => {
      try {
        const result = await invoke('import_from_sso_token', {
          bearerToken: token,
          region: ssoRegion || null
        })
        if (result.success) {
          if (result.status === 'banned') {
            return { success: true, index: index + 1, email: result.email, banned: true }
          }
          return { success: true, index: index + 1, email: result.email }
        } else {
          if (result.error?.includes('BANNED')) {
            return { success: false, index: index + 1, error: '账号已封禁', banned: true }
          }
          return { success: false, index: index + 1, error: result.error || t('common.unknown') }
        }
      } catch (e) {
        const errorMsg = String(e)
        if (errorMsg.includes('BANNED')) {
          return { success: false, index: index + 1, error: '账号已封禁', banned: true }
        }
        return { success: false, index: index + 1, error: errorMsg.slice(0, 80) }
      }
    }
    
    const ssoConcurrency = getConcurrency(tokens.length)
    const tokensWithIndex = tokens.map((token, index) => ({ token, index }))
    
    for (let i = 0; i < tokensWithIndex.length; i += ssoConcurrency) {
      const batch = tokensWithIndex.slice(i, i + ssoConcurrency)
      const batchResults = await Promise.all(
        batch.map(({ token, index }) => importOne(token, index))
      )
      
      batchResults.forEach(r => {
        if (r.success) {
          success.push({ index: r.index, email: r.email })
        } else {
          failed.push({ index: r.index, error: r.error })
        }
      })
      
      setSsoProgress({ current: Math.min(i + ssoConcurrency, tokens.length), total: tokens.length })
    }
    
    setSsoResult({ success, failed })
    setSsoImporting(false)
    if (success.length > 0) onSuccess?.()
  }

  const renderResult = (result) => (
    <Stack gap="md" p="sm">
      <Alert icon={<CheckCircle size={20} />} color="teal" variant="light">
        <Text fw={500}>{t('import.successCount', { count: result.success.length })}</Text>
        {result.success.length > 0 && (
          <Text size="sm" mt="xs">{result.success.map(s => s.email).join(', ')}</Text>
        )}
      </Alert>
      
      {result.failed.length > 0 && (
        <Alert icon={<AlertCircle size={20} />} color="red" variant="light">
          <Text fw={500}>{t('import.failedCount', { count: result.failed.length })}</Text>
          <Stack gap={4} mt="xs" p={0}>
            {result.failed.map((f, i) => (
              <Text key={i} size="sm">#{f.index}: {f.error}</Text>
            ))}
          </Stack>
        </Alert>
      )}
    </Stack>
  )

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className={`
          relative overflow-hidden
          ${colors.card} 
          rounded-2xl w-full max-w-[700px] 
          shadow-2xl
          border ${colors.cardBorder}
        `}
        onClick={e => e.stopPropagation()}
        
      >
        {/* 顶部渐变装饰 */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
        
        {/* 装饰性光晕 */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 rounded-full blur-3xl opacity-50" />
        
        {/* Header */}
        <div className="relative px-6 pt-6 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`
                w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10
                flex items-center justify-center
                ring-1 ${colors.ringColor}
                shadow-lg
              `}>
                <Upload size={24} className="text-indigo-400" strokeWidth={2} />
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${colors.text} leading-tight`}>{t('import.title')}</h2>
                <p className={`text-xs ${colors.textMuted} mt-0.5`}>{t('import.subtitle') || '批量导入账号数据'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl ${colors.cardHover}`}
            >
              <X size={18} className={colors.textMuted} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative max-h-[75vh] overflow-y-auto">
          {importResult || ssoResult ? (
            <div className="px-6 py-6">
              <Stack gap="lg" p="md">
                {importResult && renderResult(importResult)}
                {ssoResult && renderResult(ssoResult)}
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={() => { setImportResult(null); setSsoResult(null); setJsonText(''); setSsoToken(''); setParseResult(null) }}
                    className={`px-5 py-2.5 text-sm font-medium rounded-xl ${colors.btnSecondary}`}
                  >
                    {t('import.continueImport')}
                  </button>
                  <button
                    onClick={onClose}
                    className={`
                      px-6 py-2.5 text-sm font-medium rounded-xl text-white
                      bg-gradient-to-r from-emerald-500 to-teal-600
                      shadow-lg shadow-emerald-500/30
                      hover:opacity-90 hover:shadow-xl
                     
                    `}
                  >
                    {t('import.done')}
                  </button>
                </div>
              </Stack>
            </div>
          ) : importing || ssoImporting ? (
            <div className="px-6 py-8">
              <Stack gap="xl" p="md">
                <div className={`p-5 rounded-xl ${colors.cardSecondary} border ${colors.cardBorder}`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin text-white" />
                    </div>
                    <div>
                      <div className={`font-medium ${colors.text}`}>{importing ? t('import.importing') : t('import.ssoImporting')}</div>
                      <div className={`text-sm ${colors.textMuted}`}>
                        {(importing ? importProgress : ssoProgress).current}/{(importing ? importProgress : ssoProgress).total}
                      </div>
                    </div>
                  </div>
                  <Progress 
                    value={(importing ? importProgress : ssoProgress).current / (importing ? importProgress : ssoProgress).total * 100} 
                    size="lg"
                    radius="xl"
                    classNames={{
                      root: 'bg-gray-200 dark:bg-gray-700',
                      bar: 'bg-gradient-to-r from-blue-500 to-indigo-600'
                    }}
                  />
                </div>
              </Stack>
            </div>
          ) : (
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List className="px-6 pt-4 border-b-0">
                <Tabs.Tab value="json" leftSection={<FileJson size={16} />}>{t('import.jsonTab')}</Tabs.Tab>
                <Tabs.Tab value="sso" leftSection={<Key size={16} />}>{t('import.ssoTab')}</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="json" pt="md" className="px-6 pb-6">
                <Stack gap="xl" p="md">
              <Group>
                <FileButton onChange={handleFileSelect} accept=".json">
                  {(props) => <Button {...props} variant="light" leftSection={<FileJson size={16} />}>{t('import.selectFile')}</Button>}
                </FileButton>
                <Button variant="light" color="blue" size="sm" onClick={() => setJsonText(JSON.stringify([{ refreshToken: "", provider: "Google", machineId: "" }], null, 2))}>
                  {t('import.socialTemplate')}
                </Button>
                <Button variant="light" color="violet" size="sm" onClick={() => setJsonText(JSON.stringify([{ refreshToken: "", clientId: "", clientSecret: "", region: "us-east-1", provider: "BuilderId", machineId: "" }], null, 2))}>
                  {t('import.idcTemplate')}
                </Button>
              </Group>

              <Textarea
                label={t('import.orPaste')}
                value={jsonText}
                onChange={(e) => { setJsonText(e.target.value); parseJson(e.target.value) }}
                rows={10}
                placeholder={`[{"refreshToken": "aor...", "provider": "Google"}]`}
                styles={{ 
                  input: { 
                    fontFamily: 'monospace'
                  } 
                }}
              />

              {parseResult && (
                <Stack gap="xs" p={0}>
                  {parseResult.valid.length > 0 && (
                    <Alert icon={<CheckCircle size={16} />} color="teal" variant="light">
                      {t('import.parseSuccess')}: {parseResult.valid.length} {t('import.validRecords')}
                    </Alert>
                  )}
                  {parseResult.errors.length > 0 && (
                    <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
                      <Text size="sm" fw={500}>{t('import.validationError')}</Text>
                      <Stack gap={2} mt="xs" p={0}>
                        {parseResult.errors.slice(0, 5).map((err, i) => (
                          <Text key={i} size="xs">{err}</Text>
                        ))}
                        {parseResult.errors.length > 5 && (
                          <Text size="xs">{t('import.moreErrors', { count: parseResult.errors.length - 5 })}</Text>
                        )}
                      </Stack>
                    </Alert>
                  )}
                </Stack>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={onClose}
                  className={`px-5 py-2.5 text-sm font-medium rounded-xl ${colors.btnSecondary}`}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleJsonImport}
                  disabled={!parseResult?.valid.length}
                  className={`
                    px-6 py-2.5 text-sm font-medium rounded-xl text-white
                    bg-gradient-to-r from-indigo-500 to-purple-600
                    shadow-lg shadow-indigo-500/30
                    hover:opacity-90 hover:shadow-xl
                    disabled:opacity-50 disabled:cursor-not-allowed 
                    flex items-center gap-2 
                   
                  `}
                >
                  <Upload size={16} />
                  {t('import.import')} {parseResult?.valid.length ? `(${parseResult.valid.length})` : ''}
                </button>
              </div>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="sso" pt="md" className="px-6 pb-6">
            <Stack gap="xl" p="md">
              <Alert color="blue" variant="light">
                <Text size="sm" fw={500}>{t('import.ssoGuide')}</Text>
                <ol className={`list-decimal list-inside space-y-1 text-xs mt-2 ${colors.text}`}>
                  <li>{t('import.ssoStep1')}</li>
                  <li>{t('import.ssoStep2')}</li>
                  <li>{t('import.ssoStep3')}</li>
                  <li>{t('import.ssoStep4')}</li>
                </ol>
              </Alert>

              <Textarea
                label={t('import.ssoTokenLabel')}
                description={t('import.ssoTokenHint')}
                value={ssoToken}
                onChange={(e) => setSsoToken(e.target.value)}
                rows={6}
                placeholder={t('import.ssoTokenPlaceholder')}
                styles={{ 
                  input: { 
                    fontFamily: 'monospace'
                  } 
                }}
              />

              <Select
                label="Region"
                description={t('import.regionOptional')}
                value={ssoRegion}
                onChange={setSsoRegion}
                data={[
                  { value: 'us-east-1', label: 'us-east-1' },
                  { value: 'us-west-2', label: 'us-west-2' },
                  { value: 'eu-west-1', label: 'eu-west-1' },
                  { value: 'ap-northeast-1', label: 'ap-northeast-1' }
                ]}
                classNames={{
                  input: `${colors.text} ${colors.input}`,
                  dropdown: `${colors.card} border ${colors.cardBorder}`,
                  option: `${colors.text}`
                }}
              />

              {ssoToken.trim() && (
                <Alert icon={<CheckCircle size={16} />} color="blue" variant="light" radius="xl">
                  {t('import.detectedTokens', { count: ssoToken.split('\n').filter(t => t.trim()).length })}
                </Alert>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={onClose}
                  className={`px-5 py-2.5 text-sm font-medium rounded-xl ${colors.btnSecondary}`}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSsoImport}
                  disabled={!ssoToken.trim()}
                  className={`
                    px-6 py-2.5 text-sm font-medium rounded-xl text-white
                    bg-gradient-to-r from-indigo-500 to-purple-600
                    shadow-lg shadow-indigo-500/30
                    hover:opacity-90 hover:shadow-xl
                    disabled:opacity-50 disabled:cursor-not-allowed 
                    flex items-center gap-2 
                   
                  `}
                >
                  <Key size={16} />
                  {t('import.import')} {ssoToken.trim() ? `(${ssoToken.split('\n').filter(t => t.trim()).length})` : ''}
                </button>
              </div>
            </Stack>
          </Tabs.Panel>
        </Tabs>
          )}
        </div>
      </div>


    </div>
  )
}

export default ImportAccountModal
