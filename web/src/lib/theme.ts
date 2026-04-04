import lightPlusTheme from '../../../themes/builtin/winssh-default-themes/themes/light-plus.json'

type ThemeDocument = {
  colors: Record<string, string>
}

const themeDocument = lightPlusTheme as ThemeDocument

export function applyLightPlusTheme(root: HTMLElement) {
  root.dataset.theme = 'winssh.light-plus'
  root.dataset.themeAppearance = 'light'
  root.style.colorScheme = 'light'

  for (const [key, value] of Object.entries(themeDocument.colors)) {
    root.style.setProperty(`--${key}`, value)
  }
}
