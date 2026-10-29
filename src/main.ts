import './style.css'
import { Color, DefaultLoadingManager, Vector3 } from 'three'
import type { FogExp2, Mesh, Object3D, Texture } from 'three'
import { Timer } from 'three/examples/jsm/misc/Timer.js'
import { gsap } from 'gsap'
import { detectQuality } from './quality'
import { feature } from './features'
import { IMMERSION } from './config'
import { createRigState, updateRig, type RigState } from './scene/rig'
import { COSMETIC_LAYER, REFLECTOR_LAYER, createRunway } from './scene/runway'
import { createEnvironment } from './scene/environment'
import { createCameraRig, LOOK_AT_HEIGHT, subjectZForLook } from './scene/camera'
import type { MaterialPin } from './data/looks'
import {
  buildMannequins,
  disposeMannequins,
  type MannequinEntry,
} from './scene/models'
import { createPostFX } from './scene/postfx'
import { createIntro } from './ui/intro'
import { createCursor } from './ui/cursor'
import { createLookUI } from './ui/lookInfo'
import { createCreditsUI } from './ui/credits'
import { createPoster } from './ui/poster'
import { createFinale } from './ui/finale'
import { createBackdrop } from './scene/backdrop'
import { createPinLayer } from './ui/pins'
import { createAudio } from './audio/audio'
import { LOOKS, SCROLL_PER_LOOK } from './data/looks'
import { createI18n, type StringKey } from './i18n'

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}
window.scrollTo(0, 0)

const container = document.getElementById('canvas-container')
if (!container) throw new Error('#canvas-container not found')

const i18n = createI18n()

const paintStaticI18n = (): void => {
  document
    .querySelectorAll<HTMLElement>('[data-i18n]')
    .forEach((el) => {
      const key = el.getAttribute('data-i18n') as StringKey | null
      if (key) el.textContent = i18n.t(key)
    })
}
paintStaticI18n()
i18n.onChange(() => paintStaticI18n())

const urlParams = new URLSearchParams(window.location.search)
// Téléphones et tablettes : mur mobile, sans exception (même détection que le script de index.html,
// qui a déjà posé la classe force-mobile pour l'iPad en mode « site de bureau »).
const isTabletLike =
  /iPad|iPhone|iPod|Android|Mobile/i.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
const isMobileBlocked =
  isTabletLike || window.matchMedia('(pointer: coarse), (max-width: 900px)').matches
if (isMobileBlocked) {
  throw new Error('mobile-blocked')
}

// ─── Mode capture (DEV, ?record=1) ───
// Horloge simulée : three (Timer) et GSAP sont avancés à la main, une image par appel de
// `__noir.record.tick(dt, cible)`. Permet de filmer le défilé image par image, sans aucune
// saccade, quel que soit le temps de rendu réel. Voir scripts/record-video.cjs.
const recordMode = import.meta.env.DEV && urlParams.get('record') === '1'

const intro = createIntro()

DefaultLoadingManager.onProgress = (_url, loaded, total) => {
  if (total > 0) intro.setProgress((loaded / total) * 100)
}
let openingPending = false
let openingStarted = false

DefaultLoadingManager.onLoad = () => {
  intro.setProgress(100)
  intro.dismiss()
  if (IMM.opening) openingPending = true
}

const quality = detectQuality()

const IMM = {
  gaze: feature('gaze', IMMERSION.gaze),
  dof: feature('dof', IMMERSION.dof),
  soundscape: feature('soundscape', IMMERSION.soundscape),
  music: feature('music', IMMERSION.music),
  opening: feature('opening', IMMERSION.opening),
  parallax: feature('parallax', IMMERSION.parallax),
  flashwall: feature('flashwall', IMMERSION.flashwall),
  speedfx: feature('speedfx', IMMERSION.speedfx),
  letterbox: feature('letterbox', IMMERSION.letterbox),
}

const runway = createRunway(container, quality)
runway.flashWall.setEnabled(IMM.flashwall)

const mannequinsPromise = buildMannequins(runway.scene, LOOKS, '/models')

const envHandle = await createEnvironment(runway.renderer, runway.scene, {
  hdrUrl: '/hdri/photo_studio_01_2k.exr',
  intensity: 0.35,
  useHdr: quality.useHdrEnvironment,
})

let scrollResistance = 1

const cameraRig = createCameraRig({
  reducedMotion: quality.reducedMotion,
  parallax: IMM.parallax,
  getResistance: () => scrollResistance,
  onInput: () => onUserScrollInput(),
})
if (IMM.opening) cameraRig.lock(0)
cameraRig.camera.layers.enable(COSMETIC_LAYER)
cameraRig.camera.layers.enable(REFLECTOR_LAYER)

const postfx = createPostFX(runway.renderer, runway.scene, cameraRig.camera, {
  bloom: quality.postFxBloom && feature('bloom'),
  chromatic: quality.postFxChromatic && feature('chromatic'),
  vignette: quality.postFxVignette && feature('vignette'),
  noise: quality.postFxNoise && feature('noise'),
  smaa: quality.postFxSmaa && feature('smaa'),
  anamorphic: quality.postFxBloom && feature('anamorphic', false),
  colorGrade: feature('grade'),
  dof: IMM.dof && quality.tier === 'high',
  radial: IMM.speedfx,
})
const cursor = createCursor()
const lookUI = createLookUI(i18n)
const creditsUI = createCreditsUI(i18n)
const poster = createPoster({
  renderOnce: () => postfx.render(0),
  readCanvas: () => runway.renderer.domElement,
  i18n,
})
const finale = createFinale(i18n, () => rewindToStart())
const pinLayer = createPinLayer(document.body, i18n)
const audio = createAudio()
audio.setSoundscape(IMM.soundscape)
audio.setMusic(IMM.music)
// La rythmique n'entre qu'au cue d'ouverture (lumières qui claquent) ; sans ouverture, direct.
audio.setMusicIntensity(IMM.opening ? 0 : 1)

