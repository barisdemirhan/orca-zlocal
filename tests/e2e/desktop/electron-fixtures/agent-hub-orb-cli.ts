import { ORB_NATIVE_VOICE_SOURCE } from './agent-hub-orb-native-voice-cli'
import { appendFileSync, chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function createAgentHubOrbCli(): {
  directory: string
  ledger: string
  control: string
  availability: string
  realtimeControl: string
  setCommand: (command: string) => void
  completeTurn: () => void
  rejectModel: (model: string | null) => void
  emitVoiceItem: (text: string, role?: 'user' | 'assistant') => void
  emitLateVoiceEvents: () => void
  askVoiceApproval: () => void
  askVoiceQuestion: () => void
  cleanup: () => void
} {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'orca-orb-cli-'))
  const script = path.join(directory, 'orb-app-server.cjs')
  const control = path.join(directory, 'turn-control.json')
  const availability = path.join(directory, 'model-availability.json')
  const realtimeControl = path.join(directory, 'realtime-control.json')
  let revision = 0
  const advance = (command: string | null) => {
    writeFileSync(control, JSON.stringify({ revision: ++revision, command }))
  }
  advance('pwd')
  writeFileSync(availability, JSON.stringify({ rejectedModel: null }))
  writeFileSync(realtimeControl, '')
  let realtimeRevision = 0
  const controlVoice = (event: Record<string, unknown>) => {
    appendFileSync(
      realtimeControl,
      `${JSON.stringify({ revision: ++realtimeRevision, ...event })}\n`
    )
  }
  writeFileSync(script, ORB_APP_SERVER_SOURCE)
  if (process.platform === 'win32') {
    writeFileSync(
      path.join(directory, 'codex.cmd'),
      '@echo off\r\nnode "%~dp0\\orb-app-server.cjs" %*\r\n'
    )
  } else {
    const executable = path.join(directory, 'codex')
    writeFileSync(executable, `#!/usr/bin/env node\nrequire(${JSON.stringify(script)})\n`)
    chmodSync(executable, 0o755)
  }
  return {
    directory,
    ledger: path.join(directory, 'requests.jsonl'),
    control,
    availability,
    realtimeControl,
    setCommand: advance,
    completeTurn: () => advance(null),
    rejectModel: (model) => writeFileSync(availability, JSON.stringify({ rejectedModel: model })),
    emitVoiceItem: (text, role = 'user') => controlVoice({ type: 'item', text, role }),
    emitLateVoiceEvents: () => controlVoice({ type: 'late' }),
    askVoiceApproval: () => controlVoice({ type: 'approval' }),
    askVoiceQuestion: () => controlVoice({ type: 'question' }),
    cleanup: () => rmSync(directory, { recursive: true, force: true })
  }
}

