
/**
 * 检测是否在Electron环境中运行
 */
export function isElectronEnvironment(): boolean {
  // 检查是否有Electron API
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    return true;
  }

  // 检查环境变量
  if (process.env.NEXT_PUBLIC_ELECTRON === 'true') {
    return true;
  }

  // 检查User Agent
  if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')) {
    return true;
  }

  return false;
}

/**
 * 获取Electron版本信息
 */
export function getElectronVersions() {
  if (typeof window !== 'undefined' && window.electronAPI?.versions) {
    return window.electronAPI.versions;
  }
  return null;
}

/**
 * 获取平台信息
 */
export function getPlatform(): string {
  if (typeof window !== 'undefined' && window.electronAPI?.platform) {
    return window.electronAPI.platform;
  }
  return typeof navigator !== 'undefined' ? navigator.platform : 'unknown';
}


declare global {
  interface Window {
    // 直接声明全局变量，避免修饰符冲突
    electronAPI: {
      platform: string;
      isElectron: boolean;
      versions: {
        node: string;
        chrome: string;
        electron: string;
        endPoint: string | undefined;
        token: string | undefined;
      };
      getAppInfo: () => Promise<{
        version: string;
        name: string;
        electronVersion: string;
        nodeVersion: string;
        platform: string;
      }>;
      getServerStatus: () => Promise<{ started: boolean }>;
      restartServer: () => Promise<{ success: boolean; error?: string }>;
      requestLogs: () => Promise<any>;
      clearLogs: () => Promise<any>;
      onNewLog: (callback: (log: any) => void) => void;
      reload: () => void;
      showWindow: () => Promise<any>;
      hideWindow: () => Promise<any>;
      getWindowVisible: () => Promise<boolean>;
      quitApp: () => Promise<any>;
      onServerStatusChange: (callback: (status: any) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  } 
}
