import { afterEach, expect, it } from 'vitest'
import { orbAsk } from './agent-hub-orb-test-fixtures'
import { agentHubAskRequest, agentHubNotifyRequest } from './agent-hub-request-test-fixtures'
import { agentHubCurrentOrbRequest } from './agent-hub-orb-request-owner'
import {
  agentHubInboxRequests,
  applyAgentHubDelivery,
  clearAgentHubRequestHost,
  readAgentHubRequests
} from './agent-hub-requests-store'

afterEach(() => {
  clearAgentHubRequestHost('local')
  clearAgentHubRequestHost('remote')
})

it('reserves only the current execution host and Orb session, keeping other callers in Hub', () => {
  const current = orbAsk('current')
  const previous = { ...orbAsk('previous'), requestId: 'previous-question' }
  const terminal = agentHubAskRequest({ requestId: 'terminal-question' })
  const notification = agentHubNotifyRequest({
    requestId: 'terminal-notification',
    level: 'needs-you'
  })
  applyAgentHubDelivery('local', current)
  applyAgentHubDelivery('remote', current)
  applyAgentHubDelivery('local', previous)
  applyAgentHubDelivery('local', terminal)
  applyAgentHubDelivery('local', notification)
  const items = agentHubInboxRequests(readAgentHubRequests())
  const owner = { host: 'local', sessionId: 'current' }
  expect(items.filter((item) => agentHubCurrentOrbRequest(item, owner))).toEqual([
    { host: 'local', request: current }
  ])
  expect(items.filter((item) => !agentHubCurrentOrbRequest(item, owner))).toHaveLength(4)
  expect(items.some((item) => agentHubCurrentOrbRequest(item, null))).toBe(false)
})
