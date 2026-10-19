import { readFileSync } from 'node:fs'
import { expect } from './helpers/orca-app'
import {
  configureOrb,
  revealOrbLiveControls,
  showOrbConversation
} from './helpers/agent-hub-orb-fixture'
import { observeVoiceDevice, test } from './helpers/agent-hub-orb-native-voice-fixture'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { waitForActivePanePtyId } from './helpers/terminal'

test('Orb follows only selected agents, keeps a visible target and controls live audio by shortcut', async ({
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
  await mirror.getByRole('button', { name: 'Orb follow and target', exact: true }).click()
  await orcaPage.getByRole('menuitem', { name: /Follow with Orb/ }).click()
  await mirror.getByRole('button', { name: 'Orb follow and target', exact: true }).click()
  await orcaPage.getByRole('menuitem', { name: /Pin Orb target/ }).click()
  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  await showOrbConversation(orcaPage)
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  await expect(panel.getByText('Watched agent', { exact: true })).toBeVisible()
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
    .poll(() => readFileSync(orbCli.ledger, 'utf8'))
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
  await expect(panel.getByText(/4% remaining/)).toBeVisible()
  await expect.poll(() => readFileSync(orbCli.ledger, 'utf8')).toContain('4% remaining')
  const requests = readFileSync(orbCli.ledger, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  expect(
    requests
      .filter((request) => request.method === 'thread/realtime/appendText')
      .some((request) => request.params?.text?.includes('User-pinned drafting target'))
  ).toBe(true)
  await testInfo.attach('orb-follow-live-context', {
    body: await panel.screenshot(),
    contentType: 'image/png'
  })
  await panel.getByRole('button', { name: 'Unpin Orb target', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Unpin Orb target', exact: true })).toHaveCount(0)
  await orcaPage.keyboard.press(`${modifier}+Shift+L`)
  await expect.poll(async () => (await observeVoiceDevice(orcaPage)).liveTracks).toBe(0)
  expect(
    await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().every((window) => !window.isVisible() && !window.isFocused())
    )
  ).toBe(true)
})
