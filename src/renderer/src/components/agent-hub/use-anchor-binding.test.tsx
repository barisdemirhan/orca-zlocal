/** @vitest-environment happy-dom */
import { act, memo } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { useAnchorBinding, useAnchorTarget } from './use-anchor-binding'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

it('rebinds a follower whose props never change when the anchor comes back as a new element', async () => {
  const log: string[] = []
  // Why memo: the follower must not re-render with its owner, as under the React Compiler.
  const Follower = memo(function Follower({
    anchorRef
  }: {
    anchorRef: React.RefObject<HTMLElement | null>
  }): null {
    useAnchorBinding(anchorRef, 'top', (node) => {
      log.push(`bind ${node.id}`)
      return () => log.push(`release ${node.id}`)
    })
    return null
  })
  function Owner({ anchor }: { anchor: string | null }): React.JSX.Element {
    const [anchorRef, attach] = useAnchorTarget<HTMLElement>()
    return (
      <>
        {anchor ? <div key={anchor} id={anchor} ref={attach} /> : null}
        <Follower anchorRef={anchorRef} />
      </>
    )
  }
  const root = createRoot(document.createElement('div'))
  await act(async () => root.render(<Owner anchor="first" />))
  await act(async () => root.render(<Owner anchor={null} />))
  await act(async () => root.render(<Owner anchor="second" />))
  act(() => root.unmount())

  expect(log).toEqual(['bind first', 'release first', 'bind second', 'release second'])
})
