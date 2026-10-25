# Agent Hub

Agent Hub is the user's view of agents, questions, progress, and terminal mirrors. Use
it for a useful result, a decision, a brief progress line, or mirrors of agents you started.
Prefer your native question tool (for example, AskUserQuestion) when available; use
`hub ask` when you have no native tool or are calling from a script.

Run inside an Orca terminal. `ORCA` means the executable resolved in the discovery stub;
usage lines below match its command specs. All commands accept `--terminal <handle>`
to target a pane on the execution host; omitting it targets your own pane. Prefer `--json`.
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
- `progress` replaces one line (1–80 characters), coalesces updates to once per second,
  and expires after ten minutes without an update. Clear it when finished.
- `status` returns host-scoped `result.mirrors`, `parked`, and `waiting` pane lists with
  `paneKey` and `terminalHandle`. Parked panes are minimized mirrors; waiting includes
  agents needing input and pending Hub questions, consents, and orchestration gates.

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
ORCA hub mirror add [--terminal <handle>] [--json]
ORCA hub mirror add --terminal <helperHandle> --json
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

- `open` opens a mirror of the target. `add` adds the target as a tab in your open mirror;
  without an open caller mirror, it opens a mirror for the target instead.
- `minimize`, `restore`, and `close` act on the mirror containing the target, including
  its other tabs. Closing a mirror does not terminate its terminal process.
- `arrange` accepts `grid`, `columns`, or `rows`; omitted `--layout` uses the user's
  default arrangement (`grid` if unset). Other names fail with `invalid_argument`.
- `canvas open` requires the user's Agent Hub canvas setting enabled; otherwise it
  fails with `invalid_argument`. `canvas close` closes the canvas.

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