const letterboxTop = document.createElement('div')
letterboxTop.className = 'letterbox letterbox--top'
const letterboxBottom = document.createElement('div')
letterboxBottom.className = 'letterbox letterbox--bottom'
document.body.append(letterboxTop, letterboxBottom)
let letterboxLast = -1

const showGain = { value: IMM.opening ? 0.05 : 1 }

const audioToggleEl = document.getElementById('audio-toggle') as HTMLButtonElement
const audioStateEl = document.getElementById('audio-toggle-state') as HTMLElement
const refreshAudioAria = (nowMuted: boolean): void => {
  audioToggleEl.setAttribute(
    'aria-label',
    i18n.t(nowMuted ? 'audio.ariaOff' : 'audio.ariaOn'),
  )
  audioStateEl.textContent = nowMuted ? i18n.t('audio.off') : i18n.t('audio.on')
  audioToggleEl.dataset.on = nowMuted ? 'false' : 'true'
}

refreshAudioAria(true)
audioToggleEl.addEventListener('click', () => {
  refreshAudioAria(audio.toggle())
})

const langToggleEl = document.getElementById('lang-toggle') as HTMLButtonElement
const langCurrentEl = document.getElementById('lang-toggle-current') as HTMLElement
const langOtherEl = document.getElementById('lang-toggle-other') as HTMLElement
const refreshLangToggle = (): void => {
  const cur = i18n.get()
  langCurrentEl.textContent = cur.toUpperCase()
  langOtherEl.textContent = cur === 'fr' ? 'EN' : 'FR'
  langToggleEl.setAttribute('aria-label', i18n.t('lang.ariaSwitch'))
}
refreshLangToggle()
langToggleEl.addEventListener('click', () => {
  i18n.toggle()
})

i18n.onChange(() => {
  refreshLangToggle()
  refreshAudioAria(audioToggleEl.dataset.on !== 'true')
  lookUI.repaint()
  pinLayer.repaint()
  finale.repaint()
})

const textureWarmupQueue: Texture[] = []
const warmedTextures = new Set<Texture>()

function queueTextures(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (!mat) continue
      for (const value of Object.values(mat as unknown as Record<string, unknown>)) {
        const tex = value as Texture | null
        if (tex && (tex as Texture).isTexture && !warmedTextures.has(tex)) {
          warmedTextures.add(tex)
          textureWarmupQueue.push(tex)
        }
      }
    }
  })
}

function refreshGroupMatrix(group: Object3D): void {
  group.updateMatrix()
  if (group.parent) {
    group.matrixWorld.multiplyMatrices(group.parent.matrixWorld, group.matrix)
  } else {
    group.matrixWorld.copy(group.matrix)
  }
}

let mannequins: MannequinEntry[] = []
let mannequinsReadyAt = 0
let forceShadowFrames = 3

void mannequinsPromise.then((entries) => {
  mannequins = entries

  entries.forEach((m, i) => {
    m.group.position.set(0, 0, subjectZForLook(i))
    m.group.visible = i === 0
  })

  void runway.renderer
    .compileAsync(runway.scene, cameraRig.camera)
    .catch(() => runway.renderer.compile(runway.scene, cameraRig.camera))

  for (let i = 1; i < entries.length; i++) queueTextures(entries[i].group)

  const firstPins = LOOKS[0].pins
  if (firstPins && entries[0]) pinLayer.setPins(firstPins, entries[0].group)

  lookUI.showFirstLook(LOOKS[0])
  creditsUI.showFirstLook(LOOKS[0])
  mannequinsReadyAt = performance.now()
  forceShadowFrames = 3
})

const timer = new Timer()

let prevLook = -1
let displayedLookIdx = 0

let lastUserInputAt = performance.now()
let snapTarget: number | null = null
let snapStartedAt = 0
let dwellProgress: number | null = null
let dwellUntil = 0
const SNAP_IDLE_MS = 800
const SNAP_RADIUS = 0.1
const SNAP_ARRIVE_EPS = 0.0015
const SNAP_MAX_MS = 2600
const DWELL_DURATION_MS = 2000

let scrollVelocityEMA = 0
let dimAmount = 0
let travelSpeedAmount = 0
let wasTraveling = false
const rigStates = new WeakMap<MannequinEntry, RigState>()
const spatialRight = new Vector3()
const spatialToSubject = new Vector3()
const VELOCITY_DIM_THRESHOLD = 0.048
const VELOCITY_DIM_SOFT = 0.15
const INPUT_DIM_THRESHOLD = 0.12
const INPUT_DIM_SOFT = 0.55

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

function onUserScrollInput(): void {
  lastUserInputAt = performance.now()
  snapTarget = null
  if (dwellProgress !== null) {
    dwellProgress = null
    cameraRig.lock(null)
  }
}

function tryAutoSnap(): void {
  if (snapTarget !== null || dwellProgress !== null) return
  const state = cameraRig.scrollState
  if (state.finaleProgress > 0 || state.travelT >= 0) return
  if (performance.now() - lastUserInputAt < SNAP_IDLE_MS) return

  const lookIdx = state.currentLook
  const pins = LOOKS[lookIdx]?.pins
  if (!pins || pins.length === 0) return

  let nextAt: number | null = null
  let nextDist = Infinity
  for (const p of pins) {
    const d = p.atProgress - state.localProgress
    if (d > 0.012 && d < nextDist) {
      nextDist = d
      nextAt = p.atProgress
    }
  }

  if (nextAt === null) return
  if (nextDist > SNAP_RADIUS) return

  snapTarget = (lookIdx + nextAt) * SCROLL_PER_LOOK
  snapStartedAt = performance.now()
}

