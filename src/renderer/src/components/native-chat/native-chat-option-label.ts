const RECOMMENDED_SUFFIX = /\s*\(recommended\)\s*$/i

/** Agents mark their suggested option by appending "(Recommended)" to its label. */
export function splitRecommendedOptionLabel(label: string): {
  label: string
  recommended: boolean
} {
  const stripped = label.replace(RECOMMENDED_SUFFIX, '')
  return stripped !== label && stripped.length > 0
    ? { label: stripped, recommended: true }
    : { label, recommended: false }
}
