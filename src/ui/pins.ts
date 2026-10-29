import { Vector3 } from 'three'
import type { Object3D, PerspectiveCamera } from 'three'
import type { MaterialPin } from '../data/looks'
import type { I18n } from '../i18n'

interface PinHandle {
  data: MaterialPin
  host: Object3D
  root: HTMLElement
  anchorWorld: Vector3
  ndc: Vector3
  expanded: boolean
  flipped: boolean
}

// Fenêtre de visibilité alignée sur le zoom caméra (plateau 0.06 + rampe 0.1) :
// une carte n'est pleine que quand la caméra est réellement sur son ancre,
// et deux pins voisins (espacés de ~0.19) ne se superposent plus.
const PEAK_HALF_WIDTH = 0.07
const FADE_HALF_WIDTH = 0.14
// Au-delà de cette fraction de la largeur, la carte bascule à gauche du point
// pour ne jamais sortir de l'écran.
const FLIP_AT = 0.6

// Modèle d'interaction strictement différent selon l'appareil :
// - pointeur fin + survol (desktop) : la description s'ouvre au survol du point ou de la
//   carte et se referme dès que la souris en sort — rien ne reste collé à l'écran ;
// - tactile : un tap ouvre/ferme, un tap ailleurs ou un début de scroll referme.
const HOVER_CAPABLE =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches

function triangleFade(localProgress: number, atProgress: number): number {
  const d = Math.abs(localProgress - atProgress)
  if (d <= PEAK_HALF_WIDTH) return 1
  if (d >= FADE_HALF_WIDTH) return 0
  return 1 - (d - PEAK_HALF_WIDTH) / (FADE_HALF_WIDTH - PEAK_HALF_WIDTH)
}

export interface PinLayer {
  setPins: (pins: MaterialPin[], host: Object3D) => void
  update: (camera: PerspectiveCamera, localProgress: number) => void
  clear: () => void
  setVisible: (visible: boolean) => void

  repaint: () => void
  dispose: () => void
}

