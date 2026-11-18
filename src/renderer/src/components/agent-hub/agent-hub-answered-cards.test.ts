import { afterEach, expect, it } from 'vitest'
import { PANE_KEY, PANE_KEY_2 } from './agent-hub-activity-test-fixtures'
import {
  agentHubCardKey,
  dismissAgentHubCard,
  isAgentHubCardDismissed,
  readAnsweredAgentHubCard,
  recordAgentHubCardAnswer,
  resetAgentHubAnsweredCardsForTest,
  showAgentHubCardsAgain,
  withoutDismissedAgentHubCards
} from './agent-hub-answered-cards'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'

afterEach(resetAgentHubAnsweredCardsForTest)

it('closes a card on one surface only, and brings it back on request', () => {
  const key = agentHubCardKey(PANE_KEY, 1_000)
  dismissAgentHubCard(key, 'inbox')
  expect(isAgentHubCardDismissed(key, 'inbox')).toBe(true)
  expect(isAgentHubCardDismissed(key, 'pane')).toBe(false)
  // The next prompt on the same pane is a new card.
  expect(isAgentHubCardDismissed(agentHubCardKey(PANE_KEY, 2_000), 'inbox')).toBe(false)

  showAgentHubCardsAgain([key], 'inbox')
  expect(isAgentHubCardDismissed(key, 'inbox')).toBe(false)
})

it('keeps the answer on record when a card is closed, and the closure when answered', () => {
  const key = agentHubCardKey(PANE_KEY, 1_000)
  recordAgentHubCardAnswer(key, 1)
  dismissAgentHubCard(key, 'pane')
  expect(readAnsweredAgentHubCard(key)).toBe(1)
  recordAgentHubCardAnswer(key, null)
  expect(isAgentHubCardDismissed(key, 'pane')).toBe(true)
})

it('filters the waiting agents whose card was closed on that surface', () => {
  const threads = agentHubThreadsFor([
    { paneKey: PANE_KEY, state: 'waiting', at: 1_000 },
    { paneKey: PANE_KEY_2, state: 'waiting', at: 1_000 }
  ])
  dismissAgentHubCard(agentHubCardKey(PANE_KEY, 1_000), 'inbox')
  expect(withoutDismissedAgentHubCards(threads, 'inbox').map((t) => t.paneKey)).toEqual([
    PANE_KEY_2
  ])
  expect(withoutDismissedAgentHubCards(threads, 'pane')).toHaveLength(2)
})

it('keys each prompt of one turn on its own, so a second question is a fresh card', () => {
  const first = agentHubCardKey(PANE_KEY, 1_000, '{"questions":[{"question":"A?"}]}')
  const second = agentHubCardKey(PANE_KEY, 1_000, '{"questions":[{"question":"B?"}]}')
  expect(first).not.toBe(second)
  expect(agentHubCardKey(PANE_KEY, 1_000, '{"questions":[{"question":"A?"}]}')).toBe(first)
  dismissAgentHubCard(first, 'pane')
  expect(isAgentHubCardDismissed(second, 'pane')).toBe(false)
})
