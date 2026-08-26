import artkalC197Raw from '../../../palettes/artkal-c-197-official/colors.json'
import artkal418Raw from '../../../palettes/artkal-c197-m221-418-official/colors.json'
import artkalM221Raw from '../../../palettes/artkal-m-221-official/colors.json'
import cocoRaw from '../../../palettes/coco-291/colors.json'
import manmanRaw from '../../../palettes/manman-278/colors.json'
import mard221Raw from '../../../palettes/mard-221-alfonse-doudou/colors.json'
import mard291Raw from '../../../palettes/mard-291-github/colors.json'
import mixiaowoRaw from '../../../palettes/mixiaowo-290/colors.json'
import panpanRaw from '../../../palettes/panpan-289/colors.json'
import { rgbToLab } from '../lib/color'
import type { PaletteColor, PaletteDefinition } from '../types'

type RawColor = {
  code: string
  hex: string
  rgb: number[]
  group: string
  unidentified?: boolean
}

type RawPalette = {
  id: string
  title: string
  description: string
  colors: RawColor[]
}

const PALETTE_REPOSITORY_URL = 'https://github.com/HansBug/pindou-color-data'

const createPalette = (rawPalette: RawPalette): PaletteDefinition => {
  const colors: PaletteColor[] = rawPalette.colors
    .filter((color) => !color.unidentified)
    .map((color) => {
      const rgb: [number, number, number] = [color.rgb[0], color.rgb[1], color.rgb[2]]
      return {
        code: color.code,
        hex: color.hex,
        rgb,
        group: color.group,
        lab: rgbToLab(rgb),
      }
    })

  return {
    id: rawPalette.id,
    title: rawPalette.title,
    description: rawPalette.description,
    sourceUrl: `${PALETTE_REPOSITORY_URL}/tree/main/${rawPalette.id}`,
    colors,
    groups: [...new Set(colors.map((color) => color.group))],
  }
}

export const paletteCatalog = [
  createPalette(mard221Raw as RawPalette),
  createPalette(mard291Raw as RawPalette),
  createPalette(cocoRaw as RawPalette),
  createPalette(manmanRaw as RawPalette),
  createPalette(panpanRaw as RawPalette),
  createPalette(mixiaowoRaw as RawPalette),
  createPalette(artkalC197Raw as RawPalette),
  createPalette(artkalM221Raw as RawPalette),
  createPalette(artkal418Raw as RawPalette),
]

export const DEFAULT_PALETTE_ID = 'mard-221-alfonse-doudou'
export const paletteById = new Map(paletteCatalog.map((item) => [item.id, item]))
export const defaultPalette = paletteById.get(DEFAULT_PALETTE_ID) ?? paletteCatalog[0]

// Default-palette aliases keep the landing page and existing integrations stable.
export const PALETTE_ID = DEFAULT_PALETTE_ID
export const PALETTE_TITLE = `${defaultPalette.title}参考色库`
export const PALETTE_SOURCE_URL = defaultPalette.sourceUrl
export const palette = defaultPalette.colors
export const paletteGroups = defaultPalette.groups
export const colorIndexByCode = new Map(palette.map((color, index) => [color.code, index]))
