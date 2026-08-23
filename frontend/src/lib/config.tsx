/* Context + hook exports are not components; fast refresh is disabled for this module. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getConfigSnapshot,
  loadConfig,
  resetConfig,
  saveConfig,
  subscribeConfig,
  type AppConfig,
} from './config-store'

interface ConfigContextValue {
  config: AppConfig
  setConfig: (next: Partial<AppConfig>) => void
  reset: () => void
  /** baseUrl + token combined key; changes whenever either value changes */
  configKey: string
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<AppConfig>(() => loadConfig())

  useEffect(() => subscribeConfig(() => setConfigState(getConfigSnapshot())), [])

  const setConfig = useCallback((next: Partial<AppConfig>) => {
    saveConfig(next)
  }, [])

  const reset = useCallback(() => {
    resetConfig()
  }, [])

  const value = useMemo<ConfigContextValue>(
    () => ({
      config,
      setConfig,
      reset,
      configKey: `${config.baseUrl}::${config.token}`,
    }),
    [config, setConfig, reset],
  )

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used within <ConfigProvider>')
  return ctx
}
