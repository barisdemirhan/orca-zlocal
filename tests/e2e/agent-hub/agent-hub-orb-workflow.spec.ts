import { readFileSync } from 'node:fs'
import { expect } from '../desktop/electron-fixtures/orca-app'
import {
  configureOrb,
  showOrbConversation,
  test
} from '../desktop/electron-fixtures/agent-hub-orb-fixture'
import { waitForSessionReady } from '../desktop/renderer-probes/store'

test('Orb refuses an unavailable saved model, keeps startup diagnostics quiet and recovers a rejected turn', async ({
  orcaPage,
  seededRepoPath,
  orbCli
}, testInfo) => {
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'statusBar', 'gpt-6.1-sol')

  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await expect(
    orcaPage.getByText(
      'The selected Codex model is unavailable for this account. Choose a model in Orb settings.',
      { exact: true }
    )
  ).toBeVisible()
  await expect(panel).toHaveCount(0)
  await configureOrb(orcaPage, seededRepoPath, 'statusBar', 'orb-e2e-a')
  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  await showOrbConversation(orcaPage)
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  await expect(panel.locator('header')).toContainText('Codex · orb-e2e-a')
  const turnDetails = panel.getByRole('button', { name: 'Toggle turn details', exact: true })
  await turnDetails.click()
  await expect(turnDetails).toHaveAttribute('aria-expanded', 'true')
  const hook = panel.locator('p').filter({ hasText: /^hook exited with code 127$/ })
  await expect(hook).toBeVisible()
  const review = panel.locator('details').filter({
    has: orcaPage.locator('summary').filter({ hasText: 'Automatic approval review approved' })
  })
  await expect(review).toHaveJSProperty('open', false)
  await expect(review.locator('summary')).not.toContainText('risk:')
  await expect(review.locator('pre')).toContainText(
    'Read-only status query within the requested task.'
  )
  await expect(
    panel.locator('p').filter({ hasText: /Automatic approval review approved/ })
  ).toHaveCount(0)
  const mcp = panel.locator('details').filter({
    has: orcaPage.locator('summary').filter({ hasText: 'MCP connection details' })
  })
  await expect(mcp).toHaveCount(3)
  for (const server of ['sentry', 'raindrop', 'postman']) {
    const diagnostic = mcp.filter({ hasText: `"name":"${server}"` })
    await expect(diagnostic).toHaveCount(1)
    await expect(diagnostic).toHaveJSProperty('open', false)
    await expect(diagnostic.locator('pre')).not.toBeVisible()
  }
  await expect(panel.locator('p').filter({ hasText: /MCP server|MCP client for/ })).toHaveCount(0)
  await hook.scrollIntoViewIfNeeded()
  await testInfo.attach('orb-quiet-startup', {
    body: await panel.screenshot(),
    contentType: 'image/png'
  })
  const sentry = mcp.filter({ hasText: '"name":"sentry"' })
  await sentry.locator('summary').click()
  await expect(sentry.locator('pre')).toBeVisible()
  await expect(sentry.locator('pre')).toContainText('codex mcp login sentry')
  await testInfo.attach('orb-startup-diagnostics-on-demand', {
    body: await panel.screenshot(),
    contentType: 'image/png'
  })
  await sentry.locator('summary').click()
  const composer = panel.locator('[contenteditable="true"]')
  orbCli.rejectModel('orb-e2e-a')
  await composer.fill('Orb lifecycle rejected marker')
  await panel.getByRole('button', { name: 'Send', exact: true }).click()
  const failure = panel
    .locator('p')
    .filter({ hasText: "The 'orb-e2e-a' model is not supported" })
    .first()
  await expect(failure).toBeVisible()
  await expect(failure).toHaveText(
    "The 'orb-e2e-a' model is not supported when using Codex with a ChatGPT account."
  )
  const failureDetails = panel
    .locator('details')
    .filter({ hasText: 'invalid_request_error' })
    .first()
  await expect(failureDetails).toHaveJSProperty('open', false)
  await expect(failureDetails.locator('pre')).not.toBeVisible()
  await expect(panel.getByText('Orb lifecycle rejected marker', { exact: true })).toHaveCount(1)
  await expect(
    panel.getByText('Reply: Orb lifecycle rejected marker', { exact: true })
  ).toHaveCount(0)
  await testInfo.attach('orb-actionable-model-failure', {
    body: await panel.screenshot(),
    contentType: 'image/png'
  })
  await failureDetails.locator('summary').click()
  await expect(failureDetails.locator('pre')).toBeVisible()
  await expect(failureDetails.locator('pre')).toContainText('invalid_request_error')
  await failureDetails.locator('summary').click()
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
  await expect(panel.locator('header')).toContainText('Codex · orb-e2e-b')
  await expect(panel.getByText('Orb lifecycle marker', { exact: true })).toHaveCount(1)
  orbCli.rejectModel(null)

  await panel.getByRole('button', { name: 'Past conversations', exact: true }).click()
  await expect(panel.getByRole('button', { name: /Orb lifecycle marker/ })).toBeVisible()
  await panel.getByRole('button', { name: 'New', exact: true }).click()
  await expect(panel.locator('[data-agent-hub-orb-history]')).toHaveCount(0)
  await showOrbConversation(orcaPage)
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  await expect(panel.getByText('Reply: Orb lifecycle marker', { exact: true })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Past conversations', exact: true }).click()
  await panel.getByRole('button', { name: /Orb lifecycle marker/ }).click()
  await expect(panel.locator('[data-agent-hub-orb-history]')).toHaveCount(0)
  await showOrbConversation(orcaPage)
  await expect(panel.getByText('Reply: Orb lifecycle marker', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Model Orb test B/ })).toBeVisible()
  await expect(panel.locator('header')).toContainText('Codex · orb-e2e-b')
  await expect(panel.getByText('Could not load conversations. Try again.')).toHaveCount(0)
  await testInfo.attach('orb-resumed-conversation', {
    body: await panel.screenshot(),
    contentType: 'image/png'
  })
  const requests: {
    method: string
    params: { model?: string; threadId?: string; input?: { text?: string }[] }
  }[] = readFileSync(orbCli.ledger, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  const turnsFor = (text: string) =>
    requests.filter(
      (request) =>
        request.method === 'turn/start' && request.params.input?.some((item) => item.text === text)
    )
  const rejected = turnsFor('Orb lifecycle rejected marker')
  const recovered = turnsFor('Orb lifecycle marker')
  expect(requests.find((request) => request.method === 'thread/start')?.params.model).toBe(
    'orb-e2e-a'
  )
  expect(rejected).toHaveLength(1)
  expect(recovered).toHaveLength(1)
  expect(rejected[0].params.model).toBe('orb-e2e-a')
  expect(recovered[0].params.model).toBe('orb-e2e-b')
  expect(rejected[0].params.threadId).toBeTruthy()
  expect(recovered[0].params.threadId).toBe(rejected[0].params.threadId)
  await testInfo.attach('orb-codex-protocol', {
    path: orbCli.ledger,
    contentType: 'application/x-ndjson'
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
  await showOrbConversation(orcaPage)
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
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'statusBar')
  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await showOrbConversation(orcaPage)
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  await panel.locator('[contenteditable="true"]').fill('Orb lifecycle settings original')
  await panel.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(
    panel.getByText('Reply: Orb lifecycle settings original', { exact: true })
  ).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Model Orb test A/ })).toBeEnabled()

  await panel.getByRole('button', { name: 'Orb settings', exact: true }).click()
  const orbSettings = panel.getByRole('region', { name: 'Orb settings', exact: true })
  await expect(orbSettings).toBeVisible()
  await orbSettings.getByRole('combobox', { name: 'Model', exact: true }).click()
  await orcaPage.getByRole('option', { name: 'GPT-5.6 Sol', exact: true }).click()
  const freely = orbSettings
    .getByRole('radiogroup', { name: 'Approvals', exact: true })
    .getByRole('radio', { name: 'Full access', exact: true })
  await freely.click()
  await expect(freely).toHaveAttribute('aria-checked', 'true')
  await testInfo.attach('orb-in-panel-settings', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })
  await panel.getByRole('button', { name: 'Back to conversation', exact: true }).click()

  await expect(panel.getByRole('button', { name: /^Model GPT-5.6 Sol/ })).toBeVisible()
  await showOrbConversation(orcaPage)
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
