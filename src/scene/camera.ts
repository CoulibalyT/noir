import { PerspectiveCamera, Vector3 } from 'three'
import { LOOKS_SCROLL_END, SCROLL_PER_LOOK, TOTAL_LOOKS } from '../data/looks'

export const LOOK_BASE_Z = -4
export const LOOK_Z_SPACING = 18
export const ORBIT_RADIUS = 2.9
export const CAMERA_HEIGHT = 1.45
export const LOOK_AT_HEIGHT = 1.3
export const BASE_FOV = 45

export const APPROACH_FRACTION = 0.1
export const APPROACH_START_DIST = 5

export const ARRIVAL_END = 0.1
export const DEPARTURE_START = 0.78

const TRAVEL_SPLIT =
  (1 - DEPARTURE_START) / (1 - DEPARTURE_START + ARRIVAL_END)

const TRAVEL_SIDE_X = 1.7
const TRAVEL_LIFT_Y = 0.35
const TRAVEL_ROLL = 0.035
const TRAVEL_FOV_BOOST = 6
const TRAVEL_SPEED_SCALE = 0.55

export function subjectZForLook(index: number): number {
  return LOOK_BASE_Z - index * LOOK_Z_SPACING
}

export function departureStartForLook(index: number): number {
  return index < TOTAL_LOOKS - 1 ? DEPARTURE_START : 1
}

export interface ScrollState {
  progress: number
  target: number
  velocity: number
  inputRate: number
  walkPhase: number
  currentLook: number
  localProgress: number
  finaleProgress: number
  dt: number
  travelT: number
  travelFrom: number
  travelTo: number
  travelBump: number
  orbitWeight: number
  baseFov: number
}

export interface CameraRigOptions {
  reducedMotion?: boolean
  parallax?: boolean
  getResistance?: () => number
  onInput?: () => void
}

export interface CameraRig {
  camera: PerspectiveCamera
  scrollState: ScrollState
  update: (time: number, dt: number) => void
  nudge: (pixels: number) => void
  setTarget: (progress: number) => void
  jumpTo: (progress: number) => void
  lock: (progress: number | null) => void
  isLocked: () => boolean
  applyParallax: () => void
  dispose: () => void
}

const VIRTUAL_TRACK_PX = 7000
const WHEEL_LINE_PX = 16
const MAX_WHEEL_EVENT_PX = 180
const KEY_STEP_PX = 140
const PAGE_STEP_PX = 640
const TOUCH_GAIN = 1.6

const MAX_PROGRESS_PER_SECOND = 0.065
const MAX_AHEAD_BASE = 0.06
const MIN_RESISTANCE = 0.6

const SPRING_OMEGA = 3.4
const MAX_DT = 0.05
const INPUT_RATE_TAU = 0.25

const PARALLAX_YAW = 0.035
const PARALLAX_PITCH = 0.02
const PARALLAX_TAU = 0.35

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const smooth01 = (t: number): number => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}
const smoothRange = (edge0: number, edge1: number, x: number): number =>
  smooth01((x - edge0) / (edge1 - edge0))

const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    tag === 'BUTTON' ||
    tag === 'A' ||
    el.isContentEditable
  )
}