function updateScrollCadence(): void {
  // En capture, la cible caméra est dictée image par image : pas de snap ni de pose automatique.
  if (recordMode) return
  const now = performance.now()
  const state = cameraRig.scrollState
  if (snapTarget !== null) {
    cameraRig.setTarget(snapTarget)
    const arrived = Math.abs(state.progress - snapTarget) < SNAP_ARRIVE_EPS
    if (arrived || now - snapStartedAt > SNAP_MAX_MS) {
      dwellProgress = state.progress
      dwellUntil = now + DWELL_DURATION_MS
      snapTarget = null
      cameraRig.lock(dwellProgress)
    }
  } else if (dwellProgress !== null && now >= dwellUntil) {
    dwellProgress = null
    cameraRig.lock(null)
    lastUserInputAt = now
  }
}

const bloomFlash = { value: 0 }
const BLOOM_FLASH_PEAK = 1.35
const BLOOM_BASE_INTENSITY = 0.45

function flashBloomReact(): void {
  gsap.killTweensOf(bloomFlash)
  gsap
    .timeline()
    .to(bloomFlash, { value: BLOOM_FLASH_PEAK, duration: 0.12, ease: 'power2.out' })
    .to(bloomFlash, { value: 0, duration: 0.35, ease: 'power2.out' })
}

function updateScrollDimming(dt: number): void {
  const state = cameraRig.scrollState
  const kv = 1 - Math.exp(-dt / 0.15)
  scrollVelocityEMA += (state.velocity - scrollVelocityEMA) * kv
  const normCam = clamp01(
    (scrollVelocityEMA - VELOCITY_DIM_THRESHOLD) /
      (VELOCITY_DIM_SOFT - VELOCITY_DIM_THRESHOLD),
  )
  const normInput = clamp01(
    (state.inputRate - INPUT_DIM_THRESHOLD) / (INPUT_DIM_SOFT - INPUT_DIM_THRESHOLD),
  )
  const norm = Math.max(normCam, normInput)
  dimAmount += (norm - dimAmount) * (1 - Math.exp(-dt / 0.25))

  runway.renderer.toneMappingExposure = 1.15 - dimAmount * 0.4
  postfx.effects.bloom.intensity =
    BLOOM_BASE_INTENSITY * (1 - dimAmount * 0.5) + bloomFlash.value
  const speedFx = IMM.speedfx ? travelSpeedAmount : 0
  postfx.effects.vignette.darkness = 0.55 + dimAmount * 0.25 + speedFx * 0.12
  const chroma = 0.0007 + speedFx * 0.003
  postfx.effects.chromatic.offset.set(chroma, chroma)
  scrollResistance = 1 - norm * 0.4
}
let audienceFlashTimer = 0

const FINALE_LINEUP_X = [-3.3, -1.1, 1.1, 3.3]
const FINALE_LINEUP_Z = -30

const FINALE_SLIDE_END = 0.1
const FINALE_PAN_START = 0.05
const FINALE_PAN_END = 0.55
const FINALE_ARC_END = 0.92
const FINALE_CARD_TRIGGER = 0.95

const FINALE_CAM_Y = 1.7
const FINALE_CAM_Z = -24
const FINALE_LOOK_Y = 1.1
const FINALE_PAN_RANGE_X = 4.5
const FINALE_FOV = 38

const FINALE_ARC_CAM_Y = 2.8
const FINALE_ARC_CAM_Z = -48
const FINALE_ARC_LOOK_Y = 3.4
const FINALE_ARC_LOOK_Z = -72

const finaleCamPos = new Vector3()
const finaleCamLook = new Vector3()
const finaleOrbitLook = new Vector3()
const finaleBlendLook = new Vector3()
let finaleCardShown = false
let finaleSlideApplied = false
const backdrop = createBackdrop(runway.scene)

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

function resetFinaleState(): void {
  for (let i = 0; i < mannequins.length; i++) {
    mannequins[i].group.position.set(0, 0, subjectZForLook(i))
  }
  backdrop.setVisible(false)
  backdrop.setOpacity(0)
  finaleCardShown = false
}

interface LookPalette {
  color: Color
  accent: Color
  spot: Color
  exposure: number
}
const palettes: LookPalette[] = LOOKS.map((look) => ({
  color: new Color(look.lighting.color),
  accent: new Color(look.lighting.accent),
  spot: new Color(look.lighting.spotColor),
  exposure: look.lighting.exposure ?? 1,
}))

const KEY_INTENSITY = 100
const TOP_INTENSITY = 60
const FILL_INTENSITY = 18
const RIM_INTENSITY = 90
const BACK_INTENSITY = 70

function applyLookLighting(fromIdx: number, toIdx: number, blend: number): void {
  const a = palettes[fromIdx]
  const b = palettes[toIdx]
  const { rimLeft, rimRight, mainSpot, keySpot, backLight, fillLight } = runway.lights
  rimLeft.color.lerpColors(a.accent, b.accent, blend)
  rimRight.color.copy(rimLeft.color)
  backLight.color.copy(rimLeft.color)
  keySpot.color.lerpColors(a.spot, b.spot, blend)
  mainSpot.color.copy(keySpot.color)
  const gain = (a.exposure + (b.exposure - a.exposure) * blend) * showGain.value
  keySpot.intensity = KEY_INTENSITY * gain
  mainSpot.intensity = TOP_INTENSITY * gain
  fillLight.intensity = FILL_INTENSITY * gain
  rimLeft.intensity = RIM_INTENSITY * showGain.value
  rimRight.intensity = RIM_INTENSITY * showGain.value
  backLight.intensity = BACK_INTENSITY * showGain.value
  const fog = runway.scene.fog as FogExp2 | null
  if (fog) fog.color.lerpColors(a.color, b.color, blend)
  if (runway.scene.background instanceof Color) {
    runway.scene.background.lerpColors(a.color, b.color, blend)
  }
}

let uiHidden = false
let pendingCartelIdx: number | null = null
let cartelTimer: gsap.core.Tween | null = null
let inFinaleClass = false

