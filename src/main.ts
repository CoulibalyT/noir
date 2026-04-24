import './style.css'
import { Color, DefaultLoadingManager, Vector3 } from 'three'
import { Timer } from 'three/examples/jsm/misc/Timer.js'
import type { FogExp2 } from 'three'
import { gsap } from 'gsap'
import { detectQuality } from './quality'
import { feature } from './features'
import { createRunway } from './scene/runway'
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
import { LOOKS } from './data/looks'
import { createI18n, type StringKey } from './i18n'

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

const isMobileBlocked = window.matchMedia('(pointer: coarse), (max-width: 900px)').matches
if (isMobileBlocked) {
  throw new Error('mobile-blocked')
}

const intro = createIntro()

DefaultLoadingManager.onProgress = (_url, loaded, total) => {
  if (total > 0) intro.setProgress((loaded / total) * 100)
}
DefaultLoadingManager.onLoad = () => {
  intro.setProgress(100)
  intro.dismiss()
}

const quality = detectQuality()

const runway = createRunway(container, quality)

const mannequinsPromise = buildMannequins(runway.scene, LOOKS, '/models')

const envHandle = await createEnvironment(runway.renderer, runway.scene, {
  hdrUrl: '/hdri/photo_studio_01_4k.exr',
  intensity: 0.8,
  useHdr: quality.useHdrEnvironment,
})

const cameraRig = createCameraRig(quality.reducedMotion)
const postfx = createPostFX(runway.renderer, runway.scene, cameraRig.camera, {
  bloom: quality.postFxBloom && feature('bloom'),
  chromatic: quality.postFxChromatic && feature('chromatic'),
  vignette: quality.postFxVignette && feature('vignette'),
  noise: quality.postFxNoise && feature('noise'),

  anamorphic: quality.postFxBloom && feature('anamorphic', false),
  colorGrade: feature('grade'),
})
const cursor = createCursor()
const lookUI = createLookUI(i18n)
const creditsUI = createCreditsUI(i18n)
const poster = createPoster({
  renderOnce: () => postfx.render(0),
  readCanvas: () => runway.renderer.domElement,
  i18n,
})
const finale = createFinale(i18n, () => {

  finale.hide()
  resetFinaleState()
  window.scrollTo({ top: 0, behavior: 'smooth' })
})
const pinLayer = createPinLayer(document.body, i18n)
const audio = createAudio()

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

let mannequins: MannequinEntry[] = []
void mannequinsPromise.then((entries) => {
  mannequins = entries

  entries.forEach((m, i) => {
    m.group.position.set(0, 0, subjectZForLook(i))
    m.group.visible = i === 0
  })

  runway.renderer.compile(runway.scene, cameraRig.camera)

  const firstPins = LOOKS[0].pins
  if (firstPins && entries[0]) pinLayer.setPins(firstPins, entries[0].group)

  lookUI.showFirstLook(LOOKS[0])
  creditsUI.showFirstLook(LOOKS[0])
})

const timer = new Timer()

let prevLook = -1
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

const dissolveUniform = postfx.dissolve.threshold
let transitionTl: gsap.core.Timeline | null = null
let dissolveResetTimer: number | null = null
let lastTransitionAt = 0
const RAPID_THRESHOLD_MS = 1200

function forceDissolveReset(): void {
  dissolveUniform.value = 0
}

function snapLookState(toIdx: number, look: (typeof LOOKS)[number]): void {
  lookUI.setLook(toIdx, look)
  runway.lights.rimLeft.color.setHex(look.lighting.accent)
  runway.lights.rimRight.color.setHex(look.lighting.accent)
  runway.lights.mainSpot.color.setHex(look.lighting.spotColor)
  const fog = runway.scene.fog as FogExp2 | null
  if (fog) fog.color.setHex(look.lighting.color)
  if (runway.scene.background instanceof Color) {
    runway.scene.background.setHex(look.lighting.color)
  }
}

const BLOOM_FLASH_PEAK = 1.35
function flashBloomReact(): void {
  const bloom = postfx.effects.bloom
  if (!bloom) return
  const base = (bloom as unknown as { __base?: number }).__base ?? bloom.intensity
  ;(bloom as unknown as { __base?: number }).__base = base
  gsap.killTweensOf(bloom, 'intensity')
  gsap
    .timeline()
    .to(bloom, { intensity: base + BLOOM_FLASH_PEAK, duration: 0.12, ease: 'power2.out' })
    .to(bloom, { intensity: base, duration: 0.35, ease: 'power2.out' })
}

