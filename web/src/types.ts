export type LabColor = [number, number, number]

export type PaletteColor = {
  code: string
  hex: string
  rgb: [number, number, number]
  group: string
  lab: LabColor
}

export type PaletteDefinition = {
  id: string
  title: string
  description: string
  sourceUrl: string
  colors: PaletteColor[]
  groups: string[]
}

export type GridData = {
  width: number
  height: number
  cells: number[]
}

export type EditorTool = 'paint' | 'fill' | 'replace' | 'pick' | 'erase'
export type BeadView = 'square' | 'bead' | 'pattern'

export type SavedProject = {
  schema: 'pindou-project'
  version: 1
  title: string
  paletteId: string
  createdAt: string
  width: number
  height: number
  cells: number[]
}
