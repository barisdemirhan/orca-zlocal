import { Lock } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { AgentHubOrbChatStrip } from './AgentHubOrbChatStrip'
import { moveAgentHubOrbLiveHere, useAgentHubOrbChatStrip } from './agent-hub-orb-chat-strip-store'
import { ORB_CHAT_IN_MAIN_TAB } from './agent-hub-orb-main-tab'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import type { AgentHubOrbStripModel } from './use-agent-hub-orb-strip-model'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'

/** The chat strip and, while Live runs in another chat, the note that says where it is. */
export function AgentHubOrbStripBar({
  model,
  voice,
  onClearHome
}: {
  model: AgentHubOrbStripModel
  voice: AgentHubOrbVoiceValue
  onClearHome: () => void
}): React.JSX.Element {
  const { liveId } = model
  const activeTabId = useAgentHubOrbChatStrip((s) => s.meta[model.activeId]?.tabId)
  const inMainTab = useAgentHubOrbPanel((s) => s.shownTabId === ORB_CHAT_IN_MAIN_TAB)
  const activeTitle = model.tabs.find((tab) => tab.id === model.activeId)?.title ?? ''
  return (
    <>
      <AgentHubOrbChatStrip
        tabs={model.tabs}
        activeId={model.activeId}
        limit={model.limit}
        full={model.full}
        onActivate={model.activate}
        onClose={model.close}
        actions={{
          onNew: model.newChat,
          onRename: model.rename,
          onClearHome,
          onOpenAsTab: model.openAsTab
        }}
      />
      {model.tabs.find((tab) => tab.id === model.activeId)?.readOnly ? (
        <div
          data-agent-hub-orb-worker-note
          className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-1 text-2xs text-muted-foreground"
        >
          <Lock className="size-3" aria-hidden />
          {translate('agentHub.orb.worker.transcriptNote', 'Worker transcript, read only')}
        </div>
      ) : null}
      {inMainTab && activeTabId ? (
        <div
          data-agent-hub-orb-open-in-main
          className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 text-xs"
        >
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {translate('agentHub.orb.strip.inMainTab', '"{{name}}" is open in a main tab.', {
              name: activeTitle
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => useAgentHubOrbPanel.setState({ shownTabId: activeTabId })}
          >
            {translate('agentHub.orb.strip.bringHere', 'Bring here')}
          </Button>
        </div>
      ) : null}
      {model.liveElsewhere && liveId ? (
        <div
          data-agent-hub-orb-live-elsewhere
          className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 text-xs"
        >
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {translate('agentHub.orb.strip.liveOn', 'Live is on {{name}}', {
              name: model.liveTitle
            })}
          </span>
          <Button type="button" variant="outline" size="xs" onClick={() => model.activate(liveId)}>
            {translate('agentHub.orb.strip.backToLive', 'Back to Live')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => {
              void voice.stopLive().then(() => moveAgentHubOrbLiveHere(true))
            }}
          >
            {translate('agentHub.orb.strip.moveLive', 'Move Live here')}
          </Button>
        </div>
      ) : null}
    </>
  )
}
