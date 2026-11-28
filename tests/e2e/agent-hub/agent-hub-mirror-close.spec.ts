import { test, expect } from '../desktop/electron-fixtures/orca-app'
import {
  ensureTerminalVisible,
  waitForActiveWorktree,
  waitForSessionReady
} from '../desktop/renderer-probes/store'
import { waitForActivePaneHookDescriptor, waitForActivePanePtyId } from '../terminal/input/terminal'

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

test('agent close confirmation follows the list and the owning mirror tab without closing its sibling', async ({
  orcaPage,
  electronApp
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  expect(
    await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().every((window) => !window.isVisible() && !window.isFocused())
    )
  ).toBe(true)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await orcaPage.evaluate(async () => {
    await window.__store?.getState().updateSettings({
      uiLanguage: 'en',
      experimentalAgentHub: true,
      agentHubPlacement: 'status-bar',
      agentHubDefaultTab: 'agents',
      agentHubTabAutoPopout: true,
      agentHubAlertSound: false,
      agentHubFloatingDimMode: 'off',
      skipCloseTerminalWithRunningProcessConfirm: true
    })
  })
  const agents: { tabId: string; title: string; ptyId: string }[] = []
  for (const agentType of ['codex', 'claude'] as const) {
    const title = `Confirmed close ${agentType}`
    const tabId = await orcaPage.evaluate(
      ({ worktreeId, title }) => {
        const state = window.__store?.getState()
        if (!state) {
          throw new Error('Store unavailable')
        }
        const tab = state.createTab(worktreeId)
        state.setTabCustomTitle(tab.id, title)
        return tab.id
      },
      { worktreeId, title }
    )
    const descriptor = await waitForActivePaneHookDescriptor(orcaPage)
    const ptyId = await waitForActivePanePtyId(orcaPage)
    await orcaPage.evaluate(
      ({ descriptor, agentType, title, tabId }) => {
        window.__store
          ?.getState()
          .setAgentStatus(
            descriptor.paneKey,
            { state: 'done', prompt: title, agentType },
            title,
            undefined,
            { worktreeId: descriptor.worktreeId, tabId }
          )
      },
      { descriptor, agentType, title, tabId }
    )
    agents.push({ tabId, title, ptyId })
  }
  const [first, second] = agents
  if (!first || !second) {
    throw new Error('Two agent panes are required')
  }
  const source = (id: string) => orcaPage.locator(`[data-tab-id="${id}"]`)
  const dialog = orcaPage.getByRole('dialog', { name: 'Stop this agent?', exact: true })
  await orcaPage.locator('button[data-open][aria-label="Agents"]').click()
  const row = orcaPage.locator('[data-agent-hub-row]').filter({ hasText: first.title })
  await row.hover()
  await row.getByRole('button', { name: 'Close agent', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(first.title)
  await expect(dialog.getByRole('checkbox')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(source(first.tabId)).toBeVisible()
  expect(
    await orcaPage.evaluate(
      ({ tabId, ptyId }) => window.__store?.getState().ptyIdsByTabId[tabId]?.includes(ptyId),
      first
    )
  ).toBe(true)
  await orcaPage.keyboard.press('Escape')

  await source(first.tabId).getByRole('button', { name: 'Pop out', exact: true }).click()
  const openedMirror = orcaPage.locator('[data-agent-hub-mirror]').filter({
    has: orcaPage.getByRole('tab', { name: new RegExp(first.title) })
  })
  await expect(openedMirror).toBeVisible()
  const mirrorKey = await openedMirror.getAttribute('data-agent-hub-mirror-key')
  if (!mirrorKey) {
    throw new Error('Mirror identity unavailable')
  }
  const mirror = orcaPage.locator(`[data-agent-hub-mirror-key="${mirrorKey}"]`)
  await mirror.getByRole('button', { name: 'Close mirror', exact: true }).click({ button: 'right' })
  await expect(orcaPage.getByRole('menuitem', { name: 'Close agent', exact: true })).toBeVisible()
  await orcaPage.keyboard.press('Escape')
  await source(second.tabId).getByRole('button', { name: 'Pop out', exact: true }).click()
  const secondTab = orcaPage.getByRole('tab', { name: new RegExp(second.title) })
  await secondTab.click({ button: 'right' })
  await orcaPage.getByRole('menuitem', { name: 'Move to mirror', exact: true }).hover()
  await orcaPage.getByRole('menuitem', { name: new RegExp(first.title) }).click()
  await expect(mirror.getByRole('tab')).toHaveCount(2)
  await secondTab.click()
  await mirror.getByRole('button', { name: 'Close mirror', exact: true }).click({ button: 'right' })
  await expect(orcaPage.getByRole('menuitem', { name: 'Close agent', exact: true })).toHaveCount(0)
  await mirror.getByRole('tab', { name: new RegExp(first.title) }).click({ button: 'right' })
  const closeAgent = orcaPage.getByRole('menuitem', { name: 'Close agent', exact: true })
  await expect(closeAgent).toBeVisible()
  await testInfo.attach('inactive-agent-tab-close-menu', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })
  await orcaPage.waitForTimeout(400)
  await closeAgent.click()
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(first.title)
  await expect(source(first.tabId)).toBeVisible()
  await expect(source(second.tabId)).toBeVisible()
  await testInfo.attach('agent-close-confirmation', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })
  await dialog.getByRole('button', { name: 'Stop Agent', exact: true }).click()
  await expect(source(first.tabId)).toHaveCount(0)
  await expect(source(second.tabId)).toBeVisible()
  await expect(mirror.getByRole('tab')).toHaveCount(1)
  await mirror.getByRole('button', { name: 'Close mirror', exact: true }).click({ button: 'right' })
  await expect(orcaPage.getByRole('menuitem', { name: 'Close agent', exact: true })).toBeVisible()
  await orcaPage.keyboard.press('Escape')
  await mirror.getByRole('button', { name: 'Close mirror', exact: true }).click()
  await expect(mirror).toHaveCount(0)
  await expect(source(second.tabId)).toBeVisible()
  expect(
    await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().every((window) => !window.isVisible() && !window.isFocused())
    )
  ).toBe(true)
})
