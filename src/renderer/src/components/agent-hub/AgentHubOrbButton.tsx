import { Loader2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { formatOptionalShortcutLabel } from '@/hooks/useShortcutLabel'
import { translate } from '@/i18n/i18n'
import { AgentHubShortcut } from './AgentHubShortcut'
import { DockButton, DOCK_BUTTON } from './AgentHubDockParts'
import type { AgentHubOrbState } from './agent-hub-orb-state'

export function AgentHubOrbMark({ state }: { state: AgentHubOrbState }): React.JSX.Element {
  if (state.kind === 'working') {
    return (
      <Loader2
        aria-hidden
        className="size-3.5 animate-spin text-foreground motion-reduce:animate-none"
      />
    )
  }
  return (
    <span
      aria-hidden
      data-agent-hub-orb-state={state.kind}
      className="size-3.5 rounded-full border border-muted-foreground data-[agent-hub-orb-state=listening]:border-agent-orb-listening data-[agent-hub-orb-state=listening]:bg-agent-orb-listening data-[agent-hub-orb-state=needsYou]:border-agent-question data-[agent-hub-orb-state=needsYou]:bg-agent-question data-[agent-hub-orb-state=done]:border-status-success data-[agent-hub-orb-state=done]:bg-status-success/20"
    />
  )
}

export function AgentHubOrbButton({
  state,
  side,
  onOpen,
  disabled = false
}: {
  state: AgentHubOrbState
  side: 'top' | 'bottom' | 'left' | 'right'
  onOpen: () => void
  disabled?: boolean
}): React.JSX.Element {
  const bindings = useAppStore((s) => s.keybindings)
  const shortcut = formatOptionalShortcutLabel('agentHub.toggleOrb', bindings)
  const notSet = translate('auto.agentHub.orb.notSet', 'Not set')
  const talk = disabled
    ? translate('auto.agentHub.orb.disabled', 'Enable Agent control to talk to Orb')
    : translate('auto.agentHub.orb.talk', 'Talk to Orb')
  return (
    <DockButton
      label={`${talk} · ${shortcut ?? notSet}`}
      hint={
        <>
          {talk} · {shortcut ? <AgentHubShortcut actionId="agentHub.toggleOrb" /> : notSet}
        </>
      }
      side={side}
      className={DOCK_BUTTON}
      disabled={disabled}
      preserveFocus
      onClick={onOpen}
    >
      <AgentHubOrbMark state={state} />
    </DockButton>
  )
}
