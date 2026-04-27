

const params = new URLSearchParams(window.location.search)
const offList = (params.get('off') ?? '').split(',').filter(Boolean)
const onList = (params.get('on') ?? '').split(',').filter(Boolean)
const only = params.get('only') ?? null

export type FeatureKey =
  | 'cone'
  | 'shimmer'
  | 'iridescence'
  | 'reflector'
  | 'particles'
  | 'doubleside'
  | 'zoom'
  | 'transition'
  | 'bloom'
  | 'chromatic'
  | 'noise'
  | 'vignette'
  | 'audience'
  | 'pitflashes'
  | 'anamorphic'
  | 'grade'
  | 'truss'
  | 'stars'

export function feature(key: FeatureKey, defaultValue = true): boolean {
  if (only !== null) return key === only
  if (offList.includes(key)) return false
  if (onList.includes(key)) return true
  return defaultValue
}

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
  'truss',
  'stars',
]
const summary = allKeys
  .map((k) => `${k}=${feature(k, !offByDefault.has(k)) ? 'on' : 'off'}`)
  .join(' ')

console.log('[features]', summary)
