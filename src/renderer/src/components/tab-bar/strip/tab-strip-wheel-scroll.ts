import { scrollStripSidewaysOnWheel } from './tab-strip-scroll-metrics'

export function bindTabStripWheelScroll(el: HTMLElement, onScroll: () => void): () => void {
  const onWheel = (event: WheelEvent): void => {
    if (scrollStripSidewaysOnWheel(el, event)) {
      onScroll()
    }
  }
  el.addEventListener('wheel', onWheel, { passive: false })
  return () => el.removeEventListener('wheel', onWheel)
}
