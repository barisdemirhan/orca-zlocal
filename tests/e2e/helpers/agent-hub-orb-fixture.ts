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
      await window.__store?.getState().updateSettings({
        uiLanguage: 'en',
        theme: 'dark',
        experimentalAgentHub: true,
        agentHubAgentControl: true,
        agentHubAlertSound: false,
        agentHubOrbAgent: 'codex',
        agentHubOrbModel: model,
        agentHubOrbPermission: 'ask',
        agentHubOrbPlacement: placement,
        agentHubOrbPosition: { x: Math.round(window.innerWidth * 0.65), y: 220 },
        floatingTerminalCwd: cwd
      })
    },
    { cwd, placement, model }
  )
}

export async function showOrbConversation(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: /^(Show conversation|Orb view)$/ })).toBeVisible()
  const conversation = page.getByRole('button', { name: 'Show conversation', exact: true })
  if (await conversation.isVisible()) {
    await conversation.click()
  }
  await expect(page.getByRole('button', { name: 'Orb view', exact: true })).toBeVisible()
}

export async function switchOrbToText(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Orb options', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Switch to text', exact: true }).click()
}