export function createPinLayer(container: HTMLElement, i18n: I18n): PinLayer {
  const root = document.createElement('div')
  root.className = 'pin-layer'
  container.appendChild(root)

  let active: PinHandle[] = []

  const labelFor = (data: MaterialPin): string => i18n.localize(data.label)
  const detailFor = (data: MaterialPin): string | null =>
    data.detail ? i18n.localize(data.detail) : null
  const descriptionFor = (data: MaterialPin): string | null =>
    data.description ? i18n.localize(data.description) : null

  const buildHandle = (data: MaterialPin, host: Object3D): PinHandle => {
    const wrapper = document.createElement('button')
    wrapper.className = 'pin'
    wrapper.type = 'button'
    wrapper.setAttribute(
      'aria-label',
      `${labelFor(data)} — ${detailFor(data) ?? ''}`,
    )

    const dot = document.createElement('span')
    dot.className = 'pin-dot'
    wrapper.appendChild(dot)

    const card = document.createElement('span')
    card.className = 'pin-card'

    if (data.description) {

      const toggle = document.createElement('span')
      toggle.className = 'pin-toggle'
      toggle.setAttribute('aria-hidden', 'true')
      toggle.textContent = '+'
      card.appendChild(toggle)
    }

    const label = document.createElement('span')
    label.className = 'pin-label'
    label.textContent = labelFor(data)
    card.appendChild(label)
    const detailText = detailFor(data)
    if (detailText) {
      const detail = document.createElement('span')
      detail.className = 'pin-detail'
      detail.textContent = detailText
      card.appendChild(detail)
    }
    const descriptionText = descriptionFor(data)
    if (descriptionText) {
      const description = document.createElement('span')
      description.className = 'pin-description'
      description.textContent = descriptionText
      card.appendChild(description)
    }
    wrapper.appendChild(card)

    const handle: PinHandle = {
      data,
      host,
      root: wrapper,
      anchorWorld: new Vector3(),
      ndc: new Vector3(),
      expanded: false,
      flipped: false,
    }

    if (HOVER_CAPABLE) {
      wrapper.addEventListener('mouseenter', () => setExpanded(handle, true))
      wrapper.addEventListener('mouseleave', () => setExpanded(handle, false))
      wrapper.addEventListener('focus', () => setExpanded(handle, true))
      wrapper.addEventListener('blur', () => setExpanded(handle, false))
      // Le clic ne verrouille rien : seul le survol décide, pour que rien ne reste affiché.
      wrapper.addEventListener('click', (e) => e.stopPropagation())
    } else {
      wrapper.addEventListener('click', (e) => {
        e.stopPropagation()
        const next = !handle.expanded
        collapseAll()
        setExpanded(handle, next)
      })
    }

    root.appendChild(wrapper)
    return handle
  }

  const setExpanded = (handle: PinHandle, value: boolean): void => {
    if (handle.expanded === value) return
    handle.expanded = value
    handle.root.classList.toggle('expanded', value)
  }

  const collapseAll = (): void => {
    for (const p of active) setExpanded(p, false)
  }

  // Tactile : un tap hors des pins ou un début de scroll referme la description ouverte.
  const onOutsidePointer = (e: Event): void => {
    const target = e.target as Element | null
    if (target && target.closest('.pin')) return
    collapseAll()
  }
  if (!HOVER_CAPABLE) {
    document.addEventListener('pointerdown', onOutsidePointer, { passive: true })
    window.addEventListener('touchmove', collapseAll, { passive: true })
  }

  const clear = () => {
    for (const p of active) p.root.remove()
    active = []
  }

  const setPins = (pins: MaterialPin[], host: Object3D) => {
    clear()
    for (const data of pins) active.push(buildHandle(data, host))
  }

  const update = (camera: PerspectiveCamera, localProgress: number) => {
    const w = window.innerWidth
    const h = window.innerHeight
    let lastHost: Object3D | null = null
    camera.updateMatrixWorld()

    for (const p of active) {
      const opacity = triangleFade(localProgress, p.data.atProgress)

      if (opacity <= 0) {
        p.root.style.opacity = '0'
        p.root.style.pointerEvents = 'none'
        setExpanded(p, false)
        continue
      }

      p.anchorWorld.set(p.data.anchor[0], p.data.anchor[1], p.data.anchor[2])
      if (lastHost !== p.host) {
        lastHost = p.host
        p.host.updateMatrix()
        if (p.host.parent) {
          p.host.matrixWorld.multiplyMatrices(p.host.parent.matrixWorld, p.host.matrix)
        } else {
          p.host.matrixWorld.copy(p.host.matrix)
        }
      }
      p.anchorWorld.applyMatrix4(p.host.matrixWorld)
      p.ndc.copy(p.anchorWorld).project(camera)

      const behind = p.ndc.z > 1
      const offscreen =
        p.ndc.x < -1.15 || p.ndc.x > 1.15 || p.ndc.y < -1.15 || p.ndc.y > 1.15
      if (behind || offscreen) {
        p.root.style.opacity = '0'
        p.root.style.pointerEvents = 'none'
        continue
      }

      const sx = ((p.ndc.x + 1) / 2) * w
      const sy = ((1 - p.ndc.y) / 2) * h
      const flip = sx > w * FLIP_AT
      if (flip !== p.flipped) {
        p.flipped = flip
        p.root.classList.toggle('flip', flip)
      }
      p.root.style.transform = `translate3d(${sx}px, ${sy}px, 0)`
      p.root.style.opacity = String(opacity)
      p.root.style.pointerEvents = opacity > 0.6 ? 'auto' : 'none'
    }
  }

  const dispose = () => {
    clear()
    if (!HOVER_CAPABLE) {
      document.removeEventListener('pointerdown', onOutsidePointer)
      window.removeEventListener('touchmove', collapseAll)
    }
    root.remove()
  }

  const setVisible = (visible: boolean): void => {
    root.style.transition = 'opacity 0.45s ease'
    root.style.opacity = visible ? '1' : '0'
    root.style.pointerEvents = visible ? '' : 'none'
  }

  const repaint = (): void => {
    for (const p of active) {
      const data = p.data
      p.root.setAttribute(
        'aria-label',
        `${labelFor(data)} — ${detailFor(data) ?? ''}`,
      )
      const labelEl = p.root.querySelector('.pin-label')
      if (labelEl) labelEl.textContent = labelFor(data)
      const detailEl = p.root.querySelector('.pin-detail')
      const detailText = detailFor(data)
      if (detailEl && detailText) detailEl.textContent = detailText
      const descEl = p.root.querySelector('.pin-description')
      const descText = descriptionFor(data)
      if (descEl && descText) descEl.textContent = descText
    }
  }

  return { setPins, update, clear, setVisible, repaint, dispose }
}
