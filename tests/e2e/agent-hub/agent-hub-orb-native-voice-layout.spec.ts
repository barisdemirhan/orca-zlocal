import { readFileSync } from 'node:fs'
import type { Locator, Page } from '@stablyai/playwright-test'
import { expect } from '../desktop/electron-fixtures/orca-app'
import {
  configureOrb,
  revealOrbLiveControls,
  showOrbConversation,
  showOrbStage,
  switchOrbToText
} from '../desktop/electron-fixtures/agent-hub-orb-fixture'
import { test } from '../desktop/electron-fixtures/agent-hub-orb-native-voice-fixture'
import { waitForSessionReady } from '../desktop/renderer-probes/store'

async function dragOrbTo(page: Page, stage: Locator, x: number, y: number): Promise<void> {
  const [shell, art] = await Promise.all([
    stage.boundingBox(),
    stage.getByRole('img').boundingBox()
  ])
  if (!shell || !art) {
    throw new Error('Orb drag target has no rendered bounds')
  }
  const startX = art.x + art.width / 2
  const startY = art.y + art.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + x - shell.x, startY + y - shell.y, { steps: 12 })
  await page.mouse.up()
}

async function expectRequestFits(stage: Locator): Promise<void> {
  const bounds = await stage.evaluate((element) => {
    const card = element.querySelector('[data-agent-hub-orb-request-host]')?.getBoundingClientRect()
    const controls = element.querySelector('[data-agent-hub-orb-controls]')?.getBoundingClientRect()
    if (!card || !controls) {
      throw new Error('Orb request or controls are missing')
    }
    return {
      card: card.toJSON(),
      controls: controls.toJSON(),
      width: window.innerWidth,
      height: window.innerHeight
    }
  })
  expect(bounds.card.left).toBeGreaterThanOrEqual(0)
  expect(bounds.card.top).toBeGreaterThanOrEqual(0)
  expect(bounds.card.right).toBeLessThanOrEqual(bounds.width)
  expect(bounds.card.bottom).toBeLessThanOrEqual(bounds.height)
  expect(
    bounds.card.right <= bounds.controls.left ||
      bounds.card.left >= bounds.controls.right ||
      bounds.card.bottom <= bounds.controls.top ||
      bounds.card.top >= bounds.controls.bottom
  ).toBe(true)
}

test('Orb resizes by pointer and keyboard without losing its draft, including reduced motion', async ({
  orcaPage,
  seededRepoPath
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'floating')
  await orcaPage.emulateMedia({ reducedMotion: 'reduce' })
  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await showOrbConversation(orcaPage)
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  const composer = panel.locator('[contenteditable="true"]')
  await composer.fill('Draft survives visual resize')
  await showOrbStage(orcaPage)
  const stage = orcaPage.locator('[data-agent-hub-orb-stage]')
  const size = stage.getByRole('slider', { name: 'Orb size', exact: true })
  await expect(size).toBeVisible()
  const minimum = Number(await size.getAttribute('aria-valuemin'))
  const maximum = Number(await size.getAttribute('aria-valuemax'))
  expect(minimum).toBeGreaterThan(0)
  expect(maximum).toBeGreaterThan(minimum + 32)
  await size.press('Home')
  await expect(size).toHaveAttribute('aria-valuenow', String(minimum))
  await size.press('ArrowRight')
  await expect(size).toHaveAttribute('aria-valuenow', String(minimum + 8))
  await size.press('Shift+ArrowRight')
  await expect(size).toHaveAttribute('aria-valuenow', String(minimum + 32))
  await size.press('End')
  await expect(size).toHaveAttribute('aria-valuenow', String(maximum))
  await size.press('Home')
  const handle = await size.boundingBox()
  if (!handle) {
    throw new Error('Orb size handle has no rendered bounds')
  }
  await orcaPage.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await orcaPage.mouse.down()
  await orcaPage.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2 + 40, {
    steps: 6
  })
  await expect
    .poll(async () => Number(await size.getAttribute('aria-valuenow')))
    .toBeGreaterThan(minimum)
  await size.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' })
  await orcaPage.mouse.up()
  await expect(size).toHaveAttribute('aria-valuenow', String(minimum))
  await expect
    .poll(() =>
      stage.evaluate(
        (element) =>
          element.getAnimations({ subtree: true }).filter((animation) => {
            const duration = animation.effect?.getTiming().duration
            return (
              animation.playState === 'running' && typeof duration === 'number' && duration >= 500
            )
          }).length
      )
    )
    .toBe(0)
  // The Orb stays alive under Reduce Motion: its canvas keeps repainting.
  const sphere = stage.getByRole('img')
  const canvasFrame = () =>
    sphere.locator('canvas').evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error('Orb has no canvas')
      }
      return canvas.toDataURL()
    })
  const beforeMotion = await canvasFrame()
  await expect.poll(canvasFrame).not.toEqual(beforeMotion)
  await testInfo.attach('native-orb-resize-reduced-motion', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })
  await orcaPage.getByRole('radio', { name: 'Start live voice', exact: true }).click()
  await expect(sphere).toHaveAttribute('data-agent-hub-orb-phase', 'listening')
  const liveFrame = await canvasFrame()
  await expect.poll(canvasFrame).not.toEqual(liveFrame)
  await testInfo.attach('native-orb-continuous-live-motion', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })
  await orcaPage.getByRole('radio', { name: 'Switch to text', exact: true }).click()
  await expect(composer).toBeVisible()
  await expect(composer).toHaveText('Draft survives visual resize')
})

