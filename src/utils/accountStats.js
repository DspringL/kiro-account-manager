// 账号统计计算工具函数

// 从 account 获取 breakdown（API 返回 camelCase）
const getBreakdown = (a) => {
  return a.usageData?.usageBreakdownList?.[0] || null
}

// 获取总配额（主配额 + 试用 + 奖励）
const getQuota = (a) => {
  const breakdown = getBreakdown(a)
  if (!breakdown) return a.quota ?? 50
  
  const main = breakdown.usageLimit ?? 50
  const freeTrial = breakdown.freeTrialInfo?.usageLimit ?? 0
  // bonuses 可能是 null/undefined，确保是数组
  const bonuses = Array.isArray(breakdown.bonuses) ? breakdown.bonuses : []
  const bonus = bonuses.reduce((sum, b) => sum + (b.usageLimit ?? 0), 0)
  return main + freeTrial + bonus
}

// 获取已使用量（主配额 + 试用 + 奖励）
const getUsed = (a) => {
  const breakdown = getBreakdown(a)
  if (!breakdown) return a.used ?? 0
  
  const main = breakdown.currentUsage ?? 0
  const freeTrial = breakdown.freeTrialInfo?.currentUsage ?? 0
  // bonuses 可能是 null/undefined，确保是数组
  const bonuses = Array.isArray(breakdown.bonuses) ? breakdown.bonuses : []
  const bonus = bonuses.reduce((sum, b) => sum + (b.currentUsage ?? 0), 0)
  return main + freeTrial + bonus
}
const getSubType = (a) => a.usageData?.subscriptionInfo?.type ?? a.subscriptionType ?? ''
const getSubPlan = (a) => a.usageData?.subscriptionInfo?.subscriptionTitle ?? a.subscriptionPlan ?? ''

export function calcAccountStats(accounts) {
  const total = accounts.length
  const active = accounts.filter(a => a.status === 'active' || a.status === '正常' || a.status === '有效').length
  // 使用 Math.round 避免浮点数精度问题
  const totalQuota = Math.round(accounts.reduce((sum, a) => sum + getQuota(a), 0))
  const totalUsed = Math.round(accounts.reduce((sum, a) => sum + getUsed(a), 0))
  const proPlus = accounts.filter(a => getSubType(a).includes('PRO+') || getSubPlan(a).includes('PRO+')).length
  const pro = accounts.filter(a => 
    (getSubType(a).includes('PRO') || getSubPlan(a).includes('PRO')) && 
    !(getSubType(a).includes('PRO+') || getSubPlan(a).includes('PRO+'))
  ).length
  const usagePercent = totalQuota > 0 ? (totalUsed / totalQuota * 100).toFixed(1) : 0

  return { total, active, totalQuota, totalUsed, proPlus, pro, usagePercent, remaining: totalQuota - totalUsed }
}

export function getUsagePercent(used, quota) {
  return quota === 0 ? 0 : Math.min(100, (used / quota) * 100)
}

export { getQuota, getUsed, getSubType, getSubPlan }
