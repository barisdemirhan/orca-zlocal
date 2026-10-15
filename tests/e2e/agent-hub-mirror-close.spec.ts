import { test, expect } from './helpers/orca-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { waitForActivePanePtyId } from './helpers/terminal'

test('mirror dismissal preserves sources and mirror pins cannot veto authoritative source closure', async ({
  orcaPage
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  const { selected, sibling, companion } = await orcaPage.evaluate(async (worktreeId) => {
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
    const selected = state.createTab(worktreeId)
    state.setTabCustomTitle(selected.id, 'Mirror close target')
    const sibling = state.createTab(worktreeId)
    state.setTabCustomTitle(sibling.id, 'Preserved sibling')
    const companion = state.createTab(worktreeId)
    state.setTabCustomTitle(companion.id, 'Unpinned mirror sibling')
    return { selected: selected.id, sibling: sibling.id, companion: companion.id }
  }, worktreeId)
  await waitForActivePanePtyId(orcaPage)
  const targetTab = orcaPage.locator(`[data-tab-id="${selected}"]`)
  const siblingTab = orcaPage.locator(`[data-tab-id="${sibling}"]`)
  const companionTab = orcaPage.locator(`[data-tab-id="${companion}"]`)
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

  await siblingTab.getByRole('button', { name: 'Pop out', exact: true }).click()
  const pinnedMirror = orcaPage.locator('[data-agent-hub-mirror]').filter({
    has: orcaPage.getByRole('tab', { name: 'Preserved sibling, idle', exact: true })
  })
  const mirrorTab = pinnedMirror.getByRole('tab', { name: 'Preserved sibling, idle', exact: true })
  await expect(pinnedMirror).toBeVisible()
  await companionTab.getByRole('button', { name: 'Pop out', exact: true }).click()
  const companionMirrorTab = orcaPage.getByRole('tab', {
    name: 'Unpinned mirror sibling, idle',
    exact: true
  })
  await companionMirrorTab.click({ button: 'right' })
  await orcaPage.getByRole('menuitem', { name: 'Move to mirror', exact: true }).hover()
  await orcaPage.getByRole('menuitem', { name: /Preserved sibling/ }).click()
  await expect(pinnedMirror.getByRole('tab')).toHaveCount(2)
  await mirrorTab.click()
  await mirrorTab.click({ button: 'right' })
  await orcaPage.getByRole('menuitem', { name: 'Pin Tab', exact: true }).click()
  await expect(pinnedMirror.locator('[data-agent-hub-tab-entry][data-pinned="true"]')).toHaveCount(
    1
  )
  await expect(
    pinnedMirror.getByRole('button', { name: 'Close mirror tab Preserved sibling', exact: true })
  ).toHaveCount(0)
  await expect(
    pinnedMirror.getByRole('button', {
      name: 'Close mirror tab Unpinned mirror sibling',
      exact: true
    })
  ).toBeAttached()
  await mirrorTab.click({ button: 'right' })
  await expect(orcaPage.getByRole('menuitem', { name: 'Close tab', exact: true })).toBeDisabled()
  await orcaPage.keyboard.press('Escape')
  await pinnedMirror.locator('button[aria-label="Minimize"]').click()
  await expect(pinnedMirror).toHaveCount(0)
  await orcaPage.getByRole('button', { name: 'Restore Preserved sibling', exact: true }).click()
  await expect(pinnedMirror).toBeVisible()
  await expect(pinnedMirror.locator('[data-agent-hub-tab-entry][data-pinned="true"]')).toHaveCount(
    1
  )
  await testInfo.attach('pinned-mirror-before-source-close', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })
  await siblingTab.getByRole('button', { name: 'Close tab Preserved sibling', exact: true }).click()
  await expect(siblingTab).toHaveCount(0)
  await expect(pinnedMirror).toHaveCount(0)
  await expect(companionTab).toBeVisible()
  await expect(companionMirrorTab).toBeVisible()
})
