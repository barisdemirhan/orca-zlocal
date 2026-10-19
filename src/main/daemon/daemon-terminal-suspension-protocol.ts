import type { TerminalSuspensionOptions } from '../../shared/terminal-suspension'
export type TerminalSuspensionRequest = {
  id: string
  type: 'terminalSuspension'
  payload: { sessionId: string } & TerminalSuspensionOptions
}
