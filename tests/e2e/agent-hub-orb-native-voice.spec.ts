import { readFileSync } from 'node:fs'
import { expect } from './helpers/orca-app'
import {
  configureOrb,
  revealOrbLiveControls,
  showOrbConversation,
  switchOrbToText
} from './helpers/agent-hub-orb-fixture'
import { observeVoiceDevice, test } from './helpers/agent-hub-orb-native-voice-fixture'
import { waitForSessionReady } from './helpers/store'

type CodexRequest = {
  method: string
  params: {
    threadId?: string
    transport?: { type: string }
    input?: { text?: string }[]
  }
}

function readRequests(ledger: string): CodexRequest[] {
  return readFileSync(ledger, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
}

test('native Live keeps one conversation, restores its draft and ignores late media after stopping', async ({
  orcaPage,
  electronApp,
  seededRepoPath,
  orbCli
}, testInfo) => {
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'statusBar')
  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await showOrbConversation(orcaPage)
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  const composer = panel.locator('[contenteditable]')
  await composer.fill('Preserved draft before native Live')
  const start = panel.locator('[data-agent-hub-orb-composer-trigger]')
  await expect(start).toBeEnabled()
  const environment = await orcaPage.evaluate(() => ({
    secureContext: window.isSecureContext,
    protocol: window.location.protocol,
    webLocks: typeof navigator.locks?.request === 'function'
  }))
  expect(environment.secureContext).toBe(true)
  expect(environment.webLocks).toBe(true)
  expect(
    await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().some((window) => window.isVisible())
    )
  ).toBe(false)
  await testInfo.attach('native-voice-renderer-environment', {
    body: JSON.stringify(environment, null, 2),
    contentType: 'application/json'
  })
  expect(await observeVoiceDevice(orcaPage)).toMatchObject({
    captures: 0,
    liveTracks: 0,
    connectedPeers: 0,
    playbackStarts: 0
  })
  await start.click()
  await revealOrbLiveControls(orcaPage)
  const mute = orcaPage.getByRole('button', { name: 'Mute microphone', exact: true })
  await expect(mute).toBeEnabled()
  await expect(orcaPage.getByRole('button', { name: 'End live voice', exact: true })).toBeVisible()
  await expect(composer).toBeVisible()
  await expect(composer).toHaveAttribute('contenteditable', 'false')
  expect(await observeVoiceDevice(orcaPage)).toMatchObject({
    captures: 1,
    liveTracks: 1,
    enabledTracks: 1,
    connectedPeers: 1
  })
  orbCli.emitVoiceItem('Native spoken question', 'user')
  await mute.click()
  const unmute = orcaPage.getByRole('button', { name: 'Unmute microphone', exact: true })
  await expect(unmute).toBeVisible()
  expect(await observeVoiceDevice(orcaPage)).toMatchObject({ enabledTracks: 0, connectedPeers: 1 })
  await unmute.click()
  await expect(mute).toBeVisible()
  orbCli.emitVoiceItem('Native spoken answer', 'assistant')
  await switchOrbToText(orcaPage)
  await expect(composer).toBeVisible()
  await expect(composer).toHaveText('Preserved draft before native Live')
  await expect(panel.getByText('Native spoken question', { exact: true })).toHaveCount(1)
  await expect(panel.getByText('Native spoken answer', { exact: true })).toHaveCount(1)
  expect(await observeVoiceDevice(orcaPage)).toMatchObject({ liveTracks: 0, connectedPeers: 0 })

  orbCli.emitLateVoiceEvents()
  await expect(panel.getByText('Late canonical voice reply', { exact: true })).toHaveCount(1)
  await expect(composer).toHaveText('Preserved draft before native Live')
  await expect(orcaPage.getByRole('button', { name: 'End live voice', exact: true })).toHaveCount(0)
  expect(await observeVoiceDevice(orcaPage)).toMatchObject({
    captures: 1,
    liveTracks: 0,
    connectedPeers: 0
  })
  await composer.fill('Orb lifecycle typed after native Live')
  await panel.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(
    panel.getByText('Reply: Orb lifecycle typed after native Live', { exact: true })
  ).toBeVisible()

  const requests = readRequests(orbCli.ledger)
  const live = requests.filter((request) => request.method === 'thread/realtime/start')
  const turns = requests.filter((request) => request.method === 'turn/start')
  expect(live).toHaveLength(1)
  expect(live[0].params.transport?.type).toBe('webrtc')
  expect(turns).toHaveLength(2)
  expect(turns.every((request) => request.params.threadId === live[0].params.threadId)).toBe(true)
  expect(requests.filter((request) => request.method === 'thread/start')).toHaveLength(1)
  expect(requests.filter((request) => request.method === 'thread/realtime/stop')).toHaveLength(1)
  expect(
    turns
      .flatMap((request) => request.params.input ?? [])
      .some((item) => item.text === 'Native spoken question')
  ).toBe(false)
  await testInfo.attach('native-voice-conversation-after-stop', {
    body: await panel.screenshot(),
    contentType: 'image/png'
  })
  await testInfo.attach('synthetic-native-voice-protocol', {
    path: orbCli.ledger,
    contentType: 'application/x-ndjson'
  })
})

