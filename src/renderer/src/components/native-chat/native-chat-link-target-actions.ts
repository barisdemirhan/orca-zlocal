import {
  httpLinkActionDestinationsFor,
  type HttpLinkActionDestinations
} from '@/lib/browser/navigation/http-link-destinations'
import type { HttpLinkSourceOwner } from '@/lib/browser/navigation/http-link-routing'
import type { AppState } from '@/store/types'
import {
  buildFileLinkActions,
  type FileLinkActions,
  type TerminalFileLinkActionDeps
} from '@/components/terminal-pane/links/files/terminal-file-link-actions'
import { routeNativeChatHref } from '../../../../shared/native-chat/native-chat-href-routing'
import { useAppStore } from '../../store'
import { openDetectedFilePath } from '@/components/terminal-pane/links/files/terminal-file-open-routing'
import {
  resolveNativeChatFileLink,
  type NativeChatFileLinkContext,
  type NativeChatResolvedFileLink
} from './native-chat-file-link'
import {
  canNativeChatOpenOwnedBrowser,
  resolveNativeChatHttpLinkSourceOwner
} from './native-chat-http-link-source-owner'
import { nativeChatWebLinkActions, nativeChatWebPeekSource } from './native-chat-web-link-actions'
import type { AgentHubPeekLinkSource } from '../agent-hub/agent-hub-peek-routing'
import { showFileLinkOpenFailureToast } from '@/lib/file-link-open-failure-toast'

/** Who owns a chat http(s) link and where it may open: the rows its popover and menu offer. */
export function resolveNativeChatHttpLinkRouting(
  state: AppState,
  worktreeId: string
): { sourceOwner: HttpLinkSourceOwner; destinations: HttpLinkActionDestinations } {
  const sourceOwner = resolveNativeChatHttpLinkSourceOwner(state, worktreeId)
  return {
    sourceOwner,
    destinations: httpLinkActionDestinationsFor(
      state.settings,
      sourceOwner,
      canNativeChatOpenOwnedBrowser(state, worktreeId, sourceOwner)
    )
  }
}

/** How a chat file link opens; an underlined link must answer every open, so a miss says why. */
export function nativeChatFileOpenDeps(
  target: NativeChatResolvedFileLink,
  context: NativeChatFileLinkContext
): TerminalFileLinkActionDeps {
  return {
    worktreeId: context.worktreeId,
    worktreePath: context.worktreePath,
    runtimeEnvironmentId: context.runtimeEnvironmentId,
    hostFileOnly: true,
    sourceTabId: context.sourceTabId,
    onOpenFailure: (failure) => showFileLinkOpenFailureToast(target.absolutePath, failure)
  }
}

/** The rows a chat file link offers, on click and on right-click alike. */
export function nativeChatFileLinkActions(
  target: NativeChatResolvedFileLink,
  context: NativeChatFileLinkContext,
  peekSource = nativeChatFilePeekSource(target, context)
): FileLinkActions {
  return buildFileLinkActions(
    target.absolutePath,
    target.line,
    target.column,
    nativeChatFileOpenDeps(target, context),
    resolveNativeChatHttpLinkSourceOwner(useAppStore.getState(), context.worktreeId),
    peekSource
  )
}

export function nativeChatFilePeekSource(
  target: NativeChatResolvedFileLink,
  context: NativeChatFileLinkContext,
  event?: Pick<MouseEvent, 'target'>,
  previewOnModifier = false
): AgentHubPeekLinkSource {
  const deps = nativeChatFileOpenDeps(target, context)
  return {
    worktreeId: context.worktreeId,
    worktreePath: context.worktreePath,
    sourceOwner: resolveNativeChatHttpLinkSourceOwner(useAppStore.getState(), context.worktreeId),
    onPairedRuntime: Boolean(context.runtimeEnvironmentId),
    event,
    line: target.line,
    column: target.column,
    previewOnModifier,
    fromOrb:
      previewOnModifier ||
      Boolean(
        event?.target &&
        event.target instanceof Element &&
        event.target.closest('[data-agent-hub-orb-panel]')
      ),
    openInWorkspace: () =>
      openDetectedFilePath(target.absolutePath, target.line, target.column, deps),
    openExternally: () =>
      openDetectedFilePath(target.absolutePath, target.line, target.column, {
        ...deps,
        openWithSystemDefault: true
      })
  }
}

/** The rows a right-clicked chat link offers: its click popover's, or null when it opens nothing. */
export function nativeChatLinkActions(
  href: string,
  context: NativeChatFileLinkContext | null,
  event?: Pick<MouseEvent, 'target'>
): FileLinkActions | null {
  if (!context) {
    return null
  }
  const route = routeNativeChatHref(href)
  if (route.kind === 'file') {
    const target = resolveNativeChatFileLink(href, context)
    return target
      ? nativeChatFileLinkActions(
          target,
          context,
          nativeChatFilePeekSource(
            target,
            context,
            event,
            Boolean(
              event?.target &&
              event.target instanceof Element &&
              event.target.closest('[data-agent-hub-orb-panel], [data-agent-hub-orb-request-modal]')
            )
          )
        )
      : null
  }
  if (route.kind !== 'web' || !/^https?:/i.test(route.url)) {
    return null
  }
  const routing = resolveNativeChatHttpLinkRouting(useAppStore.getState(), context.worktreeId)
  return {
    destination: route.url,
    kind: 'url',
    ...nativeChatWebLinkActions(route.url, {
      ...routing,
      worktreeId: context.worktreeId,
      sourceTabId: context.sourceTabId,
      peekSource: nativeChatWebPeekSource(
        route.url,
        {
          worktreeId: context.worktreeId,
          sourceTabId: context.sourceTabId,
          sourceOwner: routing.sourceOwner
        },
        event
      )
    })
  }
}
