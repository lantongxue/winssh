import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { WinsshApi } from '@shared/api'
import type { IpcCallback, IpcChannel, IpcPayload } from '@shared/ipc-channels'
import type { LocalTerminalDataEvent, SessionDataEvent } from '@shared/types'

// ============================================================
// 1. 静态 ID 提取器注册表 —— 每个需要过滤的 channel 只定义一次
// ============================================================
type IdExtractor = (payload: unknown) => string | undefined

const CHANNEL_ID_EXTRACTORS: Partial<Record<IpcChannel, IdExtractor>> = {
  'sessions:data': (p) => (p as SessionDataEvent).sessionId,
  'localTerminals:data': (p) => (p as LocalTerminalDataEvent).terminalId
}

// ============================================================
// 2. 内部 Hub 结构 —— 全局 + 按 ID 索引，双轨分发
// ============================================================
interface ChannelHub {
  globalCallbacks: Set<(payload: unknown) => void>
  keyedCallbacks: Map<string, Set<(payload: unknown) => void>>
  idExtractor: IdExtractor | undefined
  listener: (...args: unknown[]) => void
  dispatching: boolean
}

const hubs = new Map<IpcChannel, ChannelHub>()

function getOrCreateHub(channel: IpcChannel): ChannelHub {
  const existing = hubs.get(channel)
  if (existing) return existing

  const idExtractor = CHANNEL_ID_EXTRACTORS[channel]

  const hub: ChannelHub = {
    globalCallbacks: new Set(),
    keyedCallbacks: new Map(),
    idExtractor,
    dispatching: false,

    listener(_event: unknown, payload: unknown) {
      hub.dispatching = true

      // --- 全局回调 ---
      for (const cb of hub.globalCallbacks) {
        try {
          cb(payload)
        } catch (err) {
          console.error(`[preload] subscriber error on channel "${channel}":`, err)
        }
      }

      // --- 按 ID 索引的回调 (O(1) 查找) ---
      if (hub.idExtractor) {
        const id = hub.idExtractor(payload)
        if (id) {
          const cbs = hub.keyedCallbacks.get(id)
          if (cbs) {
            for (const cb of cbs) {
              try {
                cb(payload)
              } catch (err) {
                console.error(`[preload] subscriber error on channel "${channel}" id="${id}":`, err)
              }
            }
          }
        }
      }

      hub.dispatching = false
    }
  }

  hubs.set(channel, hub)
  ipcRenderer.on(channel, hub.listener)
  return hub
}

/**
 * 确保在 dispatch 循环之外执行清理，避免迭代器失效
 */
function safeCleanup(channel: IpcChannel, hub: ChannelHub, action: () => void) {
  if (hub.dispatching) {
    queueMicrotask(() => {
      action()
      cleanupIfEmpty(channel, hub)
    })
  } else {
    action()
    cleanupIfEmpty(channel, hub)
  }
}

function cleanupIfEmpty(channel: IpcChannel, hub: ChannelHub) {
  if (hub.globalCallbacks.size === 0 && hub.keyedCallbacks.size === 0) {
    ipcRenderer.removeListener(channel, hub.listener)
    hubs.delete(channel)
  }
}

// ============================================================
// 4. 公共 API
// ============================================================

function subscribe<C extends IpcChannel>(channel: C, callback: IpcCallback<C>): () => void {
  const hub = getOrCreateHub(channel)
  const cb = callback as (payload: unknown) => void
  hub.globalCallbacks.add(cb)

  return () => {
    safeCleanup(channel, hub, () => hub.globalCallbacks.delete(cb))
  }
}

function subscribeById<C extends IpcChannel>(
  channel: C,
  id: string,
  callback: IpcCallback<C>
): () => void {
  const hub = getOrCreateHub(channel)
  const cb = callback as (payload: unknown) => void

  let set = hub.keyedCallbacks.get(id)
  if (!set) {
    set = new Set()
    hub.keyedCallbacks.set(id, set)
  }
  set.add(cb)

  return () => {
    safeCleanup(channel, hub, () => {
      const s = hub.keyedCallbacks.get(id)
      if (s) {
        s.delete(cb)
        if (s.size === 0) {
          hub.keyedCallbacks.delete(id)
        }
      }
    })
  }
}

export function once<C extends IpcChannel>(channel: C, callback: IpcCallback<C>): () => void {
  let unsubscribed = false
  const unsubscribe = subscribe(channel, ((payload: IpcPayload<C>) => {
    if (!unsubscribed) {
      unsubscribed = true
      unsubscribe()
      callback(payload)
    }
  }) as IpcCallback<C>)

  // 返回 no-op：外部调用不会产生副作用
  return () => {
    if (!unsubscribed) {
      unsubscribed = true
      unsubscribe()
    }
  }
}

// ============================================================
// 5. 全局销毁 (调试/热重载用)
// ============================================================
export function destroyAllSubscriptions() {
  for (const [channel, hub] of hubs) {
    ipcRenderer.removeListener(channel, hub.listener)
  }
  hubs.clear()
}

