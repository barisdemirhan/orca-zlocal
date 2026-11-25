import { useEffect, useSyncExternalStore } from 'react'
import type { StructuredAgentSessionQueuedMessagesController } from '../native-chat/queue/use-structured-agent-session-queued-messages'
import type { StructuredSessionTaskStop } from '../native-chat/tools/tasks/use-structured-session-task-stop'
import type { NativeChatTaskList } from '../../../../shared/native-chat/input/task-lists/native-chat-task-list'
import type {
  SessionOptionDescriptor,
  SessionOptionsSurface
} from '../../../../shared/native-chat/input/native-chat-session-options'
import type { NativeChatContextUsageSummary } from '../../../../shared/native-chat/native-chat-context-usage-summary'
import type { AgentHubMirrorInboundRow } from './agent-hub-mirror-inbound'

export type MirrorChatQueueSlice = Pick<
  StructuredAgentSessionQueuedMessagesController,
  'cards' | 'steer' | 'remove' | 'edit' | 'editCapable' | 'isWorking'
>
export type MirrorChatWorkSlice = { stop: StructuredSessionTaskStop; supportsStop: boolean }
export type MirrorChatSettingsSlice = {
  surface: SessionOptionsSurface | null
  snapshot: SessionOptionDescriptor[]
  contextUsage: NativeChatContextUsageSummary | null
  isWorking: boolean
  /** Null while a compact runs or when the session's commands do not offer one. */
  compact: (() => void) | null
  compacting: boolean
  offersCompact: boolean
}

/** One store per slice, keyed by tab, so a token that changes only the transcript wakes only its readers. */
function createSliceStore<T>() {
  const values = new Map<string, T>()
  const listeners = new Map<string, Set<() => void>>()
  const set = (tabId: string, value: T | null): void => {
    if (value === null) {
      if (!values.delete(tabId)) {
        return
      }
    } else {
      if (values.get(tabId) === value) {
        return
      }
      values.set(tabId, value)
    }
    listeners.get(tabId)?.forEach((listener) => listener())
  }
  const subscribe = (tabId: string, listener: () => void): (() => void) => {
    const bucket = listeners.get(tabId) ?? new Set<() => void>()
    bucket.add(listener)
    listeners.set(tabId, bucket)
    return () => {
      bucket.delete(listener)
    }
  }
  return {
    useValue: (tabId: string): T | null =>
      useSyncExternalStore(
        (listener) => subscribe(tabId, listener),
        () => values.get(tabId) ?? null
      ),
    usePublish: (tabId: string, value: T | null): void => {
      useEffect(() => {
        set(tabId, value)
      }, [tabId, value])
      useEffect(() => () => set(tabId, null), [tabId])
    }
  }
}

const queueStore = createSliceStore<MirrorChatQueueSlice>()
const workStore = createSliceStore<MirrorChatWorkSlice>()
const planStore = createSliceStore<NativeChatTaskList>()
const inboundStore = createSliceStore<readonly AgentHubMirrorInboundRow[]>()
const settingsStore = createSliceStore<MirrorChatSettingsSlice>()

export const usePublishAgentHubMirrorQueue = queueStore.usePublish
export const usePublishAgentHubMirrorChatWork = workStore.usePublish
export const usePublishAgentHubMirrorChatPlan = planStore.usePublish
export const usePublishAgentHubMirrorChatInbound = inboundStore.usePublish
export const usePublishAgentHubMirrorChatSettings = settingsStore.usePublish

/** Each is null for a terminal agent or a chat that is not mounted: the drawer then says it cannot report. */
export const useAgentHubMirrorQueue = queueStore.useValue
export const useAgentHubMirrorChatWork = workStore.useValue
export const useAgentHubMirrorChatPlan = planStore.useValue
export const useAgentHubMirrorChatInbound = inboundStore.useValue
export const useAgentHubMirrorChatSettings = settingsStore.useValue
