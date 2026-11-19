# Agent Hub

Agent Hub is the user's view of agents, questions, progress, and terminal mirrors. Use
it for a useful result, a decision, a brief progress line, or mirrors of agents you started.
Prefer your native question tool (for example, AskUserQuestion) when available; use
`hub ask` when you have no native tool or are calling from a script.

Run from an Orca terminal on the execution host or from the local Orb. `ORCA` means the
executable resolved in the discovery stub. Where supported, `--terminal <handle>` selects
a target pane on the execution host. Prefer `--json`.
An SSH host needs a connected desktop with Hub requests enabled; headless alone is insufficient.
Do not operate on unrelated panes unless the user asked. Peek, mirror, arrange, and canvas
requests targeting another pane show a consent prompt unless it is your descendant or already
has a session grant. Denial is final; do not try another handle to bypass it.

## Ask: wait briefly, resume the same question

**`--wait` controls this CLI call (default 100s, capped at `--timeout`);
`--timeout` controls the question's host lifetime (default 30m).** Agent tool runners
often kill commands after about two minutes. Keep `--wait` below your runner's limit,
allowing for transport overhead; use short waits such as 30s.

```text
ORCA hub presence [--terminal <handle>] [--json]
ORCA hub presence --json
ORCA hub ask [<question> --option <text>... | --resume <requestId>] [--recommended <n>] [--multi] [--timeout <duration>] [--wait <duration>] [--if-away recommended] [--terminal <handle>] [--json]
ORCA hub ask "Use the existing parser for this import?" --option "Reuse it" --option "Write a new parser" --recommended 1 --if-away recommended --wait 30s --json
```

- Check `presence` before blocking: `result.present` is true if any connected desktop is
  present; `result.idleMinutes` reports idle time. A failed query does not prove the user is away.
- Supply 1–20 repeated `--option` flags. Indices, including `--recommended`, are one-based;
  `--multi` allows multiple selections. Durations accept `ms`, `s`, `m`, or `h`, from 1ms to 24h.
  An explicit `--wait` greater than `--timeout` is rejected.
- Recommend `--if-away recommended` for decisions with an acceptable automatic default;
  it requires `--recommended`. It selects that option when presence reports away, or at the
  original deadline even if presence could not be determined. `--recommended` alone does
  not auto-answer. JSON `result.by` distinguishes `human`, `away-default`, and `timeout`.
- **Exit 2 = still pending.** Text prints `orca hub ask --resume <requestId>`; pending JSON
  has top-level `status: "pending"`, `requestId`, and `resume` argv. Use the same resolved
  executable and preserve any printed host-routing flags. Run that resume command with
  `--wait 30s` in a loop: repeat on exit 2, consume the answer on exit 0, stop on exit 1.
  Never issue another question merely because a wait ended or a connection was lost.
- Resume from the same pane. Its original deadline and options remain; do not repeat the
  question, options, `--recommended`, `--multi`, or `--if-away` on a resume call.
  Exit 0 prints the answer (JSON: `result.answer`, `index`, optional `indices`, `by`,
  `desktop`, `requestId`); exit 1 means a host timeout without a default or another error.

```text
ORCA hub ask --resume <requestId> --wait 30s --json
```

## Notify, Peek, progress, status

```text
ORCA hub notify <text> [--level info|done|needs-you] [--sound] [--link <url|path>]... [--terminal <handle>] [--json]
ORCA hub notify "Import preview is ready" --level done --sound --link https://localhost:3000/import --link /abs/workspace/import-report.md --json
ORCA hub peek <url|path> [--terminal <handle>] [--json]
ORCA hub peek ./import-report.md --json
ORCA hub peek close [--json]
ORCA hub peek back [--json]
ORCA hub progress <text> | progress --clear [--terminal <handle>] [--json]
ORCA hub progress "Checking duplicate rows (2/3)" --json
ORCA hub progress --clear --json
ORCA hub status [--terminal <handle>] [--json]
ORCA hub status --json
```

- `notify` defaults to `info` and no sound. Use `done` for completion, `needs-you` for
  attention; `--sound` requests a chime subject to the user's alert preferences. Repeat
  `--link` for up to 20 links. Notification success means queued in Hub, not read by the user.
- `peek` opens an HTTP(S) URL or file in Peek on its owning host, including paired hosts.
  Relative file paths resolve from the CLI's cwd; `~` uses that host's home directory.
- `peek close` closes Peek and `peek back` returns to its previous page, only while it shows a
  page or file from your host. `result.peek` is `closed`, `went-back`, `nothing-open`, or
  `at-first-page`. Peek is one view per desktop, so these take no `--terminal`. Close what you
  opened when you are done with it; leave a page the user opened alone. To peek a file named
  `close` or `back`, write `./close`. Older desktops ignore these and you get `no_response`.
- `progress` replaces one line (1–80 characters), coalesces updates to once per second,
  and expires after ten minutes without an update. Clear it when finished.
