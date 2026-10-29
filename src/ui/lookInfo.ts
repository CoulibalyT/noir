import type { Look } from '../data/looks'
import type { I18n } from '../i18n'

export interface LookUI {
  setLook: (index: number, look: Look) => void
  showFirstLook: (look: Look) => void
  triggerFlash: () => void
  setProgress: (progress: number) => void
  hideScrollHint: () => void
  fadeOut: () => void
  swapContent: (index: number, look: Look) => void
  fadeIn: () => void

  repaint: () => void
}

function splitChars(text: string): string {
  return [...text]
    .map((c, i) => {
      const glyph = c === ' ' ? ' ' : c
      return `<span class="char" style="--i:${i}">${glyph}</span>`
    })
    .join('')
}

function splitWords(text: string): string {
  const tokens = text.split(/(\s+)/)
  let wordIdx = 0
  return tokens
    .map((t) => {
      if (/^\s+$/.test(t)) return ' '
      const span = `<span class="word" style="--i:${wordIdx}">${t}</span>`
      wordIdx += 1
      return span
    })
    .join('')
}

export function createLookUI(i18n: I18n): LookUI {
  const lookNumEl = document.getElementById('look-num') as HTMLElement
  const lookNameEl = document.getElementById('look-name') as HTMLElement
  const lookFabricEl = document.getElementById('look-fabric') as HTMLElement
  const lookDescEl = document.getElementById('look-desc') as HTMLElement
  const lookInfoEl = document.getElementById('look-info') as HTMLElement
  const flashEl = document.getElementById('flash') as HTMLElement
  const progressBarEl = document.getElementById('progress-bar') as HTMLElement
  const progressCometEl = document.getElementById('progress-comet') as HTMLElement | null
  let lastProgressQ = -1
  const scrollHintEl = document.getElementById('scroll-hint') as HTMLElement

  let flashTimeoutId: number | null = null
  let currentLook: Look | null = null

  const paintLook = (look: Look): void => {
    lookNameEl.innerHTML = splitChars(i18n.localize(look.name))
    lookFabricEl.innerHTML = splitWords(i18n.localize(look.fabric))
    lookDescEl.textContent = i18n.localize(look.desc)
  }

  const setLook = (index: number, look: Look): void => {
    currentLook = look
    lookInfoEl.classList.remove('visible')
    window.setTimeout(() => {
      lookNumEl.textContent = String(index + 1).padStart(2, '0')
      paintLook(look)
      lookInfoEl.classList.add('visible')
    }, 300)
  }

  const fadeOut = (): void => {
    lookInfoEl.classList.remove('visible')
  }

  const swapContent = (index: number, look: Look): void => {
    currentLook = look
    lookNumEl.textContent = String(index + 1).padStart(2, '0')
    paintLook(look)
  }

  const fadeIn = (): void => {
    lookInfoEl.classList.add('visible')
  }

  const showFirstLook = (look: Look): void => {
    currentLook = look
    paintLook(look)
    lookInfoEl.classList.add('visible')
  }

  const repaint = (): void => {
    if (currentLook) paintLook(currentLook)
  }

  const triggerFlash = (): void => {
    flashEl.classList.add('active')
    if (flashTimeoutId !== null) window.clearTimeout(flashTimeoutId)
    flashTimeoutId = window.setTimeout(() => {
      flashEl.classList.remove('active')
      flashTimeoutId = null
    }, 80)
  }

  const setProgress = (progress: number): void => {
    const q = Math.round(progress * 2000) / 2000
    if (q === lastProgressQ) return
    lastProgressQ = q
    progressBarEl.style.transform = `scaleX(${q})`
    if (progressCometEl) {
      progressCometEl.style.transform = `translate3d(${q * 100}vw, 0, 0)`
    }
  }

  const hideScrollHint = (): void => {
    scrollHintEl.classList.add('hidden')
  }

  return {
    setLook,
    showFirstLook,
    triggerFlash,
    setProgress,
    hideScrollHint,
    fadeOut,
    swapContent,
    fadeIn,
    repaint,
  }
}