function playLookTransition(toIdx: number): void {
  if (transitionTl) transitionTl.kill()
  if (dissolveResetTimer !== null) window.clearTimeout(dissolveResetTimer)

  dissolveUniform.value = 0
  const look = LOOKS[toIdx]
  const now = performance.now()
  const sinceLast = now - lastTransitionAt
  lastTransitionAt = now

  if (!feature('transition') || sinceLast < RAPID_THRESHOLD_MS) {

    creditsUI.hideCartel()
    snapLookState(toIdx, look)
    if (feature('transition')) {

      lookUI.triggerFlash()
      audio.playFlash()
      flashBloomReact()
      runway.lights.flashLight.intensity = 4
      transitionTl = gsap
        .timeline()
        .to(runway.lights.flashLight, {
          intensity: 0,
          duration: 0.12,
          ease: 'power2.out',
        })
    }
    return
  }

  transitionTl = gsap
    .timeline({ onComplete: forceDissolveReset })
    .call(() => creditsUI.showCartel(look))
    .to(dissolveUniform, { value: 1, duration: 0.32, ease: 'power2.in' })
    .call(() => {
      lookUI.triggerFlash()
      audio.playFlash()
      flashBloomReact()
      runway.lights.flashLight.intensity = 7
      snapLookState(toIdx, look)
    })
    .to(runway.lights.flashLight, {
      intensity: 0,
      duration: 0.2,
      ease: 'power2.out',
    })
    .to(dissolveUniform, { value: 0, duration: 0.55, ease: 'power2.out' }, '-=0.12')
    .call(() => creditsUI.hideCartel(), [], '+=0.35')

  dissolveResetTimer = window.setTimeout(() => {
    dissolveResetTimer = null
    forceDissolveReset()
  }, 1500)
}

const rimToCam = new Vector3()
const rimAway = new Vector3()
const rimRight = new Vector3()
const rimUp = new Vector3(0, 1, 0)
const RIM_DISTANCE_BACK = 6
const RIM_SIDE_OFFSET = 3
const RIM_HEIGHT = 2.2

const zoomAnchor = new Vector3()
const zoomAnchorLifted = new Vector3()
const zoomOrbitDir = new Vector3()
const zoomCamPos = new Vector3()
const zoomLookAt = new Vector3()
const ZOOM_DIST = 1.2

const ZOOM_FOV_BASE = 45
const ZOOM_FOV_NARROW = 32

function zoomFade(localProgress: number, atProgress: number): number {
  const d = Math.abs(localProgress - atProgress)
  if (d <= 0.07) return 1
  if (d >= 0.14) return 0
  const t = 1 - (d - 0.07) / 0.07
  return t * t * (3 - 2 * t)
}