function onLookBoundary(toIdx: number): void {
  const look = LOOKS[toIdx]
  lookUI.swapContent(toIdx, look)
  const pins = look.pins
  const mannequin = mannequins[toIdx]
  if (pins && mannequin) pinLayer.setPins(pins, mannequin.group)
  else pinLayer.clear()
  pendingCartelIdx = toIdx

  audio.playFlash()
  flashBloomReact()
  const flashLight = runway.lights.flashLight
  gsap.killTweensOf(flashLight)
  flashLight.intensity = 3
  gsap.to(flashLight, { intensity: 0, duration: 0.25, ease: 'sine.out' })
}

function setLookUiHidden(hidden: boolean): void {
  if (hidden === uiHidden) return
  uiHidden = hidden
  if (hidden) {
    lookUI.fadeOut()
    pinLayer.setVisible(false)
    creditsUI.hideCartel()
    if (cartelTimer) {
      cartelTimer.kill()
      cartelTimer = null
    }
    return
  }
  lookUI.fadeIn()
  pinLayer.setVisible(true)
  if (pendingCartelIdx !== null) {
    creditsUI.showCartel(LOOKS[pendingCartelIdx])
    pendingCartelIdx = null
    if (cartelTimer) cartelTimer.kill()
    cartelTimer = gsap.delayedCall(2.4, () => {
      creditsUI.hideCartel()
      cartelTimer = null
    })
  }
}

const rimToCam = new Vector3()
const rimAway = new Vector3()
const rimRight = new Vector3()
const rimUp = new Vector3(0, 1, 0)
const RIM_DISTANCE_BACK = 6
const RIM_SIDE_OFFSET = 3
const RIM_HEIGHT = 4.2
const keySubject = new Vector3()
const rimSubject = new Vector3()

const followToCam = new Vector3()
const followDir = new Vector3()
const KEY_AZIMUTH = -0.61
const KEY_DISTANCE = 5.5
const KEY_HEIGHT = 5.5
const FILL_AZIMUTH = 0.7
const FILL_DISTANCE = 6
const FILL_HEIGHT = 3
const BACK_DISTANCE = 6
const BACK_HEIGHT = 5.5
const TOP_HEIGHT = 11

function rotateY(v: Vector3, angle: number): Vector3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const x = v.x * c + v.z * s
  const z = -v.x * s + v.z * c
  v.x = x
  v.z = z
  return v
}

function placeFollowLights(key: Vector3, rim: Vector3): void {
  const { keySpot, mainSpot, fillLight, backLight } = runway.lights
  followToCam.subVectors(cameraRig.camera.position, key)
  followToCam.y = 0
  if (followToCam.lengthSq() < 1e-6) followToCam.set(0, 0, 1)
  followToCam.normalize()

  rotateY(followDir.copy(followToCam), KEY_AZIMUTH)
  keySpot.position.copy(key).addScaledVector(followDir, KEY_DISTANCE)
  keySpot.position.y += KEY_HEIGHT
  keySpot.target.position.set(key.x, 1.0, key.z)

  mainSpot.position.set(key.x, TOP_HEIGHT, key.z)
  mainSpot.target.position.set(key.x, 0, key.z)
  mainSpot.angle = Math.PI / 12

  followToCam.subVectors(cameraRig.camera.position, rim)
  followToCam.y = 0
  if (followToCam.lengthSq() < 1e-6) followToCam.set(0, 0, 1)
  followToCam.normalize()

  rotateY(followDir.copy(followToCam), FILL_AZIMUTH)
  fillLight.position.copy(rim).addScaledVector(followDir, FILL_DISTANCE)
  fillLight.position.y += FILL_HEIGHT
  fillLight.target.position.set(rim.x, 1.2, rim.z)

  backLight.position.copy(rim).addScaledVector(followToCam, -BACK_DISTANCE)
  backLight.position.y += BACK_HEIGHT
  backLight.target.position.set(rim.x, 1.5, rim.z)

  updateRimLights(rim)
}

const zoomAnchor = new Vector3()
const zoomAnchorAccum = new Vector3()
const zoomAnchorLifted = new Vector3()
const zoomOrbitDir = new Vector3()
const zoomCamPos = new Vector3()
const zoomLookAt = new Vector3()
const ZOOM_DIST = 1.2
const ZOOM_FOV_NARROW = 32
const ZOOM_PLATEAU = 0.06
const ZOOM_RAMP = 0.1
const ZOOM_CAM_MIN_Y = 0.75
const ZOOM_LOOK_MIN_Y = 0.25
let zoomAmountFrame = 0
let zoomFocusDistance = 1.2

function zoomFade(localProgress: number, atProgress: number): number {
  const d = Math.abs(localProgress - atProgress)
  if (d <= ZOOM_PLATEAU) return 1
  if (d >= ZOOM_PLATEAU + ZOOM_RAMP) return 0
  const t = 1 - (d - ZOOM_PLATEAU) / ZOOM_RAMP
  return t * t * (3 - 2 * t)
}

