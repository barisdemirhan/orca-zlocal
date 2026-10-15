import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function createAgentHubOrbCli(): { directory: string; ledger: string; cleanup: () => void } {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'orca-orb-cli-'))
  const script = path.join(directory, 'orb-app-server.cjs')
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
    cleanup: () => rmSync(directory, { recursive: true, force: true })
  }
}

// Only the external CLI is synthetic; Orb publication, close, resume and rendering stay real.
const ORB_APP_SERVER_SOURCE = String.raw`const { randomUUID } = require('node:crypto')
const { appendFileSync } = require('node:fs')
const readline = require('node:readline')

if (process.argv.includes('--version')) {
  console.log('codex-cli 0.141.0')
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

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line)
  if (message.id === undefined || !message.method) return
  if (process.env.ORCA_E2E_ORB_CLI_LEDGER) {
    appendFileSync(process.env.ORCA_E2E_ORB_CLI_LEDGER, JSON.stringify(message) + '\n')
  }
  const reply = (result) => send({ id: message.id, result })
  const params = message.params ?? {}
  switch (message.method) {
    case 'initialize':
    case 'skills/extraRoots/set':
    case 'turn/interrupt':
      return reply({})
    case 'model/list':
      return reply({ data: models, nextCursor: null })
    case 'account/read':
      return reply({ account: { type: 'apiKey' }, requiresOpenaiAuth: false })
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
        notify('item/started', { ...scope, item: { ...item, text: '' } })
        notify('item/agentMessage/delta', { ...scope, itemId: item.id, delta: answer })
        notify('item/completed', { ...scope, item })
        notify('turn/completed', { threadId, turn: { id: turnId, status: 'completed', items: [item] } })
        notify('thread/status/changed', { threadId, status: { type: 'idle' } })
      }, 10)
      return
    }
    default:
      return send({ id: message.id, error: { code: -32601, message: 'Unsupported fixture method' } })
  }
})
`
