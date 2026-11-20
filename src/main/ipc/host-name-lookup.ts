import { ipcMain } from 'electron'
import { lookup } from 'node:dns/promises'

const LOOKUP_TIMEOUT_MS = 3_000
const HOST_NAME_PATTERN = /^(?=.{1,253}$)[a-z0-9-]+(\.[a-z0-9-]+)*\.?$/i

/** The addresses a name resolves to on this machine; empty when it does not resolve. */
export async function lookupHostNameAddresses(hostname: string): Promise<string[]> {
  if (!HOST_NAME_PATTERN.test(hostname)) {
    return []
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const entries = await Promise.race([
      lookup(hostname, { all: true }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('lookup timed out')), LOOKUP_TIMEOUT_MS)
      })
    ])
    return entries.map((entry) => entry.address)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

export function registerHostNameLookupHandlers(): void {
  ipcMain.removeHandler('hostNames:lookup')
  ipcMain.handle('hostNames:lookup', (_event, args: unknown): Promise<string[]> => {
    const hostname =
      args && typeof args === 'object' && 'hostname' in args && typeof args.hostname === 'string'
        ? args.hostname
        : ''
    return lookupHostNameAddresses(hostname)
  })
}
