import { useEffect, useRef } from 'react'

/**
 * Runs `bind` against the element a ref points at, and again whenever that element (or `key`)
 * changes. Why not a keyed effect on the ref: the hub's dock unmounts (Settings, auto-hide) and
 * comes back as a new element without the ref object changing, so an effect that captured
 * `ref.current` once keeps measuring and listening to the detached one, whose box is all zeros.
 */
export function useAnchorBinding<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  key: string,
  bind: (node: T) => () => void
): void {
  const boundRef = useRef<{ node: T; key: string; release: () => void } | null>(null)
  // Why every render: a ref changing its target neither re-renders nor re-runs keyed effects.
  // Why a passive effect: `bind` may read sibling refs, which attach after child layout effects.
  useEffect(() => {
    const node = ref.current
    const bound = boundRef.current
    if (bound && bound.node === node && bound.key === key) {
      return
    }
    bound?.release()
    boundRef.current = node ? { node, key, release: bind(node) } : null
  })
  useEffect(
    () => () => {
      boundRef.current?.release()
      boundRef.current = null
    },
    []
  )
}
