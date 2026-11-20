import { readFileSync } from 'node:fs'
import { expect } from '../desktop/electron-fixtures/orca-app'
import {
  configureOrb,
  revealOrbLiveControls,
  showOrbConversation
} from '../desktop/electron-fixtures/agent-hub-orb-fixture'
import {
  observeVoiceDevice,
  test
} from '../desktop/electron-fixtures/agent-hub-orb-native-voice-fixture'
import {
  ensureTerminalVisible,
  waitForActiveWorktree,
  waitForSessionReady
} from '../desktop/renderer-probes/store'
import { waitForActivePanePtyId } from '../terminal/input/terminal'
import { runCompiledOrcaCli } from '../desktop/cli-invocation/compiled-orca-cli'

test('Orb knows agents without selection, shares global CLI context and controls live audio by shortcut', async ({
  orcaPage,
  electronApp,
  seededRepoPath,
  orbCli
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await orcaPage.setViewportSize({ width: 1280, height: 900 })
  await configureOrb(orcaPage, seededRepoPath, 'statusBar')
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  const tabId = await orcaPage.evaluate(async (worktreeId) => {
    const state = window.__store!.getState()
    await state.updateSettings({ agentHubTabAutoPopout: true })
    const tab = state.createTab(worktreeId)
    state.setTabCustomTitle(tab.id, 'Watched agent')
    return tab.id
  }, worktreeId)
  await waitForActivePanePtyId(orcaPage)
  await orcaPage.evaluate(
    ({ worktreeId, tabId }) => {
      const state = window.__store!.getState()
      const leafId = state.terminalLayoutsByTabId[tabId]!.activeLeafId!
      state.setAgentStatus(
        `${tabId}:${leafId}`,
        { state: 'working', agentType: 'codex', prompt: 'Fixture task' },
        'Codex',
        { updatedAt: Date.now(), stateStartedAt: Date.now() },
        { worktreeId, tabId }
      )
    },
    { worktreeId, tabId }
  )
  await orcaPage
    .locator(`[data-tab-id="${tabId}"]`)
    .getByRole('button', { name: 'Pop out', exact: true })
    .click()
  const mirror = orcaPage
    .locator('[data-agent-hub-mirror]')
    .filter({ has: orcaPage.getByRole('tab', { name: /Watched agent/ }) })
  await expect(
    mirror.getByRole('button', { name: 'Orb follow and target', exact: true })
  ).toHaveCount(0)
  const background = await orcaPage.evaluate(async (worktreeId) => {
    const state = window.__store!.getState()
    const tab = state.createTab(worktreeId)
    state.setTabCustomTitle(tab.id, 'Background agent')
    return tab.id
  }, worktreeId)
  await waitForActivePanePtyId(orcaPage)
  await orcaPage.evaluate(
    ({ worktreeId, tabId }) => {
      const state = window.__store!.getState()
      const leafId = state.terminalLayoutsByTabId[tabId]!.activeLeafId!
      state.setAgentStatus(
        `${tabId}:${leafId}`,
        {
          state: 'waiting',
          agentType: 'codex',
          prompt: 'Background fixture',
          interactivePrompt: JSON.stringify({
            questions: [
              {
                question: 'Background agent asks which layout',
                options: [{ label: 'Compact' }, { label: 'Wide' }]
              }
            ]
          })
        },
        'Codex',
        { updatedAt: Date.now(), stateStartedAt: Date.now() },
        { worktreeId, tabId }
      )
    },
    { worktreeId, tabId: background }
  )
  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  await showOrbConversation(orcaPage)
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  await expect(panel.getByText(/Background agent asks which layout/)).toBeVisible()
  await expect(panel.getByText(/1. Compact/)).toBeVisible()
  expect(readFileSync(orbCli.ledger, 'utf8')).not.toContain('thread/realtime/appendText')
  const current = await orcaPage.evaluate(() => window.api.agentHub.orb.current())
  if (!current) {
    throw new Error('Orb session missing')
  }
  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  const status = await runCompiledOrcaCli(userData, ['hub', 'status', '--json'], 15_000, {
    ORCA_AGENT_SESSION_ID: current.sessionId,
    ORCA_TERMINAL_HANDLE: '',
    ORCA_PANE_KEY: ''
  })
  expect(status.code, status.stdout + status.stderr).toBe(0)
  expect(status.stdout).toContain('orbAwareness')
  expect(status.stdout).toContain('Background agent asks which layout')
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await orcaPage.keyboard.press(`${modifier}+Shift+L`)
  await expect.poll(async () => (await observeVoiceDevice(orcaPage)).connectedPeers).toBe(1)
  await orcaPage.keyboard.press(`${modifier}+Shift+U`)
  await expect.poll(async () => (await observeVoiceDevice(orcaPage)).enabledTracks).toBe(0)
  await orcaPage.keyboard.press(`${modifier}+Shift+U`)
  await expect.poll(async () => (await observeVoiceDevice(orcaPage)).enabledTracks).toBe(1)
  await revealOrbLiveControls(orcaPage)
  await orcaPage.keyboard.press(`${modifier}+Shift+S`)
  await expect(orcaPage.getByRole('button', { name: 'Unmute Orb', exact: true })).toBeVisible()
  await orcaPage.keyboard.press(`${modifier}+Shift+S`)
  await expect(orcaPage.getByRole('button', { name: 'Mute Orb', exact: true })).toBeVisible()
  const ask = await orcaPage.evaluate(async (tabId) => {
    const leaf = window.__store!.getState().terminalLayoutsByTabId[tabId]!.activeLeafId!
    return window.api.runtime.call({
      method: 'agentHub.ask',
      params: {
        callerPaneKey: `${tabId}:${leaf}`,
        question: 'Followed fixture needs a release decision',
        options: ['Wait', 'Review'],
        waitMs: 1,
        timeoutMs: 60_000
      }
    })
  }, tabId)
  expect(ask.ok).toBe(true)
  await expect(
    panel.getByText('Followed fixture needs a release decision', { exact: false })
  ).toBeVisible()
  await expect
    .poll(() => readFileSync(orbCli.ledger, 'utf8'), { timeout: 15_000 })
    .toContain('Followed fixture needs a release decision')
  await orcaPage.evaluate(() => {
    const state = window.__store!.getState()
    state.setRateLimitsFromPush({
      ...state.rateLimits,
      codexTarget: { runtime: 'host', wslDistro: null },
      codex: {
        provider: 'codex',
        status: 'ok',
        error: null,
        updatedAt: Date.now(),
        weekly: null,
        session: {
          usedPercent: 96,
          windowMinutes: 300,
          resetsAt: Date.now() + 600_000,
          resetDescription: null
        }
      }
    })
  })
  await expect(panel.getByText(/4% remaining/)).toHaveCount(1)
  await expect
    .poll(() => readFileSync(orbCli.ledger, 'utf8'), { timeout: 15_000 })
    .toContain('4% remaining')
  const requests = readFileSync(orbCli.ledger, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  expect(
    requests
      .filter((request) => request.method === 'thread/realtime/appendText')
      .some((request) => request.params?.text?.includes('all Orca agents'))
  ).toBe(true)
  await testInfo.attach('orb-global-live-context', {
    body: await panel.screenshot(),
    contentType: 'image/png'
  })
  if (
    !ask.ok ||
    typeof ask.result !== 'object' ||
    ask.result === null ||
    !('requestId' in ask.result) ||
    typeof ask.result.requestId !== 'string'
  ) {
    throw new Error('Question ID missing')
  }
  const questionId = ask.result.requestId
  await orcaPage.evaluate(
    (requestId) =>
      window.api.runtime.call({
        method: 'agentHub.respond',
        params: { requestId, result: { kind: 'ask', answer: 'Review', index: 2 } }
      }),
    questionId
  )
  await expect(
    panel.getByText('Followed fixture needs a release decision', { exact: false })
  ).toHaveCount(0)
  await expect
    .poll(
      () =>
        readFileSync(orbCli.ledger, 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
          .filter((request) => request.method === 'thread/realtime/appendText')
          .some((request) => {
            const text = request.params?.text ?? ''
            const packet = JSON.parse(text.slice(text.indexOf('\n') + 1))
            return packet.removedNoticeIds?.some((id: string) => id.includes(questionId))
          }),
      { timeout: 15_000 }
    )
    .toBe(true)
  await orcaPage.keyboard.press(`${modifier}+Shift+L`)
  await expect.poll(async () => (await observeVoiceDevice(orcaPage)).liveTracks).toBe(0)
  expect(
    await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().every((window) => !window.isVisible() && !window.isFocused())
    )
  ).toBe(true)
})
