export type TerminalSuspensionResult = {
  state: 'awake' | 'suspended' | 'unsupported' | 'unverifiable'
  incarnationId?: string
}
export type TerminalSuspensionOptions = {
  suspended?: boolean
  expectedIncarnationId?: string
}
