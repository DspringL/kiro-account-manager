import { Card } from '@/components/ui/card'
import { useApp } from '../../../hooks/useApp'

// 统计卡片组件 - 紧凑版
function StatCard({ icon: Icon, iconBg, iconColor, value, label, delay, onClick, warning }) {
  const { colors } = useApp()

  return (
    <Card
      onClick={onClick}
      className={`card-glow animate-scale-in ${delay} ${onClick ? `cursor-pointer ${colors.cardHover} transition-colors duration-200` : ''} rounded-3xl p-4`}
      style={warning ? { borderColor: 'rgba(249, 115, 22, 0.5)', borderWidth: '2px' } : undefined}
    >
      <div className="flex gap-4 items-center flex-nowrap">
        <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center relative flex-shrink-0`}>
          <Icon size={18} className={iconColor} />
          {warning && (
            <span
              className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse"
            />
          )}
        </div>
        <div className="flex flex-col gap-0">
          <div className={`text-xl font-bold stat-number ${colors.text}`}>
            {value}
          </div>
          <div className={`text-xs ${colors.textMuted}`}>{label}</div>
        </div>
      </div>
    </Card>
  )
}

export default StatCard
