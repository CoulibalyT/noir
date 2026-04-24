export interface CursorController {
  dispose: () => void
}

export function createCursor(): CursorController {
  const ring = document.getElementById('cursor')
  const dot = document.getElementById('cursor-dot')

  if (!ring || !dot) return { dispose: () => {} }

  if (window.matchMedia('(pointer: coarse)').matches) {
    ring.style.display = 'none'
    dot.style.display = 'none'
    return { dispose: () => {} }
  }

  const onMove = (e: MouseEvent) => {
    ring.style.transform = `translate3d(${e.clientX - 6}px, ${e.clientY - 6}px, 0)`
    dot.style.transform = `translate3d(${e.clientX - 1.5}px, ${e.clientY - 1.5}px, 0)`
  }

  window.addEventListener('mousemove', onMove, { passive: true })

  return {
    dispose: () => window.removeEventListener('mousemove', onMove),
  }
}