test('a microphone denial leaves the same conversation and draft available for text', async ({
  orcaPage,
  seededRepoPath,
  orbCli
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'statusBar')
  await orcaPage.getByRole('button', { name: /^Talk to Orb/ }).click()
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await showOrbConversation(orcaPage)
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  const composer = panel.locator('[contenteditable]')
  await composer.fill('Draft survives denied microphone')
  await orcaPage.evaluate(() => {
    if (!window.__orcaNativeVoiceDevice) {
      throw new Error('Voice device fixture is missing')
    }
    window.__orcaNativeVoiceDevice.denyMicrophone = true
  })
  const start = panel.locator('[data-agent-hub-orb-composer-trigger]')
  await expect(start).toBeEnabled()
  await start.click()
  await expect(
    panel.getByRole('status').filter({ hasText: /microphone|permission/i })
  ).toContainText(/microphone|permission/i)
  await expect(composer).toBeEditable()
  await expect(composer).toHaveText('Draft survives denied microphone')
  await composer.fill('Orb lifecycle after microphone denial')
  await panel.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(
    panel.getByText('Reply: Orb lifecycle after microphone denial', { exact: true })
  ).toBeVisible()
  expect(await observeVoiceDevice(orcaPage)).toMatchObject({
    captures: 1,
    liveTracks: 0,
    connectedPeers: 0,
    playbackStarts: 0
  })
  const requests = readRequests(orbCli.ledger)
  expect(requests.filter((request) => request.method === 'thread/realtime/start')).toHaveLength(0)
  expect(requests.filter((request) => request.method === 'thread/start')).toHaveLength(1)
  await testInfo.attach('native-voice-microphone-denied', {
    body: await panel.screenshot(),
    contentType: 'image/png'
  })
})

test('minimizing keeps Live connected while hiding stops media without cancelling the running agent', async ({
  orcaPage,
  seededRepoPath,
  orbCli
}, testInfo) => {
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  await configureOrb(orcaPage, seededRepoPath, 'dock')
  await orcaPage.evaluate(async () => {
    await window.__store?.getState().updateSettings({ agentHubDockAutoHide: false })
  })
  const talk = orcaPage.getByRole('button', { name: /^Talk to Orb/ })
  await talk.click()
  const panel = orcaPage.locator('[data-agent-hub-orb-panel]')
  await showOrbConversation(orcaPage)
  await expect(panel.getByText('Orb fixture ready', { exact: true })).toBeVisible()
  const composer = panel.locator('[contenteditable]')
  await composer.fill('Orb lifecycle geometry control')
  await panel.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Stop the agent', exact: true })).toBeVisible()
  await composer.fill('Draft survives hiding live Orb')
  try {
    const start = panel.locator('[data-agent-hub-orb-composer-trigger]')
    await expect(start).toBeEnabled()
    await start.click()
    await revealOrbLiveControls(orcaPage)
    await expect(
      orcaPage.getByRole('button', { name: 'Mute microphone', exact: true })
    ).toBeEnabled()
    await panel.getByRole('button', { name: 'Minimize Orb', exact: true }).click()
    const stage = orcaPage.locator('[data-agent-hub-orb-stage]')
    await expect(stage).toHaveAttribute('data-compact', 'true')
    await expect(
      panel.getByRole('button', { name: 'Past conversations', exact: true, includeHidden: true })
    ).not.toBeVisible()
    await expect(
      panel.getByRole('button', { name: 'Close', exact: true, includeHidden: true })
    ).not.toBeVisible()
    await revealOrbLiveControls(orcaPage)
    await expect(stage.getByRole('button', { name: 'End live voice', exact: true })).toBeVisible()
    expect(await observeVoiceDevice(orcaPage)).toMatchObject({
      captures: 1,
      liveTracks: 1,
      connectedPeers: 1
    })
    await testInfo.attach('native-live-visible-compact-orb', {
      body: await orcaPage.screenshot(),
      contentType: 'image/png'
    })
    await talk.click()
    await expect(panel).toHaveCount(0)
    expect(await observeVoiceDevice(orcaPage)).toMatchObject({ liveTracks: 0, connectedPeers: 0 })
    await talk.click()
    await showOrbConversation(orcaPage)
    await expect(composer).toHaveText('Draft survives hiding live Orb')
    await expect(panel.getByRole('button', { name: 'Stop the agent', exact: true })).toBeVisible()
    await expect(orcaPage.getByRole('button', { name: 'End live voice', exact: true })).toHaveCount(
      0
    )
    expect(await observeVoiceDevice(orcaPage)).toMatchObject({
      captures: 1,
      liveTracks: 0,
      connectedPeers: 0
    })
    await expect
      .poll(
        () =>
          readRequests(orbCli.ledger).filter((request) => request.method === 'thread/realtime/stop')
            .length
      )
      .toBe(1)
    const requests = readRequests(orbCli.ledger)
    expect(requests.filter((request) => request.method === 'turn/interrupt')).toHaveLength(0)
  } finally {
    orbCli.completeTurn()
  }
})
