import type { Look } from '../data/looks'

export interface LookUI {
  setLook: (index: number, look: Look) => void
  showFirstLook: (look: Look) => void
  triggerFlash: () => void
  setProgress: (progress: number) => void
  hideScrollHint: () => void
}

// Emit a span per character, indexed — CSS multiplies `--i` by a stagger
// duration to cascade the reveal. Spaces become non-breaking so the layout
// doesn't collapse when the chars are translated on the Y axis during the
// animation.
function splitChars(text: string): string {
  return [...text]
    .map((c, i) => {
      const glyph = c === ' ' ? ' ' : c
      return `<span class="char" style="--i:${i}">${glyph}</span>`
    })
    .join('')
}

// Word-level split for longer strings where per-char would stagger too long.
// Keeps the separator (· or space) inline.
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

export function createLookUI(): LookUI {
  const lookNumEl = document.getElementById('look-num') as HTMLElement
  const lookNameEl = document.getElementById('look-name') as HTMLElement
  const lookFabricEl = document.getElementById('look-fabric') as HTMLElement
  const lookDescEl = document.getElementById('look-desc') as HTMLElement
  const lookInfoEl = document.getElementById('look-info') as HTMLElement
  const flashEl = document.getElementById('flash') as HTMLElement
  const progressBarEl = document.getElementById('progress-bar') as HTMLElement
  const scrollHintEl = document.getElementById('scroll-hint') as HTMLElement

  let flashTimeoutId: number | null = null

  const paintLook = (look: Look): void => {
    lookNameEl.innerHTML = splitChars(look.name)
    lookFabricEl.innerHTML = splitWords(look.fabric)
    lookDescEl.textContent = look.desc
  }

  const setLook = (index: number, look: Look): void => {
    lookInfoEl.classList.remove('visible')
    window.setTimeout(() => {
      lookNumEl.textContent = String(index + 1).padStart(2, '0')
      paintLook(look)
      lookInfoEl.classList.add('visible')
    }, 300)
  }

  const showFirstLook = (look: Look): void => {
    paintLook(look)
    lookInfoEl.classList.add('visible')
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
    progressBarEl.style.width = `${progress * 100}%`
  }

  const hideScrollHint = (): void => {
    scrollHintEl.classList.add('hidden')
  }

  return { setLook, showFirstLook, triggerFlash, setProgress, hideScrollHint }
}
