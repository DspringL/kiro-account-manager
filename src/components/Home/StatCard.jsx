// 统计卡片组件 - 紧凑版
function StatCard({ icon: Icon, iconBg, value, label, delay, isDark }) {
  return (
    <div 
      className={`card-glow rounded-xl p-3 shadow-sm border animate-scale-in ${delay}`}
      style={{ 
        background: isDark ? 'rgba(30, 30, 50, 0.8)' : 'white',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
      }}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon size={18} className={isDark ? 'text-current' : ''} />
        </div>
        <div>
          <span className={`text-xl font-bold stat-number ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</div>
        </div>
      </div>
    </div>
  )
}

export default StatCard
