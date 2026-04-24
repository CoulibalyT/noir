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
}

// Half-widths in localProgress units. Pin stays fully opaque while the local
// scroll is within ±PEAK of its anchor, then fades linearly to 0 at ±FADE.
// Widened vs the original 0.06/0.12 so pins linger long enough to be read —
// they sync with the camera-zoom window below (main.ts ZOOM_PEAK/ZOOM_END).
const PEAK_HALF_WIDTH = 0.1
const FADE_HALF_WIDTH = 0.15

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
  // Re-render text content in the active language when the user toggles FR/EN.
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
      // Expand affordance — reads as "+" collapsed, rotates to "×" when open.
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
    }

    // Click toggles expanded view. Stops propagation so it doesn't interfere
    // with scroll handlers attached to window.
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation()
      handle.expanded = !handle.expanded
      wrapper.classList.toggle('expanded', handle.expanded)
    })

    root.appendChild(wrapper)
    return handle
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

    for (const p of active) {
      const opacity = triangleFade(localProgress, p.data.atProgress)
      // Pins whose opacity drops to 0 lose interactivity too; otherwise they
      // would block clicks on the audio toggle / mannequin below.
      if (opacity <= 0) {
        p.root.style.opacity = '0'
        p.root.style.pointerEvents = 'none'
        if (p.expanded) {
          p.expanded = false
          p.root.classList.remove('expanded')
        }
        continue
      }

      p.anchorWorld.set(p.data.anchor[0], p.data.anchor[1], p.data.anchor[2])
      p.host.updateMatrixWorld()
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
      p.root.style.transform = `translate3d(${sx}px, ${sy}px, 0)`
      p.root.style.opacity = String(opacity)
      p.root.style.pointerEvents = opacity > 0.6 ? 'auto' : 'none'
    }
  }

  const dispose = () => {
    clear()
    root.remove()
  }

  // Language toggle — rebuild text nodes in place so the pin positions and
  // expanded state survive the switch.
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

  return { setPins, update, clear, repaint, dispose }
}
