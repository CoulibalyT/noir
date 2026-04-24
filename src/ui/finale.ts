import { gsap } from 'gsap'
import credits from '../data/credits.json'
import type { Look } from '../data/looks'

interface CreditEntry {
  creator: string | null
  portfolio: string | null
  platform: string | null
  sourceAsset: string | null
  title: string | null
}

const creditsMap = credits as Record<string, CreditEntry>

export interface FinaleController {
  show: (looks: Look[]) => void
  hide: () => void
  isActive: () => boolean
  dispose: () => void
}

export function createFinale(onReplay: () => void): FinaleController {
  const overlay = document.createElement('div')
  overlay.className = 'finale-overlay'
  overlay.setAttribute('aria-hidden', 'true')
  overlay.innerHTML = `
    <div class="finale-inner">
      <div class="finale-stamp" data-finale-el>
        <span class="finale-stamp-line"></span>
        <span class="finale-stamp-label">Fin du défilé</span>
        <span class="finale-stamp-line"></span>
      </div>
      <div class="finale-title" data-finale-el>
        <span class="finale-title-a">Nøir</span>
        <span class="finale-title-b">Haus</span>
      </div>
      <div class="finale-subtitle" data-finale-el>Automne — Hiver 2026</div>
      <div class="finale-divider" data-finale-el></div>
      <ol class="finale-credits" data-finale-el></ol>
      <div class="finale-cta" data-finale-el>
        <button type="button" class="finale-replay" id="finale-replay">
          <span class="finale-replay-line"></span>
          <span class="finale-replay-label">Revoir le défilé</span>
          <span class="finale-replay-line"></span>
        </button>
      </div>
      <div class="finale-footer" data-finale-el>Nøir Haus · Paris · AW 26</div>
    </div>
  `
  document.body.appendChild(overlay)

  const creditsList = overlay.querySelector('.finale-credits') as HTMLElement
  const replayBtn = overlay.querySelector('#finale-replay') as HTMLButtonElement
  const titleEls = overlay.querySelectorAll('.finale-title span')
  const revealEls = Array.from(overlay.querySelectorAll('[data-finale-el]')) as HTMLElement[]

  let active = false
  let openTl: gsap.core.Timeline | null = null

  replayBtn.addEventListener('click', () => {
    onReplay()
  })

  const renderCredits = (looks: Look[]): void => {
    creditsList.innerHTML = looks
      .map((look, idx) => {
        const c = creditsMap[look.id]
        const title = c?.title ?? look.name
        const creator = c?.creator ?? '—'
        const platform = c?.platform ?? ''
        const link = c?.sourceAsset ?? c?.portfolio ?? null
        const linkAttr = link ? `href="${link}" target="_blank" rel="noopener noreferrer"` : ''
        const tag = link ? 'a' : 'span'
        return `
          <li class="finale-credit" style="--i:${idx}">
            <span class="finale-credit-num">${String(idx + 1).padStart(2, '0')}</span>
            <span class="finale-credit-body">
              <span class="finale-credit-name">${look.name}</span>
              <span class="finale-credit-title">${title}</span>
              <${tag} class="finale-credit-meta" ${linkAttr}>${creator}${platform ? ' · ' + platform : ''}${link ? ' →' : ''}</${tag}>
            </span>
          </li>
        `
      })
      .join('')
  }

  const show = (looks: Look[]): void => {
    if (active) return
    active = true
    renderCredits(looks)
    overlay.classList.add('visible')
    overlay.setAttribute('aria-hidden', 'false')

    // Clean any prior timeline so re-entering the finale replays cleanly.
    openTl?.kill()

    const creditItems = Array.from(creditsList.querySelectorAll('.finale-credit'))

    gsap.set(revealEls, { opacity: 0, y: 14 })
    gsap.set(titleEls, { opacity: 0, y: 40, rotateX: -45 })
    gsap.set(creditItems, { opacity: 0, x: 24 })

    openTl = gsap
      .timeline({ defaults: { ease: 'power3.out' } })
      .to(revealEls[0], { opacity: 1, y: 0, duration: 0.8 }, 0)
      .to(titleEls, { opacity: 1, y: 0, rotateX: 0, duration: 1.1, stagger: 0.25 }, 0.15)
      .to(revealEls[2], { opacity: 1, y: 0, duration: 0.8 }, 1.1)
      .to(revealEls[3], { opacity: 1, y: 0, duration: 0.6, scaleX: 1 }, 1.3)
      .to(creditItems, { opacity: 1, x: 0, duration: 0.6, stagger: 0.12 }, 1.5)
      .to(revealEls[5], { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
      .to(revealEls[6], { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
  }

  const hide = (): void => {
    if (!active) return
    active = false
    overlay.classList.remove('visible')
    overlay.setAttribute('aria-hidden', 'true')
    openTl?.kill()
    openTl = null
  }

  return {
    show,
    hide,
    isActive: () => active,
    dispose: () => {
      openTl?.kill()
      overlay.remove()
    },
  }
}
