import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { test, expect } from '../desktop/electron-fixtures/orca-app'
import {
  ensureTerminalVisible,
  waitForActiveWorktree,
  waitForSessionReady
} from '../desktop/renderer-probes/store'
import { waitForActivePanePtyId } from '../terminal/input/terminal'

test('a plain terminal pauses with confirmation and wakes the same PTY', async ({
  orcaPage
}, testInfo) => {
  test.skip(process.platform === 'win32', 'Windows reports terminal suspension as unsupported')
  await waitForSessionReady(orcaPage)
  await orcaPage.setViewportSize({ width: 1280, height: 900 })
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  const tabId = await orcaPage.evaluate(async (worktreeId) => {
    const state = window.__store!.getState()
    await state.updateSettings({
      uiLanguage: 'en',
      theme: 'dark',
      experimentalAgentHub: true,
      agentHubTabAutoPopout: true,
      agentHubAlertSound: false
    })
    const tab = state.createTab(worktreeId)
    state.setTabCustomTitle(tab.id, 'Paused shell')
    return tab.id
  }, worktreeId)
  const ptyId = await waitForActivePanePtyId(orcaPage)
  await orcaPage
    .locator(`[data-tab-id="${tabId}"]`)
    .getByRole('button', { name: 'Pop out', exact: true })
    .click()
  const mirror = orcaPage
    .locator('[data-agent-hub-mirror]')
    .filter({ has: orcaPage.getByRole('tab', { name: /Paused shell/ }) })
  await expect(mirror.getByRole('button', { name: 'Sleep', exact: true })).toBeEnabled()
  await mirror.getByRole('button', { name: 'Sleep', exact: true }).click()
  const dialog = orcaPage.getByRole('dialog', { name: 'Pause this terminal?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Sleep', exact: true }).click()
  await expect(dialog).toBeHidden()
  const sleeping = mirror.locator('[data-agent-hub-pane-sleep]')
  await expect(sleeping.getByRole('button', { name: 'Wake', exact: true })).toBeVisible()
  expect(
    await orcaPage.evaluate((tabId) => window.__store!.getState().ptyIdsByTabId[tabId], tabId)
  ).toContain(ptyId)
  const dock = orcaPage.locator('[data-agent-hub-dock]')
  await dock.hover()
  await expect(dock).toHaveAttribute('data-expanded', 'true')
  await dock.getByRole('button', { name: 'All terminals', exact: true }).click()
  const list = orcaPage
    .getByRole('listbox')
    .filter({ has: orcaPage.locator('[data-agent-hub-row]') })
  await expect(list.getByRole('button', { name: /^Sleeping/ })).toBeVisible()
  await orcaPage.getByRole('button', { name: 'Filter by window', exact: true }).click()
  await orcaPage.getByRole('menuitemradio', { name: 'Sleeping', exact: true }).click()
  await expect(list.locator('[data-agent-hub-row]')).toHaveCount(1)
  await expect(
    list.locator('[data-agent-hub-row]').getByRole('button', { name: 'Wake', exact: true })
  ).toBeVisible()
  await testInfo.attach('paused-shell-same-process', {
    body: await list.screenshot(),
    contentType: 'image/png'
  })
  await orcaPage.getByRole('button', { name: 'Close (esc)', exact: true }).click()
  await sleeping.getByRole('button', { name: 'Wake', exact: true }).click()
  await expect(sleeping).toHaveCount(0)
  expect(
    await orcaPage.evaluate((tabId) => window.__store!.getState().ptyIdsByTabId[tabId], tabId)
  ).toContain(ptyId)
})