export function createCameraRig(options: CameraRigOptions = {}): CameraRig {
  const reducedMotion = options.reducedMotion ?? false
  const parallaxEnabled = (options.parallax ?? true) && !reducedMotion
  const getResistance = options.getResistance ?? (() => 1)
  const onInput = options.onInput ?? (() => {})

  const camera = new PerspectiveCamera(
    BASE_FOV,
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
    inputRate: 0,
    walkPhase: 0,
    currentLook: 0,
    localProgress: 0,
    finaleProgress: 0,
    dt: 1 / 60,
    travelT: -1,
    travelFrom: 0,
    travelTo: 0,
    travelBump: 0,
    orbitWeight: 1,
    baseFov: BASE_FOV,
  }

  let springVelocity = 0
  let locked: number | null = null
  let inputAccumulator = 0

  const nudge = (pixels: number): void => {
    if (!Number.isFinite(pixels) || pixels === 0) return
    onInput()
    inputAccumulator += Math.abs(pixels)
    if (locked !== null) return
    scrollState.target = clamp01(scrollState.target + pixels / VIRTUAL_TRACK_PX)
  }

  const setTarget = (progress: number): void => {
    if (locked !== null) return
    scrollState.target = clamp01(progress)
  }

  const jumpTo = (progress: number): void => {
    const p = clamp01(progress)
    scrollState.target = p
    scrollState.progress = p
    springVelocity = 0
  }

  const lock = (progress: number | null): void => {
    locked = progress === null ? null : clamp01(progress)
    if (locked !== null) {
      scrollState.target = locked
      scrollState.progress = locked
      springVelocity = 0
    }
  }

  const isLocked = (): boolean => locked !== null

  let touchStartY = 0
  let touchLastY = 0
  const mouseNdc = { x: 0, y: 0 }
  const parallax = { x: 0, y: 0 }

  const onMouseMove = (e: MouseEvent): void => {
    mouseNdc.x = (e.clientX / window.innerWidth) * 2 - 1
    mouseNdc.y = -((e.clientY / window.innerHeight) * 2 - 1)
  }
  const onMouseLeave = (): void => {
    mouseNdc.x = 0
    mouseNdc.y = 0
  }

  const onTouchStart = (e: TouchEvent): void => {
    touchStartY = e.touches[0].clientY
    touchLastY = touchStartY
  }
  const onTouchMove = (e: TouchEvent): void => {
    e.preventDefault()
    const y = e.touches[0].clientY
    nudge((touchLastY - y) * TOUCH_GAIN)
    touchLastY = y
  }
  const onWheel = (e: WheelEvent): void => {
    if (e.ctrlKey) return
    e.preventDefault()
    let px = e.deltaY
    if (e.deltaMode === 1) px *= WHEEL_LINE_PX
    else if (e.deltaMode === 2) px *= window.innerHeight
    px = Math.max(-MAX_WHEEL_EVENT_PX, Math.min(MAX_WHEEL_EVENT_PX, px))
    nudge(px)
  }
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (isEditableTarget(e.target)) return
    let px = 0
    switch (e.key) {
      case 'ArrowDown':
        px = KEY_STEP_PX
        break
      case 'ArrowUp':
        px = -KEY_STEP_PX
        break
      case 'PageDown':
        px = PAGE_STEP_PX
        break
      case ' ':
        px = e.shiftKey ? -PAGE_STEP_PX : PAGE_STEP_PX
        break
      case 'PageUp':
        px = -PAGE_STEP_PX
        break
      case 'Home':
        e.preventDefault()
        onInput()
        if (locked === null) scrollState.target = 0
        return
      case 'End':
        e.preventDefault()
        onInput()
        if (locked === null) scrollState.target = 1
        return
      default:
        return
    }
    e.preventDefault()
    nudge(px)
  }

  const onResize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }

  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onResize)
  if (parallaxEnabled) {
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    document.addEventListener('mouseleave', onMouseLeave)
  }

  const applyParallax = (): void => {
    if (!parallaxEnabled) return
    camera.rotateY(-parallax.x * PARALLAX_YAW)
    camera.rotateX(parallax.y * PARALLAX_PITCH)
  }

  const cameraShake = new Vector3()
  const lookTarget = new Vector3()
  const upVector = new Vector3(0, 1, 0)

  const travelPose = (fromIdx: number, toIdx: number, t: number): number => {
    const zFrom = subjectZForLook(fromIdx) + ORBIT_RADIUS
    const zTo = subjectZForLook(toIdx) + ORBIT_RADIUS
    const z = lerp(zFrom, zTo, smooth01(t))

    const u = clamp01(t / 0.6)
    const side = fromIdx % 2 === 0 ? 1 : -1
    const sinU = Math.sin(Math.PI * u)
    const bump = sinU * sinU

    camera.position.set(
      side * TRAVEL_SIDE_X * bump + cameraShake.x,
      CAMERA_HEIGHT + TRAVEL_LIFT_Y * bump + cameraShake.y,
      z,
    )

    const gaze = smoothRange(0.18, 0.62, t)
    lookTarget.set(
      0,
      LOOK_AT_HEIGHT,
      lerp(subjectZForLook(fromIdx), subjectZForLook(toIdx), gaze),
    )

    const roll = reducedMotion ? 0 : side * TRAVEL_ROLL * bump
    upVector.set(Math.sin(roll), Math.cos(roll), 0)
    camera.up.copy(upVector)
    camera.lookAt(lookTarget)

    return BASE_FOV + TRAVEL_FOV_BOOST * Math.sin(Math.PI * t)
  }

  const update = (time: number, dtIn: number): void => {
    const dt = Math.min(Math.max(dtIn, 0), MAX_DT)
    scrollState.dt = dt

    const prev = scrollState.progress

    if (locked !== null) {
      scrollState.target = locked
      scrollState.progress = locked
      springVelocity = 0
    } else {
      const maxAhead = MAX_AHEAD_BASE * Math.max(MIN_RESISTANCE, getResistance())
      const ahead = scrollState.target - prev
      if (ahead > maxAhead) scrollState.target = prev + maxAhead
      else if (ahead < -maxAhead) scrollState.target = prev - maxAhead

      const cap =
        MAX_PROGRESS_PER_SECOND * (1 - (1 - TRAVEL_SPEED_SCALE) * scrollState.travelBump)
      const displacement = scrollState.target - prev
      const accel =
        SPRING_OMEGA * SPRING_OMEGA * displacement - 2 * SPRING_OMEGA * springVelocity
      springVelocity += accel * dt
      if (springVelocity > cap) springVelocity = cap
      else if (springVelocity < -cap) springVelocity = -cap

      let next = prev + springVelocity * dt
      if (next <= 0 || next >= 1) {
        next = clamp01(next)
        springVelocity = 0
      }
      if (
        Math.abs(scrollState.target - next) < 1e-5 &&
        Math.abs(springVelocity) < 1e-4
      ) {
        next = scrollState.target
        springVelocity = 0
      }
      scrollState.progress = next
    }

    const dp = scrollState.progress - prev
    scrollState.velocity = dt > 0 ? Math.abs(dp) / dt : 0
    scrollState.walkPhase += Math.abs(dp) * 120

    if (parallaxEnabled) {
      const kp = 1 - Math.exp(-dt / PARALLAX_TAU)
      parallax.x += (mouseNdc.x - parallax.x) * kp
      parallax.y += (mouseNdc.y - parallax.y) * kp
    }

    if (dt > 0) {
      const instantRate = inputAccumulator / VIRTUAL_TRACK_PX / dt
      const k = 1 - Math.exp(-dt / INPUT_RATE_TAU)
      scrollState.inputRate += (instantRate - scrollState.inputRate) * k
    }
    inputAccumulator = 0

    const lookIdx = Math.min(
      Math.floor(scrollState.progress / SCROLL_PER_LOOK),
      TOTAL_LOOKS - 1,
    )
    scrollState.currentLook = lookIdx
    const local = clamp01(
      (scrollState.progress - lookIdx * SCROLL_PER_LOOK) / SCROLL_PER_LOOK,
    )
    scrollState.localProgress = local
    scrollState.finaleProgress =
      LOOKS_SCROLL_END < 1
        ? clamp01(
            (scrollState.progress - LOOKS_SCROLL_END) / (1 - LOOKS_SCROLL_END),
          )
        : 0

    const subjectZ = subjectZForLook(lookIdx)

    if (reducedMotion) {
      cameraShake.set(0, 0, 0)
    } else {
      cameraShake.x = Math.sin(time * 1.2) * 0.008
      cameraShake.y = Math.cos(time * 0.8) * 0.006
    }

    const departureStart = departureStartForLook(lookIdx)
    let fov = BASE_FOV
    let travelT = -1
    let travelFrom = lookIdx
    let travelTo = lookIdx

    if (lookIdx > 0 && local < ARRIVAL_END) {
      travelFrom = lookIdx - 1
      travelTo = lookIdx
      travelT = TRAVEL_SPLIT + (local / ARRIVAL_END) * (1 - TRAVEL_SPLIT)
      fov = travelPose(travelFrom, travelTo, travelT)
    } else if (local >= departureStart && lookIdx < TOTAL_LOOKS - 1) {
      travelFrom = lookIdx
      travelTo = lookIdx + 1
      travelT = ((local - departureStart) / (1 - departureStart)) * TRAVEL_SPLIT
      fov = travelPose(travelFrom, travelTo, travelT)
    } else if (lookIdx === 0 && local < APPROACH_FRACTION) {
      const t = local / APPROACH_FRACTION
      const z =
        subjectZ + APPROACH_START_DIST - (APPROACH_START_DIST - ORBIT_RADIUS) * t
      camera.up.set(0, 1, 0)
      camera.position.set(cameraShake.x, CAMERA_HEIGHT + cameraShake.y, z)
      camera.lookAt(0, LOOK_AT_HEIGHT, subjectZ)
    } else {
      const orbitStart = lookIdx === 0 ? APPROACH_FRACTION : ARRIVAL_END
      const orbitT = clamp01((local - orbitStart) / (departureStart - orbitStart))
      const angle = orbitT * Math.PI * 2
      camera.up.set(0, 1, 0)
      camera.position.set(
        Math.sin(angle) * ORBIT_RADIUS + cameraShake.x,
        CAMERA_HEIGHT + cameraShake.y,
        subjectZ + Math.cos(angle) * ORBIT_RADIUS,
      )
      camera.lookAt(0, LOOK_AT_HEIGHT, subjectZ)
    }

    scrollState.travelT = travelT
    scrollState.travelFrom = travelFrom
    scrollState.travelTo = travelTo
    scrollState.travelBump =
      travelT < 0 ? 0 : smoothRange(0, 0.12, travelT) * (1 - smoothRange(0.88, 1, travelT))

    const orbitStart = lookIdx === 0 ? APPROACH_FRACTION : ARRIVAL_END
    scrollState.orbitWeight =
      travelT >= 0
        ? 0
        : smoothRange(orbitStart, orbitStart + 0.04, local) *
          (1 - smoothRange(departureStart - 0.05, departureStart, local))

    scrollState.baseFov = fov
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }

  const dispose = (): void => {
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseleave', onMouseLeave)
  }

  return {
    camera,
    scrollState,
    update,
    nudge,
    setTarget,
    jumpTo,
    lock,
    isLocked,
    applyParallax,
    dispose,
  }
}
