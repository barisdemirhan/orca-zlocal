export function formatAgentHubResult(method: string, result: unknown): string {
  if (typeof result !== 'object' || result === null) {
    return JSON.stringify(result)
  }
  if (method === 'agentHub.presence' && 'present' in result && 'idleMinutes' in result) {
    return `${result.present ? 'Present' : 'Away'} (idle: ${String(result.idleMinutes)} minutes)`
  }
  if (
    method === 'agentHub.status' &&
    'mirrors' in result &&
    'parked' in result &&
    'waiting' in result
  ) {
    return [
      'cards' in result && Array.isArray(result.cards)
        ? cardList(result.cards)
        : [paneList('Mirrors', result.mirrors), paneList('Parked', result.parked)].join('\n'),
      paneList('Waiting for you', result.waiting),
      ...('peek' in result ? [peekLine(result.peek)] : [])
    ].join('\n')
  }
  if (method === 'agentHub.orb.remember' && 'message' in result) {
    return String(result.message)
  }
  if (method === 'agentHub.progress') {
    return 'Progress updated.'
  }
  if (method === 'agentHub.mirror' && 'mirror' in result) {
    return MIRROR_OUTCOMES[String(result.mirror)] ?? 'Agent Hub request completed.'
  }
  if (method === 'agentHub.peekControl' && 'peek' in result) {
    return PEEK_OUTCOMES[String(result.peek)] ?? 'Agent Hub request completed.'
  }
  if ('requestId' in result) {
    return `${method === 'agentHub.notify' ? 'Notification sent to Agent Hub' : 'Agent Hub request completed'} (${String(result.requestId)}).`
  }
  return JSON.stringify(result, null, 2)
}

const MIRROR_OUTCOMES: Record<string, string> = {
  added: 'Added as a tab in the card.',
  opened: 'Opened a new card.',
  'already-there': 'Already a tab in that card.'
}

const PEEK_OUTCOMES: Record<string, string> = {
  closed: 'Closed Peek.',
  'went-back': 'Went back one page in Peek.',
  'nothing-open': 'Peek shows nothing from this host.',
  'at-first-page': 'Peek is already on its first page.'
}

function peekLine(peek: unknown): string {
  if (typeof peek !== 'object' || peek === null || !('location' in peek)) {
    return 'Peek: closed'
  }
  const title = 'title' in peek && peek.title ? `${String(peek.title)} — ` : ''
  const back = 'canGoBack' in peek && peek.canGoBack ? ' (can go back)' : ''
  return `Peek: ${title}${String(peek.location)}${back}`
}

function cardList(cards: unknown[]): string {
  if (!cards.length) {
    return 'Cards: none'
  }
  return [
    'Cards:',
    ...cards.map((card, index) => {
      if (typeof card !== 'object' || card === null) {
        return `  ${index + 1}. ?`
      }
      const tags = [
        'containsCaller' in card && card.containsCaller ? 'yours' : null,
        'parked' in card && card.parked ? 'parked' : null
      ].filter(Boolean)
      const tabs = 'tabs' in card ? paneNames(card.tabs) : '?'
      return `  ${index + 1}.${tags.length ? ` (${tags.join(', ')})` : ''} ${tabs}`
    })
  ].join('\n')
}

function paneList(label: string, value: unknown): string {
  return `${label}: ${paneNames(value)}`
}

function paneNames(value: unknown): string {
  if (!Array.isArray(value)) {
    return 'unavailable'
  }
  const panes = value.map((pane: unknown) =>
    typeof pane === 'object' && pane !== null && 'terminalHandle' in pane
      ? String(pane.terminalHandle)
      : '?'
  )
  return panes.length ? panes.join(', ') : 'none'
}
