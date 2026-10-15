import path from 'node:path'
import { existsSync } from 'node:fs'
import type { Page } from '@stablyai/playwright-test'
import { test as base, expect } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'
import { createAgentHubOrbCli } from './helpers/agent-hub-orb-cli'

const test = base.extend<{ orbCli: ReturnType<typeof createAgentHubOrbCli> }>({
  orbCli: async ({ registerPostElectronShutdownCleanup }, provideFixture, testInfo) => {
    const cli = createAgentHubOrbCli()
    registerPostElectronShutdownCleanup(async () => cli.cleanup())
    await provideFixture(cli)
    if (testInfo.status !== testInfo.expectedStatus && existsSync(cli.ledger)) {
      await testInfo.attach('fake-codex-protocol', {
        path: cli.ledger,
        contentType: 'application/x-ndjson'
      })
    }
  },
  launchEnv: async ({ orbCli }, provideFixture) => {
    await provideFixture({
      PATH: `${orbCli.directory}${path.delimiter}${process.env.PATH ?? ''}`,
      ORCA_E2E_ORB_CLI_LEDGER: orbCli.ledger,
      OPENAI_API_KEY: '',
      CODEX_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      CLAUDE_CODE_OAUTH_TOKEN: ''
    })
  }
})

async function configureOrb(page: Page, cwd: string, placement: 'floating' | 'statusBar') {
  await page.evaluate(
    async ({ cwd, placement }) => {
      await window.__store?.getState().updateSettings({
        uiLanguage: 'en',
        theme: 'dark',
        experimentalAgentHub: true,
        agentHubAgentControl: true,
        agentHubAlertSound: false,
        agentHubOrbAgent: 'codex',
        agentHubOrbModel: 'orb-e2e-a',
        agentHubOrbPermission: 'ask',
        agentHubOrbPlacement: placement,
        agentHubOrbPosition: { x: Math.round(window.innerWidth * 0.65), y: 220 },
        floatingTerminalCwd: cwd
      })
    },
    { cwd, placement }
  )
}

test('Orb preserves a draft in its model picker and reopens history after New', async ({
  orcaPage,
  seededRepoPath
}, testInfo) => {
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'statusBar')

  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  const composer = panel.locator('[contenteditable="true"]')
  await composer.fill('Orb lifecycle marker')
  const model = panel.getByRole('button', { name: /^Model Orb test A/ })
  await expect(model).toBeEnabled()
  const triggerBounds = await model.boundingBox()
  if (!triggerBounds) {
    throw new Error('Model trigger has no rendered bounds')
  }
  await model.click()
  const search = orcaPage.getByPlaceholder('Search models…')
  await expect(search).toBeVisible()
  await expect(panel).toBeVisible()
  const pickerBounds = await search.boundingBox()
  if (!pickerBounds) {
    throw new Error('Model picker has no rendered bounds')
  }
  expect(Math.abs(pickerBounds.x - triggerBounds.x)).toBeLessThan(320)
  expect(Math.abs(pickerBounds.y - triggerBounds.y)).toBeLessThan(400)
  await expect(composer).toHaveText('Orb lifecycle marker')
  await orcaPage.getByRole('option', { name: 'Orb test B', exact: true }).click()
  await expect(panel.getByRole('button', { name: /^Model Orb test B/ })).toBeVisible()
  await expect(composer).toHaveText('Orb lifecycle marker')
  await panel.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(panel.getByText('Reply: Orb lifecycle marker', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Model Orb test B/ })).toBeEnabled()

  await panel.getByRole('button', { name: 'Past conversations', exact: true }).click()
  await expect(panel.getByRole('button', { name: /Orb lifecycle marker/ })).toBeVisible()
  await panel.getByRole('button', { name: 'New', exact: true }).click()
  await expect(panel.locator('[data-agent-hub-orb-history]')).toHaveCount(0)
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  await expect(panel.getByText('Reply: Orb lifecycle marker', { exact: true })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Past conversations', exact: true }).click()
  await panel.getByRole('button', { name: /Orb lifecycle marker/ }).click()
  await expect(panel.locator('[data-agent-hub-orb-history]')).toHaveCount(0)
  await expect(panel.getByText('Reply: Orb lifecycle marker', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Model Orb test B/ })).toBeVisible()
  await expect(panel.getByText('Could not load conversations. Try again.')).toHaveCount(0)
  await testInfo.attach('orb-resumed-conversation', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })
})

