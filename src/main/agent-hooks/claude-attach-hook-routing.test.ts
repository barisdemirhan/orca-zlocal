import { describe, expect, it, vi } from 'vitest'
import type { ProcessTableRow } from '../../shared/process-observation/tables/process-table-snapshot'
import { ClaudeAttachHookRouter } from './claude-attach-hook-routing'

const WORKTREE = 'repo::/work/yulaf'
const LEAF = '1af9a7f0-f527-4e81-888c-1e03b727718d'
const CLOSED_PANE = `closed-tab:${LEAF}`
const ATTACH_PANE = `attach-tab:${LEAF}`

function row(pid: number, ppid: number, command: string): ProcessTableRow {
  return { pid, ppid, stat: 'S+', command }
}

// Daemon session reparented to launchd after the tab that ran `claude --bg` closed.
const ROWS = [
  row(500, 1, 'claude daemon run'),
  row(501, 500, 'claude bg-spare'),
  row(100, 1, '-zsh'),
  row(101, 100, 'claude attach 45f2b665'),
  row(200, 1, '-zsh'),
  row(201, 200, 'claude')
]

function hook(paneKey: string, pid: number): Record<string, unknown> {
  return {
    paneKey,
    tabId: paneKey.split(':')[0],
    worktreeId: WORKTREE,
    agentProcess: { pid, platform: 'darwin', startTime: 'Mon Oct 26 09:00:00 2026' },
    payload: { hook_event_name: 'Notification' }
  }
}

function router(
  panes: { paneKey: string | null; worktreeId: string; pid: number }[] = [
    { paneKey: ATTACH_PANE, worktreeId: WORKTREE, pid: 100 },
    // Hydrated at boot and not yet adopted by the renderer, so its key is unknown.
    { paneKey: null, worktreeId: WORKTREE, pid: 200 }
  ],
  rows = ROWS
) {
  const readProcessTable = vi.fn(async () => rows)
  return {
    readProcessTable,
    router: new ClaudeAttachHookRouter({ listPanes: () => panes, readProcessTable, now: () => 0 })
  }
}

describe.skipIf(process.platform === 'win32')('ClaudeAttachHookRouter', () => {
  it('routes a background session hook from a closed tab to the attach pane', async () => {
    const { router: subject, readProcessTable } = router()

    const routed = await subject.route('claude', hook(CLOSED_PANE, 501))
    await subject.route('claude', hook(CLOSED_PANE, 501))

    expect(routed).toMatchObject({ paneKey: ATTACH_PANE, tabId: 'attach-tab' })
    expect(readProcessTable).toHaveBeenCalledTimes(1)
  })

  it('leaves hooks alone when the sender runs inside a pane', async () => {
    const { router: subject } = router()

    const routed = await subject.route('claude', hook(`unadopted-tab:${LEAF}`, 201))

    expect(routed).toMatchObject({ paneKey: `unadopted-tab:${LEAF}` })
  })

  it('does not guess between two attach panes in the worktree', async () => {
    const { router: subject } = router(
      [
        { paneKey: ATTACH_PANE, worktreeId: WORKTREE, pid: 100 },
        { paneKey: `second-attach:${LEAF}`, worktreeId: WORKTREE, pid: 300 }
      ],
      [...ROWS, row(300, 1, '-zsh'), row(301, 300, 'claude attach 9c1d2e3f')]
    )

    const routed = await subject.route('claude', hook(CLOSED_PANE, 501))

    expect(routed).toMatchObject({ paneKey: CLOSED_PANE })
  })

  it('drops the route once the attach pane closes', async () => {
    const panes: { paneKey: string | null; worktreeId: string; pid: number }[] = [
      { paneKey: ATTACH_PANE, worktreeId: WORKTREE, pid: 100 }
    ]
    const { router: subject } = router(panes)
    await subject.route('claude', hook(CLOSED_PANE, 501))

    panes.length = 0
    const routed = await subject.route('claude', hook(CLOSED_PANE, 501))

    expect(routed).toMatchObject({ paneKey: CLOSED_PANE })
  })
})
