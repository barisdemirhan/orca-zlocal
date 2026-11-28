import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { expect } from '../desktop/electron-fixtures/orca-app'
import {
  configureOrb,
  revealOrbLiveControls,
  showOrbConversation,
  switchOrbToText
} from '../desktop/electron-fixtures/agent-hub-orb-fixture'
import {
  observeVoiceDevice,
  test
} from '../desktop/electron-fixtures/agent-hub-orb-native-voice-fixture'
import { waitForSessionReady } from '../desktop/renderer-probes/store'

test('Orb uses its composer for Live and preserves deferred long answers through the host response', async ({
  orcaPage,
  electronApp,
  seededRepoPath,
  orbCli
}, testInfo) => {
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'statusBar')
  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  await showOrbConversation(orcaPage)
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  const composer = panel.locator('[contenteditable]')
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  await expect(orcaPage.locator('[data-agent-hub-orb-stage]')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Orb options', exact: true })).toHaveCount(0)
  const orb = panel.locator('[data-agent-hub-orb-composer-trigger]')
  await expect(orb).toBeEnabled()
  await expect(panel.getByRole('button', { name: 'Send', exact: true })).not.toBeVisible()
  await composer.fill('   ')
  await composer.press('Enter')
  expect((await observeVoiceDevice(orcaPage)).captures).toBe(0)
  await composer.fill('Unsent text survives an Orb question')
  await expect(panel.getByRole('button', { name: 'Send', exact: true })).toBeVisible()
  await expect
    .poll(() =>
      panel.getByRole('button', { name: 'Send', exact: true }).evaluate((send) => {
        const sphere = document.querySelector('[data-agent-hub-orb-composer-trigger]')
        return Boolean(
          sphere && sphere.getBoundingClientRect().right <= send.getBoundingClientRect().left
        )
      })
    )
    .toBe(true)
  await orb.click()
  await expect.poll(async () => (await observeVoiceDevice(orcaPage)).connectedPeers).toBe(1)
  await orb.click()
  expect((await observeVoiceDevice(orcaPage)).connectedPeers).toBe(1)
  await revealOrbLiveControls(orcaPage)
  await orcaPage.getByRole('button', { name: 'Mute Orb', exact: true }).click()
  await orcaPage.getByRole('button', { name: 'Mute microphone', exact: true }).click()
  await expect(orb.locator('[data-output-muted]')).toHaveAttribute('data-output-muted', 'true')
  await expect(orb.locator('[data-input-muted]')).toHaveAttribute('data-input-muted', 'true')
  const transcript = panel.locator('[data-agent-hub-orb-chat-tab-id]')
  const before = await transcript.boundingBox()
  orbCli.askVoiceQuestion()
  const modal = orcaPage.locator('[data-agent-hub-orb-request-modal]')
  await expect(modal.getByText('Which measurement period?', { exact: true })).toBeVisible()
  const after = await transcript.boundingBox()
  expect(after?.height).toBe(before?.height)
  await modal.getByRole('button', { name: /Monthly/ }).click()
  await expect(modal.getByText('Describe the measurement in detail', { exact: true })).toBeVisible()
  const long = 'Monthly measurements include the same models and period.\n'.repeat(25)
  const answer = modal.getByRole('textbox')
  await answer.fill(long)
  await modal.getByRole('button', { name: 'Answer later', exact: true }).click()
  await expect(modal).toHaveCount(0)
  expect((await observeVoiceDevice(orcaPage)).connectedPeers).toBe(1)
  await switchOrbToText(orcaPage)
  await expect(composer).toBeEditable()
  await expect(composer).toHaveText('Unsent text survives an Orb question')
  await panel.getByRole('button', { name: 'Waiting for your answer', exact: true }).click()
  await expect(answer).toHaveValue(long)
  await orcaPage.setViewportSize({ width: 390, height: 700 })
  const bounds = await modal.boundingBox()
  const answerBounds = await answer.boundingBox()
  expect(answerBounds?.height).toBeGreaterThan(140)
  expect(answerBounds?.width).toBeGreaterThan((bounds?.width ?? 0) - 100)
  expect(bounds?.x).toBeGreaterThanOrEqual(0)
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390)
  await testInfo.attach('orb-question-modal-narrow', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })
  await modal.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(
    modal.getByText('Which source should be checked first?', { exact: true })
  ).toBeVisible()
  await modal.getByRole('button', { name: /Source 10$/ }).click()
  await expect(modal).toHaveCount(0)
  await expect(panel.getByText('Native question response received', { exact: true })).toBeVisible()
  await expect(
    orcaPage.locator(
      '[data-agent-hub-orb-request-receipt], [data-agent-hub-orb-modal-request-host] [data-native-chat-receipt], [data-agent-hub-orb-request-host] [data-native-chat-receipt]'
    )
  ).toHaveCount(0)
  await expect(composer).toHaveText('Unsent text survives an Orb question')
  const replies: { id?: string; result?: { answers?: Record<string, { answers: string[] }> } }[] =
    readFileSync(orbCli.ledger, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
  expect(replies.filter((reply) => reply.id === 'orb-modal-question')).toEqual([
    {
      id: 'orb-modal-question',
      result: {
        answers: {
          period: { answers: ['Monthly'] },
          details: { answers: [long.trim()] },
          sources: { answers: ['Source 10'] }
        }
      }
    }
  ])
  expect(
    await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().every((window) => !window.isVisible() && !window.isFocused())
    )
  ).toBe(true)
  await testInfo.attach('orb-composer-after-answer', {
    body: await panel.screenshot(),
    contentType: 'image/png'
  })
})

test('Orb chat links open a visible Peek and reserve their modifier hint for that action', async ({
  orcaPage,
  electronApp,
  seededRepoPath
}, testInfo) => {
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html')
    response.end('<!doctype html><title>Orb Peek fixture</title><p>Orb Peek page loaded</p>')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Missing local Peek server port')
    }
    const url = `http://127.0.0.1:${address.port}/orb-preview`
    await waitForSessionReady(orcaPage)
    await configureOrb(orcaPage, seededRepoPath, 'statusBar')
    await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
    await showOrbConversation(orcaPage)
    const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
    await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
    await panel.locator('[contenteditable]').fill(`Orb lifecycle [Orb preview](${url})`)
    await panel.getByRole('button', { name: 'Send', exact: true }).click()
    const link = panel.getByRole('link', { name: 'Orb preview', exact: true }).last()
    await expect(link).toBeVisible()
    await link.click()
    const peek = orcaPage.getByRole('button', { name: /Peek.*Click/ })
    await expect(peek).toBeVisible()
    await expect(orcaPage.getByRole('button', { name: /^Orca Browser/ })).not.toContainText('Click')
    await peek.click()
    const preview = orcaPage.locator('[data-agent-hub-peek="web"]')
    await expect(preview).toBeVisible()
    await expect
      .poll(() =>
        electronApp.evaluate(async ({ webContents }, url) => {
          const page = webContents.getAllWebContents().find((content) => content.getURL() === url)
          return page ? page.executeJavaScript('document.body.innerText') : ''
        }, url)
      )
      .toContain('Orb Peek page loaded')
    const layer = await preview.evaluate((element) => {
      const orb = document.querySelector('[data-agent-hub-orb-panel]')
      return {
        peek: Number(getComputedStyle(element).zIndex),
        orb: orb ? Number(getComputedStyle(orb).zIndex) : 0
      }
    })
    expect(layer.peek).toBeGreaterThan(layer.orb)
    await testInfo.attach('orb-chat-peek', {
      body: await orcaPage.screenshot(),
      contentType: 'image/png'
    })
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})