function applyPinZoom(
  localProgress: number,
  mannequin: MannequinEntry,
  pins: MaterialPin[] | undefined,
  weight: number,
): void {
  const cam = cameraRig.camera
  const baseFov = cameraRig.scrollState.baseFov
  if (!pins || pins.length === 0 || weight <= 0) return

  refreshGroupMatrix(mannequin.group)
  let weightSum = 0
  zoomAnchorAccum.set(0, 0, 0)
  for (const pin of pins) {
    const f = zoomFade(localProgress, pin.atProgress)
    if (f <= 0) continue
    zoomAnchor.set(pin.anchor[0], pin.anchor[1], pin.anchor[2])
    zoomAnchor.applyMatrix4(mannequin.group.matrixWorld)
    zoomAnchorAccum.addScaledVector(zoomAnchor, f)
    weightSum += f
  }
  if (weightSum <= 0) return
  const zoom = Math.min(1, weightSum) * weight
  if (zoom <= 0.0005) return
  zoomAnchor.copy(zoomAnchorAccum).multiplyScalar(1 / weightSum)
  zoomAmountFrame = zoom

  zoomOrbitDir
    .subVectors(cam.position, mannequin.group.position)
    .normalize()
  zoomCamPos.copy(zoomAnchor).addScaledVector(zoomOrbitDir, ZOOM_DIST)

  zoomCamPos.y = Math.max(zoomCamPos.y, ZOOM_CAM_MIN_Y)
  cam.position.lerp(zoomCamPos, zoom)

  zoomAnchorLifted.copy(zoomAnchor).setY(Math.max(zoomAnchor.y, ZOOM_LOOK_MIN_Y))
  zoomLookAt.set(0, LOOK_AT_HEIGHT, mannequin.group.position.z)
  zoomLookAt.lerp(zoomAnchorLifted, zoom)
  cam.lookAt(zoomLookAt)

  cam.fov = baseFov + (ZOOM_FOV_NARROW - baseFov) * zoom
  cam.updateProjectionMatrix()
  zoomFocusDistance = cam.position.distanceTo(zoomAnchorLifted)
}

function updateRimLights(subject: Vector3): void {
  rimToCam.subVectors(cameraRig.camera.position, subject).normalize()
  rimAway.copy(rimToCam).negate()
  rimRight.crossVectors(rimAway, rimUp).normalize()

  const rL = runway.lights.rimLeft
  rL.position.copy(subject)
  rL.position.addScaledVector(rimAway, RIM_DISTANCE_BACK)
  rL.position.addScaledVector(rimRight, -RIM_SIDE_OFFSET)
  rL.position.y += RIM_HEIGHT
  rL.target.position.set(subject.x, 1.5, subject.z)

  const rR = runway.lights.rimRight
  rR.position.copy(subject)
  rR.position.addScaledVector(rimAway, RIM_DISTANCE_BACK)
  rR.position.addScaledVector(rimRight, RIM_SIDE_OFFSET)
  rR.position.y += RIM_HEIGHT
  rR.target.position.set(subject.x, 1.5, subject.z)
}

const adaptive = {
  enabled: feature('adaptive'),
  dpr: quality.pixelRatio,
  ceiling: quality.pixelRatioMax,
  ceilingResetAt: 0,
  emaMs: 16.7,
  lastChangeAt: 0,
  settleUntil: 0,
  lastSpikeAt: 0,
  // Palier de dégradation atteint (0 = rien), voir RunwayContext.degrade.
  stage: 0,
  floorSince: 0,
}
const DEGRADE_MAX_STAGE = 3
const DPR_STEP = 0.25

function applyPixelRatio(dpr: number): void {
  adaptive.dpr = dpr
  runway.renderer.setPixelRatio(dpr)
  postfx.setSize(window.innerWidth, window.innerHeight)
}

// ?stats=1 : HUD de test lisible sans devtools (téléphone, tablette, autre machine).
let hudFrames = 0
if (urlParams.get('stats') === '1') {
  const hud = document.createElement('div')
  hud.className = 'stats-hud'
  document.body.appendChild(hud)
  const gl = runway.renderer.getContext()
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const gpu = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    .replace(/ANGLE \((.*)\)/, '$1')
    .slice(0, 48)
  let lastTick = performance.now()
  window.setInterval(() => {
    const now = performance.now()
    const fps = Math.round((hudFrames * 1000) / Math.max(1, now - lastTick))
    hudFrames = 0
    lastTick = now
    hud.textContent = [
      `${fps} fps · ${adaptive.emaMs.toFixed(1)} ms`,
      `dpr ${adaptive.dpr.toFixed(2)} · tier ${quality.tier} · palier ${adaptive.stage}`,
      `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}`,
      gpu,
    ].join('\n')
  }, 500)
}

let warmupDoneAt = 0

function updateAdaptiveResolution(delta: number): void {
  if (!adaptive.enabled || mannequinsReadyAt === 0) return
  const now = performance.now()
  if (textureWarmupQueue.length > 0) {
    warmupDoneAt = 0
    return
  }
  if (warmupDoneAt === 0) {
    warmupDoneAt = now
    adaptive.emaMs = 16.7
    return
  }
  if (now - warmupDoneAt < 1500 || now - mannequinsReadyAt < 2500) return
  const ms = delta * 1000
  if (ms > 250) return
  if (ms > 34) adaptive.lastSpikeAt = now
  adaptive.emaMs += (ms - adaptive.emaMs) * 0.08
  if (now < adaptive.settleUntil) return

  if (adaptive.ceilingResetAt > 0 && now > adaptive.ceilingResetAt) {
    adaptive.ceiling = quality.pixelRatioMax
    adaptive.ceilingResetAt = 0
  }

  if (adaptive.emaMs > 21 && adaptive.dpr > quality.pixelRatioMin) {
    const next = Math.max(quality.pixelRatioMin, adaptive.dpr - DPR_STEP)
    adaptive.ceiling = next
    adaptive.ceilingResetAt = now + 30000
    adaptive.lastChangeAt = now
    adaptive.settleUntil = now + 1500
    adaptive.emaMs = 16.7
    applyPixelRatio(next)
    return
  }

  // Au plancher de résolution et toujours au-dessus de 24 ms pendant 2,5 s : on retire une
  // couche coûteuse (miroirs, puis shadow map + DoF, puis public) plutôt que de laisser
  // une machine modeste à 30 fps. Jamais remonté dans la session, pour ne pas osciller.
  const atFloor = adaptive.dpr <= quality.pixelRatioMin + 1e-6
  if (atFloor && adaptive.emaMs > 24 && adaptive.stage < DEGRADE_MAX_STAGE) {
    if (adaptive.floorSince === 0) adaptive.floorSince = now
    if (now - adaptive.floorSince > 2500) {
      adaptive.stage++
      adaptive.floorSince = 0
      adaptive.settleUntil = now + 2500
      adaptive.emaMs = 16.7
      runway.degrade(adaptive.stage)
      if (adaptive.stage >= 2) IMM.dof = false
      if (import.meta.env.DEV) console.info(`[noir] palier qualité ${adaptive.stage}`)
      return
    }
  } else {
    adaptive.floorSince = 0
  }

  if (
    adaptive.emaMs < 17.2 &&
    adaptive.dpr < adaptive.ceiling &&
    now - adaptive.lastChangeAt > 4000 &&
    now - adaptive.lastSpikeAt > 4000
  ) {
    const next = Math.min(adaptive.ceiling, adaptive.dpr + DPR_STEP)
    adaptive.lastChangeAt = now
    adaptive.settleUntil = now + 2500
    applyPixelRatio(next)
  }
}