// ============================================================
// 6. API 组装 —— 与原来完全兼容，只是 subscribeFiltered → subscribeById
// ============================================================
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
    findById: (id) => ipcRenderer.invoke('servers:findById', id),
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
    getResourceSnapshot: (sessionId) =>
      ipcRenderer.invoke('sessions:getResourceSnapshot', sessionId),
    write: (sessionId, data) => ipcRenderer.invoke('sessions:write', sessionId, data),
    resize: (sessionId, columns, rows) =>
      ipcRenderer.invoke('sessions:resize', sessionId, columns, rows),
    onData: (sessionId, callback) => subscribeById('sessions:data', sessionId, callback),
    onExit: (callback) => subscribe('sessions:exit', callback),
    onStateChange: (callback) => subscribe('sessions:state', callback),
    onError: (callback) => subscribe('sessions:error', callback)
  },
  localTerminals: {
    create: () => ipcRenderer.invoke('localTerminals:create'),
    close: (terminalId) => ipcRenderer.invoke('localTerminals:close', terminalId),
    write: (terminalId, data) => ipcRenderer.send('localTerminals:write', terminalId, data),
    resize: (terminalId, columns, rows) =>
      ipcRenderer.invoke('localTerminals:resize', terminalId, columns, rows),
    onData: (terminalId, callback) => subscribeById('localTerminals:data', terminalId, callback),
    onExit: (callback) => subscribe('localTerminals:exit', callback),
    onStateChange: (callback) => subscribe('localTerminals:state', callback)
  },
  sftp: {
    list: (sessionId, remotePath) => ipcRenderer.invoke('sftp:list', sessionId, remotePath),
    createFile: (sessionId, remotePath, name) =>
      ipcRenderer.invoke('sftp:createFile', sessionId, remotePath, name),
    readFile: (sessionId, remotePath) => ipcRenderer.invoke('sftp:readFile', sessionId, remotePath),
    cancelReadFile: (sessionId, remotePath) =>
      ipcRenderer.send('sftp:cancelReadFile', sessionId, remotePath),
    writeFile: (sessionId, remotePath, contents) =>
      ipcRenderer.invoke('sftp:writeFile', sessionId, remotePath, contents),
    mkdir: (sessionId, remotePath, name) =>
      ipcRenderer.invoke('sftp:mkdir', sessionId, remotePath, name),
    rename: (sessionId, remotePath, newName) =>
      ipcRenderer.invoke('sftp:rename', sessionId, remotePath, newName),
    move: (sessionId, sourcePath, destinationDirPath) =>
      ipcRenderer.invoke('sftp:move', sessionId, sourcePath, destinationDirPath),
    remove: (sessionId, remotePath) => ipcRenderer.invoke('sftp:remove', sessionId, remotePath),
    uploadFiles: (sessionId, targetPath) =>
      ipcRenderer.invoke('sftp:uploadFiles', sessionId, targetPath),
    uploadPaths: (sessionId, targetPath, localPaths) =>
      ipcRenderer.invoke('sftp:uploadPaths', sessionId, targetPath, localPaths),
    downloadFile: (sessionId, remotePath) =>
      ipcRenderer.invoke('sftp:downloadFile', sessionId, remotePath),
    cancelTransfer: (batchId) => ipcRenderer.invoke('sftp:cancelTransfer', batchId),
    cancelAllTransfers: () => ipcRenderer.invoke('sftp:cancelAllTransfers'),
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
  logs: {
    clear: () => ipcRenderer.invoke('logs:clear'),
    getState: () => ipcRenderer.invoke('logs:getState'),
    list: () => ipcRenderer.invoke('logs:list'),
    updatePath: (logFilePath) => ipcRenderer.invoke('logs:updatePath', logFilePath),
    write: (event) => ipcRenderer.invoke('logs:write', event)
  },
  updates: {
    getState: () => ipcRenderer.invoke('updates:getState'),
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    quitAndInstall: () => ipcRenderer.invoke('updates:quitAndInstall'),
    onStateChange: (callback) => subscribe('updates:state', callback)
  },
  themes: {
    list: () => ipcRenderer.invoke('themes:list'),
    importArchive: () => ipcRenderer.invoke('themes:importArchive'),
    deletePlugin: (pluginId) => ipcRenderer.invoke('themes:deletePlugin', pluginId)
  },
  backup: {
    getState: () => ipcRenderer.invoke('backup:getState'),
    list: () => ipcRenderer.invoke('backup:list'),
    backupNow: () => ipcRenderer.invoke('backup:backupNow'),
    delete: (fileName) => ipcRenderer.invoke('backup:delete', fileName),
    restore: (fileName) => ipcRenderer.invoke('backup:restore', fileName),
    testConnection: () => ipcRenderer.invoke('backup:testConnection')
  },
  system: {
    getAppInfo: () => ipcRenderer.invoke('system:getAppInfo'),
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
    getKnownHosts: () => ipcRenderer.invoke('system:getKnownHosts'),
    removeKnownHost: (host, port) => ipcRenderer.invoke('system:removeKnownHost', host, port),
    getCapabilities: () => ipcRenderer.invoke('system:getCapabilities'),
    relaunch: () => ipcRenderer.invoke('system:relaunch'),
    menu: {
      onAction: (callback) => subscribe('system:menuAction', callback)
    },
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
