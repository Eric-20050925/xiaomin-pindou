import type { LabColor } from '../types'

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180
const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI

export function rgbToLab([red, green, blue]: [number, number, number]): LabColor {
  const linearize = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  const r = linearize(red)
  const g = linearize(green)
  const b = linearize(blue)

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883

  const pivot = (value: number) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116

  const fx = pivot(x)
  const fy = pivot(y)
  const fz = pivot(z)

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export function deltaE2000(lab1: LabColor, lab2: LabColor): number {
  const [l1, a1, b1] = lab1
  const [l2, a2, b2] = lab2
  const c1 = Math.sqrt(a1 ** 2 + b1 ** 2)
  const c2 = Math.sqrt(a2 ** 2 + b2 ** 2)
  const cMean = (c1 + c2) / 2
  const g = 0.5 * (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7)))
  const a1Prime = (1 + g) * a1
  const a2Prime = (1 + g) * a2
  const c1Prime = Math.sqrt(a1Prime ** 2 + b1 ** 2)
  const c2Prime = Math.sqrt(a2Prime ** 2 + b2 ** 2)

  const hue = (a: number, b: number) => {
    if (a === 0 && b === 0) return 0
    const angle = radiansToDegrees(Math.atan2(b, a))
    return angle >= 0 ? angle : angle + 360
  }

  const h1Prime = hue(a1Prime, b1)
  const h2Prime = hue(a2Prime, b2)
  const deltaLPrime = l2 - l1
  const deltaCPrime = c2Prime - c1Prime
  const hueDiff = h2Prime - h1Prime
  const deltaHuePrime = c1Prime * c2Prime === 0
    ? 0
    : Math.abs(hueDiff) <= 180
      ? hueDiff
      : hueDiff > 180
        ? hueDiff - 360
        : hueDiff + 360
  const deltaHPrime = 2 * Math.sqrt(c1Prime * c2Prime) * Math.sin(degreesToRadians(deltaHuePrime / 2))

  const lMean = (l1 + l2) / 2
  const cPrimeMean = (c1Prime + c2Prime) / 2
  const hPrimeMean = c1Prime * c2Prime === 0
    ? h1Prime + h2Prime
    : Math.abs(h1Prime - h2Prime) <= 180
      ? (h1Prime + h2Prime) / 2
      : h1Prime + h2Prime < 360
        ? (h1Prime + h2Prime + 360) / 2
        : (h1Prime + h2Prime - 360) / 2

  const t = 1
    - 0.17 * Math.cos(degreesToRadians(hPrimeMean - 30))
    + 0.24 * Math.cos(degreesToRadians(2 * hPrimeMean))
    + 0.32 * Math.cos(degreesToRadians(3 * hPrimeMean + 6))
    - 0.2 * Math.cos(degreesToRadians(4 * hPrimeMean - 63))
  const deltaTheta = 30 * Math.exp(-(((hPrimeMean - 275) / 25) ** 2))
  const rc = 2 * Math.sqrt(cPrimeMean ** 7 / (cPrimeMean ** 7 + 25 ** 7))
  const sl = 1 + (0.015 * (lMean - 50) ** 2) / Math.sqrt(20 + (lMean - 50) ** 2)
  const sc = 1 + 0.045 * cPrimeMean
  const sh = 1 + 0.015 * cPrimeMean * t
  const rt = -Math.sin(degreesToRadians(2 * deltaTheta)) * rc

  const lTerm = deltaLPrime / sl
  const cTerm = deltaCPrime / sc
  const hTerm = deltaHPrime / sh
  return Math.sqrt(lTerm ** 2 + cTerm ** 2 + hTerm ** 2 + rt * cTerm * hTerm)
}