test('native approval follows the Orb on all four sides and remains answerable in a narrow viewport', async ({
  orcaPage,
  seededRepoPath,
  orbCli
}, testInfo) => {
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  await orcaPage.setViewportSize({ width: 1200, height: 1000 })
  await configureOrb(orcaPage, seededRepoPath, 'floating')
  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await showOrbConversation(orcaPage)
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  await showOrbStage(orcaPage)
  await orcaPage.getByRole('radio', { name: 'Start live voice', exact: true }).click()
  await revealOrbLiveControls(orcaPage)
  await expect(orcaPage.getByRole('button', { name: 'Mute microphone', exact: true })).toBeEnabled()
  const stage = orcaPage.locator('[data-agent-hub-orb-stage]')
  const size = stage.getByRole('slider', { name: 'Orb size', exact: true })
  await size.press('Home')
  orbCli.askVoiceApproval()
  const card = stage.locator('[data-agent-hub-orb-request-host]')
  const allow = card.getByRole('button', { name: 'Allow', exact: true })
  await expect(allow).toBeVisible()
  for (const position of [
    { side: 'right', x: 30, y: 360 },
    { side: 'left', x: 900, y: 360 },
    { side: 'bottom', x: 450, y: 80 },
    { side: 'top', x: 450, y: 700 }
  ]) {
    await dragOrbTo(orcaPage, stage, position.x, position.y)
    await expect(card).toHaveAttribute('data-side', position.side)
    await expectRequestFits(stage)
  }
  await orcaPage.setViewportSize({ width: 390, height: 600 })
  await expect(allow).toBeVisible()
  await expect
    .poll(async () => {
      await expectRequestFits(stage)
      return true
    })
    .toBe(true)
  await testInfo.attach('native-approval-narrow-orb', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })
  await allow.click()
  await expect(allow).toHaveCount(0)
  const receipt = card.locator('[data-native-chat-receipt="approval"]')
  await expect(receipt).toHaveCount(0)
  await switchOrbToText(orcaPage)
  await expect(panel.getByText('Native approval response received', { exact: true })).toHaveCount(1)
  const responses: { id?: string; result?: { decision?: string } }[] = readFileSync(
    orbCli.ledger,
    'utf8'
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  expect(responses.filter((response) => response.id === 'voice-layout-approval')).toEqual([
    { id: 'voice-layout-approval', result: { decision: 'accept' } }
  ])
})
