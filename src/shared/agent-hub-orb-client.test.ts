import { expect, it } from 'vitest'
import { createDisabledAgentHubOrbApi } from './agent-hub-orb-client'

it('refuses every paired web entry point without transport effects', async () => {
  const api = createDisabledAgentHubOrbApi()
  for (const request of [
    () => api.open(),
    () => api.current(),
    () => api.close(),
    () => api.list()
  ]) {
    await expect(request()).rejects.toMatchObject({ code: 'disabled' })
  }
})
