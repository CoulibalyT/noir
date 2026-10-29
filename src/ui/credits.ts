import credits from '../data/credits.json'
import type { Look } from '../data/looks'
import type { I18n } from '../i18n'

interface CreditEntry {
  creator: string | null
  portfolio: string | null
  platform: string | null
  sourceAsset: string | null
  title: string | null
}

const creditsMap = credits as Record<string, CreditEntry>

export interface CreditsUI {

  updateMarquee: (look: Look, localProgress: number) => void

  showCartel: (look: Look) => void
  hideCartel: () => void

  showFirstLook: (look: Look) => void

  hideMarquee: () => void
}

export function createCreditsUI(i18n: I18n): CreditsUI {
  const marqueeEl = document.getElementById('credits-marquee') as HTMLElement
  const marqueeTitleEl = document.getElementById('credits-marquee-title') as HTMLElement
  const marqueeMetaEl = document.getElementById('credits-marquee-meta') as HTMLElement

  const cartelEl = document.getElementById('credits-cartel') as HTMLElement
  const cartelTitleEl = document.getElementById('credits-cartel-title') as HTMLElement
  const cartelCreatorEl = document.getElementById('credits-cartel-creator') as HTMLElement
  const cartelLinkEl = document.getElementById('credits-cartel-link') as HTMLAnchorElement

  let currentMarqueeId = ''
  let lastMarqueeX = Number.NaN

  const setMarqueeContent = (look: Look): void => {
    const c = creditsMap[look.id]

    const title = c?.title ?? i18n.localize(look.name)
    const creator = c?.creator ?? null
    const platform = c?.platform ?? null
    marqueeTitleEl.textContent = title
    marqueeMetaEl.textContent = creator
      ? platform
        ? `${creator} · ${platform}`
        : creator
      : ''

    marqueeEl.classList.toggle('visible', Boolean(title))
  }

  const updateMarquee = (look: Look, localProgress: number): void => {
    if (look.id !== currentMarqueeId) {
      setMarqueeContent(look)
      currentMarqueeId = look.id
    }

    const x = Math.round((50 - localProgress * 180) * 50) / 50
    if (x === lastMarqueeX) return
    lastMarqueeX = x
    marqueeEl.style.setProperty('--marquee-x', `${x}vw`)
  }

  const showCartel = (look: Look): void => {
    const c = creditsMap[look.id]

    if (!c?.creator) {
      cartelEl.classList.remove('visible')
      return
    }
    cartelTitleEl.textContent = c.title ?? i18n.localize(look.name)
    cartelCreatorEl.textContent = c.creator
    const linkHref = c.sourceAsset ?? c.portfolio
    if (linkHref) {
      cartelLinkEl.href = linkHref
      cartelLinkEl.textContent = c.platform ? `${c.platform} →` : 'Source →'
      cartelLinkEl.style.display = ''
    } else {
      cartelLinkEl.removeAttribute('href')
      cartelLinkEl.style.display = 'none'
    }
    cartelEl.classList.add('visible')
  }

  const hideCartel = (): void => {
    cartelEl.classList.remove('visible')
  }

  const showFirstLook = (look: Look): void => {
    setMarqueeContent(look)
    currentMarqueeId = look.id
  }

  const hideMarquee = (): void => {
    marqueeEl.classList.remove('visible')

    currentMarqueeId = ''
  }

  return { updateMarquee, showCartel, hideCartel, showFirstLook, hideMarquee }
}
