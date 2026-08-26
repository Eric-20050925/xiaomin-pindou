export const DETAIL_PRESETS = [
  { id: 'draft', label: '简约', longestSide: 24 },
  { id: 'standard', label: '标准', longestSide: 32 },
  { id: 'fine', label: '精细', longestSide: 48 },
  { id: 'ultra', label: '超精细', longestSide: 64 },
] as const

export type DetailPreset = typeof DETAIL_PRESETS[number]['id'] | 'custom'

const clampDimension = (value: number) => Math.min(160, Math.max(8, value))

export function dimensionsForDetail(
  sourceWidth: number,
  sourceHeight: number,
  longestSide: number,
) {
  const safeWidth = Math.max(1, sourceWidth)
  const safeHeight = Math.max(1, sourceHeight)
  const targetLongestSide = clampDimension(Math.round(longestSide))

  if (safeWidth >= safeHeight) {
    return {
      width: targetLongestSide,
      height: clampDimension(Math.round(targetLongestSide * safeHeight / safeWidth)),
    }
  }

  return {
    width: clampDimension(Math.round(targetLongestSide * safeWidth / safeHeight)),
    height: targetLongestSide,
  }
}

export function detailPresetForDimensions(width: number, height: number): DetailPreset {
  const longestSide = Math.max(width, height)
  return DETAIL_PRESETS.find((preset) => preset.longestSide === longestSide)?.id ?? 'custom'
}
