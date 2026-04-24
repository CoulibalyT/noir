// Feature flags toggleable via URL query params, e.g.:
//   ?off=cone,shimmer        → disable cone + shimmer
//   ?only=cone               → only cone enabled, everything else off
//   ?on=shimmer              → force shimmer on regardless of default
//
// Used for binary-search debugging. Each suspect feature reads its flag at
// startup; flipping params + refreshing isolates which one breaks the scene.

const params = new URLSearchParams(window.location.search)
const offList = (params.get('off') ?? '').split(',').filter(Boolean)
const onList = (params.get('on') ?? '').split(',').filter(Boolean)
const only = params.get('only') ?? null

export type FeatureKey =
  | 'cone' // volumetric spot light cone shader
  | 'shimmer' // silk shimmer onBeforeCompile injection
  | 'iridescence' // iridescence onBeforeCompile injection
  | 'reflector' // Reflector mirror floor
  | 'particles' // floating dust particles
  | 'doubleside' // force DoubleSide on transparent materials
  | 'zoom' // pin-driven camera zoom
  | 'transition' // flash on look change
  | 'bloom' // postfx bloom
  | 'chromatic' // postfx chromatic aberration
  | 'noise' // postfx film grain
  | 'vignette' // postfx vignette
  | 'audience' // audience silhouettes
  | 'pitflashes' // photographer pit flashes
  | 'anamorphic' // horizontal cinema-lens streaks on highlights
  | 'grade' // filmic color grading LUT

export function feature(key: FeatureKey, defaultValue = true): boolean {
  if (only !== null) return key === only
  if (offList.includes(key)) return false
  if (onList.includes(key)) return true
  return defaultValue
}

// Print the active configuration once on load so debugging is obvious in
// the console (and the screenshot HUD if she shares it).
// Default-off keys (known broken / opt-in only). Iridescence now uses the
// native MeshPhysicalMaterial path → safe to enable by default. Silk shimmer
// stays opt-in until reimplemented without onBeforeCompile.
// Binary-search disables: reflector/cone/zoom are suspects for black flashes
// on certain GLBs. Disabled until elimination narrows the culprit.
// Back to normal defaults — the Look 3 black was KHR_materials_transmission
// on CLO exports, fixed in tuneCloMaterials.
const offByDefault: Set<FeatureKey> = new Set(['shimmer'])

const allKeys: FeatureKey[] = [
  'cone',
  'shimmer',
  'iridescence',
  'reflector',
  'particles',
  'doubleside',
  'zoom',
  'transition',
  'bloom',
  'chromatic',
  'noise',
  'vignette',
  'audience',
  'pitflashes',
  'anamorphic',
  'grade',
]
const summary = allKeys
  .map((k) => `${k}=${feature(k, !offByDefault.has(k)) ? 'on' : 'off'}`)
  .join(' ')
// eslint-disable-next-line no-console
console.log('[features]', summary)
