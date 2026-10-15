import { test, expect } from './helpers/orca-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { waitForActivePanePtyId } from './helpers/terminal'

test('mirror close preserves the terminal; its context menu closes only the selected terminal', async ({
  orcaPage
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  const { selected, sibling } = await orcaPage.evaluate(async (worktreeId) => {
    const state = window.__store?.getState()
    if (!state) {
      throw new Error('Store unavailable')
    }
    await state.updateSettings({
      experimentalAgentHub: true,
      agentHubTabAutoPopout: true,
      agentHubAlertSound: false,
      agentHubFloatingDimMode: 'off'
    })
    const selected = state.createTab(worktreeId)
    state.setTabCustomTitle(selected.id, 'Mirror close target')
    const sibling = state.createTab(worktreeId)
    state.setTabCustomTitle(sibling.id, 'Preserved sibling')
    return { selected: selected.id, sibling: sibling.id }
  }, worktreeId)
  await waitForActivePanePtyId(orcaPage)
  const targetTab = orcaPage.locator(`[data-tab-id="${selected}"]`)
  const siblingTab = orcaPage.locator(`[data-tab-id="${sibling}"]`)
  const mirror = orcaPage.locator('[data-agent-hub-mirror]').filter({
    has: orcaPage.getByRole('tab', { name: 'Mirror close target, idle', exact: true })
  })

  await targetTab.getByRole('button', { name: 'Pop out', exact: true }).click()
  await expect(mirror).toBeVisible()
  await mirror.getByRole('button', { name: 'Close mirror', exact: true }).click()
  await expect(mirror).toHaveCount(0)
  await expect(targetTab).toBeVisible()
  await expect(siblingTab).toBeVisible()

  await targetTab.getByRole('button', { name: 'Pop out', exact: true }).click()
  await expect(mirror).toBeVisible()
  await mirror.getByRole('button', { name: 'Close mirror', exact: true }).click({ button: 'right' })
  const closeTerminal = orcaPage.getByRole('menuitem', { name: 'Close terminal', exact: true })
  await expect(closeTerminal).toBeVisible()
  await expect(mirror).toBeVisible()
  await expect(siblingTab).toBeVisible()
  await testInfo.attach('mirror-close-context-menu', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })
  // Wait out the intentional guard against selecting on the opening right-button release.
  await orcaPage.waitForTimeout(400)
  await closeTerminal.click()
  await expect(targetTab).toHaveCount(0)
  await expect(mirror).toHaveCount(0)
  await expect(siblingTab).toBeVisible()
})
