import { ChevronRight } from 'lucide-react'

/** Folds its content with a short height and fade; stays mounted but inert while closed. */
export function HubCollapse({
  open,
  children
}: {
  open: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      data-open={open}
      inert={!open}
      className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-150 ease-out data-[open=true]:grid-rows-[1fr] data-[open=true]:opacity-100 motion-reduce:transition-none!"
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

/** The fold arrow: points right when closed and turns down as its section opens. */
export function HubFoldChevron({
  open,
  className
}: {
  open: boolean
  className: string
}): React.JSX.Element {
  return (
    <span
      data-open={open}
      className="grid shrink-0 place-items-center transition-transform duration-150 ease-out data-[open=true]:rotate-90 motion-reduce:transition-none!"
    >
      <ChevronRight className={className} />
    </span>
  )
}
