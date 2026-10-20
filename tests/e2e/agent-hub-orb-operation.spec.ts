import path from 'node:path'
import { runProcess } from '@orca/process-host'
import { expect } from './helpers/orca-app'
import { configureOrb, showOrbConversation, test } from './helpers/agent-hub-orb-fixture'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { waitForActivePanePtyId } from './helpers/terminal'
import { orcaCliResult } from './helpers/compiled-orca-cli'

test('a real Orb CLI write protects its target automatically and the user can take control before Enter', async ({
  orcaPage,
  electronApp,
  seededRepoPath
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
    state.setTabCustomTitle(tab.id, 'Orb operation target')
    return tab.id
  }, worktreeId)
  await waitForActivePanePtyId(orcaPage)
  await orcaPage
    .locator(`[data-tab-id="${tabId}"]`)
    .getByRole('button', { name: 'Pop out', exact: true })
    .click()
  const mirror = orcaPage
    .locator('[data-agent-hub-mirror]')
    .filter({ has: orcaPage.getByRole('tab', { name: /Orb operation target/ }) })
  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  await showOrbConversation(orcaPage)
  await expect(orcaPage.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  const current = await orcaPage.evaluate(() => window.api.agentHub.orb.current())
  if (!current) {
    throw new Error('Orb session missing')
  }
  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  const list = await orcaCliResult<{ terminals: { handle: string; tabId: string }[] }>(userData, [
    'terminal',
    'list'
  ])
  const handle = list.terminals.find((terminal) => terminal.tabId === tabId)?.handle
  if (!handle) {
    throw new Error('Target terminal missing')
  }
  const cliPath = path.join(process.cwd(), 'out', 'cli', 'index.js')
  // Generate argv in the child to exercise the shipped CLI without the OS argument-size limit.
  const bootstrap = `process.argv=[process.execPath,${JSON.stringify(cliPath)},'terminal','send','--terminal',${JSON.stringify(handle)},'--text','#'+ ' '.repeat(900*1024),'--enter','--json'];void require(${JSON.stringify(cliPath)}).main()`
  const writing = runProcess({
    program: process.execPath,
    args: ['-e', bootstrap],
    env: {
      ...process.env,
      ORCA_USER_DATA_PATH: userData,
      ORCA_DEV_CLI_INVOCATION: '1',
      ORCA_AGENT_SESSION_ID: current.sessionId,
      ORCA_TERMINAL_HANDLE: '',
      ORCA_PANE_KEY: ''
    },
    timeoutMs: 30_000,
    maxOutputBytes: 64 * 1024
  }).then(async (result) => {
    await testInfo.attach('orb-cli-write-result', {
      body: JSON.stringify({ ...result, stdout: result.stdout.slice(0, 2_000) }),
      contentType: 'application/json'
    })
    return result
  })
  const protection = mirror.locator('[data-orb-operation-protection]')
  await expect(protection.getByText('Orb is working here', { exact: true })).toBeVisible()
  const blocked = await orcaPage.evaluate(
    (terminal) =>
      window.api.runtime.call({
        method: 'terminal.send',
        params: { terminal, text: 'must-not-interleave' }
      }),
    handle
  )
  expect(blocked.ok).toBe(false)
  await testInfo.attach('orb-automatic-operation-protection', {
    body: await protection.getByRole('status').screenshot(),
    contentType: 'image/png'
  })
  await protection.getByRole('button', { name: 'Take control', exact: true }).click()
  await expect(protection).toHaveCount(0)
  await testInfo.attach('orb-operation-after-take-control', {
    body: await mirror.screenshot(),
    contentType: 'image/png'
  })
  const result = await writing
  expect(result.code, result.stdout + result.stderr).not.toBe(0)
  expect(
    await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().every((window) => !window.isVisible() && !window.isFocused())
    )
  ).toBe(true)
})
