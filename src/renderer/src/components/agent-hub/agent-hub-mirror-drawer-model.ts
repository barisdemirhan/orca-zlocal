/** What `agentHubMirrorSourceKey(shownTarget)` returns: JSON of the source's host identity and tab id. */
export type AgentHubMirrorSourceKey = string
export type AgentHubMirrorDrawer = 'work' | 'inbound' | 'changes' | 'pr' | 'settings'
export type AgentHubMirrorDrawerOpenResult = 'opened' | 'closed-by-user' | 'not-available'
export type AgentHubMirrorEventKind =
  | 'card-opened'
  | 'card-closed'
  | 'card-parked'
  | 'tab-shown'
  | 'drawer-opened-by-user'
  | 'drawer-closed-by-user'
export type AgentHubMirrorEvent = {
  seq: number
  at: number
  kind: AgentHubMirrorEventKind
  detail?: string
}

const EVENT_CAP = 100
const EVENT_SOURCE_CAP = 64

type CardPrefs = { agentMay?: boolean; strip?: boolean }

/** The drawer rules without the app store, so the refusal and turn rules can be tested alone. */
export function createAgentHubMirrorDrawerModel(settings: { ownCardAllowed: () => boolean }) {
  const drawers = new Map<string, AgentHubMirrorDrawer>()
  const closedThisTurn = new Set<string>()
  const prefs = new Map<string, CardPrefs>()
  const events = new Map<string, AgentHubMirrorEvent[]>()
  const listeners = new Set<() => void>()
  let seq = 0
  const emit = (): void => listeners.forEach((listener) => listener())

  const agentMayUseCard = (key: string): boolean =>
    settings.ownCardAllowed() && prefs.get(key)?.agentMay !== false

  const recordEvent = (
    key: string,
    event: { kind: AgentHubMirrorEventKind; detail?: string }
  ): void => {
    const list = events.get(key) ?? []
    const at = Date.now()
    // Why: readers keep their cursor across a window reload, so a fresh window must not start at 1.
    seq = Math.max(seq + 1, at)
    list.push({ seq, at, ...event })
    if (list.length > EVENT_CAP) {
      list.splice(0, list.length - EVENT_CAP)
    }
    events.delete(key)
    events.set(key, list)
    if (events.size > EVENT_SOURCE_CAP) {
      const oldest = events.keys().next()
      if (!oldest.done) {
        events.delete(oldest.value)
      }
    }
  }

  const open = (
    key: string,
    drawer: AgentHubMirrorDrawer,
    by: 'user' | 'agent' | 'auto'
  ): AgentHubMirrorDrawerOpenResult => {
    if (by !== 'user') {
      if (by === 'agent' && !agentMayUseCard(key)) {
        return 'not-available'
      }
      if (closedThisTurn.has(key)) {
        return 'closed-by-user'
      }
    } else {
      closedThisTurn.delete(key)
      recordEvent(key, { kind: 'drawer-opened-by-user', detail: drawer })
    }
    if (drawers.get(key) !== drawer) {
      drawers.set(key, drawer)
      emit()
    }
    return 'opened'
  }

  const close = (key: string, by: 'user' | 'agent'): void => {
    if (by === 'agent' && !agentMayUseCard(key)) {
      return
    }
    const shown = drawers.get(key)
    if (by === 'user' && shown) {
      closedThisTurn.add(key)
      recordEvent(key, { kind: 'drawer-closed-by-user', detail: shown })
    }
    if (drawers.delete(key)) {
      emit()
    }
  }

  const updatePrefs = (key: string, patch: CardPrefs): void => {
    prefs.set(key, { ...prefs.get(key), ...patch })
    emit()
  }

  return {
    open,
    close,
    shown: (key: string): AgentHubMirrorDrawer | null => drawers.get(key) ?? null,
    noteTurnStarted: (key: string): void => {
      closedThisTurn.delete(key)
    },
    agentMayUseCard,
    setAgentMayUseCard: (key: string, agentMay: boolean): void => updatePrefs(key, { agentMay }),
    agentPref: (key: string): boolean => prefs.get(key)?.agentMay !== false,
    stripPref: (key: string): boolean | undefined => prefs.get(key)?.strip,
    setStripShown: (key: string, strip: boolean): void => updatePrefs(key, { strip }),
    recordEvent,
    readEvents: (key: string, sinceSeq: number): AgentHubMirrorEvent[] =>
      (events.get(key) ?? []).filter((event) => event.seq > sinceSeq),
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}
