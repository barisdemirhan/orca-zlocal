import path from 'node:path'
import { existsSync } from 'node:fs'
import type { Page } from '@stablyai/playwright-test'
import { expect, test as base } from './orca-app'
import { createAgentHubOrbCli } from './agent-hub-orb-cli'

export const test = base.extend<{ orbCli: ReturnType<typeof createAgentHubOrbCli> }>({
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
      NODE_ENV: 'test',
      PATH: `${orbCli.directory}${path.delimiter}${process.env.PATH ?? ''}`,
      ORCA_E2E_ORB_CLI_LEDGER: orbCli.ledger,
      ORCA_E2E_ORB_CLI_CONTROL: orbCli.control,
      ORCA_E2E_ORB_CLI_AVAILABILITY: orbCli.availability,
      ORCA_E2E_ORB_CLI_REALTIME_CONTROL: orbCli.realtimeControl,
      OPENAI_API_KEY: '',
      CODEX_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      CLAUDE_CODE_OAUTH_TOKEN: ''
    })
  }
})

export async function configureOrb(
  page: Page,
  cwd: string,
  placement: 'floating' | 'statusBar' | 'dock',
  model = 'orb-e2e-a'
) {
  await page.evaluate(
    async ({ cwd, placement, model }) => {
      await window.api.starNag.disable()
      await window.__store?.getState().updateSettings({
        uiLanguage: 'en',
        theme: 'dark',
        experimentalAgentHub: true,
        agentHubAgentControl: true,
        agentHubAlertSound: false,
        agentHubOrbAgent: 'codex',
        agentHubOrbModel: model,
        agentHubOrbPermission: 'ask',
        agentHubOrbDefaultAction: 'text',
        agentHubOrbAlternateAction: 'text',
        agentHubOrbPlacement: placement,
        agentHubOrbPosition: { x: Math.round(window.innerWidth * 0.65), y: 220 },
        floatingTerminalCwd: cwd
      })
    },
    { cwd, placement, model }
  )
}

export async function showOrbConversation(page: Page): Promise<void> {
  const chat = page.locator('[data-agent-hub-orb-chat-tab-id]')
  await expect(
    page.locator('[data-agent-hub-orb-stage]:visible, [data-agent-hub-orb-chat-tab-id]:visible')
  ).toBeVisible()
  if (!(await chat.isVisible())) {
    const conversation = page.getByRole('button', { name: 'Show conversation', exact: true })
    await ((await conversation.isVisible()) ? conversation.click() : switchOrbToText(page))
  }
  await expect(chat).toBeVisible()
}

export async function switchOrbToText(page: Page): Promise<void> {
  const text = page.getByRole('radio', { name: 'Switch to text', exact: true })
  if (await text.isVisible()) {
    await text.click()
  } else {
    const orb = page.locator('[data-agent-hub-orb-composer-trigger]')
    if (await orb.isVisible()) {
      await orb.hover()
      const stop = page.getByRole('button', { name: 'End live voice', exact: true })
      if (await stop.isVisible()) {
        await stop.click()
      }
    }
  }
  await expect(page.locator('[data-agent-hub-orb-chat-tab-id]')).toBeVisible()
}

export async function showOrbStage(page: Page): Promise<void> {
  const stage = page.locator('[data-agent-hub-orb-stage]')
  if (!(await stage.isVisible())) {
    await page.getByRole('button', { name: 'Minimize Orb', exact: true }).click()
  }
  const expand = stage.getByRole('button', { name: 'Expand Orb', exact: true })
  if (await expand.isVisible()) {
    await expand.click()
  }
  await expect(stage).toBeVisible()
}

export async function revealOrbLiveControls(page: Page): Promise<void> {
  const orb = page.locator('[data-agent-hub-orb-composer-trigger]')
  await ((await orb.isVisible())
    ? orb.hover()
    : page.locator('[data-agent-hub-orb-stage] .agent-hub-orb-art').hover())
  const stop = page.getByRole('button', { name: 'End live voice', exact: true })
  await expect(stop).toHaveCount(1)
  await expect(stop).toBeVisible()
}
