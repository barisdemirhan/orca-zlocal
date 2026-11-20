import type { Locator } from '@stablyai/playwright-test'
import { expect } from '../desktop/electron-fixtures/orca-app'
import {
  configureOrb,
  showOrbConversation,
  test
} from '../desktop/electron-fixtures/agent-hub-orb-fixture'
import { waitForSessionReady } from '../desktop/renderer-probes/store'

async function expectCenteredDictation(overlay: Locator): Promise<number> {
  const pill = overlay.getByRole('status').locator('../..')
  const [bounds, pillBounds] = await Promise.all([overlay.boundingBox(), pill.boundingBox()])
  if (!bounds || !pillBounds) {
    throw new Error('Orb dictation overlay has no rendered bounds')
  }
  expect(
    Math.abs(pillBounds.x + pillBounds.width / 2 - bounds.x - bounds.width / 2)
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(pillBounds.y + pillBounds.height / 2 - bounds.y - bounds.height / 2)
  ).toBeLessThanOrEqual(1)
  expect(pillBounds.x).toBeGreaterThanOrEqual(bounds.x)
  expect(pillBounds.x + pillBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width)
  expect(pillBounds.y).toBeGreaterThanOrEqual(bounds.y)
  expect(pillBounds.y + pillBounds.height).toBeLessThanOrEqual(bounds.y + bounds.height)
  for (const button of await overlay.getByRole('button').all()) {
    const buttonBounds = await button.boundingBox()
    if (!buttonBounds) {
      throw new Error('Orb dictation control has no rendered bounds')
    }
    expect(buttonBounds.x).toBeGreaterThanOrEqual(bounds.x)
    expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width)
    expect(buttonBounds.y).toBeGreaterThanOrEqual(bounds.y)
    expect(buttonBounds.y + buttonBounds.height).toBeLessThanOrEqual(bounds.y + bounds.height)
  }
  await expect(overlay).toHaveCSS('background-color', /0\.5\)$/)
  return bounds.width
}

test('Orb centers dictation over its dimmed composer without losing the draft', async ({
  orcaPage,
  seededRepoPath
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'statusBar')
  await orcaPage.evaluate(async () => {
    const state = window.__store?.getState()
    if (!state?.settings?.voice) {
      throw new Error('Orb dictation settings unavailable')
    }
    await state.updateSettings({ voice: { ...state.settings.voice, enabled: true } })
  })
  await orcaPage.waitForFunction(() => {
    const detail = { cancel: false }
    document.dispatchEvent(new CustomEvent('dictation:capabilities', { detail }))
    return detail.cancel
  })
  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await showOrbConversation(orcaPage)
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  const composer = panel.locator('[contenteditable="true"]')
  const draft = 'Orb lifecycle microphone overlay marker'
  await composer.fill(draft)
  await composer.focus()
  const modelPicker = panel.getByRole('button', { name: /^Model / })
  await modelPicker.click()
  await expect(modelPicker).toHaveAttribute('aria-expanded', 'true')
  const overlay = panel.locator('[data-agent-hub-orb-dictation]')
  try {
    // Capture phases are synthetic; the actual Orb composer and dictation controls stay mounted.
    await orcaPage.evaluate(() => window.__store?.getState().setDictationState('starting'))
    await expect(overlay).toBeVisible()
    await expect(overlay).toHaveAttribute('data-agent-hub-orb-dictation', 'starting')
    await expect(overlay.getByRole('status')).toHaveText('Starting mic…')
    await expect(modelPicker).toHaveAttribute('aria-expanded', 'false')
    await expectCenteredDictation(overlay)
    await composer.evaluate((element) => element.focus())
    await expect(composer).not.toBeFocused()
    await expect(composer.click({ trial: true, timeout: 700 })).rejects.toThrow()
    await expect(
      panel.getByRole('button', { name: 'Send', exact: true }).click({ trial: true, timeout: 700 })
    ).rejects.toThrow()
    await orcaPage.keyboard.press('Tab')
    expect(await composer.evaluate((element) => element.contains(document.activeElement))).toBe(
      false
    )
    await orcaPage.evaluate(() => window.__store?.getState().setDictationState('listening'))
    await expect(overlay).toHaveAttribute('data-agent-hub-orb-dictation', 'listening')
    await expect(overlay.getByRole('status')).toHaveText('Listening')
    await expect(overlay.getByRole('button', { name: 'Stop dictation', exact: true })).toBeVisible()
    await expect(
      overlay.getByRole('button', { name: 'Cancel dictation', exact: true })
    ).toBeVisible()
    await expect(overlay.locator('[data-agent-hub-dictation-stop-key]')).toBeVisible()
    await testInfo.attach('orb-centered-dictation', {
      body: await panel.screenshot(),
      contentType: 'image/png'
    })

    await orcaPage.setViewportSize({ width: 400, height: 900 })
    const narrowComposerWidth = await expectCenteredDictation(overlay)
    expect(narrowComposerWidth).toBeLessThan(384)
    await expect(overlay.locator('[data-agent-hub-dictation-stop-key]')).not.toBeVisible()
    await testInfo.attach('orb-dictation-narrow-layout', {
      body: JSON.stringify({ viewportWidth: 400, composerWidth: narrowComposerWidth }),
      contentType: 'application/json'
    })
    await expect(overlay.getByRole('button', { name: 'Stop dictation', exact: true })).toBeVisible()
    await expect(
      overlay.getByRole('button', { name: 'Cancel dictation', exact: true })
    ).toBeVisible()
    await testInfo.attach('orb-centered-dictation-narrow', {
      body: await panel.screenshot(),
      contentType: 'image/png'
    })
    await overlay.getByRole('button', { name: 'Stop dictation', exact: true }).click()
    await orcaPage.evaluate(() => window.__store?.getState().setDictationState('stopping'))
    await expect(overlay).toHaveAttribute('data-agent-hub-orb-dictation', 'finishing')
    await expect(overlay.getByRole('status')).toHaveText('Processing…')
    await expect(overlay.getByRole('button', { name: 'Stop dictation', exact: true })).toHaveCount(
      0
    )
    await overlay.getByRole('button', { name: 'Cancel dictation', exact: true }).click()
    await orcaPage.evaluate(() =>
      window.__store?.setState({ dictationState: 'idle', partialTranscript: '' })
    )
    await expect(overlay).toHaveCount(0)
    await composer.focus()
    await expect(composer).toBeFocused()
    await expect(composer).toHaveText(draft)
    await expect(panel.getByText(`Reply: ${draft}`, { exact: true })).toHaveCount(0)
    await panel.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(panel.getByText(`Reply: ${draft}`, { exact: true })).toBeVisible()
    await expect(panel.getByText(draft, { exact: true })).toHaveCount(1)
  } finally {
    await orcaPage.evaluate(() =>
      window.__store?.setState({ dictationState: 'idle', partialTranscript: '' })
    )
  }
})
