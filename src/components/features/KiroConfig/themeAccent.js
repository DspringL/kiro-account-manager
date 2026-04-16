import { isLightTheme as checkIsLightTheme } from '../../../utils/themeMode'

function freezeThemeRecord(record) {
  Object.values(record).forEach(Object.freeze)
  return Object.freeze(record)
}

const THEME_ACCENTS = freezeThemeRecord({
  light: {
    text: 'text-blue-500',
    textHover: 'hover:text-blue-500',
    textSoft: 'text-blue-400',
    bg: 'bg-blue-500/20',
    bgSoft: 'bg-blue-500/10',
    hoverBgSoft: 'hover:bg-blue-500/10',
    border: 'border-blue-500/50',
    borderSoft: 'border-blue-500/20',
    hoverBorder: 'hover:border-blue-500/35',
    ring: 'ring-blue-500/60',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-purple-500',
    solidBg: 'bg-blue-500',
    solidHoverBg: 'hover:bg-blue-600',
    gradientHoverFrom: 'hover:from-blue-600',
    gradientHoverTo: 'hover:to-purple-600',
    shadow: 'shadow-blue-500/25',
    scopeBadge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    tabActive: 'bg-blue-500/20 text-blue-500 shadow-sm',
    iconBadgeBg: 'bg-gradient-to-br from-blue-500/20 to-purple-500/20',
  },
  dark: {
    text: 'text-indigo-400',
    textHover: 'hover:text-indigo-300',
    textSoft: 'text-indigo-300',
    bg: 'bg-indigo-500/20',
    bgSoft: 'bg-indigo-500/10',
    hoverBgSoft: 'hover:bg-indigo-500/10',
    border: 'border-indigo-500/50',
    borderSoft: 'border-indigo-500/20',
    hoverBorder: 'hover:border-indigo-500/35',
    ring: 'ring-indigo-500/60',
    gradientFrom: 'from-indigo-500',
    gradientTo: 'to-violet-500',
    solidBg: 'bg-indigo-500',
    solidHoverBg: 'hover:bg-indigo-600',
    gradientHoverFrom: 'hover:from-indigo-600',
    gradientHoverTo: 'hover:to-violet-600',
    shadow: 'shadow-indigo-500/25',
    scopeBadge: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    tabActive: 'bg-indigo-500/20 text-indigo-300 shadow-sm',
    iconBadgeBg: 'bg-gradient-to-br from-indigo-500/20 to-violet-500/20',
  },
  purple: {
    text: 'text-purple-500',
    textHover: 'hover:text-purple-500',
    textSoft: 'text-purple-300',
    bg: 'bg-purple-500/20',
    bgSoft: 'bg-purple-500/10',
    hoverBgSoft: 'hover:bg-purple-500/10',
    border: 'border-purple-500/50',
    borderSoft: 'border-purple-500/20',
    hoverBorder: 'hover:border-purple-500/35',
    ring: 'ring-purple-500/60',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-fuchsia-500',
    solidBg: 'bg-purple-500',
    solidHoverBg: 'hover:bg-purple-600',
    gradientHoverFrom: 'hover:from-purple-600',
    gradientHoverTo: 'hover:to-fuchsia-600',
    shadow: 'shadow-purple-500/25',
    scopeBadge: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    tabActive: 'bg-purple-500/20 text-purple-500 shadow-sm',
    iconBadgeBg: 'bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20',
  },
  green: {
    text: 'text-emerald-500',
    textHover: 'hover:text-emerald-500',
    textSoft: 'text-emerald-300',
    bg: 'bg-emerald-500/20',
    bgSoft: 'bg-emerald-500/10',
    hoverBgSoft: 'hover:bg-emerald-500/10',
    border: 'border-emerald-500/50',
    borderSoft: 'border-emerald-500/20',
    hoverBorder: 'hover:border-emerald-500/35',
    ring: 'ring-emerald-500/60',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-teal-500',
    solidBg: 'bg-emerald-500',
    solidHoverBg: 'hover:bg-emerald-600',
    gradientHoverFrom: 'hover:from-emerald-600',
    gradientHoverTo: 'hover:to-teal-600',
    shadow: 'shadow-emerald-500/25',
    scopeBadge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    tabActive: 'bg-emerald-500/20 text-emerald-500 shadow-sm',
    iconBadgeBg: 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20',
  },
})

const THEME_SURFACE_STYLES = freezeThemeRecord({
  light: {
    inputBg: '#ffffff',
    inputBorder: '#d1d5db',
    inputText: '#1f2937',
    placeholder: '#94a3b8',
    dropdownBg: '#ffffff',
    dropdownBorder: 'rgba(0, 0, 0, 0.1)',
    editorText: '#1f2937',
    editorBg: 'rgba(243, 244, 246, 0.5)',
    editorBorder: 'rgba(209, 213, 219, 0.5)',
    pillBg: 'rgb(59 130 246 / 0.14)',
    pillText: 'rgb(30 64 175)',
    pillBorder: '1px solid rgb(59 130 246 / 0.3)',
  },
  dark: {
    inputBg: '#252540',
    inputBorder: '#374151',
    inputText: '#f3f4f6',
    placeholder: '#c8d4ea',
    dropdownBg: '#1a1a2e',
    dropdownBorder: 'rgba(255, 255, 255, 0.1)',
    editorText: '#e5e7eb',
    editorBg: 'rgba(30, 30, 50, 0.5)',
    editorBorder: 'rgba(255, 255, 255, 0.1)',
    pillBg: 'rgb(99 102 241 / 0.34)',
    pillText: 'rgb(224 231 255)',
    pillBorder: '1px solid rgb(129 140 248 / 0.45)',
  },
  purple: {
    inputBg: '#ffffff',
    inputBorder: '#c4b5fd',
    inputText: '#4c1d95',
    placeholder: '#a78bfa',
    dropdownBg: '#ffffff',
    dropdownBorder: 'rgba(124, 58, 237, 0.25)',
    editorText: '#4c1d95',
    editorBg: 'rgba(233, 213, 255, 0.4)',
    editorBorder: 'rgba(196, 181, 253, 0.6)',
    pillBg: 'rgb(147 51 234 / 0.16)',
    pillText: 'rgb(107 33 168)',
    pillBorder: '1px solid rgb(147 51 234 / 0.35)',
  },
  green: {
    inputBg: '#ffffff',
    inputBorder: '#86efac',
    inputText: '#065f46',
    placeholder: '#34d399',
    dropdownBg: '#ffffff',
    dropdownBorder: 'rgba(16, 185, 129, 0.3)',
    editorText: '#065f46',
    editorBg: 'rgba(209, 250, 229, 0.45)',
    editorBorder: 'rgba(110, 231, 183, 0.6)',
    pillBg: 'rgb(16 185 129 / 0.16)',
    pillText: 'rgb(6 95 70)',
    pillBorder: '1px solid rgb(16 185 129 / 0.35)',
  },
})

export function getThemeAccent(theme) {
  return THEME_ACCENTS[theme] || THEME_ACCENTS.light
}

export function isLightTheme(theme) {
  return checkIsLightTheme(theme)
}

export function getThemeSurfaceStyles(theme) {
  return THEME_SURFACE_STYLES[theme] || THEME_SURFACE_STYLES.light
}

export function getSolidAccentButton(accent) {
  return `${accent.solidBg} text-white ${accent.solidHoverBg}`
}

export function getGradientAccentButton(accent) {
  return `bg-gradient-to-r ${accent.gradientFrom} ${accent.gradientTo} text-white shadow-lg ${accent.shadow} ${accent.gradientHoverFrom} ${accent.gradientHoverTo}`
}
