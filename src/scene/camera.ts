import { PerspectiveCamera, Vector3 } from 'three'
import { gsap } from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import { LOOKS_SCROLL_END, SCROLL_PER_LOOK, TOTAL_LOOKS } from '../data/looks'

// Fixed subject placement — each look sits on its own station along the runway.
export const LOOK_BASE_Z = -4
export const LOOK_Z_SPACING = 18
export const ORBIT_RADIUS = 2.9
export const CAMERA_HEIGHT = 1.45
export const LOOK_AT_HEIGHT = 1.3

// Fraction of each look's scroll range spent on the linear approach before
// the orbit kicks in. 0.1 = first 10% of scroll walks toward the subject —
// short, since the user wants to be on the model fast.
export const APPROACH_FRACTION = 0.1
// Camera Z distance from the subject at the very start of the approach.
// Was 10m which made the mannequin small + dim at the entry view; 5m gets
// the mannequin to ~40% of the screen height immediately.
export const APPROACH_START_DIST = 5

export function subjectZForLook(index: number): number {
  return LOOK_BASE_Z - index * LOOK_Z_SPACING
}

gsap.registerPlugin(ScrollTrigger)

export interface ScrollState {
  progress: number
  target: number
  velocity: number
  walkPhase: number
  currentLook: number
  localProgress: number
  // 0 until the user scrolls past the last look, then ramps 0→1 across the
  // finale slice. Drives the horizontal pan + close-up on the crossbar.
  finaleProgress: number
}

export interface CameraRig {
  camera: PerspectiveCamera
  scrollState: ScrollState
  update: (time: number) => void
  dispose: () => void
}

const TOUCH_SENSITIVITY = 0.0012
const WHEEL_SENSITIVITY = 0.0004

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

export function createCameraRig(reducedMotion = false): CameraRig {
  const camera = new PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  )
  camera.position.set(0, 1.65, 0)
  camera.lookAt(0, 1.65, -10)

  const scrollState: ScrollState = {
    progress: 0,
    target: 0,
    velocity: 0,
    walkPhase: 0,
    currentLook: 0,
    localProgress: 0,
    finaleProgress: 0,
  }

  // maxTouchPoints > 0 is the reliable signal for a real touchscreen
  // (macOS Safari exposes 'ontouchstart' in window even without a touchscreen).
  const isTouch = navigator.maxTouchPoints > 0

  let scrollTrigger: ScrollTrigger | null = null
  let touchStartY = 0
  let touchScrollBase = 0

  const onTouchStart = (e: TouchEvent) => {
    touchStartY = e.touches[0].clientY
    touchScrollBase = scrollState.target
  }
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    const deltaY = touchStartY - e.touches[0].clientY
    scrollState.target = clamp01(touchScrollBase + deltaY * TOUCH_SENSITIVITY)
  }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    scrollState.target = clamp01(scrollState.target + e.deltaY * WHEEL_SENSITIVITY)
  }

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    if (scrollTrigger) ScrollTrigger.refresh()
  }

  if (isTouch) {
    // Touch devices: disable native scroll, drive progress from touch + wheel.
    document.documentElement.classList.add('no-scroll')
    document.body.classList.add('no-scroll')
    const sc = document.getElementById('scroll-container')
    if (sc) sc.style.height = '100vh'
    window.addEventListener('touchstart', onTouchStart, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('wheel', onWheel, { passive: false })
  } else {
    // Desktop: let the page scroll natively; ScrollTrigger observes progress.
    scrollTrigger = ScrollTrigger.create({
      trigger: '#scroll-container',
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        scrollState.target = self.progress
      },
    })
  }
  window.addEventListener('resize', onResize)

  const cameraShake = new Vector3()

  const update = (time: number) => {
    const prevProgress = scrollState.progress
    scrollState.progress = lerp(scrollState.progress, scrollState.target, 0.04)
    scrollState.velocity = Math.abs(scrollState.progress - prevProgress)
    scrollState.walkPhase += scrollState.velocity * 120

    scrollState.currentLook = Math.min(
      Math.floor(scrollState.progress / SCROLL_PER_LOOK),
      TOTAL_LOOKS - 1,
    )
    scrollState.localProgress = clamp01(
      (scrollState.progress - scrollState.currentLook * SCROLL_PER_LOOK) /
        SCROLL_PER_LOOK,
    )
    scrollState.finaleProgress =
      LOOKS_SCROLL_END < 1
        ? clamp01(
            (scrollState.progress - LOOKS_SCROLL_END) / (1 - LOOKS_SCROLL_END),
          )
        : 0

    // NB: orbit still runs during finaleProgress > 0 so main.ts can lerp
    // the camera from the last orbit pose to the finale pan without a snap.

    // Two-phase per look: (1) linear approach toward the subject, then
    // (2) 360° orbit around it. Camera Z is continuous at the handoff —
    // orbit starts at angle 0 (front, z = subject + radius) which is exactly
    // where the approach ends.
    const subjectZ = subjectZForLook(scrollState.currentLook)

    // Hand-held breathing — zeroed if the user asked to cut motion.
    if (reducedMotion) {
      cameraShake.set(0, 0, 0)
    } else {
      cameraShake.x = Math.sin(time * 1.2) * 0.008
      cameraShake.y = Math.cos(time * 0.8) * 0.006
    }

    if (scrollState.localProgress < APPROACH_FRACTION) {
      const t = scrollState.localProgress / APPROACH_FRACTION
      const z =
        subjectZ + APPROACH_START_DIST - (APPROACH_START_DIST - ORBIT_RADIUS) * t
      camera.position.set(cameraShake.x, CAMERA_HEIGHT + cameraShake.y, z)
    } else {
      const orbitT =
        (scrollState.localProgress - APPROACH_FRACTION) / (1 - APPROACH_FRACTION)
      const angle = orbitT * Math.PI * 2
      camera.position.set(
        Math.sin(angle) * ORBIT_RADIUS + cameraShake.x,
        CAMERA_HEIGHT + cameraShake.y,
        subjectZ + Math.cos(angle) * ORBIT_RADIUS,
      )
    }
    camera.lookAt(0, LOOK_AT_HEIGHT, subjectZ)
  }

  const dispose = () => {
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('resize', onResize)
    document.documentElement.classList.remove('no-scroll')
    document.body.classList.remove('no-scroll')
    if (scrollTrigger) scrollTrigger.kill()
  }

  return { camera, scrollState, update, dispose }
}
