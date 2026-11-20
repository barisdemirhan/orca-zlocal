import { compactIpcErrorMessage } from '@/runtime/errors/ipc-error'

export function agentHubOrbErrorMessage(error: unknown, fallback: string): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? error.message : null
  return typeof message === 'string' ? (compactIpcErrorMessage(message) ?? fallback) : fallback
}
