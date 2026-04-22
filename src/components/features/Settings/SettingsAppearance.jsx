import { Sun, Moon, Palette, Check } from 'lucide-react'
import { Card, CardContent } from '../../ui/card'
import { buildThemeOptions } from './settingsConstants'
import { getThemeAccent } from '../KiroConfig/themeAccent'
import React from 'react'

function SettingsAppearance({ theme, setTheme, t, colors }) {
  const accent = getThemeAccent(theme)
  const themeIconMap = { Sun, Moon, Palette }
  const themeOptions = buildThemeOptions(t)

  const themeAccentBorderClass = `${accent.border} shadow-md ${accent.shadow}`
  const themeAccentDotClass = accent.solidBg
  const themeAccentTextClass = accent.text

  return (
    <Card className="card-glow animate-slide-in-left delay-100 mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="w-full text-left">
            <p className={`text-sm font-semibold ${colors.text}`}>{t('settings.theme')}</p>
            <p className={`text-xs ${colors.textMuted} mt-0.5`}>{t('settings.themeDesc')}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
            {themeOptions.map((opt) => {
              const Icon = themeIconMap[opt.iconName]
              const isActive = theme === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setTheme(opt.key)}
                  className={`relative min-h-[44px] flex items-center justify-center gap-2.5 px-3 py-2 rounded-xl border-2 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 ${accent.ring} ${isActive
                    ? `${themeAccentBorderClass} ${colors.card}`
                    : `${colors.cardBorder} ${colors.cardHover} ${colors.card}`
                    }`}
                >
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${opt.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={14} className="text-white" />
                  </div>
                  <span className={`text-sm font-medium ${colors.text}`}>{opt.name}</span>
                  {isActive && (
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${themeAccentDotClass}`}>
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default SettingsAppearance
