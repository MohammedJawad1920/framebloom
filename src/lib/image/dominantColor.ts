/**
 * Returns the most common opaque color as a hex string.
 * Uses a fast 3-bit-per-channel quantisation bucket to find the dominant hue.
 */
export function pickDominantColor(data: Uint8ClampedArray): string {
  const counts = new Map<string, number>()

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 128) continue // skip transparent/semi-transparent

    // Quantise to 32-step buckets (& 0xf8) so near-identical shades cluster
    const r = (data[i]     & 0xf8).toString(16).padStart(2, '0')
    const g = (data[i + 1] & 0xf8).toString(16).padStart(2, '0')
    const b = (data[i + 2] & 0xf8).toString(16).padStart(2, '0')
    const key = `#${r}${g}${b}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  if (counts.size === 0) return '#888888'

  return [...counts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0]
}
