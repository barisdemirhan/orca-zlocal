import { useEffect, useRef, useState } from 'react'
import type { AgentHubInboxItemGroup, AgentHubInboxModel } from './agent-hub-inbox-model'
import { useAgentHubPanelListState } from './agent-hub-panel-list-state'
import { holdAgentHubOrder, sortByHeldOrder } from './agent-hub-stable-order'

const IDLE_RESORT_MS = 3000

/**
 * While the panel is open, new senders append to the end of their box; the order is recomputed
 * on pointer leave or after 3 s without pointer movement.
 */
export function useAgentHubHeldInbox(
  model: AgentHubInboxModel,
  rootRef: React.RefObject<HTMLElement | null>
): AgentHubInboxModel['boxes'] {
  const { sortOrder } = useAgentHubPanelListState()
  const heldRef = useRef<Record<string, string[]>>({})
  const [resortTick, setResortTick] = useState(0)
  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const resort = (): void => {
      heldRef.current = {}
      setResortTick((tick) => tick + 1)
    }
    const arm = (): void => {
      clearTimeout(timer)
      timer = setTimeout(resort, IDLE_RESORT_MS)
    }
    root.addEventListener('pointerleave', resort)
    root.addEventListener('pointermove', arm)
    arm()
    return () => {
      clearTimeout(timer)
      root.removeEventListener('pointerleave', resort)
      root.removeEventListener('pointermove', arm)
    }
  }, [rootRef])
  void resortTick
  return model.boxes.map((box) => {
    const ids = box.groups.map((group) => group.key)
    // Why keyed by the sort: picking another order is a deliberate re-sort, not a surprise.
    const heldKey = `${box.side}\0${sortOrder}`
    const held = holdAgentHubOrder(heldRef.current[heldKey] ?? [], ids)
    heldRef.current[heldKey] = held
    const groups: AgentHubInboxItemGroup[] = sortByHeldOrder(box.groups, (g) => g.key, held)
    return { side: box.side, groups }
  })
}
