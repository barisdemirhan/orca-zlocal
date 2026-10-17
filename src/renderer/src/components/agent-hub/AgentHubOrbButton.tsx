import { useAppStore } from '@/store'
import { formatOptionalShortcutLabel } from '@/hooks/useShortcutLabel'
import { translate } from '@/i18n/i18n'
import { AgentHubShortcut } from './AgentHubShortcut'
import { DockButton, DOCK_BUTTON } from './AgentHubDockParts'
import type { AgentHubOrbState } from './agent-hub-orb-state'
import { AgentHubOrbSphere } from './AgentHubOrbSphere'

export function AgentHubOrbMark({
  state,
  large = false
}: {
  state: AgentHubOrbState
  large?: boolean
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      data-agent-hub-orb-state={state.kind}
      data-agent-hub-orb-mark={large ? 'large' : 'small'}
      className={large ? 'inline-flex size-8' : 'inline-flex size-4'}
    >
      <AgentHubOrbSphere
        decorative
        label={translate('auto.agentHub.orb.title', 'Orb')}
        phase={
          state.kind === 'working'
            ? 'thinking'
            : state.kind === 'needsYou'
              ? 'request'
              : state.kind === 'done'
                ? 'result'
                : state.kind === 'listening'
                  ? 'listening'
                  : 'idle'
        }
      />
    </span>
  )
}

export function AgentHubOrbButton({
  state,
  side,
  onOpen,
  disabled = false,
  floating = false
}: {
  state: AgentHubOrbState
  side: 'top' | 'bottom' | 'left' | 'right'
  onOpen: () => void
  disabled?: boolean
  floating?: boolean
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
      className={
        floating
          ? 'grid size-12 cursor-grab place-items-center rounded-full border border-border bg-popover text-popover-foreground shadow-floating transition-colors hover:bg-accent active:cursor-grabbing disabled:opacity-40'
          : DOCK_BUTTON
      }
      disabled={disabled}
      preserveFocus
      onClick={onOpen}
    >
      <AgentHubOrbMark state={state} large={floating} />
    </DockButton>
  )
}
