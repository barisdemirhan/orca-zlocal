import { expect, it } from 'vitest'
import type { NativeChatBlock } from '../../../../../../../shared/native-chat/native-chat-types'
import { lastOutputLines, workerDockCommandDetail } from './worker-dock-command-detail'

const task: NativeChatBlock = {
  type: 'background-task',
  taskId: 't1',
  kind: 'command',
  label: 'build',
  state: 'done',
  parentToolUseId: 'c1',
  outputFile: '/tmp/out/t1.output'
}
const call: NativeChatBlock = {
  type: 'tool-call',
  name: 'Bash',
  callId: 'c1',
  input: { command: 'make all' }
}

it('keeps the last lines and counts what was cut, ignoring trailing blanks and CRLF', () => {
  expect(lastOutputLines('a\r\nb\r\nc\r\n\r\n', 2)).toEqual({ text: 'b\nc', omitted: 1 })
})

it('pairs the command and its printed output by call id, not by position', () => {
  const blocks: NativeChatBlock[] = [
    { type: 'tool-result', callId: 'other', output: 'noise' },
    call,
    task,
    { type: 'tool-result', callId: 'c1', output: 'done\n' }
  ]
  expect(workerDockCommandDetail(blocks, 't1')).toMatchObject({
    command: 'make all',
    output: 'done\n'
  })
})

it('drops a background launch note that only names the output file', () => {
  const blocks: NativeChatBlock[] = [
    call,
    task,
    { type: 'tool-result', callId: 'c1', output: 'Output is being written to: /tmp/out/t1.output' }
  ]
  expect(workerDockCommandDetail(blocks, 't1')?.output).toBeNull()
})
