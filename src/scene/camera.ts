import { PerspectiveCamera, Vector3 } from 'three'
import { gsap } from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import { LOOKS_SCROLL_END, SCROLL_PER_LOOK, TOTAL_LOOKS } from '../data/looks'

export const LOOK_BASE_Z = -4
export const LOOK_Z_SPACING = 18
export const ORBIT_RADIUS = 2.9
export const CAMERA_HEIGHT = 1.45
export const LOOK_AT_HEIGHT = 1.3

export const APPROACH_FRACTION = 0.1

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

  finaleProgress: number
}

export interface CameraRig {
  camera: PerspectiveCamera
  scrollState: ScrollState
  update: (time: number) => void
  dispose: () => void
}

const TOUCH_SENSITIVITY = 0.0007
const WHEEL_SENSITIVITY = 0.00018

const MAX_PROGRESS_PER_SECOND = 0.18

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

    document.documentElement.classList.add('no-scroll')
    document.body.classList.add('no-scroll')
    const sc = document.getElementById('scroll-container')
    if (sc) sc.style.height = '100vh'
    window.addEventListener('touchstart', onTouchStart, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('wheel', onWheel, { passive: false })
  } else {

    scrollTrigger = ScrollTrigger.create({
      trigger: '#scroll-container',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
      onUpdate: (self) => {
        scrollState.target = self.progress
      },
    })
  }
  window.addEventListener('resize', onResize)

  const cameraShake = new Vector3()
  let prevTime = 0

  const update = (time: number) => {
    const dt = prevTime > 0 ? Math.min(time - prevTime, 0.1) : 1 / 60
    prevTime = time

    const prevProgress = scrollState.progress
    const lerped = lerp(scrollState.progress, scrollState.target, 0.08)
    const maxStep = MAX_PROGRESS_PER_SECOND * dt
    const requested = lerped - prevProgress
    if (Math.abs(requested) > maxStep) {
      scrollState.progress = prevProgress + Math.sign(requested) * maxStep
    } else {
      scrollState.progress = lerped
    }
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

    const subjectZ = subjectZForLook(scrollState.currentLook)

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
