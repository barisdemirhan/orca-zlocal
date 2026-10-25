import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties
} from 'react'
import { createPortal } from 'react-dom'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { AgentHubOrbSphere, type AgentHubOrbSphereProps } from './AgentHubOrbSphere'
import { setAgentHubOrbRequestDestination, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { useAgentHubOrbGeometry } from './use-agent-hub-orb-geometry'
import { agentHubOrbResizeArc } from './agent-hub-orb-geometry'
import { useAgentHubOrbSphereGestures } from './use-agent-hub-orb-sphere-gestures'
import { AgentHubOrbSpeechBubble } from './AgentHubOrbSpeechBubble'
import './agent-hub-orb-stage.css'
import { useAgentHubOrbName } from './use-agent-hub-orb-identity'

const INTERACTIVE_TARGETS =
  '[data-agent-hub-orb-resize], [data-agent-hub-orb-live-controls], [data-agent-hub-orb-interactive]'

export function AgentHubOrbStage({
  embedded,
  compact,
  live = false,
  visible,
  sphereControls,
  quickInput,
  request,
  requestVisible,
  notice,
  caption,
  captionKey,
  captionDurationMs,
  captionAction,
  captionHint,
  captionPrompt,
  captionStatus,
  sphereLabel,
  onSphereClick,
  onSphereDoubleClick,
  onSphereHoldStart,
  onSphereHoldEnd,
  ...sphere
}: AgentHubOrbSphereProps & {
  embedded: boolean
  compact: boolean
  live?: boolean
  visible: boolean
  /** What the hover pill shows at the top of the sphere. */
  sphereControls?: ReactNode
  /** The one-line writing box; its slot under the sphere is reserved whether or not it is open. */
  quickInput?: ReactNode
  request: ReactNode
  requestVisible: boolean
  notice?: string
  caption?: string
  /** Tells two replies with the same words apart; Close hides only the one it was pressed on. */
  captionKey?: string
  captionDurationMs?: number
  captionAction?: ReactNode
  captionHint?: ReactNode
  captionPrompt?: string
  captionStatus?: ReactNode
  /** What a click on the sphere does, as words; the sphere is a plain image without it. */
  sphereLabel?: string
  onSphereClick?: () => void
  onSphereDoubleClick?: () => void
  onSphereHoldStart?: () => void
  onSphereHoldEnd?: () => void
}): React.JSX.Element {
  const inlineRef = useRef<HTMLDivElement>(null)
  const dismissedCaption = useAgentHubOrbPanel((s) => s.dismissedCaption)
  const captionId = captionKey ?? caption ?? ''
  const [captionEngaged, setCaptionEngaged] = useState(false)
  const [container] = useState(() => document.createElement('div'))
  const {
    geometry,
    pinned,
    quickBeside,
    dockDrop,
    pillBelow,
    request: placement,
    shellRef,
    quickRef,
    requestRef,
    beginGesture,
    resizeKey
  } = useAgentHubOrbGeometry({ embedded, compact, live, requestVisible })
  const gestures = useAgentHubOrbSphereGestures(
    {
      onClick: () => onSphereClick?.(),
      onDoubleClick: () => (onSphereDoubleClick ?? onSphereClick)?.(),
      onHoldStart: () => onSphereHoldStart?.(),
      onHoldEnd: () => onSphereHoldEnd?.()
    },
    !embedded && onSphereClick !== undefined
  )
  // Why: a hidden stage never sends pointerleave, which would keep captions engaged.
  useEffect(() => {
    if (!visible) {
      setCaptionEngaged(false)
    }
  }, [visible])
  useLayoutEffect(() => {
    const target = embedded ? inlineRef.current : document.body
    if (target && container.parentElement !== target) {
      target.appendChild(container)
    }
  }, [container, embedded])
  useLayoutEffect(() => () => container.remove(), [container])
  const bindRequest = useCallback(
    (node: HTMLDivElement | null) => {
      requestRef.current = node
      setAgentHubOrbRequestDestination(node)
    },
    [requestRef]
  )
  const onInteractive = (event: React.SyntheticEvent): boolean =>
    event.target instanceof Element && event.target.closest(INTERACTIVE_TARGETS) !== null
  const name = useAgentHubOrbName()
  const label = translate('auto.agentHub.orb.size', 'Orb size')
  const grip = agentHubOrbResizeArc(geometry.diameter)
  const style: CSSProperties & { '--orb-diameter': string } = {
    '--orb-diameter': `${geometry.diameter}px`,
    ...(!embedded ? { left: geometry.x, top: geometry.y, width: geometry.width } : {}),
    ...(pinned?.bottom != null ? { top: 'auto', bottom: pinned.bottom } : {})
  }
  return (
    <div ref={inlineRef} className={visible && embedded ? 'shrink-0' : 'hidden'}>
      {createPortal(
        <div
          ref={shellRef}
          data-agent-hub-orb-stage
          data-embedded={embedded}
          data-compact={compact}
          data-pill={pillBelow ? 'below' : 'above'}
          data-pinned={pinned ? (pinned.bottom != null ? 'up' : 'down') : undefined}
          data-away={pinned?.away ?? undefined}
          data-quick={quickBeside ? 'beside' : undefined}
          className="agent-hub-orb-stage"
          style={style}
          hidden={!visible}
        >
          <div
            ref={bindRequest}
            data-agent-hub-orb-request-host
            data-side={placement?.side ?? 'bottom'}
            data-placement={placement?.placement ?? 'inline'}
            className="agent-hub-orb-request-host scrollbar-sleek"
            hidden={!requestVisible}
            style={
              !embedded && placement
                ? {
                    position: 'fixed',
                    left: placement.x,
                    top: placement.y,
                    width: placement.width,
                    maxHeight: placement.height
                  }
                : { maxHeight: 220 }
            }
          >
            {request}
          </div>
          <div
            className="agent-hub-orb-art"
            onPointerEnter={() => setCaptionEngaged(true)}
            onPointerLeave={() => setCaptionEngaged(false)}
            onPointerDown={(event) => {
              if (onInteractive(event)) {
                return
              }
              gestures.onPointerDown(event)
              beginGesture('move', event)
            }}
            onPointerMove={gestures.onPointerMove}
            onPointerUp={gestures.onPointerUp}
            onPointerCancel={gestures.onPointerCancel}
            onClick={(event) => {
              if (!onInteractive(event)) {
                gestures.onClick()
              }
            }}
          >
            {sphereControls ? (
              <div className="agent-hub-orb-hover-controls" data-agent-hub-orb-interactive>
                {sphereControls}
              </div>
            ) : null}
            <div className="agent-hub-orb-art-sphere">
              <AgentHubOrbSpeechBubble
                open={captionId !== dismissedCaption}
                engaged={captionEngaged}
                onOpenChange={(next) =>
                  useAgentHubOrbPanel.setState({ dismissedCaption: next ? null : captionId })
                }
                text={caption ?? ''}
                speakerLabel={name}
                durationMs={captionDurationMs}
                action={captionAction}
                hint={captionHint}
                prompt={captionPrompt}
                status={captionStatus}
              >
                {!embedded && onSphereClick && sphereLabel ? (
                  <button
                    type="button"
                    aria-label={sphereLabel}
                    className="inline-flex size-full cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <AgentHubOrbSphere {...sphere} />
                  </button>
                ) : (
                  <span className="inline-flex size-full">
                    <AgentHubOrbSphere {...sphere} />
                  </span>
                )}
              </AgentHubOrbSpeechBubble>
            </div>
            {!embedded && !compact && !pinned ? (
              <span className="agent-hub-orb-resize" data-agent-hub-orb-resize>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="agent-hub-orb-resize-grip"
                      style={{ width: grip.size, height: grip.size }}
                      role="slider"
                      aria-label={label}
                      aria-valuemin={geometry.minimum}
                      aria-valuemax={geometry.maximum}
                      aria-valuenow={geometry.diameter}
                      aria-valuetext={translate(
                        'auto.agentHub.orb.sizePixels',
                        '{{value0}} pixels',
                        {
                          value0: geometry.diameter
                        }
                      )}
                      onPointerDown={(event) => beginGesture('resize', event)}
                      onKeyDown={resizeKey}
                    >
                      <svg width={grip.size} height={grip.size} aria-hidden>
                        <path className="agent-hub-orb-resize-hit" d={grip.path} />
                        <path className="agent-hub-orb-resize-arc" d={grip.path} />
                      </svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end">
                    {label}
                  </TooltipContent>
                </Tooltip>
              </span>
            ) : null}
          </div>
          {!embedded ? (
            <div ref={quickRef} className="agent-hub-orb-quick-slot">
              {quickInput}
            </div>
          ) : null}
          {dockDrop ? (
            <span
              aria-hidden
              className="agent-hub-orb-dock-drop"
              data-armed={dockDrop.drop === 'armed'}
              style={{ left: dockDrop.centre.x, top: dockDrop.centre.y }}
            />
          ) : null}
          {notice ? (
            <p
              role="status"
              data-agent-hub-orb-controls
              className="mt-1 max-w-xs rounded-md bg-muted px-2 py-1 text-center text-xs text-muted-foreground"
            >
              {notice}
            </p>
          ) : null}
        </div>,
        container
      )}
    </div>
  )
}
