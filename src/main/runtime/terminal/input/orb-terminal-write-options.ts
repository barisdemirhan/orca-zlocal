import type { TerminalInputKind } from '../../../../shared/terminal/input/terminal-input-kind'
import { readOrbOperations } from '../../agent-hub/agent-hub-orb-operations'

export function protectOrbTerminalWriteOptions<
  T extends {
    inputKind: TerminalInputKind
    beforeWrite?: (ptyId: string) => void | Promise<void>
  }
>(runtime: object, handle: string, options: T) {
  const beforeWrite = options.beforeWrite
  return {
    ...options,
    beforeWrite: async (ptyId: string) => {
      if (options.inputKind !== 'query-reply') {
        readOrbOperations(runtime)?.assertWritable({
          kind: 'terminal',
          ptyId,
          terminalHandle: handle
        })
      }
      await beforeWrite?.(ptyId)
    }
  }
}
