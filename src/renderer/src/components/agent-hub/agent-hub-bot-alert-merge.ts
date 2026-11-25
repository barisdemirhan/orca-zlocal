export type BotAlertFacetKind = 'ask' | 'signin' | 'access' | 'failure' | 'result'
export type BotAlertSource = 'item' | 'request' | 'chat' | 'event' | 'suggestion'

/** What the merge needs to know about one bubble-worthy fact of a bot. */
export type BotAlertFacet = {
  id: string
  botKey: string
  kind: BotAlertFacetKind
  source: BotAlertSource
  /** Ids, session ids and normalized text that name the fact; two facets sharing one are the same. */
  questionKeys: readonly string[]
}

export type BotAlertGroup = {
  botKey: string
  lead: BotAlertFacet
  /** Every facet the bubble stands for, duplicates included, so closing it closes them all. */
  ids: readonly string[]
  /** Facets after duplicates are folded: what "3 updates" counts. */
  distinct: readonly BotAlertFacet[]
  open: number
  failures: number
  results: number
}

const URGENCY: Record<BotAlertFacetKind, number> = {
  ask: 0,
  signin: 0,
  access: 0,
  failure: 1,
  result: 2
}
// Why: the work record knows the item, so it answers in place; the chat copy is the weakest.
const SOURCE_RANK: Record<BotAlertSource, number> = {
  item: 0,
  request: 1,
  event: 2,
  chat: 3,
  suggestion: 4
}

export function isOpenBotAlertKind(kind: BotAlertFacetKind): boolean {
  return URGENCY[kind] === 0
}

/** Lowercased words of a question, so the chat's copy and the work record's match. */
export function botQuestionTextKey(text: string): string {
  return `text:${text.replace(/\s+/g, ' ').trim().toLowerCase()}`
}

function sameQuestion(a: BotAlertFacet, b: BotAlertFacet): boolean {
  // Why ids only within one source: two questions of one chat share its session and may share words.
  return a.questionKeys.some(
    (key) => (a.source !== b.source || key.startsWith('id:')) && b.questionKeys.includes(key)
  )
}

/**
 * One bubble per bot: facets are folded when they are the same question, then grouped by bot. The
 * lead is the most urgent facet (open asks, then failures, then results), the newest of equals.
 * Asks fold with asks; a chat's end and an automation run's end fold when they are one session.
 * `facets` come oldest first; groups come out ordered by their newest member.
 */
export function mergeBotAlerts(facets: readonly BotAlertFacet[]): BotAlertGroup[] {
  const kept: { facet: BotAlertFacet; index: number; folded: string[] }[] = []
  facets.forEach((facet, index) => {
    if (facet.questionKeys.length > 0) {
      const twin = kept.find(
        (entry) =>
          entry.facet.botKey === facet.botKey &&
          isOpenBotAlertKind(entry.facet.kind) === isOpenBotAlertKind(facet.kind) &&
          sameQuestion(entry.facet, facet)
      )
      if (twin) {
        if (SOURCE_RANK[facet.source] < SOURCE_RANK[twin.facet.source]) {
          twin.folded.push(twin.facet.id)
          twin.facet = facet
        } else {
          twin.folded.push(facet.id)
        }
        twin.index = index
        return
      }
    }
    kept.push({ facet, index, folded: [] })
  })
  const byBot = new Map<string, typeof kept>()
  for (const entry of kept) {
    byBot.set(entry.facet.botKey, [...(byBot.get(entry.facet.botKey) ?? []), entry])
  }
  return [...byBot.entries()]
    .map(([botKey, entries]) => {
      const lead = entries.reduce((best, entry) =>
        URGENCY[entry.facet.kind] < URGENCY[best.facet.kind] ||
        (URGENCY[entry.facet.kind] === URGENCY[best.facet.kind] && entry.index > best.index)
          ? entry
          : best
      )
      const distinct = entries.map((entry) => entry.facet)
      return {
        newest: Math.max(...entries.map((entry) => entry.index)),
        group: {
          botKey,
          lead: lead.facet,
          ids: entries.flatMap((entry) => [entry.facet.id, ...entry.folded]),
          distinct,
          open: distinct.filter((facet) => isOpenBotAlertKind(facet.kind)).length,
          failures: distinct.filter((facet) => facet.kind === 'failure').length,
          results: distinct.filter((facet) => facet.kind === 'result').length
        } satisfies BotAlertGroup
      }
    })
    .sort((a, b) => a.newest - b.newest)
    .map((entry) => entry.group)
}
