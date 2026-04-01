import i18n from './index'

export function translateMaybeKey(value: string): string {
  return i18n.exists(value) ? i18n.t(value) : value
}
