import { describe, expect, it } from 'vitest'
import { splitRecommendedOptionLabel } from './native-chat-option-label'

describe('splitRecommendedOptionLabel', () => {
  it('moves a trailing "(Recommended)" out of the label, in any case', () => {
    expect(splitRecommendedOptionLabel('Meta Cloud API (Recommended)')).toEqual({
      label: 'Meta Cloud API',
      recommended: true
    })
    expect(splitRecommendedOptionLabel('Twilio (recommended) ')).toEqual({
      label: 'Twilio',
      recommended: true
    })
  })

  it('leaves other labels alone, including one that is only the marker', () => {
    expect(splitRecommendedOptionLabel('Recommended defaults')).toEqual({
      label: 'Recommended defaults',
      recommended: false
    })
    expect(splitRecommendedOptionLabel('(Recommended)')).toEqual({
      label: '(Recommended)',
      recommended: false
    })
  })
})