test('floating Orb drags with its open draft and restores its position after reload', async ({
  orcaPage,
  seededRepoPath
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'statusBar')
  await orcaPage.evaluate(() => {
    const state = window.__store?.getState()
    state?.openSettingsTarget({ pane: 'agentHub', repoId: null })
    state?.openSettingsPage()
  })
  const floatingPlacement = orcaPage
    .getByRole('radiogroup', { name: 'Placement', exact: true })
    .getByRole('radio', { name: 'Floating', exact: true })
  await floatingPlacement.click()
  await expect(floatingPlacement).toHaveAttribute('aria-checked', 'true')
  await orcaPage.evaluate(() => window.__store?.getState().closeSettingsPage())
  const orb = orcaPage.locator('[data-agent-hub-orb-floating]')
  await expect(orb).toBeVisible()
  await orb.getByRole('button', { name: /^Talk to Orb/ }).click()
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  const composer = panel.locator('[contenteditable="true"]')
  await composer.fill('Unsent floating draft')
  const before = await orb.boundingBox()
  if (!before) {
    throw new Error('Floating Orb has no rendered bounds')
  }
  await orcaPage.mouse.move(before.x + 24, before.y + 24)
  await orcaPage.mouse.down()
  await orcaPage.mouse.move(before.x + 124, before.y - 56, { steps: 8 })
  await orcaPage.mouse.up()
  await expect
    .poll(async () => {
      const bounds = await orb.boundingBox()
      return bounds
        ? { x: Math.round(bounds.x - before.x), y: Math.round(bounds.y - before.y) }
        : null
    })
    .toEqual({ x: 100, y: -80 })
  await expect(panel).toBeVisible()
  await expect(composer).toHaveText('Unsent floating draft')
  const moved = await orb.boundingBox()
  if (!moved) {
    throw new Error('Floating Orb disappeared after drag')
  }
  await testInfo.attach('floating-orb-with-draft', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })
  await orcaPage.reload()
  await waitForSessionReady(orcaPage)
  await expect(orb).toBeVisible()
  await expect
    .poll(async () => {
      const bounds = await orb.boundingBox()
      return bounds ? { x: Math.round(bounds.x), y: Math.round(bounds.y) } : null
    })
    .toEqual({ x: Math.round(moved.x), y: Math.round(moved.y) })
})

test('saved model and approval settings replace idle Orb while past conversations keep their model', async ({
  orcaPage,
  seededRepoPath
}) => {
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'statusBar')
  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  await panel.locator('[contenteditable="true"]').fill('Orb lifecycle settings original')
  await panel.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(
    panel.getByText('Reply: Orb lifecycle settings original', { exact: true })
  ).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Model Orb test A/ })).toBeEnabled()

  await orcaPage.evaluate(() => {
    const state = window.__store?.getState()
    state?.openSettingsTarget({ pane: 'agentHub', repoId: null })
    state?.openSettingsPage()
  })
  await orcaPage.getByRole('combobox', { name: 'Model', exact: true }).click()
  await orcaPage.getByRole('option', { name: 'GPT-5.6 Sol', exact: true }).click()
  const freely = orcaPage
    .getByRole('radiogroup', { name: 'Approvals', exact: true })
    .getByRole('radio', { name: 'Act freely', exact: true })
  await freely.click()
  await expect(freely).toHaveAttribute('aria-checked', 'true')
  await orcaPage.evaluate(() => window.__store?.getState().closeSettingsPage())

  await expect(panel.getByRole('button', { name: /^Model GPT-5.6 Sol/ })).toBeVisible()
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  await expect(
    panel.getByText('Reply: Orb lifecycle settings original', { exact: true })
  ).toHaveCount(0)
  await panel.getByRole('button', { name: 'Past conversations', exact: true }).click()
  await panel.getByRole('button', { name: /Orb lifecycle settings original/ }).click()
  await expect(
    panel.getByText('Reply: Orb lifecycle settings original', { exact: true })
  ).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Model Orb test A/ })).toBeVisible()
})

test('Agent Hub settings open the shared shortcut editor without inline shortcut rows', async ({
  orcaPage
}) => {
  await waitForSessionReady(orcaPage)
  await orcaPage.evaluate(async () => {
    const state = window.__store?.getState()
    if (!state) {
      throw new Error('Store unavailable')
    }
    await state.updateSettings({ uiLanguage: 'en', theme: 'dark', experimentalAgentHub: true })
    state.openSettingsTarget({ pane: 'agentHub', repoId: null })
    state.openSettingsPage()
  })
  const edit = orcaPage.getByRole('button', { name: 'Edit shortcuts', exact: true })
  await expect(edit).toBeVisible()
  await expect(orcaPage.locator('[data-agent-hub-shortcuts]')).toHaveCount(0)
  await edit.click()
  const dialog = orcaPage.getByRole('dialog', { name: 'Keyboard shortcuts', exact: true })
  await expect(dialog).toBeVisible()
  for (const action of ['agentHub.toggleOrb', 'agentHub.nextMirrorTab', 'voice.dictation']) {
    await expect(dialog.locator(`[data-agent-hub-shortcut="${action}"]`)).toBeVisible()
  }
  const talk = dialog.locator('[data-agent-hub-shortcut="agentHub.toggleOrb"]')
  await talk.getByRole('button', { name: /Add/ }).click()
  await orcaPage.keyboard.press('Control+Alt+Shift+Y')
  await expect(talk.getByText('Y', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await edit.click()
  await expect(
    orcaPage
      .getByRole('dialog', { name: 'Keyboard shortcuts', exact: true })
      .locator('[data-agent-hub-shortcut="agentHub.toggleOrb"]')
      .getByText('Y', { exact: true })
  ).toBeVisible()
})
