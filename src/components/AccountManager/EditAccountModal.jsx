import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Modal, TextInput, Textarea, Button, Stack, Group, Select, ActionIcon, CopyButton, Tooltip } from '@mantine/core'
import { Copy, Check, Folder, Plus, X } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { useDialog } from '../../contexts/DialogContext'
import { setAccountTags, setAccountGroup, getGroups, addGroup } from '../../api/groupTag'
import { TagSelector } from './GroupTagManager'
import { TokenJsonView } from './TokenJsonView'

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
]

function GroupSelector({ groups, value, onChange, onGroupsChange }) {
  const { t, colors } = useApp()
  const [newGroupName, setNewGroupName] = useState('')
  const [showInput, setShowInput] = useState(false)

  const handleAddGroup = async () => {
    const trimmed = newGroupName.trim().slice(0, 20)
    if (!trimmed) return
    if (groups.some(g => g.name === trimmed)) {
      setNewGroupName('')
      return
    }
    const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    try {
      const newGroup = await addGroup(trimmed, color)
      onGroupsChange([...groups, newGroup])
      onChange(newGroup.id)
      setNewGroupName('')
      setShowInput(false)
    } catch (e) {
      console.error('创建分组失败:', e)
    }
  }

  if (showInput) {
    return (
      <Group gap="xs">
        <TextInput
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
          placeholder={t('groups.newGroupPlaceholder') || '输入新分组名...'}
          style={{ flex: 1 }}
          classNames={{
            input: `${colors.text} ${colors.input}`
          }}
        />
        <ActionIcon color="blue" onClick={handleAddGroup} disabled={!newGroupName.trim()}>
          <Check size={16} />
        </ActionIcon>
        <ActionIcon onClick={() => { setShowInput(false); setNewGroupName('') }}>
          <X size={16} />
        </ActionIcon>
      </Group>
    )
  }

  return (
    <Group gap="xs">
      <Select
        value={value}
        onChange={onChange}
        data={[
          { value: '', label: t('groups.noGroup') || '无分组' },
          ...groups.map(g => ({ value: g.id, label: g.name }))
        ]}
        style={{ flex: 1 }}
        classNames={{
          input: `${colors.text} ${colors.input}`,
          dropdown: `${colors.card} border ${colors.cardBorder}`,
          option: `${colors.text}`
        }}
      />
      <ActionIcon color="blue" onClick={() => setShowInput(true)}>
        <Plus size={16} />
      </ActionIcon>
    </Group>
  )
}

function EditAccountModal({ account, onClose, onSuccess }) {
  const { t, colors } = useApp()
  const { showError } = useDialog()
  
  const [form, setForm] = useState({
    label: account.label || '',
    accessToken: account.accessToken || '',
    refreshToken: account.refreshToken || '',
    clientId: account.clientId || '',
    clientSecret: account.clientSecret || '',
    machineId: account.machineId || '',
  })
  const [selectedTagIds, setSelectedTagIds] = useState((account.tagLinks || []).map(link => link.tagId))
  const [selectedGroupId, setSelectedGroupId] = useState(account.groupId || '')
  const [groups, setGroups] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getGroups().then(setGroups).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const params = {
        id: account.id,
        label: form.label || null,
        accessToken: form.accessToken || null,
        refreshToken: form.refreshToken || null,
        machineId: form.machineId || null,
      }
      if (account.provider === 'BuilderId') {
        params.clientId = form.clientId || null
        params.clientSecret = form.clientSecret || null
      }
      await invoke('update_account', params)
      await setAccountGroup(account.id, selectedGroupId || null)
      await setAccountTags(account.id, selectedTagIds)
      onSuccess?.()
      onClose()
    } catch (e) {
      await showError(t('editAccount.saveFailed'), e.toString())
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={
        <div>
          <div className="font-medium">{t('editAccount.title')}</div>
          <div className={`text-xs ${colors.textMuted}`}>{account.email}</div>
        </div>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        <TextInput
          label={t('accounts.remark')}
          placeholder={t('editAccount.labelPlaceholder')}
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          classNames={{
            input: `${colors.text} ${colors.input}`
          }}
        />

        <TextInput
          label={t('addAccount.machineId')}
          placeholder={t('addAccount.machineIdPlaceholder')}
          value={form.machineId}
          onChange={(e) => setForm({ ...form, machineId: e.target.value })}
          classNames={{
            input: `${colors.text} ${colors.input}`
          }}
          rightSection={
            <CopyButton value={form.machineId}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? '已复制' : '复制'}>
                  <ActionIcon onClick={copy} variant="subtle">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          }
        />

        {account.provider === 'BuilderId' && (
          <>
            <TextInput
              label="Client ID"
              placeholder="刷新 Token 需要"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              classNames={{
                input: `${colors.text} ${colors.input}`
              }}
              rightSection={
                <CopyButton value={form.clientId}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? '已复制' : '复制'}>
                      <ActionIcon onClick={copy} variant="subtle">
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              }
            />
            <Textarea
              label="Client Secret"
              placeholder="刷新 Token 需要"
              value={form.clientSecret}
              onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
              rows={2}
              classNames={{
                input: `${colors.text} ${colors.input}`
              }}
              rightSection={
                <CopyButton value={form.clientSecret}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? '已复制' : '复制'}>
                      <ActionIcon onClick={copy} variant="subtle">
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              }
            />
          </>
        )}

        <div>
          <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <Folder size={14} />
            {t('groups.title') || '分组'}
          </div>
          <GroupSelector
            groups={groups}
            value={selectedGroupId}
            onChange={setSelectedGroupId}
            onGroupsChange={setGroups}
          />
        </div>

        <TagSelector 
          selectedTagIds={selectedTagIds} 
          onChange={setSelectedTagIds} 
        />

        <TokenJsonView account={account} defaultExpanded={false} />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export default EditAccountModal
