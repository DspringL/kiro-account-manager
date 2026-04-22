import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw, Users, Clock } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'
import { getThemeAccent } from '../KiroConfig/themeAccent'
import { getProviderDisplayName, isGitHubProvider } from '../../../utils/accountProvider'

// 当前账号卡片
function CurrentAccountCard({ localToken, refreshing, handleRefresh, colors, t }) {
  const { theme } = useApp()
  const accent = getThemeAccent(theme)

  return (
    <Card className="card-glow animate-scale-in delay-300">
      <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-3 border-b ${colors.cardBorder}`}>
        <span className={`font-semibold ${colors.text}`}>{t('home.currentAccount')}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
                className={refreshing ? 'spinning' : ''}
              >
                <RefreshCw size={16} className={colors.textMuted} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('common.refresh')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>

      <CardContent className="pt-6">
        {localToken ? (
          <div className="flex items-center gap-4 group relative">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg transition-transform hover:scale-105 flex-shrink-0 ${
              localToken.provider === 'Google' ? 'bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/25' :
              isGitHubProvider(localToken.provider) ? 'bg-gradient-to-br from-gray-700 to-gray-900 shadow-gray-500/25' :
              `bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} ${accent.shadow}`
            }`}>
              {localToken.provider?.[0] || 'K'}
            </div>

            <div className="flex flex-col gap-1 flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-lg ${colors.text}`}>
                  {getProviderDisplayName(localToken.provider) || t('home.unknown')}
                </span>
                <Badge variant="default" className="pulse-ring bg-green-500/10 text-green-600 dark:text-green-400">
                  {t('home.loggedIn')}
                </Badge>
              </div>
              <span className={`text-sm ${colors.textMuted}`}>{localToken.authMethod || 'social'}</span>
            </div>

            {/* Hover 显示 Token 详情 */}
            <TokenDetailPopover localToken={localToken} colors={colors} t={t} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center animate-float ${colors.cardSecondary}`}>
              <Users size={28} className={colors.textMuted} />
            </div>
            <span className={`${colors.textMuted} font-medium`}>{t('home.notLoggedIn')}</span>
            <span className={`text-sm ${colors.textMuted}`}>{t('home.clickToSwitch')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Token 详情悬浮框
function TokenDetailPopover({ localToken, colors, t }) {
  return (
    <Card className="absolute left-16 top-0 w-72 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none shadow-xl">
      <CardContent className="p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className={`text-xs ${colors.textMuted}`}>Access Token</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`text-xs font-mono truncate ${colors.textMuted} max-w-[140px] cursor-help`}>
                  {localToken.accessToken?.substring(0, 12)}...
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono text-xs">{localToken.accessToken}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex justify-between items-center">
          <span className={`text-xs ${colors.textMuted}`}>Refresh Token</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`text-xs font-mono truncate ${colors.textMuted} max-w-[140px] cursor-help`}>
                  {localToken.refreshToken?.substring(0, 12)}...
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono text-xs">{localToken.refreshToken}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {localToken.authMethod === 'IdC' ? (
          <>
            <div className="flex justify-between items-center">
              <span className={`text-xs ${colors.textMuted}`}>Client ID Hash</span>
              <span className={`text-xs font-mono truncate ${colors.textMuted} max-w-[140px]`}>
                {localToken.clientIdHash || '-'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-xs ${colors.textMuted}`}>Region</span>
              <span className={`text-xs font-mono ${colors.textMuted}`}>{localToken.region || '-'}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between items-center">
            <span className={`text-xs ${colors.textMuted}`}>Profile ARN</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`text-xs font-mono truncate ${colors.textMuted} max-w-[140px] cursor-help`}>
                    {localToken.profileArn || '-'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-mono text-xs">{localToken.profileArn}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className={`text-xs ${colors.textMuted}`}>{t('home.expiresAt')}</span>
          <div className="flex items-center gap-1">
            <Clock size={10} />
            <span className={`text-xs ${colors.text}`}>
              {localToken.expiresAt ? new Date(localToken.expiresAt).toLocaleString() : t('home.unknown')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default CurrentAccountCard
