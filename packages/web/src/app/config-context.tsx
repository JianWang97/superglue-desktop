"use client";
import { createContext, useContext, useState, useEffect } from 'react';
import { isElectronEnvironment, getApiEndpoint } from '@/src/utils/electron';

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
}

const ConfigContext = createContext<ConfigContextType | null>(null);

export function ConfigProvider({ children, config: initialConfig }: { children: React.ReactNode, config: Config }) {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [isElectron, setIsElectron] = useState(false);

  // 在客户端加载时检测Electron环境和从localStorage读取保存的配置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 检测Electron环境
      setIsElectron(isElectronEnvironment());
      
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
  }, []);

  const updateConfig = (newConfig: Partial<Config>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };
  
  return (
    <ConfigContext.Provider value={{ config, updateConfig, isElectron }}>
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