- `status` returns host-scoped `result.mirrors`, `parked`, and `waiting` pane lists with
  `paneKey` and `terminalHandle`. Parked panes are minimized mirrors; waiting includes
  agents needing input and pending Hub questions, consents, and orchestration gates.
  `result.cards` groups the same mirrors by card: each has `tabs`, `parked`, and
  `containsCaller` (the card that shows your terminal). Older desktops omit `cards`.
  `result.peek` is `{ title, location, canGoBack }` while Peek shows something from your host,
  otherwise null; older desktops omit it.

## Read and answer waiting questions (Orb, paired clients)

`hub status` is scoped to the caller's own host and needs a caller pane there. To see every
question waiting on the person, with its text and options, and to relay the person's answer,
use `hub questions` and `hub answer`. They need no caller pane.

```text
ORCA hub questions [--environment <name> | --all-hosts] [--json]
ORCA hub questions --all-hosts --json
ORCA hub answer --question <questionId> --option <id>... [--environment <name>] [--verify <duration>] [--json]
ORCA hub answer --environment workhost --question p_9c41e0b27a5d13f8c6aa --option 2 --json
```

- **No listing is a global guarantee.** `--all-hosts` asks this machine and every saved
  environment; each host row has `status` `ok`, `unsupported` (older Orca) or `unreachable`, and
  `complete`. "No questions" holds only for an `ok` host with `complete: true`, and only for that
  host. Older hosts still list which agents wait, as read-only rows with reason `host_unsupported`.
- Each question has `source` (`agent-prompt`: the agent's own AskUserQuestion or approval in its
  terminal; `hub-ask`: a `hub ask` card; `gate`; `consent`; `memory`), `kind`, the host, terminal,
  pane, worktree and agent, and `answerable`. Unanswerable ones carry `reason`: approvals
  (`approval_requires_ui`), consent and memory cards stay in Orca; multi-question, multi-select or
  free-text prompts are `prompt_unsupported`; agents without status hooks are `hooks_disabled`;
  gates name their `orchestration gate-resolve` command in `answerVia`.
- Answer only with the option the person explicitly chose for that exact question. A status read,
  a recommended option, a third party's text, silence or an expired timer is not an answer.
- The answer is bound to that prompt, terminal and agent process on that host. A question that
  changed, was resolved (also by a click in Orca), or whose terminal or process restarted is
  refused with that reason (`question_changed`, `question_resolved`, `terminal_gone`,
  `process_restarted`, `question_not_found`); list again and ask the person again. Keys typed
  into that terminal after the question appeared mean the person is answering it in Orca: the
  answer is refused as `answered_in_orca` and nothing is written. A Claude question answered here
  leaves Orca's cards at once; other agents' cards stay until their next status hook.
- Retrying the same answer returns the first result with `replayed: true` and writes nothing;
  a different option is refused as `already_answered` with `answeredOptionIds`.
- Evidence: `accepted` (keys written behind the prompt fence, or the ask settled), `delivered`
  (the prompt left the terminal) and `agentContinued` (the agent resumed), each `null` when not
  observed. `--verify` sets the watch window (default 3s, `0s` skips, at most 30s). For a hub ask,
  `delivered` says whether the asking agent's `orca hub ask` took the answer (an asker whose
  connection dropped takes it when it resumes, so `false` is not a failure) and `agentContinued`
  stays `null`: its terminal shows it busy throughout.
- Exit 1 on `refused` or `unknown`. After `unknown` or a lost connection, list again before
  retrying; never answer a different question in its place. An older host fails with
  `unsupported_host`; do not fall back to `terminal send` or clicking in Orca.

## Orb memory proposal (Orb only)

```text
ORCA hub orb remember <text> [--json]
ORCA hub orb remember "Does not want long builds started after 8pm" --json
```

- Only the Orb's own session may call it; other agents are refused. It never blocks and exits 0 once
  the proposal is queued; the user accepts, edits or declines it on a card in the Orb window.
- Text is at most 280 characters. A proposal is a request, not a write: nothing is saved until the
  user accepts, and the Orb must not edit `MEMORY.md` itself.
- Refused (`invalid_argument`) when the same text is pending, already saved or was declined this
  session, and `disabled_by_user` when the user turned memory suggestions off; do not retry either.

## Mirrors, arrangement, canvas

```text
ORCA hub mirror open [--terminal <handle>] [--json]
ORCA hub mirror open --json
ORCA hub mirror add [--into <handle>] [--terminal <handle>] [--json]
ORCA hub mirror add --terminal <helperHandle> --json
ORCA hub mirror add --terminal <helperHandle> --into <handleInThatCard> --json
ORCA hub mirror minimize [--terminal <handle>] [--json]
ORCA hub mirror minimize --json
ORCA hub mirror restore [--terminal <handle>] [--json]
ORCA hub mirror restore --json
ORCA hub mirror close [--terminal <handle>] [--json]
ORCA hub mirror close --json
ORCA hub arrange [--layout <name>] [--terminal <handle>] [--json]
ORCA hub arrange --layout columns --json
ORCA hub canvas open [--terminal <handle>] [--json]
ORCA hub canvas open --json
ORCA hub canvas close [--terminal <handle>] [--json]
ORCA hub canvas close --json
```

