import { RefreshCw } from 'lucide-react'

// 骨架屏单元
function Skeleton({ className }) {
  return <div className={`skeleton ${className}`} />
}

// 骨架屏加载状态
function LoadingSkeleton({ colors }) {
  return (
    <div className={`h-full overflow-auto ${colors.main}`}>
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      
      <div className="max-w-5xl mx-auto p-8 relative">
        {/* Header 骨架 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <Skeleton className="w-64 h-8 rounded-lg" />
          </div>
          <Skeleton className="w-80 h-5 rounded-lg mt-3" />
        </div>

        {/* 统计卡片骨架 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <Skeleton className="w-12 h-10 rounded-lg" />
              </div>
              <Skeleton className="w-20 h-4 rounded" />
            </div>
          ))}
        </div>

        {/* 主内容骨架 */}
        <div className="grid grid-cols-2 gap-6">
          <div className={`${colors.card} rounded-2xl border ${colors.cardBorder} overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${colors.cardBorder}`}>
              <Skeleton className="w-32 h-5 rounded" />
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="w-24 h-5 rounded" />
                  <Skeleton className="w-16 h-4 rounded" />
                </div>
              </div>
              <Skeleton className="w-full h-24 rounded-xl" />
            </div>
          </div>
          
          <div className={`${colors.card} rounded-2xl border ${colors.cardBorder} overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${colors.cardBorder}`}>
              <Skeleton className="w-24 h-5 rounded" />
            </div>
            <div className="p-6 space-y-4">
              <Skeleton className="w-full h-16 rounded-xl" />
              <div className="grid grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoadingSkeleton
