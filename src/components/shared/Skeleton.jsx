import { useTheme } from '../contexts/ThemeContext'

// 基础骨架元素
export function SkeletonBox({ className = '' }) {
  const { colors } = useTheme()
  
  return (
    <div 
      className={`animate-pulse rounded ${colors.cardSecondary} ${className}`}
    />
  )
}

// 账号卡片骨架屏
export function AccountCardSkeleton() {
  const { colors } = useTheme()

  return (
    <div className={`relative rounded-2xl border ${colors.cardBorder} ${colors.card} p-4 pt-10`}>
      {/* 选择框占位 */}
      <div className="absolute top-3 left-3">
        <SkeletonBox className="w-4 h-4 rounded" />
      </div>

      {/* 状态标签占位 */}
      <div className="absolute top-3 right-3">
        <SkeletonBox className="w-12 h-5 rounded" />
      </div>

      {/* 头像和邮箱 */}
      <div className="flex items-start gap-3 mb-3">
        <SkeletonBox className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <SkeletonBox className="h-4 w-3/4 mb-2" />
          <SkeletonBox className="h-3 w-1/2" />
        </div>
      </div>

      {/* 订阅类型 */}
      <div className="flex items-center gap-2 mb-3">
        <SkeletonBox className="h-6 w-16 rounded-lg" />
        <SkeletonBox className="h-6 w-14 rounded-lg" />
      </div>

      {/* 配额进度 */}
      <div className={`p-3 rounded-xl mb-3 ${colors.cardSecondary}`}>
        <div className="flex items-center justify-between mb-2">
          <SkeletonBox className="h-3 w-12" />
          <SkeletonBox className="h-3 w-8" />
        </div>
        <SkeletonBox className="h-2 w-full rounded-full mb-2" />
        <div className="flex items-center justify-between">
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-3 w-16" />
        </div>
      </div>
    </div>
  )
}

// 账号列表骨架屏
export function AccountListSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
      {[...Array(count)].map((_, i) => (
        <AccountCardSkeleton key={i} />
      ))}
    </div>
  )
}

// 表格行骨架屏
export function AccountTableRowSkeleton() {
  const { colors, theme } = useTheme()
  const isLightTheme = theme === 'light'

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${colors.cardBorder}`}>
      {/* 选择框 */}
      <SkeletonBox className="w-4 h-4 rounded shrink-0" />
      {/* 邮箱 */}
      <div className="w-44 shrink-0">
        <SkeletonBox className="h-4 w-32 mb-1" />
        <SkeletonBox className="h-3 w-20" />
      </div>
      {/* 标签 */}
      <div className="w-28 shrink-0 flex gap-1">
        <SkeletonBox className="h-5 w-12 rounded" />
        <SkeletonBox className="h-5 w-10 rounded" />
      </div>
      {/* 提供商 */}
      <SkeletonBox className="w-20 h-6 rounded shrink-0" />
      {/* 订阅类型 */}
      <SkeletonBox className="w-20 h-6 rounded shrink-0" />
      {/* 配额 */}
      <div className="w-20 shrink-0">
        <SkeletonBox className="h-3 w-12 mb-1" />
        <SkeletonBox className="h-1 w-full rounded-full" />
      </div>
      {/* 状态 */}
      <SkeletonBox className="w-14 h-6 rounded shrink-0" />
      {/* 机器码 */}
      <SkeletonBox className="w-20 h-4 shrink-0" />
      {/* 过期时间 */}
      <SkeletonBox className="w-24 h-4 shrink-0" />
      {/* 试用到期 */}
      <SkeletonBox className="w-20 h-4 shrink-0" />
      {/* 操作按钮 */}
      <div className="flex items-center gap-1 w-32 justify-center ml-auto">
        <SkeletonBox className="w-7 h-7 rounded-lg" />
        <SkeletonBox className="w-7 h-7 rounded-lg" />
        <SkeletonBox className="w-7 h-7 rounded-lg" />
        <SkeletonBox className="w-7 h-7 rounded-lg" />
        <SkeletonBox className="w-7 h-7 rounded-lg" />
      </div>
    </div>
  )
}

// 表格视图骨架屏
export function AccountTableSkeleton({ count = 8 }) {
  const { colors, theme } = useTheme()
  const isLightTheme = theme === 'light'

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      {/* 顶部信息栏 */}
      <div className="flex items-center justify-between mb-2 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <SkeletonBox className="w-4 h-4 rounded" />
          <SkeletonBox className="h-4 w-16" />
        </div>
        <SkeletonBox className="h-4 w-24" />
      </div>

      {/* 表头 */}
      <div className={`flex items-center gap-3 px-4 py-3 ${colors.cardSecondary} border ${colors.cardBorder} rounded-t-xl`}>
        <SkeletonBox className="w-4 h-4" />
        <SkeletonBox className="w-44 h-3" />
        <SkeletonBox className="w-28 h-3" />
        <SkeletonBox className="w-20 h-3" />
        <SkeletonBox className="w-20 h-3" />
        <SkeletonBox className="w-20 h-3" />
        <SkeletonBox className="w-14 h-3" />
        <SkeletonBox className="w-20 h-3" />
        <SkeletonBox className="w-24 h-3" />
        <SkeletonBox className="w-20 h-3" />
        <SkeletonBox className="w-32 h-3 ml-auto" />
      </div>

      {/* 表格行 */}
      <div className={`flex-1 overflow-hidden border border-t-0 ${colors.cardBorder} rounded-b-xl`}>
        {[...Array(count)].map((_, i) => (
          <AccountTableRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// 首页统计卡片骨架屏
export function StatCardSkeleton() {
  const { colors } = useTheme()

  return (
    <div className={`rounded-2xl p-5 border ${colors.cardBorder} ${colors.card}`}>
      <div className="flex items-center gap-2 mb-2">
        <SkeletonBox className="w-8 h-8 rounded-lg" />
        <SkeletonBox className="h-4 w-20" />
      </div>
      <SkeletonBox className="h-8 w-16" />
    </div>
  )
}

export default { SkeletonBox, AccountCardSkeleton, AccountListSkeleton, AccountTableRowSkeleton, AccountTableSkeleton, StatCardSkeleton }
