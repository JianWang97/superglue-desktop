// Electron 环境检测工具

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
      // 窗口控制
      showWindow: () => Promise<void>;
      hideWindow: () => Promise<void>;
      getWindowVisible: () => Promise<boolean>;
      quitApp: () => Promise<void>;
      // 其他Electron API...
    };
  }
}

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

/**
 * 根据环境获取正确的API端点
 */
export function getApiEndpoint(): string {
  const defaultEndpoint = process.env.NEXT_PUBLIC_SUPERGLUE_ENDPOINT || 'http://localhost:3000';
  
  if (isElectronEnvironment()) {
    // Electron环境中，GraphQL服务器在同一进程中运行
    return defaultEndpoint;
  }
  
  return defaultEndpoint;
}

/**
 * 窗口控制功能
 */
export const windowControls = {
  /**
   * 显示窗口
   */
  show: async (): Promise<void> => {
    if (isElectronEnvironment() && window.electronAPI?.showWindow) {
      await window.electronAPI.showWindow();
    }
  },

  /**
   * 隐藏窗口到托盘
   */
  hide: async (): Promise<void> => {
    if (isElectronEnvironment() && window.electronAPI?.hideWindow) {
      await window.electronAPI.hideWindow();
    }
  },

  /**
   * 获取窗口是否可见
   */
  isVisible: async (): Promise<boolean> => {
    if (isElectronEnvironment() && window.electronAPI?.getWindowVisible) {
      return await window.electronAPI.getWindowVisible();
    }
    return true; // 在浏览器环境中总是可见
  },

  /**
   * 退出应用
   */
  quit: async (): Promise<void> => {
    if (isElectronEnvironment() && window.electronAPI?.quitApp) {
      await window.electronAPI.quitApp();
    }
  }
};

/**
 * Hook for using window controls in React components
 */
export function useWindowControls() {
  return {
    isElectron: isElectronEnvironment(),
    ...windowControls
  };
}
