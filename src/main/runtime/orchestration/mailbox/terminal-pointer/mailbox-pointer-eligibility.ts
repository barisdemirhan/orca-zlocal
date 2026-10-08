import '../../db/orchestration-db'
import '../../db/contract-constants'
import { ORCHESTRATION_DELIVERY_BATCH_LIMIT } from '../../db/messages/mailbox-routing-page'
import '../../db/dispatch-row-writer'
import '../../db/attempt-outcome-projection'
import type { MessageRow } from '../../db/orchestration-records'
import type { OrchestrationDb } from '../../db/orchestration-db'

export type OrchestrationMessageWaiter = { typeFilter: string[] | undefined }

export function messageTypeHasOrchestrationWaiter(
  waiters: ReadonlySet<OrchestrationMessageWaiter> | undefined,
  messageType: string
): boolean {
  for (const waiter of waiters ?? []) {
    if (!waiter.typeFilter || waiter.typeFilter.includes(messageType)) {
      return true
    }
  }
  return false
}

export function hasUnfilteredOrchestrationWaiter(
  waiters: ReadonlySet<OrchestrationMessageWaiter> | undefined
): boolean {
  for (const waiter of waiters ?? []) {
    if (!waiter.typeFilter) {
      return true
    }
  }
  return false
}

export type OrchestrationPointerBatch = {
  messages: MessageRow[]
  /** The consumer's unacked batch, named in the reminder. */
  heldDeliveryId: string | undefined
}

/**
 * A status row reports liveness, so it must not wake a reader blocked for the actionable types. It
 * stays unread and rides along with the next pointer or `check`. Unfiltered waiters never get here.
 */
function isQuietOrchestrationPointerBatch(
  messages: readonly { type: string }[],
  waiters: ReadonlySet<OrchestrationMessageWaiter> | undefined
): boolean {
  return (
    (waiters?.size ?? 0) > 0 &&
    messages.length > 0 &&
    messages.every((message) => message.type === 'status')
  )
}

/** Both delivery lanes share this synchronous SQL selection; unfiltered waiters preempt all pointers.
 * Concrete waiter types are excluded byte-exactly in SQL; no JavaScript post-filter is needed.
 * An unacked batch defers rather than drops: only mail it does not hold is eligible, once each. */
export function selectOrchestrationPointerBatch(input: {
  db: OrchestrationDb
  mailboxHandle: string
  waiters: ReadonlySet<OrchestrationMessageWaiter> | undefined
  reservedTypes: ReadonlySet<string> | undefined
  /** A terminal's own mailbox leaves rows a Run owns undelivered for routing to move. */
  excludeRunOwnedDirect?: boolean
}): OrchestrationPointerBatch {
  if (hasUnfilteredOrchestrationWaiter(input.waiters)) {
    return { messages: [], heldDeliveryId: undefined }
  }
  const excludedTypes = new Set(input.reservedTypes)
  for (const waiter of input.waiters ?? []) {
    for (const type of waiter.typeFilter ?? []) {
      excludedTypes.add(type)
    }
  }
  const held = input.db.getOutstandingMailboxDelivery?.(input.mailboxHandle)
  const unread = (excludeTypes: string[], limit: number): MessageRow[] =>
    input.db.getUndeliveredUnreadMessages(input.mailboxHandle, undefined, {
      excludeTypes,
      excludeIds: held?.messageIds,
      excludeRunOwnedDirect: input.excludeRunOwnedDirect,
      limit
    })
  const batch = unread([...excludedTypes], ORCHESTRATION_DELIVERY_BATCH_LIMIT)
  // Why: quiet rows stay undelivered and pile up oldest-first, so a full page of them can hide an
  // actionable row past the limit; that row must still point.
  const silent =
    isQuietOrchestrationPointerBatch(batch, input.waiters) &&
    !(
      batch.length >= ORCHESTRATION_DELIVERY_BATCH_LIMIT &&
      unread([...excludedTypes, 'status'], 1).length > 0
    )
  return { messages: silent ? [] : batch, heldDeliveryId: held?.id }
}

export function shouldReleaseOrchestrationPointer(
  db: OrchestrationDb | null,
  mailboxHandle: string,
  messages: readonly { id: string; type: string }[],
  waiters: ReadonlySet<OrchestrationMessageWaiter> | undefined
): boolean {
  // A check that took this pointer's mail into a batch already showed it to the agent.
  const held = db?.getOutstandingMailboxDelivery?.(mailboxHandle)
  if (held && messages.some((message) => held.messageIds.includes(message.id))) {
    return true
  }
  if (messages.some((message) => messageTypeHasOrchestrationWaiter(waiters, message.type))) {
    return true
  }
  return !(
    db?.areUnreadMessages?.(
      mailboxHandle,
      messages.map((message) => message.id)
    ) ?? true
  )
}
