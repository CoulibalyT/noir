export interface Quality {
  // Overall device tier. Most decisions branch off this.
  tier: 'low' | 'high'
  pixelRatio: number
  shadowMapSize: number
  audienceRowCount: number
  particleCount: number
  useReflector: boolean
  useHdrEnvironment: boolean
  postFxBloom: boolean
  postFxChromatic: boolean
  postFxNoise: boolean
  postFxVignette: boolean
  // User has asked the OS to cut back animations. We freeze camera shake,
  // audience sway, particle drift. CSS handles DOM-level animations via a
  // media query.
  reducedMotion: boolean
}

export function detectQuality(): Quality {
  const ua = navigator.userAgent
  const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua)
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Low tier: mobile, or desktop with few cores / low memory.
  const isLow = isMobile || cores < 4 || memory < 4

  if (isLow) {
    return {
      tier: 'low',
      pixelRatio: 1,
      shadowMapSize: 1024,
      audienceRowCount: 4,
      particleCount: 100,
      useReflector: false,
      useHdrEnvironment: false,
      postFxBloom: true,
      postFxChromatic: false,
      postFxNoise: true,
      postFxVignette: true,
      reducedMotion,
    }
  }

  return {
    tier: 'high',
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    shadowMapSize: 2048,
    audienceRowCount: 12,
    particleCount: 400,
    useReflector: true,
    useHdrEnvironment: true,
    postFxBloom: true,
    postFxChromatic: true,
    postFxNoise: true,
    postFxVignette: true,
    reducedMotion,
  }
}