// Only the external CLI is synthetic; Orb publication, close, resume and rendering stay real.
const ORB_APP_SERVER_SOURCE = String.raw`const { randomUUID } = require('node:crypto')
const { appendFileSync, readFileSync } = require('node:fs')
const readline = require('node:readline')

if (process.argv.includes('--version')) {
  console.log('codex-cli 0.163.0')
  process.exit(0)
}
if (!process.argv.includes('app-server')) process.exit(0)

const send = (payload) => process.stdout.write(JSON.stringify(payload) + '\n')
const notify = (method, params) => send({ method, params })
let threadId
let model = 'orb-e2e-a'
const models = ['a', 'b'].map((suffix) => ({
  id: 'orb-e2e-' + suffix,
  model: 'orb-e2e-' + suffix,
  displayName: 'Orb test ' + suffix.toUpperCase(),
  isDefault: suffix === 'a',
  defaultReasoningEffort: 'medium',
  supportedReasoningEfforts: [{ reasoningEffort: 'medium', description: 'Test effort' }]
}))
models.push({
  ...models[0],
  id: 'gpt-5.6-sol',
  model: 'gpt-5.6-sol',
  displayName: 'GPT-5.6 Sol',
  isDefault: false
})

${ORB_NATIVE_VOICE_SOURCE}

function controlledTurn(scope, finish) {
  let revision = -1
  let commandItem
  const timer = setInterval(() => {
    let next
    try {
      next = JSON.parse(readFileSync(process.env.ORCA_E2E_ORB_CLI_CONTROL, 'utf8'))
    } catch {
      return
    }
    if (next.revision === revision) return
    revision = next.revision
    if (commandItem) {
      notify('item/completed', {
        ...scope,
        item: { ...commandItem, status: 'completed', exitCode: 0 }
      })
    }
    if (next.command === null) {
      clearInterval(timer)
      finish()
      return
    }
    commandItem = {
      id: randomUUID(),
      type: 'commandExecution',
      command: next.command,
      status: 'inProgress'
    }
    notify('item/started', { ...scope, item: commandItem })
  }, 25)
}

function initialProviderNotices(scope) {
  notify('hook/completed', {
    ...scope,
    run: {
      id: 'stop:17:/fixtures/hooks.json',
      eventName: 'stop',
      handlerType: 'command',
      executionMode: 'sync',
      scope: 'turn',
      sourcePath: '/fixtures/hooks.json',
      source: 'user',
      displayOrder: 17,
      status: 'failed',
      statusMessage: null,
      startedAt: 1000,
      completedAt: 1007,
      durationMs: 7,
      entries: [{ kind: 'error', text: 'hook exited with code 127' }]
    }
  })
  notify('warning', {
    threadId: scope.threadId,
    message: 'Automatic approval review approved (risk: low, authorization: medium): Read-only status query within the requested task.'
  })
  const sentry = {
    threadId: scope.threadId,
    name: 'sentry',
    status: 'failed',
    error: 'The sentry MCP server is not logged in. Run \`codex mcp login sentry\`.',
    failureReason: null
  }
  notify('mcpServer/startupStatus/updated', sentry)
  notify('mcpServer/startupStatus/updated', sentry)
  notify('mcpServer/startupStatus/updated', {
    ...sentry,
    name: 'raindrop',
    error: 'MCP client for \`raindrop\` failed to start: MCP startup failed: handshaking with MCP server failed: ' +
      'Send message error Transport [codex_mcp_client::event_notification_transport::EventNotificationTransport] error: Transport channel closed, when send initialized notification'.repeat(4)
  })
  notify('mcpServer/startupStatus/updated', {
    ...sentry,
    name: 'postman',
    error: 'The postman MCP server requires OAuth reauthentication. Run \`codex mcp login postman\`.'
  })
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line)
  if (process.env.ORCA_E2E_ORB_CLI_LEDGER) {
    appendFileSync(process.env.ORCA_E2E_ORB_CLI_LEDGER, JSON.stringify(message) + '\n')
  }
  if (handleVoiceApprovalResponse(message)) return
  if (message.id === undefined || !message.method) return
  const reply = (result) => send({ id: message.id, result })
  const params = message.params ?? {}
  if (message.method.startsWith('thread/realtime/') || message.method === 'thread/timeline/list') {
    handleRealtimeRequest(message, reply)
    return
  }
  switch (message.method) {
    case 'initialize':
    case 'skills/extraRoots/set':
    case 'turn/interrupt':
      return reply({})
    case 'model/list':
      return reply({ data: models, nextCursor: null })
    case 'account/read':
      return reply({ account: { type: 'chatgpt' }, requiresOpenaiAuth: false })
    case 'config/read':
      return reply({ config: { model, model_reasoning_effort: 'medium' } })
    case 'thread/start':
    case 'thread/resume':
      threadId = params.threadId ?? randomUUID()
      model = params.model ?? model
      return reply({
        thread: { id: threadId, turns: [] },
        model,
        reasoningEffort: 'medium'
      })
    case 'thread/read':
      return reply({ thread: { id: params.threadId, turns: [] } })
    case 'turn/start': {
      const turnId = randomUUID()
      model = params.model ?? model
      const prompt = (params.input ?? []).map((item) => item.text ?? '').join(' ')
      const answer = prompt.startsWith('Orb lifecycle') ? 'Reply: ' + prompt : 'Orb fixture ready'
      const item = { id: randomUUID(), type: 'agentMessage', text: answer }
      reply({ turn: { id: turnId, status: 'inProgress', items: [] } })
      setTimeout(() => {
        const scope = { threadId, turnId }
        const user = { id: randomUUID(), type: 'userMessage', clientId: params.clientUserMessageId, content: params.input }
        notify('turn/started', { threadId, turn: { id: turnId, status: 'inProgress' } })
        notify('item/started', { ...scope, item: user })
        notify('item/completed', { ...scope, item: user })
        const { rejectedModel } = JSON.parse(readFileSync(process.env.ORCA_E2E_ORB_CLI_AVAILABILITY, 'utf8'))
        if (!models.some((entry) => entry.model === model) || rejectedModel === model) {
          const error = {
            message: JSON.stringify({ type: 'error', status: 400, error: {
              type: 'invalid_request_error',
              message: "The '" + model + "' model is not supported when using Codex with a ChatGPT account."
            } }),
            codexErrorInfo: 'other'
          }
          notify('thread/status/changed', { threadId, status: { type: 'systemError' } })
          notify('error', { ...scope, willRetry: false, error })
          notify('turn/completed', { threadId, turn: { id: turnId, status: 'failed', error, durationMs: 10 } })
          return
        }
        if (answer === 'Orb fixture ready') initialProviderNotices(scope)
        const finish = () => {
          notify('item/started', { ...scope, item: { ...item, text: '' } })
          notify('item/agentMessage/delta', { ...scope, itemId: item.id, delta: answer })
          notify('item/completed', { ...scope, item })
          notify('turn/completed', { threadId, turn: { id: turnId, status: 'completed', items: [item] } })
          notify('thread/status/changed', { threadId, status: { type: 'idle' } })
        }
        if (prompt === 'Orb lifecycle geometry control') {
          controlledTurn(scope, finish)
        } else {
          finish()
        }
      }, 10)
      return
    }
    default:
      return send({ id: message.id, error: { code: -32601, message: 'Unsupported fixture method' } })
  }
})
`
