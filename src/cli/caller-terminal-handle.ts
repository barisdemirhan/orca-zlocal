export function getCallerTerminalHandle(): string | undefined {
  return process.env.ORCA_TERMINAL_HANDLE || undefined
}

export function getCallerAgentSessionId(): string | undefined {
  return process.env.ORCA_AGENT_SESSION_ID?.trim() || undefined
}
