import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { recomputeOn } from '@/lib/recompute-on'

const anchorListeners = new WeakMap<object, Set<() => void>>()
const anchorsSettling = new WeakSet<object>()

/**
 * Points an anchor ref at its element and re-renders what is bound to it. Why not a plain ref
 * write: a ref changing its target re-renders nobody, and a bound component whose props hold
 * still (the compiler memoizes it) would keep the element that left.
 */
function setAnchorTarget<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  node: T | null
): void {
  ref.current = node
  if (anchorsSettling.has(ref)) {
    return
  }
  anchorsSettling.add(ref)
  // Why a microtask: a commit may detach and re-attach the same element; only what it settles on counts.
  queueMicrotask(() => {
    anchorsSettling.delete(ref)
    anchorListeners.get(ref)?.forEach((listener) => listener())
  })
}

/** A ref for `useAnchorBinding`, with the callback ref that keeps what follows it current. */
export function useAnchorTarget<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  (node: T | null) => void
] {
  const ref = useRef<T>(null)
  const attach = useCallback((node: T | null) => setAnchorTarget(ref, node), [])
  return [ref, attach]
}

function subscribeAnchor(ref: object, listener: () => void): () => void {
  const listeners = anchorListeners.get(ref) ?? new Set()
  anchorListeners.set(ref, listeners)
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Runs `bind` against the element a ref points at, and again whenever that element (or `key`)
 * changes. Why not a keyed effect on the ref: the hub's dock unmounts (Settings, auto-hide) and
 * comes back as a new element without the ref object changing, so an effect that captured
 * `ref.current` once keeps measuring and listening to the detached one, whose box is all zeros.
 * The caller re-renders when a `useAnchorTarget` ref moves, so its own placement runs again too.
 */
export function useAnchorBinding<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  key: string,
  bind: (node: T) => () => void
): void {
  const boundRef = useRef<{ node: T; key: string; release: () => void } | null>(null)
  const subscribe = useCallback((listener: () => void) => subscribeAnchor(ref, listener), [ref])
  const settled = useSyncExternalStore(subscribe, () => ref.current)
  // Why every render: `bind` is a fresh closure each time, and `key` may change with any of them.
  // Why a passive effect: `bind` may read sibling refs, which attach after child layout effects.
  useEffect(() => {
    // Why not `settled` itself: a plain ref notifies nobody, so only the ref knows its element.
    const node = recomputeOn([settled], () => ref.current)
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
