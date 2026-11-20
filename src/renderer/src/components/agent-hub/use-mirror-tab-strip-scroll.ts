import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useTabStripDragScrollHandlers } from '../tab-bar/strip/tab-strip-drag-scroll'
import { bindTabStripWheelScroll } from '../tab-bar/strip/tab-strip-wheel-scroll'

export function useMirrorTabStripScroll(ref: RefObject<HTMLDivElement | null>, count: number) {
  const [canScroll, setCanScroll] = useState({ start: false, end: false })
  const edge = useRef<'start' | 'end' | null>(null)
  const update = useCallback(() => {
    const list = ref.current
    if (list) {
      setCanScroll({
        start: list.scrollLeft > 0,
        end: list.scrollLeft + list.clientWidth < list.scrollWidth - 1
      })
    }
  }, [ref])
  const scroll = useCallback(
    (direction: 'start' | 'end') => {
      const list = ref.current
      if (list) {
        list.scrollLeft += (direction === 'start' ? -1 : 1) * 96
        update()
      }
    },
    [ref, update]
  )
  const handlers = useTabStripDragScrollHandlers(scroll, canScroll)
  useEffect(() => {
    if (ref.current) {
      return bindTabStripWheelScroll(ref.current, update)
    }
    return undefined
  }, [ref, update])
  useEffect(() => {
    if (!handlers.isTabDragActive) {
      edge.current = null
    }
  }, [handlers.isTabDragActive])
  useLayoutEffect(() => {
    update()
    const observer = new ResizeObserver(update)
    if (ref.current) {
      observer.observe(ref.current)
    }
    return () => observer.disconnect()
  }, [count, ref, update])
  return {
    onScroll: update,
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!handlers.isTabDragActive) {
        return
      }
      const rect = event.currentTarget.getBoundingClientRect()
      const next =
        event.clientX < rect.left + 24 ? 'start' : event.clientX > rect.right - 24 ? 'end' : null
      if (next === edge.current) {
        return
      }
      edge.current = next
      if (next === 'start') {
        handlers.onDragScrollStartEnter()
      } else if (next === 'end') {
        handlers.onDragScrollEndEnter()
      } else {
        handlers.onDragScrollLeave()
      }
    },
    onPointerLeave: (): void => {
      edge.current = null
      handlers.onDragScrollLeave()
    }
  }
}
