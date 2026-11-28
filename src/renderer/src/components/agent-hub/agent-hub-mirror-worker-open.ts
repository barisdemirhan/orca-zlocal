import { useCallback } from 'react'
import {
  getActivityThreadInputs,
  readActivityThreadSnapshot
} from '../activity/threads/activity-thread-projection'
import { showWorkerPaneInMirror } from './agent-hub-bot-mirror'
import { useAgentHubMirroredTargetOfTab } from './agent-hub-mirror-tab-target'

function workerPaneKeyOfDispatch(dispatchId: string): string | undefined {
  const { allThreads } = readActivityThreadSnapshot('all', getActivityThreadInputs('all'))
  return allThreads.find((thread) =>
    [thread.currentAgentEntry, thread.paneEntry, thread.latestEvent?.entry].some(
      (entry) => entry?.orchestration?.dispatchId === dispatchId
    )
  )?.paneKey
}

/** Shows a dock worker in the mirror tab that shows this chat; null while no mirror shows the chat.
 *  The returned opener is false when the worker has no pane here, so the caller opens it in the main window. */
export function useAgentHubMirrorWorkerOpen(
  tabId: string | undefined
): ((dispatchId: string) => boolean) | null {
  const shown = useAgentHubMirroredTargetOfTab(tabId ?? '')
  const open = useCallback(
    (dispatchId: string) =>
      shown ? showWorkerPaneInMirror(shown, workerPaneKeyOfDispatch(dispatchId)) : false,
    [shown]
  )
  return tabId && shown ? open : null
}
