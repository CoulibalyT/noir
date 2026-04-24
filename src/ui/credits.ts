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
  // Called every frame with the active look + its local scroll progress
  // (0..1). Drives the giant horizontal-parallax title behind the runway.
  updateMarquee: (look: Look, localProgress: number) => void
  // Fade in the full-screen credit card during a look transition.
  showCartel: (look: Look) => void
  hideCartel: () => void
  // Initialise the marquee for the first look without waiting for scroll.
  showFirstLook: (look: Look) => void
  // Explicitly hide the parallax title — used during the finale where a
  // look-specific headline would clash with the group lineup.
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

  const setMarqueeContent = (look: Look): void => {
    const c = creditsMap[look.id]
    // Title falls back to the look name so the marquee never reads as empty —
    // credits are progressively filled, we shouldn't wait for the json to be
    // complete before the editorial layer kicks in. Credits titles (asset
    // names) stay as the creator set them; look names are localized.
    const title = c?.title ?? i18n.localize(look.name)
    const creator = c?.creator ?? null
    const platform = c?.platform ?? null
    marqueeTitleEl.textContent = title
    marqueeMetaEl.textContent = creator
      ? platform
        ? `${creator} · ${platform}`
        : creator
      : ''
    // Only reveal the marquee once we have at least a title to show — every
    // look has a name so this is effectively always true, but the guard keeps
    // the door open for a future "hide marquee when null" policy.
    marqueeEl.classList.toggle('visible', Boolean(title))
  }

  const updateMarquee = (look: Look, localProgress: number): void => {
    if (look.id !== currentMarqueeId) {
      setMarqueeContent(look)
      currentMarqueeId = look.id
    }
    // Parallax: the title enters from the right at progress=0 and exits to
    // the left at progress=1. Range is wider than 100vw because the text
    // itself is huge (often overflows the viewport).
    const x = 50 - localProgress * 180
    marqueeEl.style.setProperty('--marquee-x', `${x}vw`)
  }

  const showCartel = (look: Look): void => {
    const c = creditsMap[look.id]
    // Without a creator the cartel has nothing meaningful to say — skip it
    // silently rather than showing a half-empty card.
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
    // Force a re-sync next time updateMarquee runs so the marquee comes back
    // with fresh content if the user replays.
    currentMarqueeId = ''
  }

  return { updateMarquee, showCartel, hideCartel, showFirstLook, hideMarquee }
}
