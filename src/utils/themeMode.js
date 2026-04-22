const DARK_THEME_NAMES = Object.freeze(['dark', 'dark-one', 'tech'])

export function isLightTheme(theme) {
  return !DARK_THEME_NAMES.includes(theme)
}