let curtainEl: HTMLDivElement | null = null

function rewindToStart(): void {
  if (curtainEl) return
  const curtain = document.createElement('div')
  curtain.className = 'curtain'
  document.body.appendChild(curtain)
  curtainEl = curtain

  gsap
    .timeline({
      onComplete: () => {
        curtain.remove()
        curtainEl = null
      },
    })
    .to(curtain, { opacity: 1, duration: 0.55, ease: 'power2.inOut' })
    .call(() => {
      finale.hide()
      resetFinaleState()
      snapTarget = null
      dwellProgress = null
      cameraRig.lock(null)
      cameraRig.jumpTo(0)
      displayedLookIdx = 0
      prevLook = 0
      pendingCartelIdx = null
      applyLookLighting(0, 0, 0)
      lookUI.swapContent(0, LOOKS[0])
      const first = mannequins[0]
      const pins = LOOKS[0].pins
      if (pins && first) pinLayer.setPins(pins, first.group)
      uiHidden = true
      setLookUiHidden(false)
      forceShadowFrames = 3
      lastUserInputAt = performance.now()
    })
    .to(curtain, { opacity: 0, duration: 0.9, ease: 'power2.inOut' }, '+=0.15')
}

const onGlobalResize = () => {
  applyPixelRatio(adaptive.dpr)
}
window.addEventListener('resize', onGlobalResize)

window.addEventListener('keydown', (e) => {
  if (e.key !== 'p' && e.key !== 'P') return
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  const idx = cameraRig.scrollState.currentLook
  poster.capture({ look: LOOKS[idx], index: idx, total: LOOKS.length })
})

let lastShadowProgress = -1

function startOpening(): void {
  openingStarted = true
  cameraRig.lock(0)
  snapTarget = null
  dwellProgress = null
  gsap
    .timeline()
    .call(
      () => {
        gsap.to(showGain, { value: 1, duration: 0.5, ease: 'expo.out' })
        flashBloomReact()
        audio.playCue()
        audio.setMusicIntensity(1)
        const fl = runway.lights.flashLight
        gsap.killTweensOf(fl)
        fl.intensity = 3
        gsap.to(fl, { intensity: 0, duration: 0.3, ease: 'sine.out' })
        forceShadowFrames = 3
      },
      [],
      1.1,
    )
    .call(
      () => {
        cameraRig.lock(null)
        lastUserInputAt = performance.now()
      },
      [],
      1.7,
    )
}

