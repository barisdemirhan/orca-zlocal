import { findAttachedAgentHubMirrorInput } from './agent-hub-mirror-input'
import { agentHubMirrorWindows, shownAgentHubMirrorTarget } from './agent-hub-mirror-membership'
import { useAppStore } from '@/store'
import { normalizeAgentHubMicMode } from '../../../../shared/agent-hub-settings'
import { AgentHubShortcut } from './AgentHubShortcut'
import { useRef, useState } from 'react'
import { AudioLines, Loader2, Mic, MicOff, MicVocal } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { dispatchDictationControl } from '../dictation/dictation-control-events'
import { useAgentHubDictationSession } from './agent-hub-dictation-origin'
import {
  agentHubMirrorDictationPane,
  mirrorOwnsDictation,
  type AgentHubDictationPane,
  type AgentHubMirrorMicState
} from './agent-hub-mirror-mic-state'
import { useAgentHubMirrors } from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { AgentHubMirrorMicMenu } from './AgentHubMirrorMicMenu'
import { useAgentHubMirrorMicState } from './use-agent-hub-mirror-mic-state'
import { readAgentHubDictationCapabilities } from './agent-hub-dictation-capabilities'
import { startAgentHubDictation } from './agent-hub-dictation-improve'

/** The terminal's own input, which dictation reads as "the focused pane". */
function findTerminalInput(button: HTMLElement, pane: AgentHubDictationPane): HTMLElement | null {
  const root = button.closest<HTMLElement>('[data-agent-hub-mirror]')
  const inMirror = root
    ? findAttachedAgentHubMirrorInput(root, {
        tab: { id: pane.tabId },
        paneKey: pane.leafId ? `${pane.tabId}:${pane.leafId}` : null
      })
    : null
  if (inMirror) {
    return inMirror
  }
  // The pane is on screen in the workspace instead; the mirror only says so.
  for (const tab of document.querySelectorAll<HTMLElement>('[data-terminal-tab-id]')) {
    if (tab.dataset.terminalTabId !== pane.tabId) {
      continue
    }
    for (const input of tab.querySelectorAll<HTMLElement>('.xterm-helper-textarea')) {
      const leafId = input.closest<HTMLElement>('.pane[data-leaf-id]')?.dataset.leafId
      if (pane.leafId === null || leafId === pane.leafId) {
        return input
      }
    }
  }
  return null
}

function startDictationIn(input: HTMLElement, improve: boolean): void {
  const start = (): void => {
    // Never start without the terminal focused: the text would have nowhere to go.
    if (document.activeElement === input) {
      startAgentHubDictation(improve)
    }
  }
  input.focus()
  if (document.activeElement === input) {
    start()
  } else {
    // Why a frame: on macOS, focus handed from one terminal to another lands a frame later.
    requestAnimationFrame(start)
  }
}

function MicIcon({
  state,
  improve
}: {
  state: AgentHubMirrorMicState
  improve: boolean
}): React.JSX.Element {
  switch (state) {
    case 'idle':
    case 'listening':
      return improve ? <MicVocal className="size-3.5" /> : <Mic className="size-3.5" />
    case 'starting':
      return improve ? (
        <MicVocal className="size-3.5 animate-pulse motion-reduce:animate-none" />
      ) : (
        <Mic className="size-3.5 animate-pulse motion-reduce:animate-none" />
      )
    case 'finishing':
      return <Loader2 className="size-3.5 animate-spin" />
    case 'elsewhere':
      return <AudioLines className="size-3.5" />
    case 'disabled':
    case 'no-model':
    case 'unsupported':
    case 'answering':
      return <MicOff className="size-3.5" />
  }
}

function micHint(
  state: AgentHubMirrorMicState,
  elsewhere: { name: string | null; inTerminal: boolean }
): string {
  const voiceOptions = translate('agentHub.mic.voiceOptions', 'Right-click for voice options.')
  switch (state) {
    case 'idle':
      return translate('agentHub.mic.start', 'Dictate into this terminal')
    case 'starting':
      return translate('agentHub.mic.starting', 'Starting the microphone… Click to stop.')
    case 'listening':
      return translate('agentHub.mic.stop', 'Stop dictation')
    case 'finishing':
      return translate('agentHub.mic.finishing', 'Finishing the dictation…')
    case 'elsewhere': {
      const where = elsewhere.name
        ? translate('agentHub.mic.elsewhereNamed', 'Dictation is running in “{{name}}”.', {
            name: elsewhere.name
          })
        : elsewhere.inTerminal
          ? translate('agentHub.mic.elsewhereTerminal', 'Dictation is running in another terminal.')
          : translate('agentHub.mic.elsewhere', 'Dictation is running elsewhere in Orca.')
      return `${where} ${translate('agentHub.mic.onlyOne', 'Only one can run at a time.')}`
    }
    case 'disabled':
      return `${translate('agentHub.mic.disabled', 'Voice dictation is off.')} ${voiceOptions}`
    case 'no-model':
      return `${translate('agentHub.mic.noModel', 'No speech model is selected and downloaded.')} ${voiceOptions}`
    case 'answering':
      return translate(
        'agentHub.mic.answering',
        'The question card is open: dictate your answer with the mic in its field.'
      )
    case 'unsupported':
      return translate(
        'agentHub.mic.unsupported',
        'Dictation cannot type into a floating workspace terminal from this window.'
      )
  }
}

