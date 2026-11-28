import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { PluginClientHost, type PluginClientTransport } from './plugin-client-host'

const PluginClientContext = createContext<PluginClientHost | null>(null)

/** Provides the chat's surface-module runtime to the `Client` regions below; absent a transport, they draw nothing. */
export function PluginClientProvider({
  transport,
  children
}: {
  transport: PluginClientTransport | undefined
  children: ReactNode
}): React.JSX.Element {
  const [host, setHost] = useState<PluginClientHost | null>(null)
  useEffect(() => {
    if (!transport) {
      return undefined
    }
    const created = new PluginClientHost(transport)
    setHost(created)
    return () => {
      created.dispose()
      setHost(null)
    }
  }, [transport])
  return <PluginClientContext.Provider value={host}>{children}</PluginClientContext.Provider>
}

export function usePluginClientHost(): PluginClientHost | null {
  return useContext(PluginClientContext)
}
