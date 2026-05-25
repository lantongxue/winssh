const common = {
  appName: 'WinSSH',
  actions: {
    browse: '浏览',
    cancel: '取消',
    clear: '清除',
    close: '关闭',
    commandPalette: '命令面板',
    connect: '连接',
    create: '创建',
    delete: '删除',
    discard: '放弃更改',
    disconnect: '断开',
    download: '下载',
    edit: '编辑',
    import: '导入',
    newConnection: '新建连接',
    newFile: '新建文件',
    newFolder: '新建文件夹',
    open: '打开',
    openSettings: '打开设置',
    openTerminal: '打开本地终端',
    quickOpen: '快速连接',
    reconnect: '重新连接',
    refresh: '刷新',
    reject: '拒绝',
    rename: '重命名',
    restartNow: '立即重启',
    save: '保存',
    start: '启动',
    stop: '停止',
    togglePanel: '切换底部面板',
    toggleSidebar: '切换侧栏',
    trust: '信任',
    upload: '上传'
  },
  labels: {
    color: '颜色',
    name: '名称',
    none: '无',
    root: '根目录',
    selectedCount: '{{count}} 已选'
  },
  theme: {
    dark: 'Dark+',
    light: 'Light+',
    pixel: '像素终端',
    system: '跟随系统'
  },
  language: {
    enUS: 'English',
    system: '跟随系统',
    zhCN: '简体中文'
  },
  titleBarStyle: {
    custom: '自绘标题栏',
    native: '系统原生标题栏'
  },
  shortcuts: {
    quickOpen: 'Ctrl/Cmd+P',
    togglePanel: 'Ctrl/Cmd+J',
    toggleSidebar: 'Ctrl/Cmd+B'
  },
  hostTrust: {
    hostChanged: {
      title: '主机指纹已变更',
      message: '{{serverName}} 的主机指纹与上次记录不一致',
      detail:
        '旧指纹: {{knownFingerprint}}\n新指纹: {{fingerprint}}\n\n如果你无法确认变更来源，请取消连接。',
      cancel: '取消连接',
      trust: '信任新指纹'
    },
    hostFirstSeen: {
      title: '首次连接主机',
      message: '是否信任 {{serverName}} 的主机指纹？',
      detail: '地址: {{host}}:{{port}}\n指纹: {{fingerprint}}',
      reject: '拒绝',
      trust: '信任并继续'
    }
  }
}

export default common
