type Point = { x: number; y: number }

export function panScrollPosition(
  initialScroll: Point,
  initialPointer: Point,
  currentPointer: Point,
) {
  return {
    left: initialScroll.x - (currentPointer.x - initialPointer.x),
    top: initialScroll.y - (currentPointer.y - initialPointer.y),
  }
}
