import type { Page } from '@stablyai/playwright-test'
import { expect } from '../desktop/electron-fixtures/orca-app'
import {
  configureOrb,
  showOrbConversation,
  test
} from '../desktop/electron-fixtures/agent-hub-orb-fixture'
import { waitForSessionReady } from '../desktop/renderer-probes/store'

async function waitForOrbDockAnchor(page: Page) {
  const dock = page.locator('[data-agent-hub-dock]')
  let previous = await dock.boundingBox()
  let stable = 0
  await expect
    .poll(
      async () => {
        const current = await dock.boundingBox()
        const prior = previous
        const delta =
          prior && current
            ? Math.max(
                ...(['x', 'y', 'width', 'height'] as const).map((axis) =>
                  Math.abs(current[axis] - prior[axis])
                )
              )
            : Infinity
        previous = current
        stable = delta <= 1 ? stable + 1 : 0
        return stable
      },
      { timeout: 10_000, intervals: [100] }
    )
    .toBeGreaterThanOrEqual(3)
}

async function measureOrbPillFrames(page: Page) {
  return page.locator('[data-agent-hub-orb-pill="working"]').evaluate(async (pill) => {
    const frames: {
      x: number
      y: number
      width: number
      height: number
      viewportWidth: number
      viewportHeight: number
    }[] = []
    for (let index = 0; index < 5; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const rect = pill.getBoundingClientRect()
      frames.push({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      })
    }
    return frames
  })
}

function expectOrbPillFrames(
  frames: Awaited<ReturnType<typeof measureOrbPillFrames>>,
  label: string
) {
  for (const axis of ['x', 'y', 'width'] as const) {
    const values = frames.map((frame) => frame[axis])
    expect
      .soft(Math.max(...values) - Math.min(...values), `${label} ${axis} jitter`)
      .toBeLessThanOrEqual(1)
  }
  for (const frame of frames) {
    expect.soft(frame.width, `${label} width`).toBeGreaterThan(0)
    expect.soft(frame.height, `${label} height`).toBeGreaterThan(0)
    expect.soft(frame.x, `${label} left`).toBeGreaterThanOrEqual(0)
    expect.soft(frame.y, `${label} top`).toBeGreaterThanOrEqual(0)
    expect.soft(frame.x + frame.width, `${label} right`).toBeLessThanOrEqual(frame.viewportWidth)
    expect.soft(frame.y + frame.height, `${label} bottom`).toBeLessThanOrEqual(frame.viewportHeight)
  }
}

test('Orb keeps its running conversation and draft while its pill geometry stays stable', async ({
  orcaPage,
  electronApp,
  seededRepoPath,
  orbCli
}, testInfo) => {
  test.setTimeout(240_000)
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'dock')
  await orcaPage.evaluate(async () => {
    await window.__store?.getState().updateSettings({
      agentHubPlacement: 'dock',
      agentHubDockAutoHide: false,
      agentHubDockPosition: { edge: 'bottom', offset: 0.5 }
    })
  })
  const dock = orcaPage.locator('[data-agent-hub-dock]')
  const talk = dock.getByRole('button', { name: /^Talk to Orb/ })
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await talk.click()
  await showOrbConversation(orcaPage)
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  const composer = panel.locator('[contenteditable="true"]')
  const destination = panel.locator('[data-agent-hub-orb-chat-tab-id]')
  const chatTabId = await destination.getAttribute('data-agent-hub-orb-chat-tab-id')
  expect(chatTabId).toBeTruthy()
  await composer.fill('Orb lifecycle geometry control')
  await panel.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Stop the agent', exact: true })).toBeVisible()
  await composer.fill('Unsent draft during the running turn')
  await talk.click()
  await expect(panel).toHaveCount(0)
  const pill = orcaPage.locator('[data-agent-hub-orb-pill="working"]')
  await expect(pill).toContainText('pwd')
  await talk.click()
  await showOrbConversation(orcaPage)
  await expect(destination).toHaveAttribute('data-agent-hub-orb-chat-tab-id', chatTabId ?? '')
  await expect(composer).toHaveText('Unsent draft during the running turn')
  await expect(panel.getByRole('button', { name: 'Stop the agent', exact: true })).toBeVisible()
  await talk.click()
  await expect(panel).toHaveCount(0)

  const longCommand =
    'node scripts/verify-orb-command-layout-with-long-workspace-and-cross-platform-paths.mjs'
  const measurements: {
    label: string
    short: Awaited<ReturnType<typeof measureOrbPillFrames>>
    long: Awaited<ReturnType<typeof measureOrbPillFrames>>
  }[] = []
  try {
    for (const viewport of [
      { width: 1200, zoom: 1 },
      { width: 640, zoom: 1.25 }
    ]) {
      await electronApp.evaluate(({ BrowserWindow }, zoom) => {
        BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(zoom)
      }, viewport.zoom)
      await orcaPage.setViewportSize({ width: viewport.width, height: 900 })
      for (const edge of ['bottom', 'top', 'left', 'right'] as const) {
        await orcaPage.evaluate(async (edge) => {
          await window.__store?.getState().updateSettings({
            agentHubDockPosition: { edge, offset: 0.5 }
          })
        }, edge)
        await orcaPage.mouse.move(100, 120)
        await expect(dock).toHaveAttribute('data-edge', edge)
        await expect(dock).toHaveAttribute('data-expanded', 'false')
        await waitForOrbDockAnchor(orcaPage)
        orbCli.setCommand('pwd')
        await expect(pill).toHaveText('Working · pwd')
        await expect(pill).toBeVisible()
        const short = await measureOrbPillFrames(orcaPage)
        orbCli.setCommand(longCommand)
        await expect(pill).toContainText(longCommand.slice(0, 60))
        const long = await measureOrbPillFrames(orcaPage)
        const label = `${edge} ${viewport.width}px zoom ${viewport.zoom}`
        measurements.push({ label, short, long })
        expectOrbPillFrames(short, `${label} short`)
        expectOrbPillFrames(long, `${label} long`)
        for (const axis of ['x', 'y', 'width'] as const) {
          expect
            .soft(Math.abs(long[0][axis] - short[0][axis]), `${label} ${axis} changed with command`)
            .toBeLessThanOrEqual(1)
        }
      }
    }
    await testInfo.attach('orb-working-pill', {
      body: await orcaPage.screenshot(),
      contentType: 'image/png'
    })
  } finally {
    orbCli.completeTurn()
    await testInfo.attach('orb-pill-geometry', {
      body: JSON.stringify({ framesPerCommand: 5, maximumJitterPixels: 1, measurements }, null, 2),
      contentType: 'application/json'
    })
  }
  await talk.click()
  await showOrbConversation(orcaPage)
  await expect(destination).toHaveAttribute('data-agent-hub-orb-chat-tab-id', chatTabId ?? '')
  await expect(
    panel.getByText('Reply: Orb lifecycle geometry control', { exact: true })
  ).toBeVisible()
  await expect(composer).toHaveText('Unsent draft during the running turn')
  await expect(panel.getByRole('button', { name: 'Stop the agent', exact: true })).toHaveCount(0)
})
