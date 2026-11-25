import type { CommandSpec } from '../discovery/command-spec'
import { CLI_GLOBAL_FLAGS as GLOBAL_FLAGS } from '../../shared/cli/cli-argument-boundary'

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
  // Peek is one view per desktop, so these take no --terminal.
  ...[
    ['close', 'Close Peek if it shows this host'],
    ['back', 'Go back one page in Peek if it shows this host']
  ].map(([action, summary]) => ({
    path: ['hub', 'peek', action],
    summary,
    usage: `orca hub peek ${action} [--json]`,
    allowedFlags: [...GLOBAL_FLAGS]
  })),
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
  // Questions are read and answered without a caller pane, so the Orb and paired clients reach them.
  {
    path: ['hub', 'questions'],
    summary: 'List waiting agent questions, hub asks and gates with their options',
    usage: 'orca hub questions [--environment <name> | --all-hosts] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'all-hosts'],
    examples: [
      'orca hub questions --all-hosts --json',
      'orca hub questions --environment workhost'
    ],
    notes: [
      'Each host is reported as ok, unsupported (older Orca) or unreachable. An empty list means "none" only for an ok host whose coverage is complete; this is never a global guarantee.',
      '--all-hosts asks this machine and every saved environment. Older hosts still show which agents wait, as read-only rows with reason host_unsupported.',
      'Only questions marked answerable can be answered here. Tool permission approvals, consent and memory cards stay in Orca; gates name their gate-resolve command.'
    ]
  },
  {
    path: ['hub', 'answer'],
    summary: 'Answer one listed question with the option the person chose',
    usage:
      'orca hub answer --question <id> --option <id>... [--environment <name>] [--verify <duration>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'question', 'option', 'verify'],
    repeatableFlags: ['option'],
    examples: [
      'orca hub answer --question p_9c41e0b27a5d13f8c6aa --option 2 --json',
      'orca hub answer --environment workhost --question <requestId> --option 1 --option 3'
    ],
    notes: [
      'Pass the questionId and option id from orca hub questions on the same host. Agent prompts take one option; hub asks with --multi take several.',
      'The answer is bound to that exact prompt, terminal and agent process: a changed, resolved or restarted one is refused, never answered in its place.',
      'Retrying with the same option returns the first result (replayed: true) and writes nothing again; a different option is refused as already_answered.',
      'Evidence: accepted (written or settled), delivered (the prompt left the terminal) and agentContinued (the agent resumed work), each null when not observed. --verify sets how long to watch (default 3s, 0s skips, at most 30s).',
      'Exit 1 when refused or unknown. Older hosts fail with unsupported_host; nothing falls back to the UI.'
    ]
  },
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
  // Card commands always act on the caller's own cards, so there is no --terminal.
  ...[
    {
      verb: 'list',
      summary: 'List your own Agent Hub cards with their open drawer and permissions',
      usage: 'orca hub mirror list --mine [--json]',
      flags: ['mine'],
      booleanFlags: ['mine'],
      positionalArgs: undefined
    },
    {
      verb: 'show',
      summary: 'Open a drawer on your own card: work, inbound, changes or pr',
      usage: 'orca hub mirror show work|inbound|changes|pr [--mirror <id>] [--json]',
      flags: ['drawer', 'mirror'],
      booleanFlags: undefined,
      positionalArgs: ['drawer']
    },
    {
      verb: 'events',
      summary: 'Read what happened on your own cards since a cursor',
      usage: 'orca hub mirror events --since last|<seq> [--json]',
      flags: ['since'],
      booleanFlags: undefined,
      positionalArgs: undefined
    }
  ].map(({ verb, summary, usage, flags, booleanFlags, positionalArgs }): CommandSpec => ({
    path: ['hub', 'mirror', verb],
    summary,
    usage,
    allowedFlags: [...GLOBAL_FLAGS, ...flags],
    ...(booleanFlags ? { booleanFlags } : {}),
    ...(positionalArgs ? { positionalArgs } : {}),
    ...(verb === 'events' ? { valueFlags: ['since'] } : {}),
    notes: [
      'Only your own cards are visible and usable; a card of another agent is refused. It never opens a window, takes focus or raises one.',
      'Refusals are typed: no_card, not_your_card, drawer_closed_by_user (the person closed it this turn), not_available, agent_control_off, card_use_off.',
      ...(verb === 'events'
        ? [
            '--since last continues from the cursor kept for you; --since <seq> starts after that sequence number. Events are only read on request.'
          ]
        : [])
    ]
  })),
  hubSpec(['arrange'], 'Arrange Agent Hub mirrors', 'arrange [--layout <name>]', ['layout']),
  ...['open', 'close'].map((action) =>
    hubSpec(['canvas', action], `${action} the Agent Hub canvas`, `canvas ${action}`)
  )
]
