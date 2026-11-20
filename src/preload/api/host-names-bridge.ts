import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const hostNamesApi = {
  lookup: (args: { hostname: string }): Promise<string[]> =>
    ipcRenderer.invoke('hostNames:lookup', args)
} satisfies PreloadApi['hostNames']
