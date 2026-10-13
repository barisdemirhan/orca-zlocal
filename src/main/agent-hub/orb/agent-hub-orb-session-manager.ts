import { randomUUID } from 'node:crypto'
import { agentHubOrbPermissionOptions } from './agent-hub-orb-permission-settings'
import { stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import {
  AGENT_HUB_ORB_OPENING_PROMPT,
  AGENT_HUB_ORB_ORIGIN,
  type AgentHubOrbConversation,
  type AgentHubOrbOpenParams,
  type AgentHubOrbSession
} from '../../../shared/agent-hub-orb'
import { normalizeAgentHubOrbSettings } from '../../../shared/agent-hub-orb-settings'
import type { AgentHubSettings } from '../../../shared/agent-hub-settings'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { isStructuredAgentId } from '../../../shared/agent-session-provider-handle'
import type { AgentSessionRecord } from '../../../shared/agent-session-record'
import {
  structuredAgentSessionCreateParams,
  createStructuredAgentSessionId
} from '../../../shared/structured-agent-session-create'
import { getStructuredAgentSessionHost } from '../../native-chat/agent-session-wire/structured-agent-session-registry'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/structured-agent-session-host'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { RuntimeStore } from '../../runtime/runtime-store-contract'
import { AgentHubError } from '../../runtime/agent-hub/agent-hub-error'
import {
  commitStructuredAgentSessionCreate,
  prepareStructuredAgentSessionCreateForWorktree
} from '../../runtime/rpc/methods/structured-agent-session-create'
import { commitStructuredAgentSessionLaunchPrompt } from '../../runtime/rpc/methods/agent-launch-structured-prompt'

const caller = { callerKey: 'trusted-local:agent-hub-orb' }
type OrbRuntime = Pick<
  OrcaRuntimeService,
  | 'isAgentHubEnabled'
  | 'ensureStructuredAgentSessionHost'
  | 'resolveStructuredAgentSessionCreateIntent'
  | 'publishStructuredAgentSessionTab'
>

export class AgentHubOrbSessionManager {
  private opening: Promise<AgentHubOrbSession> | null = null
  private active: AgentHubOrbSession | null = null

  constructor(
    private readonly runtime: OrbRuntime,
    private readonly getSettings: () => AgentHubSettings,
    private readonly saveCwd: (cwd: string) => void | Promise<void>
  ) {}

  requireEnabled(): void {
    if (!this.runtime.isAgentHubEnabled()) {
      throw new AgentHubError('disabled', 'Agent Hub Orb is disabled')
    }
  }

  current(): AgentHubOrbSession | null {
    this.requireEnabled()
    const host = getStructuredAgentSessionHost()
    const record =
      host && this.orbRecords(host).find((entry) => host.getSessionTabId(entry.sessionId))
    if (!record || !host) {
      this.active = null
      return null
    }
    const tabId = host.getSessionTabId(record.sessionId)
    return this.active?.sessionId === record.sessionId
      ? this.active
      : { sessionId: record.sessionId, ...(tabId ? { tabId } : {}), resumed: false }
  }

  open(params: AgentHubOrbOpenParams = {}): Promise<AgentHubOrbSession> {
    this.requireEnabled()
    if (this.opening) {
      return this.opening
    }
    this.opening = this.openOnce(params).finally(() => {
      this.opening = null
    })
    return this.opening
  }

  async list(limit = 30): Promise<AgentHubOrbConversation[]> {
    this.requireEnabled()
    const host = await this.ensureHost()
    const conversations: AgentHubOrbConversation[] = []
    for (const record of this.orbRecords(host)) {
      if (!isStructuredAgentId(record.provider)) {
        continue
      }
      const snapshot = await host.journalSnapshot(record.sessionId)
      const messages = snapshot.items.flatMap((item) => {
        if (item.body.kind !== 'message') {
          return []
        }
        const text = item.body.blocks
          .flatMap((block) => (block.type === 'text' ? [block.text] : []))
          .join(' ')
          .trim()
        return [{ role: item.body.role, text }]
      })
      const firstUser = messages.find(
        (message) => message.role === 'user' && message.text !== AGENT_HUB_ORB_OPENING_PROMPT
      )
      const lastReply = messages.findLast((message) => message.role === 'assistant')?.text
      conversations.push({
        sessionId: record.sessionId,
        agent: record.provider,
        ...(record.options?.model ? { model: record.options.model } : {}),
        title: (record.conversationName || firstUser?.text || 'Orb').slice(0, 120),
        startedAt: record.createdAt,
        lastActiveAt: Math.max(record.updatedAt, ...snapshot.items.map((item) => item.observedAt)),
        ...(lastReply ? { lastReply: lastReply.slice(0, 240) } : {})
      })
    }
    return conversations
      .sort((left, right) => right.lastActiveAt - left.lastActiveAt)
      .slice(0, limit)
  }

  private async openOnce(params: AgentHubOrbOpenParams): Promise<AgentHubOrbSession> {
    const settings = normalizeAgentHubOrbSettings(this.getSettings())
    const cwd = params.cwd?.trim() || settings.cwd
    if (!cwd) {
      throw new AgentHubError('invalid_argument', 'Orb folder is not chosen')
    }
    if (!isAbsolute(cwd)) {
      throw new AgentHubError('invalid_argument', 'Orb folder must be an absolute path')
    }
    const directory = await stat(cwd).catch(() => null)
    if (!directory?.isDirectory()) {
      throw new AgentHubError('invalid_argument', 'Orb folder does not exist or is not a directory')
    }
    if (params.cwd !== undefined) {
      await this.saveCwd(cwd)
    }
    const host = await this.ensureHost()
    this.requireEnabled()
    const current = this.current()
    if (current) {
      await this.ensureOpeningPrompt(host, current.sessionId)
      return current
    }
    const previous = params.resume ? host.deps.store.getRecord(params.resume.sessionId) : null
    if (params.resume && previous?.origin !== AGENT_HUB_ORB_ORIGIN) {
      throw new AgentHubError('not_found', 'Orb conversation was not found on this host')
    }
    const agent = previous?.provider ?? params.agent ?? settings.agent
    if (!isStructuredAgentId(agent) || (previous && params.agent && params.agent !== agent)) {
      throw new AgentHubError('invalid_argument', 'Orb resume must use the conversation agent')
    }
    if (previous) {
      const revealed = await host.revealSession(previous.sessionId)
      await this.runtime.publishStructuredAgentSessionTab({
        workspaceId: revealed.workspaceId,
        sessionId: revealed.sessionId,
        agent: revealed.agent,
        activate: false
      })
      const tabId = host.getSessionTabId(previous.sessionId)
      this.active = { sessionId: previous.sessionId, ...(tabId ? { tabId } : {}), resumed: true }
      await this.ensureOpeningPrompt(host, previous.sessionId)
      return this.active
    }
    const model = params.model === undefined ? settings.model : params.model
    const create = structuredAgentSessionCreateParams({
      sessionId: createStructuredAgentSessionId(agent, randomUUID),
      worktree: FLOATING_TERMINAL_WORKTREE_ID,
      agent,
      randomUuid: randomUUID
    })
    const prepared = await prepareStructuredAgentSessionCreateForWorktree({
      runtime: this.runtime,
      ensureHost: async () => host,
      caller,
      ...create,
      origin: AGENT_HUB_ORB_ORIGIN,
      hostLaunchDirectory: cwd,
      options: {
        ...(model ? { model } : {}),
        ...agentHubOrbPermissionOptions(this.getSettings(), agent)
      }
    })
    this.requireEnabled()
    const result = await commitStructuredAgentSessionCreate({
      runtime: this.runtime,
      caller,
      prepared,
      activate: false
    })
    if (!result.ok) {
      throw new AgentHubError('invalid_argument', result.refusal.message)
    }
    this.active = {
      sessionId: result.value.sessionId,
      ...(result.value.tabId ? { tabId: result.value.tabId } : {}),
      resumed: false
    }
    await this.ensureOpeningPrompt(host, result.value.sessionId)
    return this.active
  }

  private async ensureOpeningPrompt(
    host: StructuredAgentSessionHost,
    sessionId: string
  ): Promise<void> {
    const snapshot = await host.journalSnapshot(sessionId)
    if (snapshot.items.length > 0 || snapshot.submissions.length > 0) {
      return
    }
    const record = host.deps.store.getRecord(sessionId)
    if (!record) {
      throw new AgentHubError('not_found', 'Orb conversation was not found on this host')
    }
    const committed = await commitStructuredAgentSessionLaunchPrompt({
      host,
      caller,
      sessionId,
      fence: record.lease.runtimeFence,
      text: AGENT_HUB_ORB_OPENING_PROMPT
    })
    if (!committed) {
      throw new AgentHubError(
        'invalid_argument',
        'Orb was created but its opening prompt was not committed'
      )
    }
  }

  private async ensureHost(): Promise<StructuredAgentSessionHost> {
    await this.runtime.ensureStructuredAgentSessionHost()
    const host = getStructuredAgentSessionHost()
    if (!host) {
      throw new AgentHubError('disabled', 'Structured agent sessions are unavailable on this host')
    }
    return host
  }

  private orbRecords(host: StructuredAgentSessionHost): AgentSessionRecord[] {
    return host.deps.store
      .listRecords()
      .filter((record) => record.origin === AGENT_HUB_ORB_ORIGIN)
      .sort((left, right) => right.createdAt - left.createdAt)
  }
}

export function createAgentHubOrbSessionManager(
  runtime: OrbRuntime,
  store: Pick<RuntimeStore, 'getSettings' | 'updateSettings'> | null
): AgentHubOrbSessionManager {
  return new AgentHubOrbSessionManager(
    runtime,
    () => store?.getSettings() ?? {},
    (cwd) => {
      if (!store?.updateSettings) {
        throw new Error('runtime_unavailable')
      }
      store.updateSettings({ agentHubOrbCwd: cwd }, { notifyListeners: true })
    }
  )
}
