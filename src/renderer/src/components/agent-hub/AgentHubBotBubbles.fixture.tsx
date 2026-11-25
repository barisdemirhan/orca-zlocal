import { defineFixture } from '../../component-fixtures/component-fixture'
import { fixtureCos } from '../../component-fixtures/fixture-bot-panel'
import { Button } from '@/components/ui/button'
import { AgentHubBotAskView } from './AgentHubBotAskView'
import {
  AgentHubBotAccessBody,
  AgentHubBotRunsBody,
  AgentHubBotSignInBody
} from './AgentHubBotBubbleBodies'
import { AgentHubBotMoreChip, AgentHubBotPendingChip } from './AgentHubBotPendingChips'
import { AgentHubBotSpeechBubble } from './AgentHubBotSpeechBubble'
import type { AgentHubBotAskModel } from './use-agent-hub-bot-ask-steps'
import type { BotConnectorEntry } from '../bots/bot-connector-entries'

const no = (): void => {}
const at = Date.now() - 2 * 60_000
const bot = { ...fixtureCos, name: 'Scotty' }

const ask: AgentHubBotAskModel = {
  phase: 'open',
  waiting: true,
  number: 7,
  title: 'Migration needs your call',
  total: 1,
  folded: [],
  openKey: 'q0',
  question: 'Which environment should the migration run on first?',
  replies: [
    { label: 'Staging', recommended: true },
    { label: 'Production', recommended: false }
  ],
  multi: false,
  held: null,
  nav: null,
  answeredCount: 0,
  heldCount: 0,
  step: no,
  reopen: no,
  pick: no,
  reply: no,
  sendHeld: no,
  retry: no
}

const github: BotConnectorEntry = {
  kind: 'github',
  key: 'github:w1',
  title: { service: 'GitHub', name: null },
  needsOwner: true
}

const run = (failed: boolean, name = 'Nightly PR sweep') => ({
  runId: `r-${name}`,
  automationId: 'a1',
  name,
  sessionId: 's1',
  failed
})

const frame = { bot, at, hostLabel: null, alertKey: 'fixture', onDismiss: no, reduceMotion: true }

function Stage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex flex-col gap-4 bg-background p-4">{children}</div>
}

export const all = defineFixture({
  width: 460,
  render: () => (
    <Stage>
      <AgentHubBotSpeechBubble {...frame} tone="ask" headline="asks you" from="Home chat · #7">
        <AgentHubBotAskView
          ask={ask}
          variant="plain"
          actions={
            <>
              <Button size="xs" variant="ghost" onClick={no}>
                Later
              </Button>
              <Button size="xs" variant="ghost" onClick={no}>
                Open #7
              </Button>
            </>
          }
        />
      </AgentHubBotSpeechBubble>
      <AgentHubBotSpeechBubble {...frame} tone="result" headline="finished" from="Nightly PR sweep">
        <AgentHubBotRunsBody bot={bot} subject={{ type: 'runs', runs: [run(false)] }} />
      </AgentHubBotSpeechBubble>
      <AgentHubBotSpeechBubble
        {...frame}
        tone="failure"
        headline="could not finish"
        from="Nightly PR sweep"
      >
        <AgentHubBotRunsBody bot={bot} subject={{ type: 'runs', runs: [run(true)] }} />
      </AgentHubBotSpeechBubble>
      <AgentHubBotSpeechBubble {...frame} tone="ask" headline="3 updates" from={null}>
        <AgentHubBotAskView ask={ask} variant="plain" />
        <Button size="xs" variant="outline" className="self-start" onClick={no}>
          Open in Inbox
        </Button>
      </AgentHubBotSpeechBubble>
      <AgentHubBotSpeechBubble {...frame} tone="ask" headline="asks you" from="GitHub">
        <AgentHubBotSignInBody
          bot={bot}
          subject={{ type: 'signin', key: 'github:w1', connector: github }}
          onLater={no}
        />
      </AgentHubBotSpeechBubble>
      <AgentHubBotSpeechBubble {...frame} tone="ask" headline="asks you" from="Acme" offline>
        <AgentHubBotAccessBody
          subject={{
            type: 'access',
            request: {
              hostId: 'local',
              requestId: 'q1',
              botId: bot.id,
              source: 'slack',
              workspaceId: 'w1',
              workspaceName: 'Acme',
              requester: { id: 'u1', name: 'Dana', handle: 'dana', detail: 'Dana Lee' },
              createdAt: at,
              expiresAt: at + 86_400_000
            }
          }}
          onLater={no}
        />
      </AgentHubBotSpeechBubble>
    </Stage>
  )
})

export const parkedChips = defineFixture({
  width: 460,
  render: () => (
    <Stage>
      <div className="flex">
        <AgentHubBotPendingChip bot={bot} count={1} onOpen={no} />
      </div>
      <div className="flex">
        <AgentHubBotMoreChip
          bots={[bot, { ...bot, id: 'b2' }, { ...bot, id: 'b3' }, { ...bot, id: 'b4' }]}
          hidden={3}
          onOpenInbox={no}
        />
      </div>
    </Stage>
  )
})
