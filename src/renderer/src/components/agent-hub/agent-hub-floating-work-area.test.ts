/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest'
const control = vi.hoisted(() => ({ canvas: false }))
vi.mock('./agent-hub-canvas-store', () => ({ isAgentHubCanvasOpen: () => control.canvas }))
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({
      sidebarOpen: true,
      sidebarWidth: 200,
      rightSidebarOpen: true,
      rightSidebarWidth: 250,
      statusBarVisible: true,
      settings: { agentHubCanvas: true }
    })
  }
}))
import { agentHubWorkArea } from './agent-hub-floating-arrangement'

describe('floating mirrors with the canvas enabled', () => {
  it('reserves the right sidebar while floating over the current view', () => {
    control.canvas = false
    expect(agentHubWorkArea().width).toBe(window.innerWidth - 450)
    control.canvas = true
    expect(agentHubWorkArea().width).toBe(window.innerWidth - 200)
  })
})
