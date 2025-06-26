import { contextBridge, ipcRenderer } from "electron";

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld("electronAPI", {
  // 平台信息
  platform: process.platform,
  isElectron: true,

  // 版本信息
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    endPoint: process.env.GRAPHQL_ENDPOINT,
    token: process.env.AUTH_TOKEN,
  },

  // 应用信息
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),

  // 服务器控制
  getServerStatus: () => ipcRenderer.invoke("get-server-status"),
  restartServer: () => ipcRenderer.invoke("restart-server"),

  // 日志相关API
  requestLogs: () => ipcRenderer.invoke("request-logs"),
  clearLogs: () => ipcRenderer.invoke("clear-logs"),
  
  // 监听新日志
  onNewLog: (callback: (log: any) => void) => {
    ipcRenderer.on("new-log", (_event, log) => callback(log));
  },

  // 窗口控制
  reload: () => {
    if (window.location) {
      window.location.reload();
    }
  },

  // 托盘和窗口控制
  showWindow: () => ipcRenderer.invoke("show-window"),
  hideWindow: () => ipcRenderer.invoke("hide-window"),
  getWindowVisible: () => ipcRenderer.invoke("get-window-visible"),
  quitApp: () => ipcRenderer.invoke("quit-app"),

  // 事件监听
  onServerStatusChange: (callback: (status: any) => void) => {
    ipcRenderer.on("server-status-changed", (_event, status) =>
      callback(status)
    );
  },

  // 移除监听器
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
