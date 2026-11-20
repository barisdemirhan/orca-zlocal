import type { PreloadApi } from '../../../../preload/api-types'

export function createWebHostNamesApi(): Partial<PreloadApi> {
  return {
    // Why: a web page cannot resolve names, so a host's private name is never reachable here.
    hostNames: { lookup: () => Promise.resolve([]) }
  }
}
