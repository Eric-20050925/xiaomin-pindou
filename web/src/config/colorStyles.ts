import type { ColorStyle } from '../types'

export type ColorStyleDefinition = {
  id: ColorStyle
  label: string
  description: string
  group: 'natural' | 'creative'
}

export const COLOR_STYLES: ColorStyleDefinition[] = [
  { id: 'faithful', label: '保真还原', description: '尽量贴近原图色彩', group: 'natural' },
  { id: 'harmonized', label: '协调美化', description: '整理色阶与突兀杂色', group: 'natural' },
  { id: 'vivid', label: '鲜明强化', description: '增强明暗与饱和度', group: 'creative' },
  { id: 'cartoon', label: '卡通风格', description: '清晰轮廓与扁平色块', group: 'creative' },
  { id: 'pastel', label: '柔彩马卡龙', description: '明亮柔和的低刺激色彩', group: 'creative' },
  { id: 'retro', label: '复古暖调', description: '温暖克制的怀旧色调', group: 'creative' },
  { id: 'cool', label: '清冷通透', description: '明亮干净的蓝青倾向', group: 'creative' },
  { id: 'monochrome', label: '黑白剪影', description: '明确的黑白灰色阶', group: 'creative' },
]

export const COLOR_STYLE_LABELS = Object.fromEntries(
  COLOR_STYLES.map((style) => [style.id, style.label]),
) as Record<ColorStyle, string>
