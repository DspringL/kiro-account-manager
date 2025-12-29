// 统计卡片组件 - 紧凑版
function StatCard({ icon: Icon, iconBg, value, label, delay, isLightTheme }) {
  return (
    <div 
      className={`card-glow rounded-xl p-3 shadow-sm border animate-scale-in ${delay}`}
      style={{ 
        background: isLightTheme ? 'white' : 'rgba(30, 30, 50, 0.8)',
        borderColor: isLightTheme ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'
      }}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon size={18} className={!isLightTheme ? 'text-current' : ''} />
        </div>
        <div>
          <span className={`text-xl font-bold stat-number ${isLightTheme ? 'text-gray-900' : 'text-white'}`}>{value}</span>
          <div className={`text-xs ${isLightTheme ? 'text-gray-500' : 'text-gray-400'}`}>{label}</div>
        </div>
      </div>
    </div>
  )
}

export default StatCard
