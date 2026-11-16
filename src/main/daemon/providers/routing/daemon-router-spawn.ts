import type { DaemonPtyAdapter } from '../adapter/daemon-pty-adapter'
import type { PtySpawnOptions } from '../../../providers/pty/provider-contract'
import type { PtySpawnResult } from '../../../providers/pty/spawn-result'
import type { LegacyDaemonExitProof } from './daemon-legacy-exit-proof'
import type { DaemonSessionOwnerResolver } from './daemon-session-owner-resolution'
import { routeSpawnOrHold } from './daemon-router-newer-daemon-hold'
import { findLegacySessionOwner } from './daemon-router-legacy-owner'

export async function routeDaemonSpawn(input: {
  opts: PtySpawnOptions
  current: DaemonPtyAdapter
  legacy: DaemonPtyAdapter[]
  sessionAdapters: Map<string, DaemonPtyAdapter>
  ownerResolver: DaemonSessionOwnerResolver<DaemonPtyAdapter>
  legacyExitProof: LegacyDaemonExitProof
}): Promise<PtySpawnResult> {
  const { opts, current, legacy, sessionAdapters, ownerResolver, legacyExitProof } = input
  if (opts.attachOnly && opts.sessionId) {
    return await ownerResolver.spawnAttachOnly({ ...opts, sessionId: opts.sessionId })
  }
  const adapter =
    (opts.sessionId ? sessionAdapters.get(opts.sessionId) : undefined) ??
    (await findLegacySessionOwner(opts, current, legacy, legacyExitProof))
  const target = await routeSpawnOrHold(opts, adapter, current, ownerResolver)
  const result = await target.spawn(opts)
  if (!result.exitedBeforeSpawnReply) {
    ownerResolver.recordRoute(result.id, target, result.incarnationId)
  }
  return result
}
