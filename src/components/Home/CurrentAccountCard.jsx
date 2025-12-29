import { RefreshCw, Users, Clock } from 'lucide-react'

// 当前账号卡片
function CurrentAccountCard({ localToken, refreshing, handleRefresh, isLightTheme, colors, t }) {
  return (
    <div className={`card-glow ${colors.card} rounded-2xl shadow-sm border ${colors.cardBorder} animate-scale-in delay-300`}>
      <div className={`px-6 py-4 border-b ${colors.cardBorder} flex items-center justify-between`}>
        <h2 className={`font-semibold ${colors.text}`}>{t('home.currentAccount')}</h2>
        <button 
          onClick={handleRefresh} 
          className={`btn-icon p-2 ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} rounded-xl ${refreshing ? 'spinning' : ''}`}
        >
          <RefreshCw size={16} className={`${colors.textMuted} ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="p-6">
        {localToken ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 group relative">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg transition-transform hover:scale-105 ${
                localToken.provider === 'Google' ? 'bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/25' :
                localToken.provider === 'Github' ? 'bg-gradient-to-br from-gray-700 to-gray-900 shadow-gray-500/25' :
                'bg-gradient-to-br from-blue-500 to-purple-600 shadow-blue-500/25'
              }`}>
                {localToken.provider?.[0] || 'K'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${colors.text} text-lg`}>{localToken.provider || t('home.unknown')}</span>
                  <span className={`px-2.5 py-1 ${isLightTheme ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400'} rounded-full text-xs font-medium pulse-ring`}>{t('home.loggedIn')}</span>
                </div>
                <div className={`text-sm ${colors.textMuted} mt-1`}>{localToken.authMethod || 'social'}</div>
              </div>
              {/* Hover 显示 Token 详情 */}
              <TokenDetailPopover localToken={localToken} isLightTheme={isLightTheme} colors={colors} t={t} />
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className={`w-16 h-16 ${isLightTheme ? 'bg-gray-100' : 'bg-white/10'} rounded-full flex items-center justify-center mx-auto mb-3 animate-float`}>
              <Users size={28} className={colors.textMuted} />
            </div>
            <div className={`${colors.textMuted} mb-1 font-medium`}>{t('home.notLoggedIn')}</div>
            <div className={`text-sm ${colors.textMuted}`}>{t('home.clickToSwitch')}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// Token 详情悬浮框
function TokenDetailPopover({ localToken, isLightTheme, colors, t }) {
  return (
    <div className={`absolute left-16 top-0 w-72 ${isLightTheme ? 'bg-white' : 'bg-[#1a1a2e]'} rounded-xl shadow-2xl border ${colors.cardBorder} p-3 space-y-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none`}>
      <div className="flex items-center justify-between text-xs">
        <span className={colors.textMuted}>Access Token</span>
        <span title={localToken.accessToken} className={`font-mono ${colors.textMuted} truncate max-w-[140px]`}>
          {localToken.accessToken?.substring(0, 12)}...
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className={colors.textMuted}>Refresh Token</span>
        <span title={localToken.refreshToken} className={`font-mono ${colors.textMuted} truncate max-w-[140px]`}>
          {localToken.refreshToken?.substring(0, 12)}...
        </span>
      </div>
      {localToken.authMethod === 'IdC' ? (
        <>
          <div className="flex items-center justify-between text-xs">
            <span className={colors.textMuted}>Client ID Hash</span>
            <span className={`font-mono ${colors.textMuted} truncate max-w-[140px]`}>
              {localToken.clientIdHash || '-'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className={colors.textMuted}>Region</span>
            <span className={`font-mono ${colors.textMuted}`}>{localToken.region || '-'}</span>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between text-xs">
          <span className={colors.textMuted}>Profile ARN</span>
          <span title={localToken.profileArn} className={`font-mono ${colors.textMuted} truncate max-w-[140px]`}>
            {localToken.profileArn || '-'}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between text-xs">
        <span className={colors.textMuted}>{t('home.expiresAt')}</span>
        <span className={`${colors.text} flex items-center gap-1`}>
          <Clock size={10} />
          {localToken.expiresAt ? new Date(localToken.expiresAt).toLocaleString() : t('home.unknown')}
        </span>
      </div>
    </div>
  )
}

export default CurrentAccountCard
