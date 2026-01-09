// 筛选器应用函数
export function applyFilters(accounts, filters) {
  if (!filters) return accounts
  const hasFilters = (filters.subscriptions?.length > 0) ||
    (filters.statuses?.length > 0) ||
    (filters.providers?.length > 0) ||
    filters.usageRange
  if (!hasFilters) return accounts

  return accounts.filter(account => {
    // 订阅类型筛选 - 使用 subscriptionTitle 字段
    if (filters.subscriptions?.length > 0) {
      const subTitle = (account.usageData?.subscriptionInfo?.subscriptionTitle || '').toUpperCase()
      let subType = 'FREE'
      if (subTitle.includes('ENTERPRISE')) {
        subType = 'KIRO ENTERPRISE'
      } else if (subTitle.includes('PRO+')) {
        subType = 'KIRO PRO+'
      } else if (subTitle.includes('PRO')) {
        subType = 'KIRO PRO'
      } else if (subTitle.includes('KIRO')) {
        subType = 'KIRO FREE'
      }
      if (!filters.subscriptions.includes(subType)) return false
    }

    // 状态筛选
    if (filters.statuses?.length > 0) {
      const rawStatus = (account.status || '').toLowerCase()
      let status = 'normal'
      if (rawStatus.includes('ban') || rawStatus.includes('封禁')) {
        status = 'banned'
      } else if (rawStatus.includes('expir') || rawStatus.includes('过期')) {
        status = 'expired'
      }
      if (!filters.statuses.includes(status)) return false
    }

    // 提供商筛选
    if (filters.providers?.length > 0) {
      const provider = account.provider || 'Google'
      const matchProvider = filters.providers.some(p => 
        p.toLowerCase() === provider.toLowerCase()
      )
      if (!matchProvider) return false
    }

    // 使用率范围筛选 - 字符串格式 '0-25', '25-50' 等
    if (filters.usageRange && typeof filters.usageRange === 'string') {
      const [minStr, maxStr] = filters.usageRange.split('-')
      const min = parseInt(minStr, 10)
      const max = parseInt(maxStr, 10)
      
      const breakdown = account.usageData?.usageBreakdownList?.[0]
      const quota = breakdown?.usageLimit || 0
      const used = breakdown?.currentUsage || 0
      const percent = quota > 0 ? (used / quota) * 100 : 0
      
      if (max === 100) {
        if (percent < min || percent > max) return false
      } else {
        if (percent < min || percent >= max) return false
      }
    }

    return true
  })
}
