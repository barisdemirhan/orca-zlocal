import type { LinkActionRequest } from '@/components/link-actions/link-action-request'
// Chat shares the terminal's link-click vocabulary: plain click asks, modifier click opens.
import {
  isTerminalLinkActionActivation,
  isTerminalLinkDirectActivation
} from '@/components/terminal-pane/links/gestures/terminal-link-activation'
import type { TerminalLinkClickBehavior } from '@/components/terminal-pane/links/gestures/terminal-link-click-behavior'
import {
  buildHttpLinkActions,
  httpLinkDirectClickDestination,
  openRoutedHttpLink,
  type HttpLinkActionDestinations,
  type HttpLinkDestination
} from '@/lib/browser/navigation/http-link-destinations'
import type { HttpLinkSourceOwner } from '@/lib/browser/navigation/http-link-routing'
import {
  agentHubPeekUrlAction,
  peekTerminalUrlFromMirror,
  type AgentHubPeekLinkSource
} from '../agent-hub/agent-hub-peek-routing'

export type NativeChatWebLinkDeps = {
  worktreeId: string
  sourceTabId?: string | null
  sourceOwner: HttpLinkSourceOwner
  destinations: HttpLinkActionDestinations
  /** Off: a plain click opens the routed destination outright, as it did before actions existed. */
  actionsEnabled: boolean
  plainClickBehavior?: TerminalLinkClickBehavior
  restoreFocus: () => void
  request: (request: LinkActionRequest) => void
  peekSource?: AgentHubPeekLinkSource
}

export function nativeChatWebPeekSource(
  url: string,
  deps: Pick<NativeChatWebLinkDeps, 'worktreeId' | 'sourceOwner' | 'sourceTabId'>,
  event?: Pick<MouseEvent, 'target'>,
  previewOnModifier = false
): AgentHubPeekLinkSource {
  return {
    ...deps,
    event,
    fromOrb:
      previewOnModifier ||
      Boolean(
        event?.target &&
        event.target instanceof Element &&
        event.target.closest('[data-agent-hub-orb-panel], [data-agent-hub-orb-request-modal]')
      ),
    previewOnModifier:
      previewOnModifier ||
      Boolean(
        event?.target &&
        event.target instanceof Element &&
        event.target.closest('[data-agent-hub-orb-panel], [data-agent-hub-mirror]')
      ),
    onPairedRuntime: deps.sourceOwner.kind === 'runtime',
    openInWorkspace: () => openNativeChatWebLink(url, deps, 'orca'),
    openExternally: () => openNativeChatWebLink(url, deps, 'system')
  }
}

export function nativeChatWebLinkActions(
  url: string,
  deps: Pick<
    NativeChatWebLinkDeps,
    'worktreeId' | 'sourceOwner' | 'sourceTabId' | 'destinations' | 'peekSource'
  >
) {
  const actions = buildHttpLinkActions(
    deps.destinations,
    (destination) => openNativeChatWebLink(url, deps, destination),
    {
      worktreeId: deps.worktreeId,
      sourceTabId: deps.sourceTabId,
      sourceOwner: deps.sourceOwner,
      url,
      openInSourceGroup: () => openNativeChatWebLink(url, deps, 'orca', true)
    }
  )
  const peek = deps.peekSource ? agentHubPeekUrlAction(url, deps.peekSource) : null
  return {
    ...actions,
    primary: {
      ...actions.primary,
      shortcut:
        peek?.shortcut === 'primary'
          ? deps.destinations.primary === 'system'
            ? 'alternate'
            : null
          : 'primary'
    },
    ...(actions.alternate && peek?.shortcut === 'primary'
      ? {
          alternate: {
            ...actions.alternate,
            shortcut: deps.destinations.alternate === 'system' ? ('alternate' as const) : null
          }
        }
      : {}),
    ...(peek ? { secondaryActions: [peek, ...(actions.secondaryActions ?? [])] } : {})
  } as const
}

type ChatLinkMouseEvent = Pick<
  MouseEvent,
  'altKey' | 'clientX' | 'clientY' | 'ctrlKey' | 'metaKey' | 'shiftKey'
> & {
  detail?: number
  currentTarget?: Pick<HTMLElement, 'getBoundingClientRect'> | EventTarget | null
  button?: number
  preventDefault: () => void
}

export function openNativeChatWebLink(
  url: string,
  deps: Pick<NativeChatWebLinkDeps, 'worktreeId' | 'sourceOwner' | 'sourceTabId'>,
  destination: HttpLinkDestination | undefined,
  openInSourceGroup = false
): void {
  openRoutedHttpLink(url, {
    worktreeId: deps.worktreeId,
    ...(deps.sourceTabId ? { sourceTabId: deps.sourceTabId } : {}),
    ...(openInSourceGroup ? { openInSourceGroup: true } : {}),
    sourceOwner: deps.sourceOwner,
    modifierHeld: false,
    ...(destination ? { forceDestination: destination } : {})
  })
}

/** Returns true when the click was consumed; false leaves the anchor's default. */
export function handleNativeChatWebLink(
  event: ChatLinkMouseEvent,
  url: string,
  deps: NativeChatWebLinkDeps
): boolean {
  const open = (destination: HttpLinkDestination | undefined): void =>
    openNativeChatWebLink(url, deps, destination)

  if (isTerminalLinkDirectActivation(event)) {
    event.preventDefault()
    if (!event.shiftKey && deps.peekSource && peekTerminalUrlFromMirror(url, deps.peekSource)) {
      return true
    }
    if (
      event.shiftKey &&
      deps.peekSource &&
      agentHubPeekUrlAction(url, deps.peekSource)?.shortcut === 'primary'
    ) {
      open('system')
      return true
    }
    open(httpLinkDirectClickDestination(deps.destinations, event.shiftKey))
    return true
  }
  if (!isTerminalLinkActionActivation(event)) {
    return false
  }

  if (!deps.actionsEnabled) {
    if (deps.plainClickBehavior === 'none') {
      return false
    }
    event.preventDefault()
    open(deps.destinations.primary)
    return true
  }
  event.preventDefault()
  const anchor = event.currentTarget
  const keyboardAnchor =
    event.detail === 0 &&
    anchor &&
    'getBoundingClientRect' in anchor &&
    typeof anchor.getBoundingClientRect === 'function'
      ? anchor.getBoundingClientRect()
      : null
  deps.request({
    anchorX: keyboardAnchor?.left ?? event.clientX,
    anchorY: keyboardAnchor?.bottom ?? event.clientY,
    destination: url,
    kind: 'url',
    restoreFocus: deps.restoreFocus,
    ...nativeChatWebLinkActions(url, deps)
  })
  return true
}
