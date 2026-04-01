import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'

void i18n.use(initReactI18next).init({
  interpolation: {
    escapeValue: false
  },
  lng: 'zh-CN',
  fallbackLng: 'en-US',
  resources,
  returnNull: false
})

export default i18n
