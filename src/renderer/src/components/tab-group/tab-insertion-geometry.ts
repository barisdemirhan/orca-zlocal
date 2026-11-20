/** The insertion edge shared by anchored tab strips. */
export function tabInsertionSide(
  pointerX: number,
  rect: { left: number; width: number }
): 'left' | 'right' {
  return pointerX < rect.left + rect.width / 2 ? 'left' : 'right'
}

export function tabInsertionIndexAfterRemoval(insertionIndex: number, sourceIndex: number): number {
  return insertionIndex - (sourceIndex >= 0 && sourceIndex < insertionIndex ? 1 : 0)
}