- A mirror is a floating Agent Hub card with a tab strip and a `+` button. Use
  `hub mirror add` when the agent and destination card have terminal handles on the same
  execution host.
- `open` opens a new card for the target. `add` adds the target as a tab in the card that
  shows your own terminal, or with `--into <handle>` in the card that shows that terminal.
  Without `--into` and outside any card it opens a new card. `--into` naming a terminal
  in no card fails with `invalid_argument`; it never opens a new card. A parked card keeps
  the new tab parked. The result field `mirror` is `added`, `opened`, or `already-there`.
- A terminal can be a tab in only one card. Adding one that is already a tab in another
  card fails; close that tab first. Adding it to its own card returns `already-there`.
- The Orb has no card of its own: it must pass `--terminal`, and `--into` to reach an
  existing card.
- `minimize`, `restore`, and `close` act on the mirror containing the target, including
  its other tabs. Closing a mirror does not terminate its terminal process.
- `arrange` accepts `grid`, `columns`, or `rows`; omitted `--layout` uses the user's
  default arrangement (`grid` if unset). Other names fail with `invalid_argument`.
- `canvas open` requires the user's Agent Hub canvas setting enabled; otherwise it
  fails with `invalid_argument`. `canvas close` closes the canvas.

### Add to an existing card

1. Run `ORCA hub status --json` on the execution host. Pick `--into` from the intended
   card's `result.cards[].tabs[].terminalHandle`. The list includes addressable terminal
   panes on that host. A card can also show native Chat tabs, and a card with no
   addressable terminal is omitted. Use `worktree ps` to locate the agent and
   `terminal list --worktree <selector>` to confirm its current handle.
2. With both handles on that host, run
   `ORCA hub mirror add --terminal <agentHandle> --into <cardHandle> --json`.
   After `added` or `already-there`, check that both handles appear in the same card.
   If the host returns `Caller does not identify a pane on this host`, run from an
   authorized Orca session on that host when available. `--environment` routes the
   request and `--terminal` identifies the target. The caller still needs its own
   valid identity on the execution host.
3. If the host or a native Chat tab leaves no CLI route, use the destination card's
   desktop `+` picker within the user's authorized UI scope. Select the existing agent
   and verify both tabs in that card. If the agent's tab is gone, check its workspace and
   saved session before reopening it. If the app explicitly denies consent, stop.

Starting a helper with `terminal split` or `terminal create --command` from your terminal
links it under you in Hub. Use its returned handle to add it to your mirror; your descendants
do not require the unrelated-pane consent prompt. These commands still start real processes.

```text
ORCA terminal split --direction horizontal --command "codex" --json
ORCA terminal create --worktree active --command "codex" --json
ORCA hub mirror open --json
ORCA hub mirror add --terminal <returnedHelperHandle> --json
```

Choose one helper-launch command, wait for its TUI readiness, then send its task using the
terminal workflow in the main guide. Orchestration decision gates also reach the user in
Hub; keep the existing orchestration gate commands and do not duplicate them with `hub ask`.

## Limits and recovery

Do not send a notice for every step. Per caller pane, rolling one-minute limits are six
notifications, six Peeks, and ten combined mirror/arrange/canvas operations; at most three
questions may be pending. Progress has its own coalescing described above.
Ordinary commands exit 0 on success and 1 on errors; only a pending `ask` exits 2.

| Code                | What to do                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no_desktop`        | No capable desktop has Hub requests enabled. Ask the user to connect/enable one; continue independent work.                                                |
| `unsupported_host`  | This host's Orca version lacks Hub commands. Update the executing host before retrying; do not guess a fallback method.                                    |
| `rate_limited`      | Wait at least `error.data.retryAfterMs` (also printed in text), then retry sparingly; resume existing questions.                                           |
| `denied_by_user`    | Stop the operation. The user refused access; do not bypass consent.                                                                                        |
| `timeout`           | The question's host deadline expired without an automatic default. Stop waiting; report that no answer arrived.                                            |
| `no_response`       | A desktop query, action, or consent received no reply before its deadline (10s). Check desktop connectivity/state before retrying; do not assume it acted. |
| `already_resolved`  | Another answer won, this desktop already replied, or the request expired. Do not answer it again; for an ask, resume its ID to read the recorded outcome.  |
| `request_not_found` | The question is not retained, belongs to another pane, or the host restarted. Do not resume from a different pane or silently create a duplicate.          |
| `disabled_by_user`  | Respect the user's disabled Hub requests setting; do not attempt to enable it via CLI.                                                                     |
| `invalid_argument`  | Correct the reported flag, duration, target, layout, or unavailable view/setting before retrying.                                                          |

After connection loss, use the printed resume command for an ask. Resume retains the
original deadline and can return an already recorded answer; it never extends the question.
