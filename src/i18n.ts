

export type Lang = 'fr' | 'en'

export interface Localized {
  fr: string
  en: string
}

export const SUBMISSION_EMAIL = 'coulibaly.tene00@gmail.com'

const DICT = {
  'intro.defile': { fr: 'Défilé', en: 'Runway' },
  'intro.season': { fr: 'Automne — Hiver 2026', en: 'Fall — Winter 2026' },
  'intro.corner.tl': { fr: 'N° 01 — DÉFILÉ', en: 'N° 01 — SHOW' },
  'intro.corner.bl': { fr: 'Paris / 24.04.2026', en: 'Paris / 04.24.2026' },
  'intro.corner.br': { fr: '4 regards', en: '4 looks' },

  'brand.subtitle': { fr: 'Automne — Hiver 2026', en: 'Fall — Winter 2026' },
  'seasonTag': { fr: 'AW26 — PARIS', en: 'AW26 — PARIS' },

  'scrollHint': { fr: 'Glissez pour entrer', en: 'Scroll to enter' },

  'audio.label': { fr: 'Son', en: 'Sound' },
  'audio.on': { fr: 'on', en: 'on' },
  'audio.off': { fr: 'off', en: 'off' },
  'audio.ariaOn': { fr: 'Couper le son', en: 'Mute sound' },
  'audio.ariaOff': { fr: 'Activer le son', en: 'Turn sound on' },

  'cartel.label': { fr: 'Couture', en: 'Couture' },

  'finale.stampLabel': { fr: 'Fin du défilé', en: 'End of show' },
  'finale.replay': { fr: 'Revoir le défilé', en: 'Watch again' },
  'finale.footer': {
    fr: 'Nøir Haus · Paris · AW 26',
    en: 'Nøir Haus · Paris · AW 26',
  },
  'finale.submit.title': {
    fr: 'Votre pièce sur la prochaine saison',
    en: 'Your work on the next season',
  },
  'finale.submit.body': {
    fr: 'NØIR HAUS ouvre son défilé aux créateurs. Envoyez un GLB, un fichier CLO ou un lien vers votre pièce — les sélections intègrent la saison suivante, créditées sur la cartel.',
    en: 'NØIR HAUS opens its runway to makers. Send a GLB, a CLO file or a link to your piece — selected works join the next season with a cartel credit.',
  },
  'finale.submit.cta': {
    fr: 'Envoyer votre création',
    en: 'Submit your work',
  },

  'lang.toggle.fr': { fr: 'FR', en: 'FR' },
  'lang.toggle.en': { fr: 'EN', en: 'EN' },
  'lang.ariaSwitch': {
    fr: 'Basculer en anglais',
    en: 'Switch to French',
  },

  'mobile.stamp': {
    fr: 'Expérience desktop',
    en: 'Desktop experience',
  },
  'mobile.title': {
    fr: 'Ce défilé se vit sur grand écran',
    en: 'This runway is made for a bigger screen',
  },
  'mobile.body': {
    fr: 'Le rendu 3D, les détails de couture et le travelling du finale demandent la puissance et la largeur d’un ordinateur. Retrouvez-nous sur desktop.',
    en: 'The 3D rendering, fabric detail and finale travelling require the horsepower and width of a desktop. See us on a computer.',
  },
  'mobile.footer': {
    fr: 'Nøir Haus · Paris · AW 26',
    en: 'Nøir Haus · Paris · AW 26',
  },
} as const

export type StringKey = keyof typeof DICT

const STORAGE_KEY = 'noirhaus:lang'

function detectDefaultLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'fr' || stored === 'en') return stored
  } catch {

  }
  const nav = (navigator.language || '').toLowerCase()
  return nav.startsWith('fr') ? 'fr' : 'en'
}

export interface I18n {
  get: () => Lang
  set: (lang: Lang) => void
  toggle: () => Lang
  t: (key: StringKey) => string
  localize: (s: Localized | string) => string
  onChange: (cb: (lang: Lang) => void) => () => void
}

export function createI18n(): I18n {
  let lang: Lang = detectDefaultLang()
  const subscribers = new Set<(lang: Lang) => void>()

  const syncDocument = (): void => {
    document.documentElement.setAttribute('lang', lang)
  }
  syncDocument()

  const set = (next: Lang): void => {
    if (next === lang) return
    lang = next
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {

    }
    syncDocument()
    subscribers.forEach((cb) => cb(lang))
  }

  return {
    get: () => lang,
    set,
    toggle: () => {
      const next: Lang = lang === 'fr' ? 'en' : 'fr'
      set(next)
      return next
    },
    t: (key) => DICT[key][lang],
    localize: (s) => (typeof s === 'string' ? s : s[lang]),
    onChange: (cb) => {
      subscribers.add(cb)
      return () => subscribers.delete(cb)
    },
  }
}