/**
 * A mirror's microphone. A click focuses this mirror's terminal and starts Orca's dictation for
 * it, or stops the one running here. Only one dictation runs at a time, so while another runs the
 * button only says where. Right-click opens the voice options.
 */
export function AgentHubMirrorMicButton({
  target,
  reachable
}: {
  target: AgentHubPaneTarget
  /** False when the mirror shows a terminal dictation cannot type into. */
  reachable: boolean
}): React.JSX.Element {
  const state = useAgentHubMirrorMicState(target, reachable)
  const session = useAgentHubDictationSession()
  const { windows, chips } = useAgentHubMirrors()
  const [menuOpen, setMenuOpen] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const canImprove = readAgentHubDictationCapabilities().improve
  const storedMode = useAppStore((s) => normalizeAgentHubMicMode(s.settings?.agentHubMicMode))
  const improveMode = canImprove && storedMode === 'improve'
  const pane = agentHubMirrorDictationPane(target)
  const elsewhereName =
    state === 'elsewhere'
      ? (agentHubMirrorWindows({ windows, chips })
          .flatMap((window) => window.tabs.map(shownAgentHubMirrorTarget))
          .find((other) => mirrorOwnsDictation(session, agentHubMirrorDictationPane(other)))
          ?.title ?? null)
      : null
  const hint =
    state === 'idle' && canImprove
      ? improveMode
        ? translate(
            'agentHub.mic.startImproveHint',
            'Dictate and improve in this terminal. Shift-click to dictate.'
          )
        : translate(
            'agentHub.mic.startWithImproveHint',
            'Dictate into this terminal. Shift-click to dictate and improve.'
          )
      : micHint(state, {
          name: elsewhereName,
          inTerminal: session?.pane != null
        })
  const clickable = state === 'idle' || state === 'starting' || state === 'listening'
  return (
    <AgentHubMirrorMicMenu onOpenChange={setMenuOpen} canImprove={canImprove}>
      <Tooltip open={!menuOpen && tooltipOpen} onOpenChange={setTooltipOpen}>
        <TooltipTrigger asChild>
          <button
            ref={buttonRef}
            type="button"
            data-agent-hub-mirror-mic={state}
            data-agent-hub-mic-mode={improveMode ? 'improve' : 'dictate'}
            aria-label={hint}
            aria-pressed={state === 'starting' || state === 'listening'}
            aria-disabled={!clickable}
            // Why: the terminal keeps the keyboard; a click here must not take focus from it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              if (state === 'starting' || state === 'listening') {
                dispatchDictationControl('stop')
                return
              }
              if (state !== 'idle') {
                return
              }
              // Why focus first: dictation inserts into whatever holds focus when it starts.
              const input = findTerminalInput(event.currentTarget, pane)
              if (input) {
                const available = readAgentHubDictationCapabilities().improve
                const chosen = available && storedMode === 'improve'
                startDictationIn(input, available && (event.shiftKey ? !chosen : chosen))
              }
            }}
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground aria-disabled:cursor-default aria-disabled:hover:bg-transparent data-[agent-hub-mirror-mic=answering]:text-muted-foreground/50 data-[agent-hub-mirror-mic=answering]:hover:text-muted-foreground/50 data-[agent-hub-mirror-mic=disabled]:text-muted-foreground/50 data-[agent-hub-mirror-mic=disabled]:hover:text-muted-foreground/50 data-[agent-hub-mirror-mic=elsewhere]:text-status-warning data-[agent-hub-mirror-mic=elsewhere]:hover:text-status-warning data-[agent-hub-mirror-mic=finishing]:text-foreground data-[agent-hub-mirror-mic=listening]:bg-foreground data-[agent-hub-mirror-mic=listening]:text-background data-[agent-hub-mirror-mic=listening]:hover:bg-foreground/85 data-[agent-hub-mirror-mic=listening]:hover:text-background data-[agent-hub-mirror-mic=no-model]:text-muted-foreground/50 data-[agent-hub-mirror-mic=no-model]:hover:text-muted-foreground/50 data-[agent-hub-mirror-mic=starting]:bg-foreground/15 data-[agent-hub-mirror-mic=starting]:text-foreground data-[agent-hub-mirror-mic=unsupported]:text-muted-foreground/50 data-[agent-hub-mirror-mic=unsupported]:hover:text-muted-foreground/50"
          >
            <MicIcon state={state} improve={improveMode} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          <span className="flex items-center gap-2">
            {hint}
            <AgentHubShortcut
              actionId={improveMode ? 'voice.dictationImprove' : 'voice.dictation'}
            />
          </span>
        </TooltipContent>
      </Tooltip>
    </AgentHubMirrorMicMenu>
  )
}
