import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface Config {
  apiBaseUrl: string;
  adobeClientId?: string;
  setApiBaseUrl: (v: string) => void;
  setAdobeClientId: (v: string) => void;
}

const ConfigCtx = createContext<Config | undefined>(undefined);

export const ConfigProvider = ({ children }: { children: React.ReactNode }) => {
  // Hardcoded defaults - Adobe API key configured for hackathon
  const [apiBaseUrl] = useState<string>("http://localhost:8787");
  const [adobeClientId] = useState<string>("f991e8c76f754ecd8f599e223b57d885");

  const value = useMemo(
    () => ({
      apiBaseUrl,
      adobeClientId,
      setApiBaseUrl: () => {}, // No-op since it's hardcoded
      setAdobeClientId: () => {}, // No-op since it's hardcoded
    }),
    [apiBaseUrl, adobeClientId]
  );

  return <ConfigCtx.Provider value={value}>{children}</ConfigCtx.Provider>;
};

export const useConfig = () => {
  const ctx = useContext(ConfigCtx);
  if (!ctx) throw new Error("useConfig must be used within ConfigProvider");
  return ctx;
};
