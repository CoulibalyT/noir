export interface Quality {

  tier: 'low' | 'high'
  pixelRatio: number
  pixelRatioMin: number
  pixelRatioMax: number
  shadowMapSize: number
  reflectorSize: number
  audienceRowCount: number
  particleCount: number
  useReflector: boolean
  useHdrEnvironment: boolean
  postFxBloom: boolean
  postFxChromatic: boolean
  postFxNoise: boolean
  postFxVignette: boolean
  postFxSmaa: boolean

  reducedMotion: boolean
}

export function detectQuality(): Quality {
  const ua = navigator.userAgent
  const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua)
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const params = new URLSearchParams(window.location.search)
  const dprOverride = Number(params.get('dpr'))
  const dpr = dprOverride > 0 ? dprOverride : window.devicePixelRatio || 1
  // `?tier=low|high` force le palier pour tester le chemin « petite machine » sur un gros poste.
  const tierOverride = params.get('tier')

  const isLow =
    tierOverride === 'low' ||
    (tierOverride !== 'high' && (isMobile || cores < 4 || memory < 4))

  if (isLow) {
    return {
      tier: 'low',
      pixelRatio: 1,
      pixelRatioMin: 0.75,
      pixelRatioMax: 1,
      shadowMapSize: 1024,
      reflectorSize: 512,
      audienceRowCount: 4,
      particleCount: 100,
      useReflector: false,
      useHdrEnvironment: false,
      postFxBloom: true,
      postFxChromatic: false,
      postFxNoise: true,
      postFxVignette: true,
      postFxSmaa: false,
      reducedMotion,
    }
  }

  return {
    tier: 'high',
    pixelRatio: Math.min(dpr, 1.5),
    pixelRatioMin: 0.75,
    pixelRatioMax: Math.min(dpr, 2),
    shadowMapSize: 2048,
    reflectorSize: 1024,
    audienceRowCount: 12,
    particleCount: 400,
    useReflector: true,
    useHdrEnvironment: true,
    postFxBloom: true,
    postFxChromatic: true,
    postFxNoise: true,
    postFxVignette: true,
    postFxSmaa: true,
    reducedMotion,
  }
}
