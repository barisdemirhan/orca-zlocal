import type { BotTemplate } from '../bot-templates'

export const BOT_TEMPLATES_AGENT_HUB: readonly BotTemplate[] = [
  {
    id: 'hub-orb',
    category: 'hub',
    name: 'Orb',
    line: 'Runs your Agent Hub: sees who is waiting and answers by your standing rules.',
    firstChat:
      'Asks for your standing rules (what it may answer on its own, what always comes to you), then looks at the Agent Hub with `orca hub status` and `orca hub questions --all-hosts`. It answers only what your rules cover and says so in one line.',
    mascot: 'A1',
    watches: 'Agents and workers waiting on you, on every host',
    does: 'Answers waiting questions by your standing rules and leaves the rest for you.',
    reports: 'Here, one line per round',
    connectors: [],
    schedules: [],
    events: [],
    skills: ['status-brief'],
    example: [
      'Answered 2 “continue?” prompts by your rule. 1 waits on you: delete the old migration?',
      'No agent is blocked.'
    ]
  },
  {
    id: 'hub-secretary',
    category: 'hub',
    name: 'Hub Secretary',
    line: 'Reads the Inbox every hour and sends you one summary of what needs you.',
    firstChat:
      'Reads what is waiting in the Agent Hub with `orca hub questions --all-hosts`, groups it by agent and host, and tells you what needs you first. It answers nothing.',
    mascot: 'E1',
    watches: 'The Agent Hub Inbox: questions, approvals and finished work',
    does: 'Groups what is waiting by agent and host and puts what needs you first.',
    reports: 'Here, every hour',
    connectors: [],
    schedules: [
      {
        id: 'hourly-inbox',
        when: 'Every hour',
        what: 'What needs you',
        rrule: '0 * * * *',
        prompt:
          'Read the Agent Hub with `orca hub questions --all-hosts --json` and `orca hub status`. Write one summary: what needs my owner, by agent and host, oldest first, and what can wait. Answer nothing. If nothing is waiting, say so in one line.'
      }
    ],
    events: [],
    skills: ['status-brief'],
    example: [
      '3 need you: a deploy approval (api), a naming question (docs), a failing test (app).',
      '5 agents are working; none are stuck.'
    ]
  },
  {
    id: 'night-watch',
    category: 'hub',
    name: 'Night Watch',
    line: 'Watches agents overnight and wakes you only for blockers.',
    firstChat:
      'Asks when your night starts and ends, then checks the Agent Hub through the night. What can wait goes into a morning list; only a blocked agent gets a notification, with `orca hub notify`.',
    mascot: 'N1',
    watches: 'Running agents and workers overnight',
    does: 'Keeps what can wait for the morning and notifies you only about blockers.',
    reports: 'Here, nightly, and a notification for a blocker',
    connectors: [],
    schedules: [
      {
        id: 'nightly-watch',
        when: 'Nightly at 11 PM',
        what: 'Night watch',
        rrule: '0 23 * * *',
        prompt:
          'Check the Agent Hub with `orca hub status` and `orca hub questions --all-hosts --json`. Anything that can wait goes into a list for the morning. Only if an agent is blocked and cannot continue without my owner, send one `orca hub notify` that names it. Repeat the check on each run until morning, and end with the morning list.'
      }
    ],
    events: [],
    skills: ['status-brief', 'incident-timeline'],
    example: [
      '2 agents finished, 1 asked a style question. All of it waits for the morning.',
      'Blocked at 02:10: the release agent needs a signing password.'
    ]
  },
  {
    id: 'review-sentry',
    category: 'hub',
    name: 'Review Sentry',
    line: 'Follows review threads, answers reviewers and asks before a force-push.',
    firstChat:
      'Asks which repos to follow, then reads the review comments on your open pull requests and drafts an answer to each. It asks you before it answers for you, and always before a force-push.',
    mascot: 'G1',
    watches: 'Review comments on your pull requests, and the agents working on them',
    does: 'Answers reviewers with what the agent changed, and asks you before a force-push.',
    reports: 'Here, when a reviewer writes',
    connectors: ['github'],
    schedules: [],
    events: [
      {
        id: 'review-comment',
        name: 'When a reviewer comments on your pull request: draft an answer',
        source: 'github',
        event: 'review_comment',
        prompt:
          'A reviewer commented on my owner’s pull request. Read the thread, check what the agent on that branch already changed, and draft an answer here with the pr-review-checklist skill. Post nothing on GitHub until my owner agrees, and never force-push without asking first.'
      }
    ],
    skills: ['pr-review-checklist'],
    example: [
      '#212: the reviewer asked why the retry is capped at 3. Draft answer below.',
      'The fix needs a force-push after a rebase. Go ahead?'
    ]
  },
  {
    id: 'upstream-watch',
    category: 'hub',
    name: 'Upstream Watch',
    line: 'Waits for new upstream releases and drafts the update notes.',
    firstChat:
      'Asks which upstream repo you follow, then waits for its new releases. When one lands it compares it with your branches and drafts what came and what it touches.',
    mascot: 'K2',
    watches: 'New releases of the upstream repo you pick',
    does: 'Drafts the update notes: what came, and which of your features it touches.',
    reports: 'Here, when a release lands',
    connectors: ['github'],
    schedules: [
      {
        id: 'daily-upstream',
        when: 'Weekdays at 8 AM',
        what: 'New upstream releases',
        rrule: '0 8 * * 1-5',
        prompt:
          'Check the upstream repo my owner follows for a release newer than the last one you wrote notes for. If there is one, draft the update notes with the release-notes-style skill: what came, and which of my owner’s branches it touches. If not, say nothing.'
      }
    ],
    events: [],
    skills: ['release-notes-style', 'dependency-upgrade'],
    example: [
      'v1.4.272 is out: 14 changes. 2 touch the Agent Hub tabs.',
      'Notes drafted. Start the update on the feature branch?'
    ]
  },
  {
    id: 'machine-hygiene',
    category: 'hub',
    name: 'Machine Hygiene',
    line: 'Finds sleeping workers and stale worktrees on each host and offers to clean up.',
    firstChat:
      'Lists workers with `orca orchestration worker-list` and workspaces with `orca worktree list` on each host, and tells you which are asleep or stale. It removes nothing until you pick.',
    mascot: 'H2',
    watches: 'Workers and workspaces on every host',
    does: 'Finds sleeping workers and stale workspaces, and removes the ones you pick.',
    reports: 'Here, Mondays at 9 AM',
    connectors: [],
    schedules: [
      {
        id: 'weekly-hygiene',
        when: 'Mondays at 9 AM',
        what: 'Cleanup list',
        rrule: '0 9 * * 1',
        prompt:
          'On each host, list workers with `orca orchestration worker-list` and workspaces with `orca worktree list`. Report sleeping workers and stale workspaces with the workspace-hygiene skill, per host, with what each takes up. Remove nothing; wait for my owner to pick.'
      }
    ],
    events: [],
    skills: ['workspace-hygiene'],
    example: [
      'mac: 4 sleeping workers, 2 stale workspaces. pd: 1 worker, 6 workspaces merged.',
      'Remove the 6 merged ones on pd?'
    ]
  }
]