function applyPinZoom(
  localProgress: number,
  mannequin: MannequinEntry,
  pins: MaterialPin[] | undefined,
): void {
  const cam = cameraRig.camera
  if (!pins || pins.length === 0) {
    if (cam.fov !== ZOOM_FOV_BASE) {
      cam.fov = ZOOM_FOV_BASE
      cam.updateProjectionMatrix()
    }
    return
  }

  let zoom = 0
  let target: MaterialPin | null = null
  for (const pin of pins) {
    const f = zoomFade(localProgress, pin.atProgress)
    if (f > zoom) {
      zoom = f
      target = pin
    }
  }

  if (zoom <= 0 || !target) {
    if (cam.fov !== ZOOM_FOV_BASE) {
      cam.fov = ZOOM_FOV_BASE
      cam.updateProjectionMatrix()
    }
    return
  }

  mannequin.group.updateMatrixWorld()
  zoomAnchor.set(target.anchor[0], target.anchor[1], target.anchor[2])
  zoomAnchor.applyMatrix4(mannequin.group.matrixWorld)

  zoomOrbitDir
    .subVectors(cam.position, mannequin.group.position)
    .normalize()
  zoomCamPos.copy(zoomAnchor).addScaledVector(zoomOrbitDir, ZOOM_DIST)

  zoomCamPos.y = Math.max(zoomCamPos.y, 1.1)
  cam.position.lerp(zoomCamPos, zoom)

  zoomAnchorLifted.copy(zoomAnchor).setY(Math.max(zoomAnchor.y, 0.5))
  zoomLookAt.set(0, LOOK_AT_HEIGHT, mannequin.group.position.z)
  zoomLookAt.lerp(zoomAnchorLifted, zoom)
  cam.lookAt(zoomLookAt)

  cam.fov = ZOOM_FOV_BASE + (ZOOM_FOV_NARROW - ZOOM_FOV_BASE) * zoom
  cam.updateProjectionMatrix()
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

const onGlobalResize = () => {
  runway.renderer.setSize(window.innerWidth, window.innerHeight)
  postfx.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onGlobalResize)

window.addEventListener('keydown', (e) => {
  if (e.key !== 'p' && e.key !== 'P') return
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  const idx = cameraRig.scrollState.currentLook
  poster.capture({ look: LOOKS[idx], index: idx, total: LOOKS.length })
})

function frame(): void {
  timer.update()
  const delta = timer.getDelta()
  const time = timer.getElapsed()

  cameraRig.update(time)

  if (!quality.reducedMotion) {
    runway.updateAudience(time)
    runway.updateParticles(delta, time)
    runway.updatePhones(delta, time)
  }
  runway.updatePitFlashes(delta)
  runway.updateSpotCone(time)
  const state = cameraRig.scrollState

  const finaleEngaged = state.finaleProgress > 0
  if (finaleEngaged) {
    const fp = state.finaleProgress

    const slideT = smoothstep(0, FINALE_SLIDE_END, fp)
    for (let i = 0; i < mannequins.length; i++) {
      const baseZ = subjectZForLook(i)
      mannequins[i].group.position.x = FINALE_LINEUP_X[i] * slideT
      mannequins[i].group.position.z = baseZ + (FINALE_LINEUP_Z - baseZ) * slideT
    }

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
      pinLayer.clear()
      document.getElementById('look-info')?.classList.remove('visible')
    }
  } else if (finaleCardShown) {

    finale.hide()
    resetFinaleState()
  }

  for (let i = 0; i < mannequins.length; i++) {
    mannequins[i].group.visible = finaleEngaged || i === state.currentLook
  }
  const currentMannequin = mannequins[state.currentLook]
  if (finaleEngaged) {

    const washBlend = smoothstep(0, FINALE_SLIDE_END, state.finaleProgress)
    runway.lights.finaleWash.intensity = 18 * washBlend

    runway.lights.mainSpot.position.set(0, 13, FINALE_LINEUP_Z)
    runway.lights.mainSpot.target.position.set(0, 0, FINALE_LINEUP_Z)
    runway.lights.mainSpot.angle = Math.PI / 9

    const rL = runway.lights.rimLeft
    rL.position.set(-8, 5.5, -22)
    rL.target.position.set(-3, 1.4, FINALE_LINEUP_Z)
    const rR = runway.lights.rimRight
    rR.position.set(8, 5.5, -22)
    rR.target.position.set(3, 1.4, FINALE_LINEUP_Z)

    runway.lights.ambient.intensity = 0.75
  } else if (currentMannequin) {
    runway.lights.finaleWash.intensity = 0
    const subjectX = currentMannequin.group.position.x
    const subjectZ = currentMannequin.group.position.z

    runway.lights.mainSpot.position.set(subjectX, 11, subjectZ)
    runway.lights.mainSpot.target.position.set(subjectX, 0, subjectZ)
    runway.lights.mainSpot.angle = Math.PI / 12
    runway.lights.ambient.intensity = 0.55

    updateRimLights(currentMannequin.group.position)
  }

  if (currentMannequin) {

    if (currentMannequin.mixer && currentMannequin.walkAction) {
      currentMannequin.walkAction.time =
        currentMannequin.walkLoopStart +
        state.localProgress * currentMannequin.walkLoopDuration
      currentMannequin.mixer.update(0)
    }
  }

  if (finaleEngaged) {
    creditsUI.hideMarquee()
    creditsUI.hideCartel()
  } else {
    creditsUI.updateMarquee(LOOKS[state.currentLook], state.localProgress)
  }

  if (currentMannequin && feature('zoom')) {
    applyPinZoom(state.localProgress, currentMannequin, LOOKS[state.currentLook].pins)
  }

  if (state.currentLook !== prevLook) {
    if (prevLook < 0) {

      const look = LOOKS[state.currentLook]
      runway.lights.rimLeft.color.setHex(look.lighting.accent)
      runway.lights.rimRight.color.setHex(look.lighting.accent)
      runway.lights.mainSpot.color.setHex(look.lighting.spotColor)
      const fog = runway.scene.fog as FogExp2 | null
      if (fog) fog.color.setHex(look.lighting.color)
      if (runway.scene.background instanceof Color) {
        runway.scene.background.setHex(look.lighting.color)
      }
    } else {
      playLookTransition(state.currentLook)
    }

    const nextPins = LOOKS[state.currentLook].pins
    if (nextPins && currentMannequin) {
      pinLayer.setPins(nextPins, currentMannequin.group)
    } else {
      pinLayer.clear()
    }
    prevLook = state.currentLook
  }

  pinLayer.update(cameraRig.camera, state.localProgress)

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
    runway.lights.flashLight.intensity = 5
    window.setTimeout(() => {
      runway.lights.flashLight.intensity = 0
    }, 100)
  }

  lookUI.setProgress(state.progress)
  if (state.progress > 0.02) lookUI.hideScrollHint()

  audio.update(state.walkPhase)

  if (finaleEngaged) {
    const blend = smoothstep(0, FINALE_SLIDE_END, state.finaleProgress)

    finaleOrbitLook.set(0, LOOK_AT_HEIGHT, subjectZForLook(state.currentLook))
    finaleBlendLook.copy(finaleOrbitLook).lerp(finaleCamLook, blend)
    cameraRig.camera.position.lerp(finaleCamPos, blend)
    cameraRig.camera.lookAt(finaleBlendLook)

    const targetFov = 45 + (FINALE_FOV - 45) * blend
    if (Math.abs(cameraRig.camera.fov - targetFov) > 0.05) {
      cameraRig.camera.fov = targetFov
      cameraRig.camera.updateProjectionMatrix()
    }
  }

  postfx.render(delta)
}

runway.renderer.setAnimationLoop(frame)

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
