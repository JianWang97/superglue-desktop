"use client";
import { createContext, useContext, useState, useEffect } from 'react';

interface Config {
  superglueEndpoint: string;
  superglueApiKey: string;
  postHogKey: string;
  postHogHost: string;
}

interface ConfigContextType {
  config: Config;
  updateConfig: (newConfig: Partial<Config>) => void;
  isElectron: boolean;
  isInitialized: boolean;
}

const ConfigContext = createContext<ConfigContextType | null>(null);

export function ConfigProvider({ children ,config:initConfig}: { children: React.ReactNode, config?: Config }) {
  const [config, setConfig] = useState<Config>(
    {
      superglueEndpoint: initConfig?.superglueEndpoint ?? '',
      superglueApiKey: initConfig?.superglueApiKey ?? '',
      postHogKey: initConfig?.postHogKey || '',
      postHogHost: initConfig?.postHogHost || '',
    });
  const [isElectron, setIsElectron] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 在客户端加载时检测Electron环境和从localStorage读取保存的配置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const electronIsElectron = window?.electronAPI?.isElectron;
      setIsElectron(electronIsElectron);
      
      if (electronIsElectron) {
        // 在 Electron 环境中，从 electronAPI 读取配置
        setConfig(prev => ({
          ...prev,
          superglueEndpoint: window?.electronAPI?.versions?.endPoint || prev.superglueEndpoint,
          superglueApiKey: window?.electronAPI?.versions?.token || prev.superglueApiKey,
        }));
      } else {
        // 在浏览器环境中，从 localStorage 读取配置
        const savedConfig = localStorage.getItem('superglue_config');
        if (savedConfig) {
          try {
            const parsedConfig = JSON.parse(savedConfig);
            setConfig(prev => ({
              ...prev,
              superglueEndpoint: parsedConfig.superglueEndpoint || prev.superglueEndpoint,
              superglueApiKey: parsedConfig.superglueApiKey || prev.superglueApiKey,
            }));
          } catch (error) {
            console.error('Failed to parse saved config:', error);
          }
        }
      }
    }
    setIsInitialized(true);
  }, []);

  const updateConfig = (newConfig: Partial<Config>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };
  
  return (
    <ConfigContext.Provider value={{ config, updateConfig, isElectron, isInitialized }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context.config;
}

export function useIsInitialized() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useIsInitialized must be used within a ConfigProvider');
  }
  return context.isInitialized;
}

export function useConfigUpdate() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfigUpdate must be used within a ConfigProvider');
  }
  return context.updateConfig;
}

export function useElectron() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useElectron must be used within a ConfigProvider');
  }
  return context.isElectron;
}