export const ORB_NATIVE_VOICE_SOURCE = String.raw`let voiceSessionId
let voiceThreadId
let voiceRevision = 0
const voiceTimelines = new Map()

function completedVoiceItem(text, role) {
  const item = { id: randomUUID(), realtimeSessionId: voiceSessionId, type: 'transcriptSegment', role, text }
  const voiceTimeline = voiceTimelines.get(voiceThreadId) ?? []
  voiceTimeline.push({ type: 'realtime', position: voiceTimeline.length, item })
  voiceTimelines.set(voiceThreadId, voiceTimeline)
  const payload = { threadId: voiceThreadId, item }
  notify('thread/realtime/item/started', { threadId: voiceThreadId, item: { ...item, text: '' } })
  notify('thread/realtime/item/transcript/delta', { threadId: voiceThreadId, itemId: item.id, delta: text })
  notify('thread/realtime/item/completed', payload)
  notify('thread/realtime/item/completed', payload)
}

if (process.env.ORCA_E2E_ORB_CLI_REALTIME_CONTROL) {
  setInterval(() => {
    let events
    try {
      events = readFileSync(process.env.ORCA_E2E_ORB_CLI_REALTIME_CONTROL, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
    } catch { return }
    for (const event of events) {
      if (event.revision <= voiceRevision) continue
      voiceRevision = event.revision
      if (event.type === 'item' && voiceSessionId) completedVoiceItem(event.text, event.role)
      if (event.type === 'late' && voiceSessionId) {
        notify('thread/realtime/started', { threadId: voiceThreadId, version: 'v2', realtimeSessionId: voiceSessionId })
        notify('thread/realtime/sdp', { threadId: voiceThreadId, sdp: 'v=0\r\ns=orca-e2e-voice-answer\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' })
        completedVoiceItem('Late canonical voice reply', 'assistant')
      }
      if (event.type === 'question' && voiceSessionId) {
        notify('turn/started', { threadId: voiceThreadId, turn: { id: 'voice-question-turn', status: 'inProgress' } })
        send({ id: 'orb-modal-question', method: 'item/tool/requestUserInput', params: {
          threadId: voiceThreadId, turnId: 'voice-question-turn', itemId: 'voice-question',
          questions: [
            { id: 'period', header: 'Period', question: 'Which measurement period?', options: [{ label: 'Monthly' }, { label: 'Weekly' }] },
            { id: 'details', header: 'Details', question: 'Describe the measurement in detail', options: [] },
            { id: 'sources', header: 'Sources', question: 'Which source should be checked first?', options: Array.from({ length: 10 }, (_, i) => ({ label: 'Source ' + (i + 1) })) }
          ]
        } })
      }
      if (event.type === 'approval' && voiceSessionId) {
        notify('turn/started', { threadId: voiceThreadId, turn: { id: 'voice-approval-turn', status: 'inProgress' } })
        notify('item/started', { threadId: voiceThreadId, turnId: 'voice-approval-turn', item: {
          id: 'voice-approval-command', type: 'commandExecution', command: 'printf orb-voice-layout-approved', status: 'inProgress'
        } })
        send({ id: 'voice-layout-approval', method: 'item/commandExecution/requestApproval', params: {
          threadId: voiceThreadId, turnId: 'voice-approval-turn', itemId: 'voice-approval-command',
          command: 'printf orb-voice-layout-approved', reason: 'Check the Orb request layout'
        } })
      }
    }
  }, 25).unref()
}

function handleVoiceApprovalResponse(message) {
  if (message.id === 'orb-modal-question' && !message.method) {
    const scope = { threadId: voiceThreadId, turnId: 'voice-question-turn' }
    const item = { id: 'orb-modal-question-result', type: 'agentMessage', text: 'Native question response received' }
    notify('item/started', { ...scope, item })
    notify('item/completed', { ...scope, item })
    notify('turn/completed', { threadId: voiceThreadId, turn: { id: scope.turnId, status: 'completed', items: [item] } })
    notify('thread/status/changed', { threadId: voiceThreadId, status: { type: 'idle' } })
    return true
  }
  if (message.id === 'voice-layout-approval' && !message.method) {
    const scope = { threadId: voiceThreadId, turnId: 'voice-approval-turn' }
    notify('item/completed', { ...scope, item: {
      id: 'voice-approval-command', type: 'commandExecution', command: 'printf orb-voice-layout-approved', status: 'completed', exitCode: 0
    } })
    completedVoiceItem('Native approval response received', 'assistant')
    notify('turn/completed', { threadId: voiceThreadId, turn: { id: scope.turnId, status: 'completed', items: [] } })
    notify('thread/status/changed', { threadId: voiceThreadId, status: { type: 'idle' } })
    return true
  }
  return false
}

function handleRealtimeRequest(message, reply) {
  const params = message.params ?? {}
  switch (message.method) {
    case 'thread/realtime/listVoices':
      return reply({ voices: { defaultV1: 'alloy', defaultV2: 'marin', v1: ['alloy'], v2: ['marin'], v3: ['marin'] } })
    case 'thread/realtime/start':
      voiceSessionId = params.realtimeSessionId
      voiceThreadId = params.threadId
      reply({})
      setTimeout(() => {
        notify('thread/realtime/started', { threadId: params.threadId, version: 'v2', realtimeSessionId: params.realtimeSessionId })
        notify('thread/realtime/sdp', { threadId: params.threadId, sdp: 'v=0\r\ns=orca-e2e-voice-answer\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' })
      }, 10)
      return
    case 'thread/realtime/stop':
      reply({})
      setTimeout(() => notify('thread/realtime/closed', { threadId: params.threadId, reason: null }), 10)
      return
    case 'thread/realtime/appendText':
      return reply({})
    case 'thread/timeline/list':
      return reply({ data: voiceTimelines.get(params.threadId) ?? [], nextCursor: null, activeRealtimeSessionAtPageStart: null })
  }
}
`
