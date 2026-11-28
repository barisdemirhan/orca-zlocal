import { create } from 'zustand'
import {
  EMPTY_SUGGESTION_LEDGER,
  localDayKey,
  recordOrbSuggestionShown,
  type OrbSuggestionLedger
} from './agent-hub-orb-bot-bubble'

const STORAGE_KEY = 'orca.agentHubOrbBotBubbles'
const DISMISSED_LIMIT = 200

type Persisted = { ledger: OrbSuggestionLedger; briefDay: string; briefAt: number | null }

const EMPTY: Persisted = { ledger: EMPTY_SUGGESTION_LEDGER, briefDay: '', briefAt: null }

function read(): Persisted {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (typeof raw !== 'object' || raw === null) {
      return EMPTY
    }
    const value = raw as Partial<Persisted>
    const ledger = value.ledger
    return {
      ledger: {
        day: typeof ledger?.day === 'string' ? ledger.day : '',
        shownToday: typeof ledger?.shownToday === 'number' ? ledger.shownToday : 0,
        seen: Array.isArray(ledger?.seen)
          ? ledger.seen.filter((id): id is string => typeof id === 'string')
          : []
      },
      briefDay: typeof value.briefDay === 'string' ? value.briefDay : '',
      briefAt: typeof value.briefAt === 'number' ? value.briefAt : null
    }
  } catch {
    return EMPTY
  }
}

function write(persisted: Persisted): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
  } catch {
    // Why: without storage the limits hold for this session only.
  }
}

type OrbBotBubbleState = {
  persisted: Persisted
  /** Bubbles and asks the owner put off or closed; they stay gone until the app restarts. */
  dismissed: readonly string[]
  dismiss: (key: string) => void
  markSuggestionShown: (suggestionId: string, now: number) => void
  markBriefDone: (now: number) => void
}

export const useAgentHubOrbBotBubbleStore = create<OrbBotBubbleState>((set, get) => ({
  persisted: read(),
  dismissed: [],
  dismiss: (key) => {
    const { dismissed } = get()
    if (!dismissed.includes(key)) {
      set({ dismissed: [...dismissed, key].slice(-DISMISSED_LIMIT) })
    }
  },
  markSuggestionShown: (suggestionId, now) => {
    const persisted = {
      ...get().persisted,
      ledger: recordOrbSuggestionShown(get().persisted.ledger, suggestionId, now)
    }
    write(persisted)
    set({ persisted })
  },
  markBriefDone: (now) => {
    const persisted = { ...get().persisted, briefDay: localDayKey(now), briefAt: now }
    write(persisted)
    set({ persisted })
  }
}))
