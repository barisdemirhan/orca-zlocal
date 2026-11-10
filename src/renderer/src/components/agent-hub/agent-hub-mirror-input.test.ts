/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { findAttachedAgentHubMirrorInput } from './agent-hub-mirror-input'
import { useAppStore } from '@/store'

vi.mock('@/store', async () => {
  const { createTestStore } = await import('@/store/testing/app-store-test-fixture')
  return { useAppStore: createTestStore() }
})

const LEAF_A = '11111111-1111-4111-8111-111111111111'
const LEAF_B = '22222222-2222-4222-8222-222222222222'

function buildTab(): HTMLElement {
  document.body.innerHTML = `
    <div data-terminal-tab-id="tab-1">
      <div class="pane" data-leaf-id="${LEAF_A}"><textarea class="xterm-helper-textarea"></textarea></div>
      <div class="pane" data-leaf-id="${LEAF_B}"><textarea class="xterm-helper-textarea"></textarea></div>
    </div>`
  return document.body
}

function setActiveLeaf(activeLeafId: string | null): void {
  useAppStore.setState({
    terminalLayoutsByTabId: {
      'tab-1': { root: null, activeLeafId, expandedLeafId: null }
    }
  })
}

describe('findAttachedAgentHubMirrorInput', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    useAppStore.setState({ terminalLayoutsByTabId: {} })
  })

  it('uses the active leaf textarea when the target has no pane key', () => {
    const root = buildTab()
    setActiveLeaf(LEAF_B)
    const input = findAttachedAgentHubMirrorInput(root, {
      tab: { id: 'tab-1' },
      paneKey: null
    })
    expect(input).toBe(root.querySelectorAll('.xterm-helper-textarea')[1])
  })

  it('falls back to the first textarea when there is no layout', () => {
    const root = buildTab()
    const input = findAttachedAgentHubMirrorInput(root, {
      tab: { id: 'tab-1' },
      paneKey: null
    })
    expect(input).toBe(root.querySelectorAll('.xterm-helper-textarea')[0])
  })

  it('lets an explicit pane key win over the active leaf', () => {
    const root = buildTab()
    setActiveLeaf(LEAF_B)
    const input = findAttachedAgentHubMirrorInput(root, {
      tab: { id: 'tab-1' },
      paneKey: makePaneKey('tab-1', LEAF_A)
    })
    expect(input).toBe(root.querySelectorAll('.xterm-helper-textarea')[0])
  })
})
