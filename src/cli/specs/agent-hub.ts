import { GLOBAL_FLAGS, type CommandSpec } from '../args'

function hubSpec(
  verb: string[],
  summary: string,
  usage: string,
  flags: string[] = [],
  positionalArgs?: string[],
  repeatableFlags?: string[]
): CommandSpec {
  return {
    path: ['hub', ...verb],
    summary,
    usage: `orca hub ${usage} [--terminal <handle>] [--json]`,
    allowedFlags: [...GLOBAL_FLAGS, 'terminal', ...flags],
    positionalArgs,
    repeatableFlags,
    identityFlagRoles: { terminal: 'target' }
  }
}

export const AGENT_HUB_COMMAND_SPECS: CommandSpec[] = [
  hubSpec(
    ['notify'],
    'Notify the person using Agent Hub',
    'notify <text> [--level info|done|needs-you] [--sound] [--link <url|path>]...',
    ['text', 'level', 'sound', 'link'],
    ['text'],
    ['link']
  ),
  hubSpec(['peek'], 'Show a host URL or file in Agent Hub', 'peek <url|path>', ['link'], ['link']),
  {
    ...hubSpec(
      ['ask'],
      'Ask the person a question and wait for the answer',
      'ask <question> --option <text>... [--recommended <n>] [--multi] [--timeout <duration>] [--if-away recommended]',
      ['question', 'option', 'recommended', 'multi', 'timeout', 'if-away', 'resume'],
      ['question'],
      ['option']
    ),
    notes: [
      'Indices are one-based. The default timeout is 30m; durations accept ms, s, m, or h (maximum 24h).',
      'After a lost connection, use hub ask --resume <requestId> to wait for the same question. The original deadline is retained.'
    ]
  },
  hubSpec(
    ['progress'],
    'Set or clear this pane’s progress line',
    'progress <text> | progress --clear',
    ['text', 'clear'],
    ['text']
  ),
  hubSpec(['presence'], 'Read whether any connected desktop is present', 'presence'),
  hubSpec(['status'], 'Read open mirrors, parked panes and waiting panes', 'status'),
  ...['open', 'add', 'minimize', 'restore', 'close'].map((action) =>
    hubSpec(['mirror', action], `${action} an Agent Hub mirror`, `mirror ${action}`)
  ),
  hubSpec(['arrange'], 'Arrange Agent Hub mirrors', 'arrange [--layout <name>]', ['layout']),
  ...['open', 'close'].map((action) =>
    hubSpec(['canvas', action], `${action} the Agent Hub canvas`, `canvas ${action}`)
  )
]
