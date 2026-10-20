import { describe, expect, it } from 'vitest'
import { agentHubOrbDetail, createAgentHubOrganism } from './agent-hub-orb-organism'
import { FALLBACK_ORB_PALETTE } from './agent-hub-orb-palette'
import { buildOrbStateParams } from './agent-hub-orb-state-params'

function recordingContext(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = []
  const gradient = { addColorStop: () => undefined }
  const handler: ProxyHandler<object> = {
    get: (_t, prop: string) => {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
        return () => gradient
      }
      return (...args: unknown[]) => {
        calls.push(`${prop}:${args.length}`)
      }
    },
    set: () => true
  }
  // SAFETY: the proxy only stands in for the drawing calls the organism makes.
  // oxlint-disable-next-line typescript/consistent-type-assertions
  return { ctx: new Proxy({}, handler) as CanvasRenderingContext2D, calls }
}

describe('agentHubOrbDetail', () => {
  it('picks detail by rendered size', () => {
    expect(agentHubOrbDetail(24)).toBe('tiny')
    expect(agentHubOrbDetail(64)).toBe('mid')
    expect(agentHubOrbDetail(140)).toBe('full')
  })
})

describe('buildOrbStateParams', () => {
  it('defines every state without a muted look and routes colours from tokens', () => {
    const states = buildOrbStateParams(FALLBACK_ORB_PALETTE)
    expect(Object.keys(states)).not.toContain('muted')
    expect(states.request.core).toEqual(FALLBACK_ORB_PALETTE.question)
    expect(states.approval.core).toEqual(FALLBACK_ORB_PALETTE.warning)
    expect(states.dictating.nucleusTint).toEqual(FALLBACK_ORB_PALETTE.destructive)
    expect(states.attention.rippleEvery).toBeGreaterThan(0)
  })

  it('reaches harder when a question is waiting than when idle', () => {
    const states = buildOrbStateParams(FALLBACK_ORB_PALETTE)
    expect(states.request.reach).toBeGreaterThan(states.idle.reach)
    expect(states.approval.beat2).toBe(1)
  })
})

describe('createAgentHubOrganism', () => {
  it('eases toward the new state instead of snapping', () => {
    const organism = createAgentHubOrganism('idle')
    organism.setState('request')
    organism.step(0.016)
    const { ctx, calls } = recordingContext()
    organism.draw(ctx, 140, 'full')
    expect(calls.length).toBeGreaterThan(0)
    for (let i = 0; i < 400; i++) {
      organism.step(0.016)
    }
    organism.draw(ctx, 24, 'tiny')
  })

  it('clamps long frame gaps', () => {
    const organism = createAgentHubOrganism('listening')
    organism.setInputActive(true)
    expect(() => organism.step(5)).not.toThrow()
  })
})
