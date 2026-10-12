export function getCallerTerminalHandle(): string | undefined {
  return process.env.ORCA_TERMINAL_HANDLE || undefined
}
