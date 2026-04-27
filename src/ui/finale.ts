import { gsap } from 'gsap'
import credits from '../data/credits.json'
import type { Look } from '../data/looks'
import { AUTHOR_NAME, AUTHOR_PORTFOLIO, SUBMISSION_EMAIL, type I18n } from '../i18n'

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

  repaint: () => void
  dispose: () => void
}

export function createFinale(i18n: I18n, onReplay: () => void): FinaleController {
  const overlay = document.createElement('div')
  overlay.className = 'finale-overlay'
  overlay.setAttribute('aria-hidden', 'true')
  overlay.innerHTML = `
    <div class="finale-inner">
      <div class="finale-stamp" data-finale-el>
        <span class="finale-stamp-line"></span>
        <span class="finale-stamp-label" data-finale-i18n="stamp"></span>
        <span class="finale-stamp-line"></span>
      </div>
      <div class="finale-title" data-finale-el>
        <span class="finale-title-a">Nøir</span>
        <span class="finale-title-b">Haus</span>
      </div>
      <div class="finale-subtitle" data-finale-el data-finale-i18n="subtitle"></div>
      <div class="finale-divider" data-finale-el></div>
      <ol class="finale-credits" data-finale-el></ol>
      <div class="finale-submit" data-finale-el>
        <div class="finale-submit-title" data-finale-i18n="submitTitle"></div>
        <p class="finale-submit-body" data-finale-i18n="submitBody"></p>
        <a class="finale-submit-cta" id="finale-submit-cta" data-finale-i18n="submitCta"></a>
      </div>
      <div class="finale-author" data-finale-el>
        <span class="finale-author-label" data-finale-i18n="authorLabel"></span>
        <span class="finale-author-name">${AUTHOR_NAME}</span>
        <span class="finale-author-sep">·</span>
        <a class="finale-author-link" href="${AUTHOR_PORTFOLIO}" target="_blank" rel="noopener noreferrer" data-finale-i18n="authorPortfolio"></a>
        <span class="finale-author-sep">·</span>
        <a class="finale-author-link" href="mailto:${SUBMISSION_EMAIL}" data-finale-i18n="authorContact"></a>
      </div>
      <div class="finale-cta" data-finale-el>
        <button type="button" class="finale-replay" id="finale-replay">
          <span class="finale-replay-line"></span>
          <span class="finale-replay-label" data-finale-i18n="replay"></span>
          <span class="finale-replay-line"></span>
        </button>
      </div>
      <div class="finale-footer" data-finale-el data-finale-i18n="footer"></div>
    </div>
  `
  document.body.appendChild(overlay)

  const creditsList = overlay.querySelector('.finale-credits') as HTMLElement
  const replayBtn = overlay.querySelector('#finale-replay') as HTMLButtonElement
  const submitCtaEl = overlay.querySelector('#finale-submit-cta') as HTMLAnchorElement
  const titleEls = overlay.querySelectorAll('.finale-title span')
  const revealEls = Array.from(overlay.querySelectorAll('[data-finale-el]')) as HTMLElement[]

  const MAIL_SUBJECT_FR = encodeURIComponent('Création pour NØIR HAUS')
  const MAIL_SUBJECT_EN = encodeURIComponent('Submission for NØIR HAUS')

  const applyI18n = (): void => {
    overlay.querySelector('[data-finale-i18n="stamp"]')!.textContent =
      i18n.t('finale.stampLabel')
    overlay.querySelector('[data-finale-i18n="subtitle"]')!.textContent =
      i18n.t('intro.season')
    overlay.querySelector('[data-finale-i18n="submitTitle"]')!.textContent =
      i18n.t('finale.submit.title')
    overlay.querySelector('[data-finale-i18n="submitBody"]')!.textContent =
      i18n.t('finale.submit.body')
    const cta = overlay.querySelector('[data-finale-i18n="submitCta"]')!
    cta.textContent = `${i18n.t('finale.submit.cta')} →`
    overlay.querySelector('[data-finale-i18n="replay"]')!.textContent =
      i18n.t('finale.replay')
    overlay.querySelector('[data-finale-i18n="footer"]')!.textContent =
      i18n.t('finale.footer')
    overlay.querySelector('[data-finale-i18n="authorLabel"]')!.textContent =
      i18n.t('finale.author.label')
    overlay.querySelector('[data-finale-i18n="authorPortfolio"]')!.textContent =
      i18n.t('finale.author.portfolio')
    overlay.querySelector('[data-finale-i18n="authorContact"]')!.textContent =
      i18n.t('finale.author.contact')
    const subj = i18n.get() === 'fr' ? MAIL_SUBJECT_FR : MAIL_SUBJECT_EN
    submitCtaEl.href = `mailto:${SUBMISSION_EMAIL}?subject=${subj}`
  }
  applyI18n()

  let active = false
  let openTl: gsap.core.Timeline | null = null

  replayBtn.addEventListener('click', () => {
    onReplay()
  })

  let lastLooks: Look[] = []
  const renderCredits = (looks: Look[]): void => {
    lastLooks = looks
    creditsList.innerHTML = looks
      .map((look, idx) => {
        const c = creditsMap[look.id]
        const title = c?.title ?? i18n.localize(look.name)
        const creator = c?.creator ?? '—'
        const platform = c?.platform ?? ''
        const link = c?.sourceAsset ?? c?.portfolio ?? null
        const linkAttr = link ? `href="${link}" target="_blank" rel="noopener noreferrer"` : ''
        const tag = link ? 'a' : 'span'
        return `
          <li class="finale-credit" style="--i:${idx}">
            <span class="finale-credit-num">${String(idx + 1).padStart(2, '0')}</span>
            <span class="finale-credit-body">
              <span class="finale-credit-name">${i18n.localize(look.name)}</span>
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

  const repaint = (): void => {
    applyI18n()
    if (lastLooks.length > 0) renderCredits(lastLooks)
  }

  return {
    show,
    hide,
    isActive: () => active,
    repaint,
    dispose: () => {
      openTl?.kill()
      overlay.remove()
    },
  }
}
