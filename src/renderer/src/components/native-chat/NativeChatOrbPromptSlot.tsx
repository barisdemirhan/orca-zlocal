import { useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { NATIVE_CHAT_APPEARANCE_ROOT_CLASS } from './appearance/native-chat-appearance-style'
import { useAgentHubOrbPanel } from '../agent-hub/agent-hub-orb-panel-store'
import { registerRetainedPaneDestination } from '../tab-group/retained-pane-destinations'

export function NativeChatOrbPromptSlot({
  tabId,
  sessionId,
  pending,
  requestId,
  appearanceStyle,
  children
}: {
  tabId: string
  sessionId: string
  pending: boolean
  requestId?: string | null
  appearanceStyle?: CSSProperties
  children: ReactNode
}): React.JSX.Element {
  const destination = useAgentHubOrbPanel((state) =>
    state.session?.tabId === tabId && state.session.sessionId === sessionId
      ? state.requestDestination
      : null
  )
  const homeRef = useRef<HTMLDivElement>(null)
  const [container] = useState(() => {
    const element = document.createElement('div')
    element.className = 'min-w-0 shrink-0'
    return element
  })
  useLayoutEffect(() => {
    const state = useAgentHubOrbPanel.getState()
    if (state.session?.tabId === tabId && state.session.sessionId === sessionId) {
      useAgentHubOrbPanel.setState({
        nativeRequestPending: pending,
        nativeRequestVisible: pending,
        nativeRequestId: pending ? (requestId ?? null) : null
      })
    }
  }, [pending, requestId, sessionId, tabId, destination])
  useLayoutEffect(
    () => () => {
      const state = useAgentHubOrbPanel.getState()
      if (state.session?.tabId === tabId && state.session.sessionId === sessionId) {
        useAgentHubOrbPanel.setState({
          nativeRequestPending: false,
          nativeRequestVisible: false,
          nativeRequestId: null
        })
      }
    },
    [sessionId, tabId]
  )
  useLayoutEffect(() => {
    const home = homeRef.current
    if (!home) {
      return undefined
    }
    const target = destination ?? home
    if (container.parentElement !== target) {
      target.appendChild(container)
    }
    if (destination) {
      return registerRetainedPaneDestination(destination, () => home.appendChild(container))
    }
    return undefined
  }, [container, destination])
  useLayoutEffect(
    () => () => {
      homeRef.current?.appendChild(container)
    },
    [container]
  )
  return (
    <div ref={homeRef} className="contents">
      {createPortal(
        <div className={NATIVE_CHAT_APPEARANCE_ROOT_CLASS} style={appearanceStyle}>
          {children}
        </div>,
        container
      )}
    </div>
  )
}
