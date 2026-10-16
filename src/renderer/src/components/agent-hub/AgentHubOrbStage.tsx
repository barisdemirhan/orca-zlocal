import {
  useCallback,
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
import './agent-hub-orb-stage.css'

export function AgentHubOrbStage({
  embedded,
  compact,
  visible,
  controls,
  request,
  requestVisible,
  notice,
  ...sphere
}: AgentHubOrbSphereProps & {
  embedded: boolean
  compact: boolean
  visible: boolean
  controls: ReactNode
  request: ReactNode
  requestVisible: boolean
  notice?: string
}): React.JSX.Element {
  const inlineRef = useRef<HTMLDivElement>(null)
  const [container] = useState(() => document.createElement('div'))
  const {
    geometry,
    request: placement,
    shellRef,
    controlsRef,
    requestRef,
    beginGesture,
    resizeKey
  } = useAgentHubOrbGeometry({ embedded, compact, requestVisible })
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
          <div className="agent-hub-orb-art" onPointerDown={(event) => beginGesture('move', event)}>
            <div className="agent-hub-orb-art-sphere">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex size-full">
                    <AgentHubOrbSphere {...sphere} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{sphere.label}</TooltipContent>
              </Tooltip>
            </div>
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
                    aria-valuetext={translate('auto.agentHub.orb.sizePixels', '{{value0}} pixels', {
                      value0: geometry.diameter
                    })}
                    onPointerDown={(event) => beginGesture('resize', event)}
                    onKeyDown={resizeKey}
                  >
                    <MoveDiagonal2 aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            </span>
          </div>
          <div ref={controlsRef} data-agent-hub-orb-controls className="agent-hub-orb-controls">
            {controls}
          </div>
          {notice ? (
            <p role="status" className="max-w-full pt-2 text-center text-xs text-muted-foreground">
              {notice}
            </p>
          ) : null}
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
        </div>,
        container
      )}
    </div>
  )
}
