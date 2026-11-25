import { describe, expect, it } from 'vitest'
import { holdAgentHubOrder, sortByHeldOrder } from './agent-hub-stable-order'

describe('holdAgentHubOrder', () => {
  it('keeps known rows in place and appends new ones, so a sender does not jump under the pointer', () => {
    const held = holdAgentHubOrder(['b', 'a'], ['a', 'c', 'b'])
    expect(held).toEqual(['b', 'a', 'c'])
    expect(sortByHeldOrder(['a', 'c', 'b'], (id) => id, held)).toEqual(['b', 'a', 'c'])
  })

  it('drops rows that left', () => {
    expect(holdAgentHubOrder(['a', 'b'], ['b'])).toEqual(['b'])
  })
})