test('explicit agent sleep confirms, stays asleep while visible, and wakes only its saved pane', async ({
  orcaPage,
  electronApp
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await orcaPage.setViewportSize({ width: 1280, height: 900 })
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  const resumeScript = testInfo.outputPath('resume-fixture.sh')
  const ledger = testInfo.outputPath('resume-ledger.txt')
  writeFileSync(
    resumeScript,
    `#!/bin/sh\nprintf 'resume\\n' >> "$(dirname "$0")/resume-ledger.txt"\nprintf 'Saved session resumed\\n'\nwhile IFS= read -r line; do printf '%s\\n' "$line"; done\n`
  )
  chmodSync(resumeScript, 0o700)
  const tabId = await orcaPage.evaluate(async (worktreeId) => {
    const state = window.__store!.getState()
    await state.updateSettings({
      uiLanguage: 'en',
      theme: 'dark',
      experimentalAgentHub: true,
      agentHubTabAutoPopout: true,
      agentHubAlertSound: false
    })
    const tab = state.createTab(worktreeId)
    state.setTabCustomTitle(tab.id, 'Saved agent target')
    return tab.id
  }, worktreeId)
  const oldPtyId = await waitForActivePanePtyId(orcaPage)
  const paneKey = await orcaPage.evaluate(
    ({ worktreeId, tabId, resumeScript }) => {
      const state = window.__store!.getState()
      const leafId = state.terminalLayoutsByTabId[tabId]!.activeLeafId!
      const paneKey = `${tabId}:${leafId}`
      state.setAgentStatus(
        paneKey,
        { state: 'working', agentType: 'codex', prompt: 'Resume only this fixture' },
        'Codex',
        { updatedAt: Date.now(), stateStartedAt: Date.now() },
        { tabId, worktreeId },
        { providerSession: { key: 'session_id', id: '11111111-1111-4111-8111-111111111111' } }
      )
      state.registerAgentLaunchConfig(
        paneKey,
        { agentCommand: resumeScript, agentArgs: '', agentEnv: {} },
        { agentType: 'codex', tabId, leafId }
      )
      return paneKey
    },
    { worktreeId, tabId, resumeScript }
  )
  await orcaPage
    .locator(`[data-tab-id="${tabId}"]`)
    .getByRole('button', { name: 'Pop out', exact: true })
    .click()
  const mirror = orcaPage
    .locator('[data-agent-hub-mirror]')
    .filter({ has: orcaPage.getByRole('tab', { name: /Saved agent target/ }) })
  const sleep = mirror.getByRole('button', { name: 'Sleep', exact: true })
  await expect(sleep).toBeEnabled()
  await sleep.click()
  const dialog = orcaPage.getByRole('dialog', { name: 'Put this agent to sleep?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(
    await orcaPage.evaluate((tabId) => window.__store!.getState().ptyIdsByTabId[tabId], tabId)
  ).toContain(oldPtyId)
  await sleep.click()
  await dialog.getByRole('button', { name: 'Sleep', exact: true }).click()
  await expect(dialog).toBeHidden()
  const sleeping = mirror.locator('[data-agent-hub-pane-sleep]')
  await expect(sleeping.getByRole('button', { name: 'Wake', exact: true })).toBeVisible()
  await mirror.getByRole('button', { name: 'Focus this mirror', exact: true }).click()
  await expect(mirror).toHaveAttribute('data-focus', 'focused')
  const checkpoint = await orcaPage.evaluate(
    (paneKey) => window.__store!.getState().sleepingAgentSessionsByPaneKey[paneKey],
    paneKey
  )
  expect(checkpoint).toMatchObject({
    wakeOnRequestOnly: true,
    state: 'working',
    launchConfig: { agentCommand: resumeScript }
  })
  await testInfo.attach('saved-pane-stays-asleep', {
    body: await mirror.screenshot(),
    contentType: 'image/png'
  })
  await sleeping.getByRole('button', { name: 'Wake', exact: true }).click()
  await expect
    .poll(() =>
      orcaPage.evaluate(
        (paneKey) => window.__store!.getState().sleepingAgentSessionsByPaneKey[paneKey] ?? null,
        paneKey
      )
    )
    .toBeNull()
  await expect
    .poll(() => {
      try {
        return readFileSync(ledger, 'utf8').trim().split('\n').length
      } catch {
        return 0
      }
    })
    .toBe(1)
  expect(
    await orcaPage.evaluate((tabId) => window.__store!.getState().ptyIdsByTabId[tabId], tabId)
  ).not.toContain(oldPtyId)
  await expect(sleeping).toHaveCount(0)
  expect(
    await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().every((window) => !window.isVisible() && !window.isFocused())
    )
  ).toBe(true)
})
