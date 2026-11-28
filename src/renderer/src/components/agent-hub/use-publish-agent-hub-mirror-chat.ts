import { useMemo, useState } from 'react'
import type { NativeChatMessage } from '../../../../shared/native-chat/native-chat-types'
import { nativeChatDockedTaskList } from '../../../../shared/native-chat/input/task-lists/native-chat-task-list-state'
import type { NativeChatStructuredComposerTransport } from '../native-chat/composer/submit/native-chat-structured-composer-transport'
import { agentSessionCompactCommandText } from '../../../../shared/agent-session/conversation-context/agent-session-conversation-command'
import type { StructuredSessionTaskStop } from '../native-chat/tools/tasks/use-structured-session-task-stop'
import {
  usePublishAgentHubMirrorChatInbound,
  usePublishAgentHubMirrorChatPlan,
  usePublishAgentHubMirrorChatSettings,
  type MirrorChatSettingsSlice,
  usePublishAgentHubMirrorChatWork,
  usePublishAgentHubMirrorQueue,
  type MirrorChatQueueSlice
} from './agent-hub-mirror-chat-feed'
import { sameAgentHubMirrorInbound, selectAgentHubMirrorInbound } from './agent-hub-mirror-inbound'

/** Publishes the mounted chat's card facts once; every slice keeps its identity until its content changes. */
export function usePublishAgentHubMirrorChat(
  tabId: string,
  messages: readonly NativeChatMessage[],
  queue: MirrorChatQueueSlice,
  { stop, supportsStop }: { stop: StructuredSessionTaskStop; supportsStop: boolean }
): void {
  const { cards, steer, remove, edit, editCapable, isWorking } = queue
  const queueSlice = useMemo(
    () => ({ cards, steer, remove, edit, editCapable, isWorking }),
    [cards, steer, remove, edit, editCapable, isWorking]
  )
  usePublishAgentHubMirrorQueue(tabId, queueSlice)

  const { stoppingTaskIds, stoppingAll, onStop } = stop
  const workSlice = useMemo(
    () => ({ stop: { stoppingTaskIds, stoppingAll, onStop }, supportsStop }),
    [stoppingTaskIds, stoppingAll, onStop, supportsStop]
  )
  usePublishAgentHubMirrorChatWork(tabId, workSlice)

  usePublishAgentHubMirrorChatPlan(
    tabId,
    useMemo(() => nativeChatDockedTaskList(messages), [messages])
  )

  const next = selectAgentHubMirrorInbound(messages)
  const [inbound, setInbound] = useState(next)
  if (!sameAgentHubMirrorInbound(inbound, next)) {
    setInbound(next)
  }
  usePublishAgentHubMirrorChatInbound(tabId, inbound)
}

/** The composer's option surface, context use and Compact, published only for a structured chat. */
export function usePublishAgentHubMirrorSettings(
  {
    terminalTabId,
    structuredTransport: transport,
    isWorking
  }: {
    terminalTabId: string
    structuredTransport: NativeChatStructuredComposerTransport | undefined
    isWorking: boolean
  },
  { surface, snapshot }: Pick<MirrorChatSettingsSlice, 'surface' | 'snapshot'>,
  contextUsage: MirrorChatSettingsSlice['contextUsage']
): void {
  const [compacting, setCompacting] = useState(false)
  const dispatchCommand = transport?.dispatchCommand
  const offersCompact = transport?.conversationCommands?.includes('compact') === true
  const compact = useMemo(
    () =>
      dispatchCommand && offersCompact && !compacting
        ? () => {
            setCompacting(true)
            void dispatchCommand(agentSessionCompactCommandText()).finally(() =>
              setCompacting(false)
            )
          }
        : null,
    [dispatchCommand, offersCompact, compacting]
  )
  const slice = useMemo(
    () =>
      transport
        ? { surface, snapshot, contextUsage, isWorking, compact, compacting, offersCompact }
        : null,
    [transport, surface, snapshot, contextUsage, isWorking, compact, compacting, offersCompact]
  )
  usePublishAgentHubMirrorChatSettings(terminalTabId, slice)
}
