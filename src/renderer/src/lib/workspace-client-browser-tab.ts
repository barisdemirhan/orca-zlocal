import type { AppState } from '@/store/types'
import type { ExecutionHostId } from '../../../shared/execution-host'
import { resolveNewBrowserTabProfile } from '@/store/slices/browser/profiles/browser-new-tab-profile'
import type { TabSplitTarget } from '@/store/slices/tabs/tabs-slice-contract'

/** Shared materialization for workspace and private client browser surfaces. */
export function createWorkspaceClientBrowserTab(
  state: AppState,
  request: {
    workspaceId: string
    url: string
    title?: string
    focusOnCreate?: boolean
    targetGroupId?: string
    split?: TabSplitTarget
    afterTabId?: string
  },
  hostId: ExecutionHostId,
  // Desktop-rendered pages in runtime workspaces keep runtime ownership or palette/activation disowns their tabs.
  ownerHostId: ExecutionHostId = hostId
) {
  return state.createBrowserTab(request.workspaceId, request.url, {
    activate: request.focusOnCreate !== false,
    browserRuntimeEnvironmentId: null,
    focusAddressBar: false,
    executionHostId: ownerHostId,
    ...resolveNewBrowserTabProfile(state, request.workspaceId, hostId),
    targetGroupId: request.targetGroupId,
    ...(request.split ? { split: request.split } : {}),
    ...(request.afterTabId ? { afterTabId: request.afterTabId } : {}),
    title: request.title
  })
}
