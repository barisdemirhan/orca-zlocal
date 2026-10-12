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
      paneList('Mirrors', result.mirrors),
      paneList('Parked', result.parked),
      paneList('Waiting for you', result.waiting)
    ].join('\n')
  }
  if (method === 'agentHub.progress') {
    return 'Progress updated.'
  }
  if ('requestId' in result) {
    return `${method === 'agentHub.notify' ? 'Notification sent to Agent Hub' : 'Agent Hub request completed'} (${String(result.requestId)}).`
  }
  return JSON.stringify(result, null, 2)
}

function paneList(label: string, value: unknown): string {
  if (!Array.isArray(value)) {
    return `${label}: unavailable`
  }
  const panes = value.map((pane: unknown) =>
    typeof pane === 'object' && pane !== null && 'terminalHandle' in pane
      ? String(pane.terminalHandle)
      : '?'
  )
  return `${label}: ${panes.length ? panes.join(', ') : 'none'}`
}
