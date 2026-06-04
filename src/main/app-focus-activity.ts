import { type BrowserWindow, powerMonitor } from 'electron'

export function setupAppFocusAndActivityListeners(window: BrowserWindow): () => void {
  let blurDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const onBlur = () => {
    blurDebounceTimer = setTimeout(() => {
      window.webContents.send('system:appFocus', { phase: 'blurred' })
    }, 100)
  }

  const onFocus = () => {
    if (blurDebounceTimer !== null) {
      clearTimeout(blurDebounceTimer)
      blurDebounceTimer = null
    }
    window.webContents.send('system:appFocus', { phase: 'focused' })
  }

  const onSuspend = () => {
    window.webContents.send('system:appActivity', { phase: 'sleep' })
  }
  const onResume = () => {
    window.webContents.send('system:appActivity', { phase: 'wake' })
  }
  const onLockScreen = () => {
    window.webContents.send('system:appActivity', { phase: 'lock-screen' })
  }
  const onUnlockScreen = () => {
    window.webContents.send('system:appActivity', { phase: 'unlock-screen' })
  }

  window.on('blur', onBlur)
  window.on('focus', onFocus)
  powerMonitor.on('suspend', onSuspend)
  powerMonitor.on('resume', onResume)
  powerMonitor.on('lock-screen', onLockScreen)
  powerMonitor.on('unlock-screen', onUnlockScreen)

  return () => {
    if (blurDebounceTimer !== null) {
      clearTimeout(blurDebounceTimer)
      blurDebounceTimer = null
    }
    window.removeListener('blur', onBlur)
    window.removeListener('focus', onFocus)
    powerMonitor.removeListener('suspend', onSuspend)
    powerMonitor.removeListener('resume', onResume)
    powerMonitor.removeListener('lock-screen', onLockScreen)
    powerMonitor.removeListener('unlock-screen', onUnlockScreen)
  }
}
