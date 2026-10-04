/**
 * Returns true if the pixel data contains at least one pixel with alpha < 255.
 * @param data Raw RGBA pixel data from ImageData.data
 */
export function hasTransparentPixels(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

/**
 * Returns true if |a - b| <= tolerance.
 */
export function aspectRatioMatches(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance + Number.EPSILON
}
