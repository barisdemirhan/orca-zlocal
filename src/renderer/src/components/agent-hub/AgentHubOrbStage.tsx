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
import { MoveDiagonal2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { AgentHubOrbSphere, type AgentHubOrbSphereProps } from './AgentHubOrbSphere'
import { setAgentHubOrbRequestDestination } from './agent-hub-orb-panel-store'
import { useAgentHubOrbGeometry } from './use-agent-hub-orb-geometry'
import { AgentHubOrbSpeechBubble } from './AgentHubOrbSpeechBubble'
import './agent-hub-orb-stage.css'

export function AgentHubOrbStage({
  embedded,
  compact,
  live = false,
  visible,
  controls,
  sphereControls,
  request,
  requestVisible,
  notice,
  caption,
  sphereLabel,
  onSphereClick,
  ...sphere
}: AgentHubOrbSphereProps & {
  embedded: boolean
  compact: boolean
  live?: boolean
  visible: boolean
  controls: ReactNode
  sphereControls?: ReactNode
  request: ReactNode
  requestVisible: boolean
  notice?: string
  caption?: string
  /** What a click on the sphere does, as words; the sphere is a plain image without it. */
  sphereLabel?: string
  onSphereClick?: () => void
}): React.JSX.Element {
  const inlineRef = useRef<HTMLDivElement>(null)
  const pressedAt = useRef<{ x: number; y: number } | null>(null)
  const [captionsOpen, setCaptionsOpen] = useState(true)
  const [captionEngaged, setCaptionEngaged] = useState(false)
  const [container] = useState(() => document.createElement('div'))
  const {
    geometry,
    request: placement,
    shellRef,
    controlsRef,
    requestRef,
    beginGesture,
    resizeKey
  } = useAgentHubOrbGeometry({ embedded, compact, live, requestVisible })
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
  const label = translate('auto.agentHub.orb.size', 'Orb size')
  const style: CSSProperties & { '--orb-diameter': string } = {
    '--orb-diameter': `${geometry.diameter}px`,
    ...(!embedded ? { left: geometry.x, top: geometry.y, width: geometry.width } : {})
  }
  return (
    <div ref={inlineRef} className={visible && embedded ? 'shrink-0' : 'hidden'}>
      {createPortal(
        <div
          ref={shellRef}
          data-agent-hub-orb-stage
          data-embedded={embedded}
          data-compact={compact}
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
              if (
                event.target instanceof Element &&
                event.target.closest(
                  '[data-agent-hub-orb-live-controls], [data-agent-hub-orb-interactive]'
                )
              ) {
                return
              }
              pressedAt.current = { x: event.clientX, y: event.clientY }
              beginGesture('move', event)
            }}
            onClick={(event) => {
              const pressed = pressedAt.current
              pressedAt.current = null
              // Why: a drag ends in a click on the captured element; only a press that stayed put acts.
              const dragged =
                pressed !== null &&
                Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 4
              if (
                embedded ||
                !onSphereClick ||
                dragged ||
                (event.target instanceof Element &&
                  event.target.closest(
                    '[data-agent-hub-orb-resize], [data-agent-hub-orb-live-controls], [data-agent-hub-orb-interactive]'
                  ))
              ) {
                return
              }
              onSphereClick()
            }}
          >
            {sphereControls ? (
              <div className="agent-hub-orb-hover-controls">{sphereControls}</div>
            ) : null}
            <div className="agent-hub-orb-art-sphere">
              <AgentHubOrbSpeechBubble
                open={captionsOpen}
                engaged={captionEngaged}
                onOpenChange={setCaptionsOpen}
                text={caption ?? ''}
                speakerLabel={translate('auto.agentHub.orb.title', 'Orb')}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
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
                  </TooltipTrigger>
                  <TooltipContent>
                    {!embedded && sphereLabel ? sphereLabel : sphere.label}
                  </TooltipContent>
                </Tooltip>
              </AgentHubOrbSpeechBubble>
            </div>
            {!embedded && !compact ? (
              <span className="agent-hub-orb-resize" data-agent-hub-orb-resize>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="cursor-nwse-resize touch-none"
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
                      <MoveDiagonal2 aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              </span>
            ) : null}
          </div>
          <div data-agent-hub-orb-controls className="min-w-0 max-w-xs">
            <div ref={controlsRef} className="agent-hub-orb-controls">
              {controls}
            </div>
            {notice ? (
              <p
                role="status"
                className="mt-1 max-w-full rounded-md bg-muted px-2 py-1 text-center text-xs text-muted-foreground"
              >
                {notice}
              </p>
            ) : null}
          </div>
        </div>,
        container
      )}
    </div>
  )
}
