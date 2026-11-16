import * as z from 'zod'
import { requiredString } from '../rpc-param-primitives'
import { OptionalExecutionHostId } from '../workspaces/worktree-params'

const TerminalSurfaceCloseIdentity = z.object({
  worktreeId: requiredString('Missing worktree id'),
  tabId: requiredString('Missing tab id'),
  leafId: requiredString('Missing leaf id'),
  createdAt: z.number().finite().nullable(),
  generation: z.number().int().nonnegative(),
  hasLeaf: z.boolean(),
  ptyId: z.string().nullable(),
  incarnationId: z.string().nullable()
})
export const TerminalSurfaceCloseCapture = z.object({
  identity: TerminalSurfaceCloseIdentity,
  holders: z
    .array(
      z.object({
        hostId: OptionalExecutionHostId.unwrap(),
        identity: TerminalSurfaceCloseIdentity.nullable()
      })
    )
    .max(64)
})
