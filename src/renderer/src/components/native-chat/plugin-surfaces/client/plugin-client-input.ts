import type { KeyboardEvent, PointerEvent } from 'react'
import type { PluginClientKeyEvent, PluginClientPointerEvent } from './plugin-client-host'

const SPECIAL_KEYS: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'return',
  Tab: 'tab',
  Backspace: 'backspace',
  Delete: 'delete',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  Home: 'home',
  End: 'end'
}

/** The key as a surface module's `onKey` hears it; null for a modifier alone or a browser shortcut. */
export function clientKeyOf(event: KeyboardEvent): PluginClientKeyEvent | null {
  const special = SPECIAL_KEYS[event.key]
  if (special) {
    return {
      key: special,
      ...(event.ctrlKey ? { ctrl: true as const } : {}),
      ...(event.shiftKey ? { shift: true as const } : {}),
      ...(event.metaKey ? { meta: true as const } : {})
    }
  }
  if (event.key.length !== 1 || event.metaKey) {
    return null
  }
  return { key: event.key, ...(event.ctrlKey ? { ctrl: true as const } : {}) }
}

export type PluginClientCell = { width: number; height: number }

function buttonOf(event: PointerEvent, type: PluginClientPointerEvent['type']) {
  if (type === 'enter' || type === 'leave') {
    return undefined
  }
  if (type === 'move') {
    return event.buttons & 1
      ? 'left'
      : event.buttons & 4
        ? 'middle'
        : event.buttons & 2
          ? 'right'
          : undefined
  }
  return event.button === 1 ? 'middle' : event.button === 2 ? 'right' : 'left'
}

/** A pointer event in the region's own cells; `fine` keeps the fraction of a cell. */
export function clientPointerOf(
  type: PluginClientPointerEvent['type'],
  event: PointerEvent,
  region: DOMRect,
  cell: PluginClientCell
): PluginClientPointerEvent {
  const fineX = (event.clientX - region.left) / cell.width
  const fineY = (event.clientY - region.top) / cell.height
  const button = buttonOf(event, type)
  return {
    type,
    x: Math.floor(fineX),
    y: Math.floor(fineY),
    ...(type === 'enter' || type === 'leave' ? {} : { fine: { x: fineX, y: fineY } }),
    ...(button ? { button } : {}),
    ...(event.shiftKey ? { shift: true as const } : {}),
    ...(event.altKey ? { alt: true as const } : {}),
    ...(event.ctrlKey ? { ctrl: true as const } : {})
  }
}
