import commonEnUS from './en-US/common'
import validationEnUS from './en-US/validation'
import workbenchEnUS from './en-US/workbench'
import commonZhCN from './zh-CN/common'
import validationZhCN from './zh-CN/validation'
import workbenchZhCN from './zh-CN/workbench'

export const resources = {
  'en-US': {
    translation: {
      common: commonEnUS,
      ...validationEnUS,
      ...workbenchEnUS
    }
  },
  'zh-CN': {
    translation: {
      common: commonZhCN,
      ...validationZhCN,
      ...workbenchZhCN
    }
  }
} as const
