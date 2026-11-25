import { useEffect, useState, type RefObject } from 'react'
import { isEditableTarget } from '@/lib/text-input/focus/editable-target'

const ROW = '[data-hub-nav]'

function openTarget(row: HTMLElement, mirror: boolean): HTMLElement | null {
  return mirror
    ? row.querySelector<HTMLElement>('[data-nav-mirror] button')
    : (row.querySelector<HTMLElement>('[data-nav-open]') ?? row.querySelector('button'))
}

function rowFolded(row: HTMLElement): boolean {
  const toggle = row.querySelector<HTMLElement>('[data-nav-toggle]')
  return toggle?.getAttribute('aria-expanded') !== 'true'
}

/**
 * Arrow-key navigation over the Bots tab's bot, chat, worker and automation rows, read from the
 * DOM because each bot's chats live in its own subtree. It listens on the hub panel's root, which
 * owns focus, and leaves Tab, digits and text typing to the panel.
 */
export function useAgentHubBotsKeys(
  listRef: RefObject<HTMLElement | null>,
  /** The list is on screen (a bot's page may cover it). */
  active: boolean
): {
  selectedKey: string | null
} {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  useEffect(() => {
    const list = active ? listRef.current : null
    const root = list?.closest('[tabindex]')
    if (!list || !root) {
      return
    }
    const rows = (): HTMLElement[] => [...list.querySelectorAll<HTMLElement>(ROW)]
    const select = (row: HTMLElement | undefined): void => {
      if (row) {
        setSelectedKey(row.dataset.navKey ?? null)
        row.scrollIntoView({ block: 'nearest' })
      }
    }
    const onKeyDown = (event: Event): void => {
      if (!(event instanceof KeyboardEvent) || event.metaKey || event.ctrlKey || event.shiftKey) {
        return
      }
      const target = event.target instanceof HTMLElement ? event.target : null
      const inSearch = target?.closest('[data-agent-hub-bots-search]') != null
      const typing = isEditableTarget(event.target)
      const all = rows()
      const index = all.findIndex((row) => row.dataset.navKey === selectedKey)
      const current = all[index]
      let handled = true
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          if (typing && !inSearch) {
            return
          }
          const step = event.key === 'ArrowDown' ? 1 : -1
          const next = index === -1 ? (step > 0 ? 0 : all.length - 1) : index + step
          select(all[Math.max(0, Math.min(all.length - 1, next))])
          break
        }
        case 'ArrowRight':
        case 'ArrowLeft': {
          if (typing || !current) {
            return
          }
          const foldable = current.dataset.navFoldable !== undefined
          const right = event.key === 'ArrowRight'
          if (foldable && right === rowFolded(current)) {
            current.querySelector<HTMLElement>('[data-nav-toggle]')?.click()
          } else if (right) {
            select(all[index + 1])
          } else {
            select(all.find((row) => row.dataset.navKey === current.dataset.navParent))
          }
          break
        }
        case 'Enter': {
          const button = target?.closest('button')
          if ((typing && !inSearch) || (button && !inSearch) || !current) {
            return
          }
          openTarget(current, event.altKey)?.click()
          break
        }
        default:
          handled = false
      }
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    root.addEventListener('keydown', onKeyDown, true)
    return () => root.removeEventListener('keydown', onKeyDown, true)
  }, [listRef, active, selectedKey])
  return { selectedKey }
}
