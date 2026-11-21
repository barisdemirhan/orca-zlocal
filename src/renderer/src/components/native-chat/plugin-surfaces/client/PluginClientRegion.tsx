import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/class-names'
import type {
  AgentSessionPluginNode,
  AgentSessionPluginUiPress
} from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { cellLength, readNumber, readString } from '../plugin-prop-values'
import { usePluginClientHost } from './plugin-client-context'
import type {
  PluginClientHandle,
  PluginClientPointerEvent,
  PluginClientView
} from './plugin-client-host'
import { clientKeyOf, clientPointerOf, type PluginClientCell } from './plugin-client-input'

type Target = Pick<AgentSessionPluginUiPress, 'component' | 'instanceId'>

/** A `Client` node: a region of terminal cells a mod's own surface module draws and listens in. */
export function PluginClientRegion({
  node,
  target,
  renderTree
}: {
  node: AgentSessionPluginNode
  target: Target
  renderTree: (
    tree: AgentSessionPluginNode,
    onPress: (press: AgentSessionPluginUiPress) => void
  ) => ReactNode
}): React.JSX.Element | null {
  const host = usePluginClientHost()
  const nodeProps = node.props ?? {}
  const key = readString(nodeProps.key)
  const module = readString(nodeProps.module)
  const plugin = node.client?.plugin
  const hash = node.client?.hash ?? ''
  const data = nodeProps.props
  const dataJson = JSON.stringify(data ?? null)
  const regionRef = useRef<HTMLDivElement | null>(null)
  const probeRef = useRef<HTMLSpanElement | null>(null)
  const handleRef = useRef<PluginClientHandle | null>(null)
  const cellRef = useRef<PluginClientCell>({ width: 1, height: 1 })
  const sizeRef = useRef({ columns: 0, rows: 0 })
  const dataRef = useRef<unknown>(data)
  const moveRef = useRef<{ frame: number; event: PluginClientPointerEvent | null }>({
    frame: 0,
    event: null
  })
  const [size, setSize] = useState({ columns: 0, rows: 0 })
  const [view, setView] = useState<PluginClientView | null>(null)

  useLayoutEffect(() => {
    dataRef.current = data
  })

  useLayoutEffect(() => {
    const region = regionRef.current
    const probe = probeRef.current
    if (!region || !probe) {
      return undefined
    }
    const measure = (): void => {
      const cell = probe.getBoundingClientRect()
      if (cell.width <= 0 || cell.height <= 0) {
        return
      }
      const box = region.getBoundingClientRect()
      const columns = Math.max(0, Math.floor(box.width / cell.width + 0.05))
      const rows = Math.max(0, Math.floor(box.height / cell.height + 0.05))
      cellRef.current = { width: cell.width, height: cell.height }
      sizeRef.current = { columns, rows }
      setSize((last) => (last.columns === columns && last.rows === rows ? last : { columns, rows }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(region)
    observer.observe(probe)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!host || !plugin || !module || !key) {
      return undefined
    }
    const handle = host.open(
      { plugin, component: target.component, instanceId: target.instanceId, client: key, module },
      hash,
      { props: dataRef.current, ...sizeRef.current },
      setView
    )
    handleRef.current = handle
    return () => {
      handle.close()
      handleRef.current = null
      setView(null)
    }
  }, [host, plugin, module, key, hash, target.component, target.instanceId])

  useEffect(() => {
    handleRef.current?.setProps(dataRef.current)
  }, [dataJson])

  useEffect(() => {
    handleRef.current?.resize(size.columns, size.rows)
  }, [size])

  useEffect(() => {
    const move = moveRef.current
    return () => cancelAnimationFrame(move.frame)
  }, [])

  if (!plugin || !module || !key) {
    return null
  }

  const sendPointer = (type: PluginClientPointerEvent['type'], event: React.PointerEvent): void => {
    const region = regionRef.current
    if (!region || !view?.wantsPointer) {
      return
    }
    const pointer = clientPointerOf(type, event, region.getBoundingClientRect(), cellRef.current)
    const pending = moveRef.current
    if (type !== 'move') {
      pending.event = null
      cancelAnimationFrame(pending.frame)
      pending.frame = 0
      handleRef.current?.pointer(pointer)
      return
    }
    pending.event = pointer
    if (!pending.frame) {
      pending.frame = requestAnimationFrame(() => {
        pending.frame = 0
        if (pending.event) {
          handleRef.current?.pointer(pending.event)
          pending.event = null
        }
      })
    }
  }
  const isOnButton = (event: React.PointerEvent): boolean =>
    event.target instanceof Element && event.target.closest('button') !== null

  return (
    <div
      ref={regionRef}
      tabIndex={view?.wantsKey ? 0 : undefined}
      className={cn(
        'relative flex min-w-0 select-none flex-col overflow-hidden outline-none',
        view?.wantsPointer && 'touch-none'
      )}
      style={{
        width: cellLength(nodeProps.width, 'x'),
        height: cellLength(nodeProps.height, 'y'),
        flexGrow: readNumber(nodeProps.flexGrow)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          event.currentTarget.blur()
          return
        }
        const clientKey =
          view?.wantsKey && !event.nativeEvent.isComposing ? clientKeyOf(event) : null
        if (clientKey) {
          event.preventDefault()
          event.stopPropagation()
          handleRef.current?.key(clientKey)
        }
      }}
      onPointerDown={(event) => {
        if (isOnButton(event) || !(view?.wantsKey || view?.wantsPointer)) {
          return
        }
        event.preventDefault()
        event.currentTarget.focus({ preventScroll: true })
        if (view.wantsPointer) {
          event.currentTarget.setPointerCapture(event.pointerId)
          sendPointer('down', event)
        }
      }}
      onPointerMove={(event) => sendPointer('move', event)}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
          sendPointer('up', event)
        }
      }}
      onPointerEnter={(event) => sendPointer('enter', event)}
      onPointerLeave={(event) => sendPointer('leave', event)}
    >
      <span
        ref={probeRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0"
        style={{ width: 'var(--plugin-cell, 1ch)', height: 'var(--plugin-row)' }}
      />
      {view
        ? renderTree(view.tree, (press) => handleRef.current?.press(press.key ?? '', press.handle))
        : null}
    </div>
  )
}
