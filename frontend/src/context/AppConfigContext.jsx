import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AppConfigContext = createContext({
  appName: 'iChat',
  appTagline: 'Secure Real-time Chat App',
  loading: true,
});

export const AppConfigProvider = ({ children }) => {
  const [config, setConfig] = useState({
    appName: 'iChat',
    appTagline: 'Secure Real-time Chat App',
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    const loadConfig = async () => {
      try {
        const { data } = await api.get('/api/app-config');
        if (!mounted) return;

        setConfig({
          appName: data?.appName || 'iChat',
          appTagline: data?.appTagline || 'Secure Real-time Chat App',
          loading: false,
        });
      } catch (error) {
        if (!mounted) return;
        setConfig((prev) => ({ ...prev, loading: false }));
      }
    };

    loadConfig();

    return () => {
      mounted = false;
    };
  }, []);

  return <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>;
};

export const useAppConfig = () => useContext(AppConfigContext);