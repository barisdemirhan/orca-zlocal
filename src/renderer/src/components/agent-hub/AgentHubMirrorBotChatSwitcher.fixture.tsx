import { defineFixture } from '../../component-fixtures/component-fixture'
import type { Bot } from '../../../../shared/bot-types'
import { AgentHubMirrorBotChatSwitcherView } from './AgentHubMirrorBotChatSwitcher'
import type { AgentHubMirrorBotPill } from './agent-hub-mirror-bot-pills'

const bot = { id: 'scotty', name: 'Scotty' } as Bot

const pills: AgentHubMirrorBotPill[] = [
  { id: 'home', sessionId: null, title: 'Home chat', active: false, mark: null },
  { id: 'a', sessionId: 'a', title: 'Weekly dependency report', active: false, mark: 'ask' },
  { id: 'b', sessionId: 'b', title: 'CI failures run 9', active: false, mark: 'work' },
  {
    id: 'c',
    sessionId: 'c',
    title: 'Asana: ibiz mails and pending work',
    active: true,
    mark: null
  },
  { id: 'd', sessionId: 'd', title: 'PR follow-up run 2', active: false, mark: null }
]

function Frame(): React.JSX.Element {
  return (
    <div className="flex h-96 w-120 items-start rounded-xl border border-foreground/25 bg-popover p-1.5">
      <AgentHubMirrorBotChatSwitcherView
        bot={bot}
        line="done · Claude Code · claude-opus-5-5"
        title="Asana: ibiz mails and pending work"
        progress={null}
        pills={pills}
        onSwitch={() => {}}
        onNew={() => {}}
        onOpenPage={() => {}}
      />
    </div>
  )
}

export const closedWaiting = defineFixture({ width: 480, render: () => <Frame /> })
export const open = defineFixture({
  width: 480,
  render: () => <Frame />,
  interact: (frame) => {
    frame
      .querySelector('button')
      ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
  }
})
