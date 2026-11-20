import { Undo2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { formatOptionalShortcutLabel } from '@/lib/keyboard/useShortcutLabel'
import { translate } from '@/i18n/i18n'
import { AgentHubShortcut } from './AgentHubShortcut'
import { DockButton, DOCK_BUTTON } from './AgentHubDockParts'
import type { AgentHubOrbState } from './agent-hub-orb-state'
import { AgentHubOrbSphere } from './AgentHubOrbSphere'
import { agentHubOrbPresentation } from './agent-hub-orb-presentation'
import { EMPTY_ORB_VOICE_SNAPSHOT } from './agent-hub-orb-voice-state'
import { getShortcutPlatform } from '@/lib/keyboard/shortcut-platform'
import { agentHubOrbLaunchAction } from '../../../../shared/agent-hub-orb-settings'
import { agentHubOrbActionLabel } from './agent-hub-orb-action-label'
import { useAgentHubOrbName } from './use-agent-hub-orb-identity'

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
        {...agentHubOrbPresentation(state, EMPTY_ORB_VOICE_SNAPSHOT, state.kind === 'needsYou')}
      />
    </span>
  )
}

export function AgentHubOrbButton({
  state,
  side,
  onOpen,
  disabled = false,
  floating = false,
  recall = false
}: {
  state: AgentHubOrbState
  side: 'top' | 'bottom' | 'left' | 'right'
  onOpen: (alternate?: boolean) => void
  disabled?: boolean
  floating?: boolean
  /** The Orb is out, so a click calls it back instead of waking it. */
  recall?: boolean
}): React.JSX.Element {
  const name = useAgentHubOrbName()
  const bindings = useAppStore((s) => s.keybindings)
  const settings = useAppStore((s) => s.settings)
  const shortcut = formatOptionalShortcutLabel('agentHub.toggleOrb', bindings)
  const notSet = translate('auto.agentHub.orb.notSet', 'Not set')
  const talk = disabled
    ? translate('agentHub.orb.disabledNamed', 'Enable Agent control to talk to {{name}}', {
        name
      })
    : recall
      ? translate('agentHub.orb.callBackNamed', 'Call {{name}} back', { name })
      : translate('agentHub.orb.talkNamed', 'Talk to {{name}}', { name })
  return (
    <DockButton
      label={`${talk} · ${shortcut ?? notSet}`}
      hint={
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            {talk} · {agentHubOrbActionLabel(agentHubOrbLaunchAction(settings))} ·
            {shortcut ? <AgentHubShortcut actionId="agentHub.toggleOrb" /> : notSet}
          </span>
          <span>
            {translate('agentHub.orb.modifierClickHint', '{{modifier}}-click · {{action}}', {
              modifier: getShortcutPlatform() === 'darwin' ? '⌘' : 'Ctrl',
              action: agentHubOrbActionLabel(agentHubOrbLaunchAction(settings, true))
            })}
          </span>
        </span>
      }
      side={side}
      className={
        floating
          ? 'grid size-12 cursor-grab place-items-center rounded-full border border-border bg-popover text-popover-foreground shadow-floating transition-colors hover:bg-accent active:cursor-grabbing disabled:opacity-40'
          : DOCK_BUTTON
      }
      disabled={disabled}
      preserveFocus
      onClick={(event) =>
        onOpen(getShortcutPlatform() === 'darwin' ? event.metaKey : event.ctrlKey)
      }
    >
      {recall && !floating ? (
        <Undo2 aria-hidden data-agent-hub-orb-recall className="size-3.5" />
      ) : (
        <AgentHubOrbMark state={state} large={floating} />
      )}
    </DockButton>
  )
}
