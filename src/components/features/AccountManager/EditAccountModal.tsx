import { useState, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Copy, Check, Folder, Plus, X } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import { setAccountTags, setAccountGroup, getGroups, addGroup } from '../../../api/groupTag'
import { getAccountDisplayName } from '../../../utils/accountStats'
import { TagSelector } from './GroupTagManager'
import { TokenJsonView } from './TokenJsonView'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter} from '../../shared/dialog'
import { Button } from '../../shared/button'
import { getThemeAccent } from '../KiroConfig/themeAccent'
import { Account, GroupDefinition } from '../../../types/account'
import React from 'react'

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
]

interface GroupSelectorProps {
  groups: GroupDefinition[];
  value: string;
  onChange: (value: string) => void;
  onGroupsChange: (groups: GroupDefinition[]) => void;
}

function GroupSelector({ groups, value, onChange, onGroupsChange }: GroupSelectorProps) {
  const { t, theme } = useApp()
  const accent = useMemo(() => getThemeAccent(theme), [theme])
  const colors = useMemo(() => ({
    inputFocus: 'focus:ring-primary/20 focus:border-primary'
  }), [])

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
      const newGroup = await addGroup(trimmed, color) as GroupDefinition
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
      <div className="flex gap-2">
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
          placeholder={t('groups.newGroupPlaceholder') || '输入新分组名...'}
          className={`flex-1 px-4 py-2.5 border rounded-xl text-foreground bg-background border-input ${colors.inputFocus} focus:ring-2 outline-none`}
        />
        <button
          onClick={handleAddGroup}
          disabled={!newGroupName.trim()}
          className={`p-2.5 ${accent.solidBg} text-white rounded-xl ${accent.solidHoverBg} disabled:opacity-50 cursor-pointer`}
        >
          <Check size={16} />
        </button>
        <button
          onClick={() => { setShowInput(false); setNewGroupName('') }}
          className={`p-2.5 rounded-xl hover:bg-muted/50 cursor-pointer`}
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 px-4 py-2.5 border rounded-xl text-foreground bg-background border-input ${colors.inputFocus} focus:ring-2 outline-none`}
      >
        <option value="">{t('groups.noGroup') || '无分组'}</option>
        {groups.map(g => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      <button
        onClick={() => setShowInput(true)}
        className={`p-2.5 ${accent.solidBg} text-white rounded-xl ${accent.solidHoverBg} cursor-pointer`}
      >
        <Plus size={16} />
      </button>
    </div>
  )
}

interface EditAccountModalProps {
  account: Account;
  onClose: () => void;
  onSuccess?: (account: Account) => void;
}

function EditAccountModal({ account, onClose, onSuccess }: EditAccountModalProps) {
  const { t, theme } = useApp()
  const { showError } = useDialog()
  const accent = useMemo(() => getThemeAccent(theme), [theme])
  const colors = useMemo(() => ({
    inputFocus: 'focus:ring-primary/20 focus:border-primary'
  }), [])

  const isIdCAccount = account.provider === 'BuilderId' || account.provider === 'Enterprise'

  const [form, setForm] = useState({
    label: account.label || '',
    accessToken: account.accessToken || '',
    refreshToken: account.refreshToken || '',
    clientId: account.clientId || '',
    clientSecret: account.clientSecret || '',
    machineId: account.machineId || ''})

  const [selectedTagIds, setSelectedTagIds] = useState((account.tagLinks || []).map(link => link.tagId))
  const [selectedGroupId, setSelectedGroupId] = useState(account.groupId || '')
  const [groups, setGroups] = useState<GroupDefinition[]>([])
  const [saving, setSaving] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    getGroups().then(setGroups).catch(() => {})
  }, [])

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (e) {
      console.error('复制失败:', e)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const params: any = {
        id: account.id,
        label: form.label || null,
        accessToken: form.accessToken || null,
        refreshToken: form.refreshToken || null,
        machineId: form.machineId || null}
      if (isIdCAccount) {
        params.clientId = form.clientId || null
        params.clientSecret = form.clientSecret || null
      }
      const updatedAccount = await invoke<Account>('update_account', { params })
      await setAccountGroup(account.id, selectedGroupId || null)
      await setAccountTags(account.id, selectedTagIds)
      onSuccess?.(updatedAccount)
      onClose()
    } catch (e) {
      await showError(t('editAccount.saveFailed'), String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogRoot open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent maxWidth="480px">
        <DialogHeader icon={Folder} iconColor={accent.text} iconBg={accent.iconBadgeBg}>
          <DialogTitle>{t('editAccount.title')}</DialogTitle>
          <DialogDescription>{getAccountDisplayName(account)}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div>
            <label className={`block text-sm font-medium text-foreground mb-2`}>
              {t('accounts.remark')}
            </label>
            <input
              type="text"
              placeholder={t('editAccount.labelPlaceholder')}
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className={`w-full px-4 py-3 border rounded-xl text-sm text-foreground bg-background border-input ${colors.inputFocus} focus:ring-2 outline-none`}
            />
          </div>

          <div className="mt-4">
            <label className={`block text-sm font-medium text-foreground mb-2`}>
              {t('addAccount.machineId')}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={t('addAccount.machineIdPlaceholder')}
                value={form.machineId}
                onChange={(e) => setForm({ ...form, machineId: e.target.value })}
                className={`w-full px-4 py-3 pr-10 border rounded-xl text-sm text-foreground bg-background border-input ${colors.inputFocus} focus:ring-2 outline-none`}
              />
              <button
                onClick={() => handleCopy(form.machineId, 'machineId')}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer`}
                title={copiedField === 'machineId' ? '已复制' : '复制'}
              >
                {copiedField === 'machineId' ? <Check size={16} className="text-green-500" /> : <Copy size={16} className={"text-muted-foreground"} />}
              </button>
            </div>
          </div>

          {isIdCAccount && (
            <>
              <div className="mt-4">
                <label className={`block text-sm font-medium text-foreground mb-2`}>
                  Client ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="刷新 Token 需要"
                    value={form.clientId}
                    onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                    className={`w-full px-4 py-3 pr-10 border rounded-xl text-sm text-foreground bg-background border-input ${colors.inputFocus} focus:ring-2 outline-none`}
                  />
                  <button
                    onClick={() => handleCopy(form.clientId, 'clientId')}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer`}
                    title={copiedField === 'clientId' ? '已复制' : '复制'}
                  >
                    {copiedField === 'clientId' ? <Check size={16} className="text-green-500" /> : <Copy size={16} className={"text-muted-foreground"} />}
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <label className={`block text-sm font-medium text-foreground mb-2`}>
                  Client Secret
                </label>
                <div className="relative">
                  <textarea
                    placeholder="刷新 Token 需要"
                    value={form.clientSecret}
                    onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                    rows={2}
                    className={`w-full px-4 py-3 pr-10 border rounded-xl text-sm text-foreground bg-background border-input ${colors.inputFocus} focus:ring-2 resize-none outline-none`}
                  />
                  <button
                    onClick={() => handleCopy(form.clientSecret, 'clientSecret')}
                    className={`absolute right-3 top-3 p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer`}
                    title={copiedField === 'clientSecret' ? '已复制' : '复制'}
                  >
                    {copiedField === 'clientSecret' ? <Check size={16} className="text-green-500" /> : <Copy size={16} className={"text-muted-foreground"} />}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="mt-4">
            <div className={`text-sm font-medium mb-2 flex items-center gap-1.5 text-foreground`}>
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

          <div className="mt-4">
            <TagSelector 
              selectedTagIds={selectedTagIds} 
              onChange={setSelectedTagIds} 
            />
          </div>

          <div className="mt-4">
            <TokenJsonView account={account} defaultExpanded={false} />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={saving}
            loading={saving}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}

export default EditAccountModal
