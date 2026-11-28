import { expect } from '../desktop/electron-fixtures/orca-app'
import {
  configureOrb,
  revealOrbLiveControls,
  showOrbStage
} from '../desktop/electron-fixtures/agent-hub-orb-fixture'
import {
  observeVoiceDevice,
  test
} from '../desktop/electron-fixtures/agent-hub-orb-native-voice-fixture'
import { pressShortcut } from '../desktop/renderer-probes/shortcuts'
import { waitForSessionReady } from '../desktop/renderer-probes/store'

test('Orb opens its chosen action, stays open and remembers its resized size', async ({
  orcaPage,
  electronApp,
  seededRepoPath
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'statusBar')
  await orcaPage.evaluate(async () => {
    await window.__store?.getState().updateSettings({
      agentHubOrbDefaultAction: 'live',
      agentHubOrbAlternateAction: 'text'
    })
  })
  expect(
    await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().every((window) => !window.isVisible() && !window.isFocused())
    )
  ).toBe(true)

  const launcher = orcaPage.getByRole('button', { name: /^Talk to Orb/ })
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  const stage = orcaPage.locator('[data-agent-hub-orb-stage]')
  const size = stage.getByRole('slider', { name: 'Orb size', exact: true })
  await launcher.click()
  await revealOrbLiveControls(orcaPage)
  await expect(stage.getByRole('button', { name: 'Mute microphone', exact: true })).toBeEnabled()
  await expect.poll(async () => (await observeVoiceDevice(orcaPage)).captures).toBe(1)
  await expect(size).toHaveAttribute('aria-valuenow', '128')
  await size.press('ArrowRight')
  await expect(size).toHaveAttribute('aria-valuenow', '136')
  await stage.getByRole('button', { name: 'Close Orb', exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect.poll(async () => (await observeVoiceDevice(orcaPage)).liveTracks).toBe(0)

  const modifier = await orcaPage.evaluate(() =>
    navigator.userAgent.includes('Mac') ? ('Meta' as const) : ('Control' as const)
  )
  await launcher.click({ modifiers: [modifier] })
  const composer = panel.locator('[contenteditable="true"]')
  await expect(composer).toBeVisible()
  await expect(composer).toBeFocused()
  await composer.fill('Unsent text stays while working elsewhere')
  await orcaPage.mouse.click(12, 160)
  await expect(panel).toBeVisible()
  await expect(composer).toHaveText('Unsent text stays while working elsewhere')
  expect((await observeVoiceDevice(orcaPage)).captures).toBe(1)
  await showOrbStage(orcaPage)
  await expect(size).toHaveAttribute('aria-valuenow', '136')
  for (const theme of ['dark', 'light'] as const) {
    await orcaPage.evaluate(async (theme) => {
      await window.__store?.getState().updateSettings({ theme })
    }, theme)
    await stage.getByRole('button', { name: 'Close Orb', exact: true }).hover()
    await expect(stage.locator('.agent-hub-orb-controls')).toHaveCSS('opacity', '1')
    const screenshotPath = testInfo.outputPath(`orb-controls-${theme}.png`)
    await stage.screenshot({ path: screenshotPath })
    await testInfo.attach(`orb-controls-${theme}`, {
      path: screenshotPath,
      contentType: 'image/png'
    })
  }
  await stage.getByRole('button', { name: 'Close Orb', exact: true }).click()
  await expect(panel).toHaveCount(0)

  await pressShortcut(orcaPage, 'Space', { shift: true })
  await revealOrbLiveControls(orcaPage)
  await expect(stage.getByRole('button', { name: 'Mute microphone', exact: true })).toBeEnabled()
  await expect.poll(async () => (await observeVoiceDevice(orcaPage)).captures).toBe(2)
  await expect(size).toHaveAttribute('aria-valuenow', '136')
  expect(
    await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().every((window) => !window.isVisible() && !window.isFocused())
    )
  ).toBe(true)
  await stage.getByRole('button', { name: 'Close Orb', exact: true }).click()
})
