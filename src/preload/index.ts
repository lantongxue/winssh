import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { WinsshApi } from '@shared/api'

function subscribe<T>(channel: string, callback: (payload: T) => void) {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

const api: WinsshApi = {
  groups: {
    list: () => ipcRenderer.invoke('groups:list'),
    create: (input) => ipcRenderer.invoke('groups:create', input),
    update: (id, input) => ipcRenderer.invoke('groups:update', id, input),
    delete: (id) => ipcRenderer.invoke('groups:delete', id)
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    create: (input) => ipcRenderer.invoke('tags:create', input),
    update: (id, input) => ipcRenderer.invoke('tags:update', id, input),
    delete: (id) => ipcRenderer.invoke('tags:delete', id)
  },
  credentials: {
    list: () => ipcRenderer.invoke('credentials:list'),
    getSecret: (id) => ipcRenderer.invoke('credentials:getSecret', id),
    create: (input) => ipcRenderer.invoke('credentials:create', input),
    update: (id, input) => ipcRenderer.invoke('credentials:update', id, input),
    delete: (id) => ipcRenderer.invoke('credentials:delete', id)
  },
  servers: {
    list: () => ipcRenderer.invoke('servers:list'),
    getSecrets: (id) => ipcRenderer.invoke('servers:getSecrets', id),
    create: (input) => ipcRenderer.invoke('servers:create', input),
    update: (id, input) => ipcRenderer.invoke('servers:update', id, input),
    delete: (id) => ipcRenderer.invoke('servers:delete', id),
    toggleFavorite: (id) => ipcRenderer.invoke('servers:toggleFavorite', id),
    listRecent: () => ipcRenderer.invoke('servers:listRecent'),
    clearRecent: () => ipcRenderer.invoke('servers:clearRecent')
  },
  sessions: {
    connect: (request) => ipcRenderer.invoke('sessions:connect', request),
    disconnect: (sessionId) => ipcRenderer.invoke('sessions:disconnect', sessionId),
    reconnect: (sessionId) => ipcRenderer.invoke('sessions:reconnect', sessionId),
    getResourceSnapshot: (sessionId) => ipcRenderer.invoke('sessions:getResourceSnapshot', sessionId),
    write: (sessionId, data) => ipcRenderer.invoke('sessions:write', sessionId, data),
    resize: (sessionId, columns, rows) =>
      ipcRenderer.invoke('sessions:resize', sessionId, columns, rows),
    onData: (callback) => subscribe('sessions:data', callback),
    onExit: (callback) => subscribe('sessions:exit', callback),
    onStateChange: (callback) => subscribe('sessions:state', callback),
    onError: (callback) => subscribe('sessions:error', callback)
  },
  localTerminals: {
    create: () => ipcRenderer.invoke('localTerminals:create'),
    close: (terminalId) => ipcRenderer.invoke('localTerminals:close', terminalId),
    write: (terminalId, data) => ipcRenderer.invoke('localTerminals:write', terminalId, data),
    resize: (terminalId, columns, rows) =>
      ipcRenderer.invoke('localTerminals:resize', terminalId, columns, rows),
    onData: (callback) => subscribe('localTerminals:data', callback),
    onExit: (callback) => subscribe('localTerminals:exit', callback),
    onStateChange: (callback) => subscribe('localTerminals:state', callback)
  },
  sftp: {
    list: (sessionId, remotePath) => ipcRenderer.invoke('sftp:list', sessionId, remotePath),
    createFile: (sessionId, remotePath, name) =>
      ipcRenderer.invoke('sftp:createFile', sessionId, remotePath, name),
    mkdir: (sessionId, remotePath, name) =>
      ipcRenderer.invoke('sftp:mkdir', sessionId, remotePath, name),
    rename: (sessionId, remotePath, newName) =>
      ipcRenderer.invoke('sftp:rename', sessionId, remotePath, newName),
    remove: (sessionId, remotePath) => ipcRenderer.invoke('sftp:remove', sessionId, remotePath),
    uploadFiles: (sessionId, targetPath) =>
      ipcRenderer.invoke('sftp:uploadFiles', sessionId, targetPath),
    uploadPaths: (sessionId, targetPath, localPaths) =>
      ipcRenderer.invoke('sftp:uploadPaths', sessionId, targetPath, localPaths),
    downloadFile: (sessionId, remotePath) =>
      ipcRenderer.invoke('sftp:downloadFile', sessionId, remotePath),
    refresh: (sessionId, remotePath) => ipcRenderer.invoke('sftp:refresh', sessionId, remotePath),
    onTransferProgress: (callback) => subscribe('sftp:transfer', callback)
  },
  portForwards: {
    list: (sessionId) => ipcRenderer.invoke('portForwards:list', sessionId),
    create: (sessionId, input) => ipcRenderer.invoke('portForwards:create', sessionId, input),
    start: (sessionId, ruleId) => ipcRenderer.invoke('portForwards:start', sessionId, ruleId),
    stop: (sessionId, ruleId) => ipcRenderer.invoke('portForwards:stop', sessionId, ruleId),
    remove: (sessionId, ruleId) => ipcRenderer.invoke('portForwards:remove', sessionId, ruleId),
    onStateChange: (callback) => subscribe('portForwards:state', callback)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (input) => ipcRenderer.invoke('settings:update', input)
  },
  themes: {
    list: () => ipcRenderer.invoke('themes:list'),
    importArchive: () => ipcRenderer.invoke('themes:importArchive'),
    deletePlugin: (pluginId) => ipcRenderer.invoke('themes:deletePlugin', pluginId)
  },
  system: {
    getPathForFile: (file) => {
      try {
        const localPath = webUtils.getPathForFile(file)
        return localPath.trim() ? localPath : null
      } catch {
        return null
      }
    },
    pickPrivateKey: () => ipcRenderer.invoke('system:pickPrivateKey'),
    pickServerIcon: () => ipcRenderer.invoke('system:pickServerIcon'),
    listFonts: () => ipcRenderer.invoke('system:listFonts'),
    getKnownHosts: () => ipcRenderer.invoke('system:getKnownHosts'),
    removeKnownHost: (host, port) => ipcRenderer.invoke('system:removeKnownHost', host, port),
    getCapabilities: () => ipcRenderer.invoke('system:getCapabilities'),
    relaunch: () => ipcRenderer.invoke('system:relaunch'),
    window: {
      minimize: () => ipcRenderer.invoke('system:window:minimize'),
      toggleMaximize: () => ipcRenderer.invoke('system:window:toggleMaximize'),
      close: () => ipcRenderer.invoke('system:window:close'),
      isMaximized: () => ipcRenderer.invoke('system:window:isMaximized'),
      onStateChange: (callback) => subscribe('system:windowState', callback)
    }
  }
}

contextBridge.exposeInMainWorld('winsshApi', api)
