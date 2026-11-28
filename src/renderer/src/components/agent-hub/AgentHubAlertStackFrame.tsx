import { useState } from 'react'
import { createPortal } from 'react-dom'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/composition/status-bar-context-menu-policy'

/** Owns hover and focus here so they reset when the stack unmounts without a mouseleave. */
export function AgentHubAlertStackFrame({
  stackRef,
  children
}: {
  stackRef: React.RefObject<HTMLDivElement | null>
  children: (held: boolean) => React.ReactNode
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  return createPortal(
    <div
      ref={stackRef}
      data-agent-hub-alert-stack
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false)
        }
      }}
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      className="fixed z-[48] flex max-h-[min(70vh,560px)] flex-col gap-2 overflow-y-auto p-0.5 scrollbar-sleek"
    >
      {children(hovered || focused)}
    </div>,
    document.body
  )
}
