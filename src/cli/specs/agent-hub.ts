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
      'ask [<question> --option <text>... | --resume <requestId>] [--recommended <n>] [--multi] [--timeout <duration>] [--wait <duration>] [--if-away recommended]',
      ['question', 'option', 'recommended', 'multi', 'timeout', 'wait', 'if-away', 'resume'],
      ['question'],
      ['option']
    ),
    valueFlags: ['wait'],
    notes: [
      'Indices are one-based. The default timeout is 30m; durations accept ms, s, m, or h (maximum 24h).',
      '--timeout is the question lifetime on the host (default 30m). --wait is how long this command blocks (default 100s, capped at --timeout).',
      'Exit 2 means still pending: resume with orca hub ask --resume <requestId>. JSON returns status, requestId and resume argv. Exit 1 means the host timeout expired or another error occurred.',
      'After a lost connection or a pending result, use hub ask --resume <requestId> to wait for the same question. The original deadline is retained.'
    ]
  },
  hubSpec(
    ['progress'],
    'Set or clear this pane’s progress line',
    'progress <text> | progress --clear',
    ['text', 'clear'],
    ['text']
  ),
  {
    ...hubSpec(
      ['orb', 'remember'],
      'Orb only: propose a lasting memory for the user to approve',
      'orb remember <text>',
      ['text'],
      ['text']
    ),
    notes: [
      'Returns at once; the user accepts, edits or declines in the Orb window. Text is at most 280 characters.',
      'Refused when memory suggestions are off, or when the text is already pending, saved or was declined.'
    ]
  },
  hubSpec(['presence'], 'Read whether any connected desktop is present', 'presence'),
  hubSpec(['status'], 'Read Agent Hub cards (mirrors), parked cards and waiting panes', 'status'),
  hubSpec(
    ['mirror', 'open'],
    'Open a new Agent Hub card (floating mirror) showing the terminal',
    'mirror open'
  ),
  {
    ...hubSpec(
      ['mirror', 'add'],
      'Add the terminal as a tab in an Agent Hub card (floating mirror)',
      'mirror add [--into <handle>]',
      ['into']
    ),
    notes: [
      'Without --into the tab joins the card that shows your own terminal; if you are in no card, a new card opens.',
      '--into <handle> adds the tab to the card that shows that terminal (see hub status). The Orb has no card of its own, so it must pass --into to reach an existing card.',
      'The result says added, opened or already-there.'
    ]
  },
  hubSpec(['mirror', 'minimize'], 'Park the card that shows the terminal', 'mirror minimize'),
  hubSpec(
    ['mirror', 'restore'],
    'Restore the parked card that shows the terminal',
    'mirror restore'
  ),
  hubSpec(
    ['mirror', 'close'],
    'Close the card that shows the terminal; processes keep running',
    'mirror close'
  ),
  hubSpec(['arrange'], 'Arrange Agent Hub mirrors', 'arrange [--layout <name>]', ['layout']),
  ...['open', 'close'].map((action) =>
    hubSpec(['canvas', action], `${action} the Agent Hub canvas`, `canvas ${action}`)
  )
]
