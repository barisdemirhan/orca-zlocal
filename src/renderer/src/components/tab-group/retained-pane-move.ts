import { createContext } from 'react'

export type RetainedPaneMoveParticipant = () => () => void
export const RetainedPaneMoveContext = createContext<Set<RetainedPaneMoveParticipant> | null>(null)

export function moveRetainedPaneContent(
  container: HTMLElement,
  destination: HTMLElement,
  participants: ReadonlySet<RetainedPaneMoveParticipant>
): void {
  if (container.parentElement === destination) {
    return
  }
  const afterMove = [...participants].map((capture) => capture())
  destination.appendChild(container)
  afterMove.forEach((restore) => restore())
}
