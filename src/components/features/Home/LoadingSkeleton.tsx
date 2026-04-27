import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// 骨架屏加载状态
function LoadingSkeleton({ colors }) {
  return (
    <div className={`h-full overflow-auto glass-main`}>
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />

      <div className="max-w-5xl mx-auto p-8 relative">
        {/* Header 骨架 */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex gap-4">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="w-64 h-8 rounded-lg" />
          </div>
          <Skeleton className="w-80 h-5 rounded-lg" />
        </div>

        {/* 统计卡片骨架 */}
        <div className="grid grid-cols-5 gap-6 mb-8">
          {[...Array(5)].map((_, i) => (
            <Card
              key={i}
              className="rounded-3xl"
              style={{
                background: "glass-card",
                borderColor: "border-border"
              }}
            >
              <div className="flex gap-4 items-center p-6">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="w-3/5 h-7" />
                  <Skeleton className="w-4/5 h-4" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* 主内容骨架 */}
        <div className="grid grid-cols-2 gap-8">
          <Card
            className="rounded-3xl p-0"
            style={{
              background: "glass-card",
              borderColor: "border-border"
            }}
          >
            <div className={`px-6 py-4 border-b border-border`}>
              <Skeleton className="w-32 h-5" />
            </div>
            <div className="flex flex-col gap-4 p-8">
              <div className="flex gap-4">
                <Skeleton className="w-16 h-16 rounded-3xl" />
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="w-2/5 h-5" />
                  <Skeleton className="w-3/10 h-4" />
                </div>
              </div>
              <Skeleton className="w-full h-24 rounded-3xl" />
            </div>
          </Card>

          <Card
            className="rounded-3xl p-0"
            style={{
              background: "glass-card",
              borderColor: "border-border"
            }}
          >
            <div className={`px-6 py-4 border-b border-border`}>
              <Skeleton className="w-24 h-5" />
            </div>
            <div className="flex flex-col gap-4 p-8">
              <Skeleton className="w-full h-16 rounded-3xl" />
              <div className="grid grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-3xl" />
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default LoadingSkeleton