function frame(timestamp?: number): void {
  timer.update(timestamp)
  const delta = timer.getDelta()
  const time = timer.getElapsed()
  hudFrames++

  cameraRig.update(time, delta)
  const state = cameraRig.scrollState

  if (openingPending && !openingStarted && mannequinsReadyAt > 0) startOpening()
  runway.scene.environmentIntensity = 0.35 * (0.2 + 0.8 * showGain.value)

  const travelSpeedTarget =
    state.travelBump * Math.min(1.4, state.velocity / 0.065)
  travelSpeedAmount += (travelSpeedTarget - travelSpeedAmount) * (1 - Math.exp(-delta / 0.12))

  if (!quality.reducedMotion) {
    runway.updateAudience(time)
    runway.updateParticles(delta, time)
    runway.updateStars(delta, time)
  }
  runway.updatePitFlashes(delta)

  const finaleEngaged = state.finaleProgress > 0
  const traveling = state.travelT >= 0 && !finaleEngaged

  if (finaleEngaged) {
    const fp = state.finaleProgress

    const slideT = smoothstep(0, FINALE_SLIDE_END, fp)
    for (let i = 0; i < mannequins.length; i++) {
      const baseZ = subjectZForLook(i)
      mannequins[i].group.position.x = FINALE_LINEUP_X[i] * slideT
      mannequins[i].group.position.z = baseZ + (FINALE_LINEUP_Z - baseZ) * slideT
    }
    finaleSlideApplied = true

    const panT = smoothstep(FINALE_PAN_START, FINALE_PAN_END, fp)
    const arcT = smoothstep(FINALE_PAN_END, FINALE_ARC_END, fp)
    const panX = -FINALE_PAN_RANGE_X + panT * (2 * FINALE_PAN_RANGE_X)

    const camX = panX * (1 - arcT)
    const camY = FINALE_CAM_Y + (FINALE_ARC_CAM_Y - FINALE_CAM_Y) * arcT
    const camZ = FINALE_CAM_Z + (FINALE_ARC_CAM_Z - FINALE_CAM_Z) * arcT
    const lookX = panX * (1 - arcT)
    const lookY = FINALE_LOOK_Y + (FINALE_ARC_LOOK_Y - FINALE_LOOK_Y) * arcT
    const lookZ = FINALE_LINEUP_Z + (FINALE_ARC_LOOK_Z - FINALE_LINEUP_Z) * arcT
    finaleCamPos.set(camX, camY, camZ)
    finaleCamLook.set(lookX, lookY, lookZ)

    const backdropA = smoothstep(FINALE_PAN_END, FINALE_ARC_END, fp) * 0.95
    backdrop.setVisible(backdropA > 0.001)
    backdrop.setOpacity(backdropA)

    if (fp >= FINALE_CARD_TRIGGER && !finaleCardShown) {
      finaleCardShown = true
      finale.show(LOOKS)
      audio.playFinale()
      audio.setMusicIntensity(0.45)
      pinLayer.clear()
      lookUI.fadeOut()
    }
  } else if (finaleCardShown) {
    finale.hide()
    audio.setMusicIntensity(1)
    resetFinaleState()
    finaleSlideApplied = false
  } else if (finaleSlideApplied) {
    resetFinaleState()
    finaleSlideApplied = false
  }

  displayedLookIdx = state.currentLook

  for (let i = 0; i < mannequins.length; i++) {
    mannequins[i].group.visible =
      finaleEngaged ||
      i === displayedLookIdx ||
      (traveling && (i === state.travelFrom || i === state.travelTo))
  }
  const currentMannequin = mannequins[displayedLookIdx]

  if (finaleEngaged) {
    const washBlend = smoothstep(0, FINALE_SLIDE_END, state.finaleProgress)
    runway.lights.finaleWash.intensity = 18 * washBlend

    runway.lights.mainSpot.position.set(0, 13, FINALE_LINEUP_Z)
    runway.lights.mainSpot.target.position.set(0, 0, FINALE_LINEUP_Z)
    runway.lights.mainSpot.angle = Math.PI / 9

    const { keySpot, fillLight, backLight } = runway.lights
    keySpot.position.set(-2.5, 8, FINALE_LINEUP_Z + 8)
    keySpot.target.position.set(0, 0.8, FINALE_LINEUP_Z)
    fillLight.position.set(3, 4, FINALE_LINEUP_Z + 7)
    fillLight.target.position.set(0, 1, FINALE_LINEUP_Z)
    backLight.position.set(0, 6, FINALE_LINEUP_Z - 7)
    backLight.target.position.set(0, 1.4, FINALE_LINEUP_Z)

    const rL = runway.lights.rimLeft
    rL.position.set(-8, 5.5, -22)
    rL.target.position.set(-3, 1.4, FINALE_LINEUP_Z)
    const rR = runway.lights.rimRight
    rR.position.set(8, 5.5, -22)
    rR.target.position.set(3, 1.4, FINALE_LINEUP_Z)

    runway.lights.ambient.intensity = 0.75 * (0.35 + 0.65 * showGain.value)
    applyLookLighting(displayedLookIdx, displayedLookIdx, 0)
  } else if (currentMannequin) {
    runway.lights.finaleWash.intensity = 0
    const fromIdx = traveling ? state.travelFrom : displayedLookIdx
    const toIdx = traveling ? state.travelTo : displayedLookIdx
    const keyBlend = traveling ? smoothstep(0.5, 0.9, state.travelT) : 0
    const rimBlend = traveling ? smoothstep(0.25, 0.6, state.travelT) : 0
    applyLookLighting(fromIdx, toIdx, keyBlend)

    const mFrom = mannequins[fromIdx] ?? currentMannequin
    const mTo = mannequins[toIdx] ?? currentMannequin
    keySubject.copy(mFrom.group.position).lerp(mTo.group.position, keyBlend)
    rimSubject.copy(mFrom.group.position).lerp(mTo.group.position, rimBlend)
    runway.lights.ambient.intensity = 0.55 * (0.35 + 0.65 * showGain.value)

    placeFollowLights(keySubject, rimSubject)
  }

  runway.updateSpotCone(time)

  if (currentMannequin && currentMannequin.mixer && currentMannequin.walkAction) {
    currentMannequin.walkAction.time =
      currentMannequin.walkLoopStart +
      state.localProgress * currentMannequin.walkLoopDuration
    currentMannequin.mixer.update(0)
  }

  if (finaleEngaged) {
    creditsUI.hideMarquee()
    creditsUI.hideCartel()
    if (!inFinaleClass) {
      inFinaleClass = true
      document.body.classList.add('in-finale')
    }
    pinLayer.setVisible(false)
  } else {
    if (inFinaleClass) {
      inFinaleClass = false
      document.body.classList.remove('in-finale')
      pinLayer.setVisible(!uiHidden)
    }
    if (traveling) creditsUI.hideMarquee()
    else creditsUI.updateMarquee(LOOKS[state.currentLook], state.localProgress)
  }

  if (state.currentLook !== prevLook) {
    if (prevLook < 0) {
      applyLookLighting(state.currentLook, state.currentLook, 0)
    } else {
      onLookBoundary(state.currentLook)
    }
    prevLook = state.currentLook
  }

  if (!finaleEngaged) {
    setLookUiHidden(traveling && state.travelT < 0.92)
  }

  zoomAmountFrame = 0
  if (currentMannequin && feature('zoom') && !traveling) {
    applyPinZoom(
      state.localProgress,
      currentMannequin,
      LOOKS[displayedLookIdx].pins,
      state.orbitWeight,
    )
  }
  postfx.setDof(IMM.dof ? zoomAmountFrame : 0, zoomFocusDistance)
  postfx.setSpeed(IMM.speedfx ? travelSpeedAmount * 0.45 : 0)

  const letterboxAmount = IMM.letterbox ? Math.round(state.travelBump * 200) / 200 : 0
  if (letterboxAmount !== letterboxLast) {
    letterboxLast = letterboxAmount
    letterboxTop.style.transform = `scaleY(${letterboxAmount})`
    letterboxBottom.style.transform = `scaleY(${letterboxAmount})`
  }

  audienceFlashTimer += delta
  if (audienceFlashTimer > 1 + Math.random() * 2 && state.progress > 0.05) {
    audienceFlashTimer = 0
    const flashSide = Math.random() > 0.5 ? 1 : -1
    const subjectZ = currentMannequin ? currentMannequin.group.position.z : 0
    runway.lights.flashLight.position.set(
      flashSide * (2.6 + Math.random() * 0.8),
      1.1 + Math.random() * 0.6,
      subjectZ + (Math.random() - 0.5) * 4,
    )
    runway.lights.flashLight.intensity = 3
    window.setTimeout(() => {
      runway.lights.flashLight.intensity = 0
    }, 100)
    const fp = runway.lights.flashLight.position
    runway.flashWall.flash(fp.x, fp.z)
    cameraRig.camera.getWorldDirection(spatialToSubject)
    spatialRight.set(-spatialToSubject.z, 0, spatialToSubject.x).normalize()
    spatialToSubject.copy(fp).sub(cameraRig.camera.position)
    const flashDist = spatialToSubject.length()
    const flashPan = flashDist > 1e-3 ? spatialRight.dot(spatialToSubject) / flashDist : 0
    audio.playClick(Math.max(-1, Math.min(1, flashPan)), flashDist)
  }

  lookUI.setProgress(state.progress)
  if (state.progress > 0.02) lookUI.hideScrollHint()

  audio.update(state.walkPhase)

  updateScrollCadence()
  updateScrollDimming(delta)
  tryAutoSnap()

  if (finaleEngaged) {
    const blend = smoothstep(0, FINALE_SLIDE_END, state.finaleProgress)

    finaleOrbitLook.set(0, LOOK_AT_HEIGHT, subjectZForLook(state.currentLook))
    finaleBlendLook.copy(finaleOrbitLook).lerp(finaleCamLook, blend)
    cameraRig.camera.position.lerp(finaleCamPos, blend)
    cameraRig.camera.lookAt(finaleBlendLook)

    const targetFov = state.baseFov + (FINALE_FOV - state.baseFov) * blend
    if (Math.abs(cameraRig.camera.fov - targetFov) > 0.05) {
      cameraRig.camera.fov = targetFov
      cameraRig.camera.updateProjectionMatrix()
    }
  }

  cameraRig.applyParallax()

  let rigMoving = false
  if (IMM.gaze) {
    for (let i = 0; i < mannequins.length; i++) {
      const m = mannequins[i]
      if (!m.group.visible || !m.rig) continue
      let rs = rigStates.get(m)
      if (!rs) {
        rs = createRigState()
        rigStates.set(m, rs)
      }
      if (updateRig(m, rs, cameraRig.camera, time, delta, 1)) rigMoving = true
    }
  }

  pinLayer.update(cameraRig.camera, state.localProgress)

  if (currentMannequin) {
    cameraRig.camera.getWorldDirection(spatialToSubject)
    spatialRight.set(-spatialToSubject.z, 0, spatialToSubject.x).normalize()
    spatialToSubject.copy(currentMannequin.group.position)
    spatialToSubject.y = 1.2
    spatialToSubject.sub(cameraRig.camera.position)
    const dist = spatialToSubject.length()
    const pan = dist > 1e-3 ? Math.max(-1, Math.min(1, spatialRight.dot(spatialToSubject) / dist)) : 0
    audio.setSpatial(pan, dist)
  }
  audio.setDim(Math.min(1, dimAmount + state.travelBump * 0.35))
  if (traveling && !wasTraveling) audio.playWhoosh(1)
  wasTraveling = traveling

  runway.flashWall.update(
    delta,
    finaleEngaged
      ? smoothstep(0.05, 0.2, state.finaleProgress) *
          (1 - smoothstep(0.9, 0.97, state.finaleProgress))
      : 0,
    FINALE_LINEUP_Z,
    cameraRig.camera,
  )

  if (
    textureWarmupQueue.length > 0 &&
    !traveling &&
    mannequinsReadyAt > 0 &&
    performance.now() - mannequinsReadyAt > 400
  ) {
    const tex = textureWarmupQueue.shift()
    if (tex) runway.renderer.initTexture(tex)
  }

  const shadowDirty =
    forceShadowFrames > 0 || finaleEngaged || rigMoving || state.progress !== lastShadowProgress
  runway.renderer.shadowMap.needsUpdate = shadowDirty
  if (shadowDirty) {
    lastShadowProgress = state.progress
    if (forceShadowFrames > 0) forceShadowFrames--
  }

  updateAdaptiveResolution(delta)

  postfx.render(delta)
}

