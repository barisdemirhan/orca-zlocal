import type { CodexSession } from './codex-structured-session-state'
import { isCodexTurnOptionKey } from './codex-structured-turn-start'

export function readCodexAcquisitionOptions(
  session: CodexSession,
  priorOptions?: Readonly<Record<string, string>>
) {
  const options = {
    ...Object.fromEntries(
      Object.entries(priorOptions ?? {}).filter(([key]) => !isCodexTurnOptionKey(key))
    ),
    ...Object.fromEntries(session.options)
  }
  const reported = session.reportedOptions
  // The thread's effort belongs to the thread's model, not to a different saved one.
  if (
    options.effort === undefined &&
    reported.effort &&
    (options.model === undefined || options.model === reported.model)
  ) {
    options.effort = reported.effort
  }
  if (options.model === undefined && reported.model) {
    options.model = reported.model
  }
  return Object.keys(options).length > 0 ? options : undefined
}

export function readCodexAcquisitionOptionsFrom(session: (sessionId: string) => CodexSession) {
  return (input: { sessionId: string; priorOptions?: Readonly<Record<string, string>> }) =>
    readCodexAcquisitionOptions(session(input.sessionId), input.priorOptions)
}
