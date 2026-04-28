import { Account, AccountUsageData } from '../types/account';

const ACTIVE_STATUSES = new Set(['active', '正常', '有效'])
const CAPPED_STATUSES = new Set(['capped', '封顶'])
const BANNED_STATUSES = new Set(['banned', '封禁', '已封禁'])
const INVALID_STATUSES = new Set(['invalid', '失效', '已失效', 'Token已失效', 'token已失效'])
const EXPIRED_STATUSES = new Set(['expired', '过期', '已过期'])

function resolveStatusInput(statusOrAccount: string | Account | any, usageData?: AccountUsageData) {
  if (statusOrAccount && typeof statusOrAccount === 'object' && !Array.isArray(statusOrAccount)) {
    return {
      status: (statusOrAccount as Account).status || (statusOrAccount as any).status,
      usageData: (statusOrAccount as Account).usageData || usageData
    }
  }

  return {
    status: statusOrAccount as string,
    usageData
  }
}

function getUsageNumber(source: any, integerKey: string, preciseKey: string): number | null {
  const precise = source?.[preciseKey]
  if (typeof precise === 'number') return precise

  const integer = source?.[integerKey]
  if (typeof integer === 'number') return integer

  return null
}

export function isUsageCapped(usageData?: AccountUsageData): boolean {
  const breakdown = usageData?.usageBreakdownList?.[0]
  if (!breakdown) return false

  const currentUsage = getUsageNumber(breakdown, 'currentUsage', 'currentUsageWithPrecision')
  const usageLimit = getUsageNumber(breakdown, 'usageLimit', 'usageLimitWithPrecision')

  if (typeof currentUsage !== 'number' || typeof usageLimit !== 'number' || usageLimit <= 0) {
    return false
  }

  return currentUsage >= usageLimit
}

export function normalizeAccountStatus(statusOrAccount: string | Account | any, usageData?: AccountUsageData): string {
  const { status, usageData: resolvedUsageData } = resolveStatusInput(statusOrAccount, usageData)
  if (!status) return 'unknown'

  let normalized = status
  if (ACTIVE_STATUSES.has(status)) normalized = 'active'
  else if (CAPPED_STATUSES.has(status)) normalized = 'capped'
  else if (BANNED_STATUSES.has(status)) normalized = 'banned'
  else if (INVALID_STATUSES.has(status)) normalized = 'invalid'
  else if (EXPIRED_STATUSES.has(status)) normalized = 'expired'

  if (normalized === 'active' && isUsageCapped(resolvedUsageData)) {
    return 'capped'
  }

  return normalized
}

export function isActiveStatus(statusOrAccount: string | Account | any, usageData?: AccountUsageData): boolean {
  return normalizeAccountStatus(statusOrAccount, usageData) === 'active'
}

export function isCappedStatus(statusOrAccount: string | Account | any, usageData?: AccountUsageData): boolean {
  return normalizeAccountStatus(statusOrAccount, usageData) === 'capped'
}

export function isBannedStatus(statusOrAccount: string | Account | any, usageData?: AccountUsageData): boolean {
  return normalizeAccountStatus(statusOrAccount, usageData) === 'banned'
}

export function isInvalidStatus(statusOrAccount: string | Account | any, usageData?: AccountUsageData): boolean {
  return normalizeAccountStatus(statusOrAccount, usageData) === 'invalid'
}

export function isExpiredStatus(statusOrAccount: string | Account | any, usageData?: AccountUsageData): boolean {
  return normalizeAccountStatus(statusOrAccount, usageData) === 'expired'
}

export function isUnavailableStatus(statusOrAccount: string | Account | any, usageData?: AccountUsageData): boolean {
  const normalized = normalizeAccountStatus(statusOrAccount, usageData)
  return normalized === 'banned' || normalized === 'invalid' || normalized === 'expired'
}

export function isAvailableStatus(statusOrAccount: string | Account | any, usageData?: AccountUsageData): boolean {
  return !isUnavailableStatus(statusOrAccount, usageData)
}

export interface StatusMeta {
    key: string;
    label: string;
    tone: 'success' | 'warning' | 'danger';
}

export function getAccountStatusMeta(statusOrAccount: string | Account | any, t?: any, usageData?: AccountUsageData): StatusMeta {
  const normalized = normalizeAccountStatus(statusOrAccount, usageData)

  switch (normalized) {
    case 'active':
      return { key: 'active', label: t?.('accounts.active') ?? '正常', tone: 'success' }
    case 'capped':
      return { key: 'capped', label: '封顶', tone: 'warning' }
    case 'banned':
      return { key: 'banned', label: t?.('accounts.banned') ?? '封禁', tone: 'danger' }
    case 'invalid':
      return { key: 'invalid', label: t?.('accounts.invalid') ?? '失效', tone: 'warning' }
    case 'expired':
      return { key: 'expired', label: t?.('accounts.expired') ?? '过期', tone: 'warning' }
    default:
      const { status } = resolveStatusInput(statusOrAccount, usageData)
      return { key: normalized, label: status || (t?.('common.unknown') ?? '未知'), tone: 'warning' }
  }
}