let recordClock = 0
let recordGsapBase = 0
const recordTick = (dt: number, target: number | null): void => {
  if (recordClock === 0) {
    recordClock = performance.now()
    recordGsapBase = gsap.ticker.time - recordClock / 1000
  }
  recordClock += dt * 1000
  gsap.updateRoot(recordGsapBase + recordClock / 1000)
  if (target !== null) cameraRig.setTarget(target)
  frame(recordClock)
}

if (recordMode) {
  document.documentElement.classList.add('record')
  gsap.ticker.remove(gsap.updateRoot)
  adaptive.enabled = false
} else {
  runway.renderer.setAnimationLoop(frame)
}

if (import.meta.env.DEV) {
  ;(window as unknown as { __noir?: unknown }).__noir = {
    rig: cameraRig,
    state: cameraRig.scrollState,
    adaptive,
    mannequins: () => mannequins,
    looks: LOOKS,
    postfx,
    renderer: runway.renderer,
    applyPixelRatio,
    runway,
    showGain,
    opening: () => ({ pending: openingPending, started: openingStarted }),
    audio,
    imm: IMM,
    record: {
      enabled: recordMode,
      ready: () => mannequinsReadyAt > 0,
      warmupPending: () => textureWarmupQueue.length,
      tick: recordTick,
    },
  }
}

window.addEventListener('beforeunload', () => {
  window.removeEventListener('resize', onGlobalResize)
  intro.dispose()
  cursor.dispose()
  pinLayer.dispose()
  audio.dispose()
  cameraRig.dispose()
  finale.dispose()
  poster.dispose()
  disposeMannequins(runway.scene, mannequins)
  envHandle.dispose()
  postfx.dispose()
  runway.dispose()
})
