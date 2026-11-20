import { createServer } from 'node:http'
import path from 'node:path'
import { runProcess } from '@orca/process-host'
import type { RuntimeTerminalListResult } from '../../../src/shared/terminal/runtime/runtime-terminal-contracts'
import { test, expect } from '../desktop/electron-fixtures/orca-app'
import { orcaCliResult } from '../desktop/cli-invocation/compiled-orca-cli'
import {
  ensureTerminalVisible,
  waitForActiveWorktree,
  waitForSessionReady
} from '../desktop/renderer-probes/store'
import { waitForActivePanePtyId } from '../terminal/input/terminal'

test('Peek stays clickable above normal and enlarged mirrors without changing their focus mode', async ({
  orcaPage,
  electronApp
}, testInfo) => {
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html')
    response.end('<!doctype html><title>Mirror Peek</title><p>Mirror Peek loaded</p>')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Missing Peek fixture port')
    }
    await waitForSessionReady(orcaPage)
    const worktreeId = await waitForActiveWorktree(orcaPage)
    await ensureTerminalVisible(orcaPage)
    const tabId = await orcaPage.evaluate(async (worktreeId) => {
      const state = window.__store?.getState()
      if (!state) {
        throw new Error('Store unavailable')
      }
      await state.updateSettings({
        uiLanguage: 'en',
        experimentalAgentHub: true,
        agentHubTabAutoPopout: true,
        agentHubAlertSound: false,
        agentHubFloatingDimMode: 'off'
      })
      const tab = state.createTab(worktreeId)
      state.setTabCustomTitle(tab.id, 'Peek mirror target')
      return tab.id
    }, worktreeId)
    await waitForActivePanePtyId(orcaPage)
    const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
    const listed = await orcaCliResult<RuntimeTerminalListResult>(userData, ['terminal', 'list'])
    const terminal = listed.terminals.find((terminal) => terminal.tabId === tabId)
    if (!terminal) {
      throw new Error('Peek source terminal unavailable')
    }
    await orcaPage
      .locator(`[data-tab-id="${tabId}"]`)
      .getByRole('button', { name: 'Pop out', exact: true })
      .click()
    const mirror = orcaPage.locator('[data-agent-hub-mirror]').filter({
      has: orcaPage.getByRole('tab', { name: 'Peek mirror target, idle', exact: true })
    })
    await expect(mirror).toBeVisible()
    for (const enlarged of [false, true]) {
      if (enlarged) {
        await mirror.getByRole('button', { name: 'Focus this mirror', exact: true }).click()
        await expect(mirror).toHaveAttribute('data-focus', 'focused')
      }
      const result = await runProcess({
        program: process.execPath,
        args: [
          path.join(process.cwd(), 'out', 'cli', 'index.js'),
          'hub',
          'peek',
          `http://127.0.0.1:${address.port}/mirror-peek`,
          '--json'
        ],
        env: {
          ...process.env,
          ORCA_USER_DATA_PATH: userData,
          ORCA_DEV_CLI_INVOCATION: '1',
          ORCA_TERMINAL_HANDLE: terminal.handle
        },
        timeoutMs: 20_000,
        maxOutputBytes: 16_384
      })
      expect(result.code, result.stdout + result.stderr).toBe(0)
      const peek = orcaPage.locator('[data-agent-hub-peek="web"]')
      await expect(peek).toBeVisible()
      const expand = peek.getByRole('button', { name: 'Full screen', exact: true })
      await expand.click({ timeout: 5_000 })
      await expect(
        peek.getByRole('button', { name: 'Exit full screen', exact: true })
      ).toBeVisible()
      await testInfo.attach(enlarged ? 'peek-above-enlarged-mirror' : 'peek-above-normal-mirror', {
        body: await orcaPage.screenshot(),
        contentType: 'image/png'
      })
      await peek.getByRole('button', { name: 'Close (esc)', exact: true }).click()
      await expect(peek).toHaveCount(0)
      await expect(mirror).toBeVisible()
      if (enlarged) {
        await expect(mirror).toHaveAttribute('data-focus', 'focused')
        await mirror
          .getByRole('button', { name: 'Return this mirror to its place', exact: true })
          .click()
        await expect(mirror).not.toHaveAttribute('data-focus', 'focused')
      }
    }
    expect(
      await electronApp.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().every((window) => !window.isVisible() && !window.isFocused())
      )
    ).toBe(true)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})
