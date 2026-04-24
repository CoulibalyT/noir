export interface IntroController {
  setProgress: (pct: number) => void
  dismiss: () => void
  dispose: () => void
}

function splitTitle(text: string): string {
  let charIndex = 0
  return [...text]
    .map((c) => {
      if (c === ' ') return '<span class="char char--space"></span>'
      const span = `<span class="char" style="--char-index: ${charIndex}">${c}</span>`
      charIndex++
      return span
    })
    .join('')
}

function splitWords(text: string): string {
  let wordIndex = 0
  return text
    .split(/(\s+)/)
    .map((t) => {
      if (/^\s+$/.test(t)) return ' '
      const span = `<span class="word" style="--word-index: ${wordIndex}">${t}</span>`
      wordIndex++
      return span
    })
    .join('')
}

export function createIntro(): IntroController {
  const el = document.getElementById('intro') as HTMLElement
  const titleEl = document.getElementById('intro-title') as HTMLElement
  const seasonEl = document.getElementById('intro-season') as HTMLElement
  const fill = document.getElementById('intro-progress-fill') as HTMLElement
  const label = document.getElementById('intro-progress-label') as HTMLElement

  titleEl.innerHTML = splitTitle(titleEl.textContent ?? '')
  seasonEl.innerHTML = splitWords(seasonEl.textContent ?? '')

  requestAnimationFrame(() => {
    el.classList.add('intro-playing')
  })

  let dismissed = false
  let pendingTimeoutId: number | null = null

  return {
    setProgress: (pct: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(pct)))
      fill.style.width = `${clamped}%`
      label.textContent = `${String(clamped).padStart(2, '0')}%`
    },
    dismiss: () => {
      if (dismissed) return
      dismissed = true

      pendingTimeoutId = window.setTimeout(() => {
        el.classList.add('hidden')
        pendingTimeoutId = null
      }, 650)
    },
    dispose: () => {
      if (pendingTimeoutId !== null) window.clearTimeout(pendingTimeoutId)
    },
  }
}
