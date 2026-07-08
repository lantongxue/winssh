const common = {
  appName: 'WinSSH',
  actions: {
    add: 'Add',
    browse: 'Browse',
    cancel: 'Cancel',
    clear: 'Clear',
    close: 'Close',
    commandPalette: 'Command Palette',
    connect: 'Connect',
    create: 'Create',
    delete: 'Delete',
    discard: 'Discard',
    disconnect: 'Disconnect',
    download: 'Download',
    edit: 'Edit',
    import: 'Import',
    newConnection: 'New Connection',
    newFile: 'New File',
    newFolder: 'New Folder',
    open: 'Open',
    openSettings: 'Open Settings',
    openTerminal: 'Open Local Terminal',
    quickOpen: 'Quick Connect',
    reconnect: 'Reconnect',
    refresh: 'Refresh',
    reject: 'Reject',
    rename: 'Rename',
    restartNow: 'Restart Now',
    save: 'Save',
    start: 'Start',
    stop: 'Stop',
    togglePanel: 'Toggle Panel',
    toggleSidebar: 'Toggle Sidebar',
    trust: 'Trust',
    upload: 'Upload'
  },
  labels: {
    color: 'Color',
    name: 'Name',
    none: 'None',
    root: 'Root',
    selectedCount: '{{count}} selected'
  },
  theme: {
    dark: 'Dark+',
    light: 'Light+',
    pixel: 'Pixel CRT',
    system: 'System'
  },
  language: {
    enUS: 'English',
    system: 'System',
    zhCN: 'Simplified Chinese'
  },
  titleBarStyle: {
    custom: 'Custom Title Bar',
    native: 'Native Title Bar'
  },
  shortcuts: {
    quickOpen: 'Ctrl/Cmd+P',
    togglePanel: 'Ctrl/Cmd+J',
    toggleSidebar: 'Ctrl/Cmd+B'
  },
  hostTrust: {
    hostChanged: {
      title: 'Host Fingerprint Changed',
      message: 'The host fingerprint for {{serverName}} does not match the previous record.',
      detail:
        'Old fingerprint: {{knownFingerprint}}\nNew fingerprint: {{fingerprint}}\n\nIf you cannot verify the change, cancel the connection.',
      cancel: 'Cancel Connection',
      trust: 'Trust New Fingerprint'
    },
    hostFirstSeen: {
      title: 'First-Time Host Connection',
      message: 'Trust the host fingerprint for {{serverName}}?',
      detail: 'Address: {{host}}:{{port}}\nFingerprint: {{fingerprint}}',
      reject: 'Reject',
      trust: 'Trust and Continue'
    }
  }
}

export default common
