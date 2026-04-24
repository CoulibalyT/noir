import './style.css'
import { Box3, Color, DefaultLoadingManager, Vector3 } from 'three'
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

const container = document.getElementById('canvas-container')
if (!container) throw new Error('#canvas-container not found')

// Intro first — needs to exist before any loader fires so progress callbacks
// have somewhere to write to.
const intro = createIntro()

// Wire Three's global LoadingManager to the intro progress bar. RGBELoader,
// EXRLoader, GLTFLoader and TextureLoader all register with it by default so
// this single hook tracks every async asset in the scene.
DefaultLoadingManager.onProgress = (_url, loaded, total) => {
  if (total > 0) intro.setProgress((loaded / total) * 100)
}
DefaultLoadingManager.onLoad = () => {
  intro.setProgress(100)
  intro.dismiss()
}

const quality = detectQuality()

const runway = createRunway(container, quality)

// Kick off the mannequin download IMMEDIATELY — in parallel with the env
// load — so LoadingManager sees all pending items in one batch and only
// fires onLoad once everything (HDR + GLBs) is actually ready.
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
  // Anamorphic streaks need a separable multi-pass blur to look smooth;
  // the single-pass approximation produces visible "dashes" on bright
  // specular peaks. Disabled by default; opt in via ?on=anamorphic for
  // experimentation. Color grading is a clean per-pixel transform so it
  // stays on.
  anamorphic: quality.postFxBloom && feature('anamorphic', false),
  colorGrade: feature('grade'),
})
const cursor = createCursor()
const lookUI = createLookUI()
const creditsUI = createCreditsUI()
const poster = createPoster({
  renderOnce: () => postfx.render(0),
  readCanvas: () => runway.renderer.domElement,
})
const finale = createFinale(() => {
  // Replay — exit the curtain call, restore mannequins + backdrop, then
  // smoothly scroll back to the top. The scroll-driven rig picks up from
  // there on the next frame.
  finale.hide()
  resetFinaleState()
  window.scrollTo({ top: 0, behavior: 'smooth' })
})
const pinLayer = createPinLayer(document.body)
const audio = createAudio()

// Wire audio toggle button
const audioToggleEl = document.getElementById('audio-toggle') as HTMLButtonElement
const audioStateEl = document.getElementById('audio-toggle-state') as HTMLElement
audioToggleEl.addEventListener('click', () => {
  const nowMuted = audio.toggle()
  audioStateEl.textContent = nowMuted ? 'off' : 'on'
  audioToggleEl.dataset.on = nowMuted ? 'false' : 'true'
  audioToggleEl.setAttribute('aria-label', nowMuted ? 'Activer le son' : 'Couper le son')
})

let mannequins: MannequinEntry[] = []
void mannequinsPromise.then((entries) => {
  mannequins = entries
  // Pin each mannequin to its fixed orbit station. They stand still; the
  // camera rotates around them.
  entries.forEach((m, i) => {
    m.group.position.set(0, 0, subjectZForLook(i))
    m.group.visible = i === 0
  })
  // Seed pins for the current look on first paint.
  const firstPins = LOOKS[0].pins
  if (firstPins && entries[0]) pinLayer.setPins(firstPins, entries[0].group)
  // First look info follows the asset loading, not a hardcoded timer.
  lookUI.showFirstLook(LOOKS[0])
  creditsUI.showFirstLook(LOOKS[0])
})

// Timer pauses when the tab is hidden — Clock would accumulate drift and
// cause a jump on tab refocus. Same API (update/getDelta/getElapsed).
const timer = new Timer()

// ─── DEBUG HUD ─────────────────────────────────────────────────────────────
const debugHud = document.getElementById('debug-hud')
let debugAcc = 0
function updateDebugHud(): void {
  if (!debugHud) return
  debugAcc++
  if (debugAcc % 6 !== 0) return
  const cam = cameraRig.camera
  const s = cameraRig.scrollState
  const m = mannequins[s.currentLook]
  const ml = m
    ? `(${m.group.position.x.toFixed(1)}, ${m.group.position.y.toFixed(1)}, ${m.group.position.z.toFixed(1)})`
    : '—'
  const visible = mannequins.map((x) => (x.group.visible ? '1' : '0')).join('')
  let meshCount = 0
  let visibleMeshes = 0
  let firstMatOpacity = '—'
  let firstMatColor = '—'
  let firstMatTransparent = '—'
  let firstMatType = '—'
  let firstMatName = '—'
  if (m) {
    m.group.traverse((obj) => {
      const me = obj as import('three').Mesh
      if (me.isMesh) {
        meshCount++
        if (me.visible) visibleMeshes++
        if (meshCount === 1) {
          const mat = Array.isArray(me.material) ? me.material[0] : me.material
          if (mat) {
            const std = mat as import('three').MeshStandardMaterial
            firstMatType = mat.type
            firstMatName = mat.name || '(no name)'
            firstMatOpacity = String(std.opacity ?? 'n/a')
            firstMatTransparent = String(std.transparent ?? false)
            firstMatColor = std.color
              ? '#' + std.color.getHexString()
              : '—'
          }
        }
      }
    })
  }
  debugHud.textContent = [
    `look      ${s.currentLook + 1}/${mannequins.length || '?'}  (local ${s.localProgress.toFixed(3)})`,
    `cam pos   (${cam.position.x.toFixed(1)}, ${cam.position.y.toFixed(1)}, ${cam.position.z.toFixed(1)})`,
    `mann pos  ${ml}`,
    `mann bbox ${m ? bboxSummary(m.group) : '—'}`,
    `visible   ${visible}`,
    `meshes    ${meshCount}  (visible ${visibleMeshes})`,
    `mat[0]    ${firstMatType}`,
    `  name    ${firstMatName}`,
    `  color   ${firstMatColor}`,
    `  opacity ${firstMatOpacity}`,
    `  trans   ${firstMatTransparent}`,
  ].join('\n')
}

const bboxTmp = new Box3()
const bboxSize = new Vector3()
function bboxSummary(obj: import('three').Object3D): string {
  bboxTmp.setFromObject(obj)
  bboxTmp.getSize(bboxSize)
  return `${bboxSize.x.toFixed(1)}×${bboxSize.y.toFixed(1)}×${bboxSize.z.toFixed(1)}`
}
let prevLook = -1
let audienceFlashTimer = 0

// ─── FINALE / CURTAIN CALL ────────────────────────────────────────────────
// Scroll-driven. The last slice of scroll (FINALE_SCROLL_FRACTION of total)
// maps to state.finaleProgress 0→1. Mannequins gather on the T-bar crossbar
// and the camera zooms in, travelling horizontally past each look so the
// user discovers them one at a time. Credits card fades in at the tail.
const FINALE_LINEUP_X = [-3.3, -1.1, 1.1, 3.3]
const FINALE_LINEUP_Z = -30

// Pacing inside the finale slice (finaleProgress 0..1).
const FINALE_SLIDE_END = 0.1 // mannequins finish sliding to the T-bar
const FINALE_PAN_START = 0.05
const FINALE_PAN_END = 0.55 // pan ends, arc begins
const FINALE_ARC_END = 0.92 // camera settled behind the lineup
const FINALE_CARD_TRIGGER = 0.95 // HTML "Nøir Haus" overlay takes over

// Phase 2 (pan) pose — sits in front of the crossbar, panning x across it.
const FINALE_CAM_Y = 1.7
const FINALE_CAM_Z = -24
const FINALE_LOOK_Y = 1.1
const FINALE_PAN_RANGE_X = 4.5
const FINALE_FOV = 38

// Phase 3 (arc behind the lineup). Camera flies up, over the mannequins,
// and lands deep in the scene — the pan's final subject is the giant
// NØIR HAUS backdrop receding into the end of the runway. Camera never
// crosses the plane, so the text reads correctly front-on.
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

// Called from the replay button — pull everything back to its scroll-driven
// default. Scroll will also be animated back to top by the caller.
function resetFinaleState(): void {
  for (let i = 0; i < mannequins.length; i++) {
    mannequins[i].group.position.set(0, 0, subjectZForLook(i))
  }
  backdrop.setVisible(false)
  backdrop.setOpacity(0)
  finaleCardShown = false
}

// ─── LOOK TRANSITION ───────────────────────────────────────────────────────
// Two modes:
//   - Calm scroll (>= RAPID_THRESHOLD_MS since last transition) → grandiose
//     noise-dissolve via DissolveEffect.
//   - Rapid scroll (faster) → instant snap. Avoids piling up multi-second
//     dissolve tweens that would freeze the screen black.
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

// Audio-reactive bloom spike — on every shutter, push bloom intensity up
// briefly so the highlight-heavy frame punches harder exactly when the
// shutter clicks. Keeps the base intensity captured so repeated flashes
// always return to the resting value (even if config changes at runtime).
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
  // Hard pre-reset of dissolve so a killed previous tween can't leave a
  // partial value behind.
  dissolveUniform.value = 0
  const look = LOOKS[toIdx]
  const now = performance.now()
  const sinceLast = now - lastTransitionAt
  lastTransitionAt = now

  // Rapid scroll OR transitions disabled → instant snap, no dissolve.
  if (!feature('transition') || sinceLast < RAPID_THRESHOLD_MS) {
    // Killing the previous (calm) timeline above orphaned its scheduled
    // hideCartel. Make sure no stale cartel headline stays pinned after a
    // rapid scroll.
    creditsUI.hideCartel()
    snapLookState(toIdx, look)
    if (feature('transition')) {
      // Brief flash burst to mark the change without a long dissolve
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

  // Calm scroll — full grandiose dissolve.
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

  // Hard 1.5s safety: force dissolve back to 0 regardless.
  dissolveResetTimer = window.setTimeout(() => {
    dissolveResetTimer = null
    forceDissolveReset()
  }, 1500)
}

// ─── DYNAMIC RIM LIGHTS ────────────────────────────────────────────────────
// Keep the two rims positioned directly "behind" the mannequin relative to
// the camera, so silhouettes stay rimmed whatever angle the camera is on.
const rimToCam = new Vector3()
const rimAway = new Vector3()
const rimRight = new Vector3()
const rimUp = new Vector3(0, 1, 0)
const RIM_DISTANCE_BACK = 6
const RIM_SIDE_OFFSET = 3
const RIM_HEIGHT = 2.2

// ─── PIN ZOOM ──────────────────────────────────────────────────────────────
// When the scroll sits near a pin's atProgress, dolly the camera in toward
// that pin's anchor — lets the user actually SEE the detail the label points
// at. Blend is cubic-smoothstep on |localProgress - atProgress|; outside the
// window the orbit camera takes back over unchanged.
const zoomAnchor = new Vector3()
const zoomAnchorLifted = new Vector3()
const zoomOrbitDir = new Vector3()
const zoomCamPos = new Vector3()
const zoomLookAt = new Vector3()
const ZOOM_DIST = 1.2 // meters from anchor at peak zoom (safety buffer
// to keep the camera outside long sleeves / drape volumes)
const ZOOM_FOV_BASE = 45
const ZOOM_FOV_NARROW = 32 // telephoto compression at peak zoom

// Camera zoom window — stays peaked while the pin is at full opacity
// (PEAK_HALF_WIDTH in pins.ts = 0.1), then fades out in sync with the pin.
// Before: 0.03/0.09 — so short the zoom flashed in and out before the user
// could read the pin card.
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

  // Anchor in world space
  mannequin.group.updateMatrixWorld()
  zoomAnchor.set(target.anchor[0], target.anchor[1], target.anchor[2])
  zoomAnchor.applyMatrix4(mannequin.group.matrixWorld)

  // Approach the anchor along the current orbit ray so we don't teleport
  // through the model
  zoomOrbitDir
    .subVectors(cam.position, mannequin.group.position)
    .normalize()
  zoomCamPos.copy(zoomAnchor).addScaledVector(zoomOrbitDir, ZOOM_DIST)
  // Floor clamp — never let the camera dive low enough to look from shoe
  // level into an unlit area. Stays in the believable "press photographer"
  // height range.
  zoomCamPos.y = Math.max(zoomCamPos.y, 1.1)
  cam.position.lerp(zoomCamPos, zoom)

  // LookAt blends from orbit center (subject torso) to a lifted anchor —
  // very low anchors (shoes at y=0.08) get raised to at least y=0.5 so the
  // camera frames the lower body, not just an unlit floor patch.
  zoomAnchorLifted.copy(zoomAnchor).setY(Math.max(zoomAnchor.y, 0.5))
  zoomLookAt.set(0, LOOK_AT_HEIGHT, mannequin.group.position.z)
  zoomLookAt.lerp(zoomAnchorLifted, zoom)
  cam.lookAt(zoomLookAt)

  // Narrow FOV → lens compression, signals "close up" even before user reads
  cam.fov = ZOOM_FOV_BASE + (ZOOM_FOV_NARROW - ZOOM_FOV_BASE) * zoom
  cam.updateProjectionMatrix()
}

function updateRimLights(subject: Vector3): void {
  rimToCam.subVectors(cameraRig.camera.position, subject).normalize()
  rimAway.copy(rimToCam).negate() // behind the subject, away from camera
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

// Keyboard — "P" captures a 9:16 poster of the current frame with the
// look credits baked in. No modifier needed; ignored when focus is on a
// text input so it doesn't hijack typing.
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
  // Ambient living-scene animations — skipped when the user has asked for
  // reduced motion. Pit flashes stay (they're a staged event, not decoration).
  if (!quality.reducedMotion) {
    runway.updateAudience(time)
    runway.updateParticles(delta, time)
  }
  runway.updatePitFlashes(delta)
  runway.updateSpotCone(time)
  const state = cameraRig.scrollState

  // Finale / curtain-call — scroll-driven. Anything > 0 means the user is
  // in the finale slice; mannequins glide to the T-bar and the camera pans
  // horizontally across the lineup in close-up.
  const finaleEngaged = state.finaleProgress > 0
  if (finaleEngaged) {
    const fp = state.finaleProgress

    // Mannequins lerp from their scroll stations to the T-bar lineup over
    // the first slice of finale scroll. After that they're fixed, the only
    // thing moving is the camera.
    const slideT = smoothstep(0, FINALE_SLIDE_END, fp)
    for (let i = 0; i < mannequins.length; i++) {
      const baseZ = subjectZForLook(i)
      mannequins[i].group.position.x = FINALE_LINEUP_X[i] * slideT
      mannequins[i].group.position.z = baseZ + (FINALE_LINEUP_Z - baseZ) * slideT
    }

    // Phase 2 — horizontal pan across the lineup (close-up discovery).
    // Phase 3 — camera lifts and pushes behind the lineup so the backdrop
    // fills the frame ahead of the HTML "Nøir Haus" overlay that takes
    // over at the very tail.
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

    // Backdrop ramps in during the arc. Peaks near full by the time the
    // camera has settled behind the lineup and the HTML overlay fires.
    const backdropA = smoothstep(FINALE_PAN_END, FINALE_ARC_END, fp) * 0.95
    backdrop.setVisible(backdropA > 0.001)
    backdrop.setOpacity(backdropA)

    // Credits card appears at the tail — once the 3D "push behind" has
    // resolved, the HTML layer with the giant Nøir Haus + per-look credits
    // takes over the screen.
    if (fp >= FINALE_CARD_TRIGGER && !finaleCardShown) {
      finaleCardShown = true
      finale.show(LOOKS)
      audio.playFinale()
      pinLayer.clear()
      document.getElementById('look-info')?.classList.remove('visible')
    }
  } else if (finaleCardShown) {
    // Scrolled back below the finale threshold — tear down.
    finale.hide()
    resetFinaleState()
  }

  // Mannequins — during the finale (choreography or overlay) the whole
  // lineup stays visible; otherwise only the current one reads singular.
  for (let i = 0; i < mannequins.length; i++) {
    mannequins[i].group.visible = finaleEngaged || i === state.currentLook
  }
  const currentMannequin = mannequins[state.currentLook]
  if (finaleEngaged) {
    // Curtain call — swap the single-subject tracking spot for an overhead
    // RectAreaLight wash aligned with the T-bar. Rims stay in fixed house
    // positions covering the whole lineup instead of chasing one subject.
    const washBlend = smoothstep(0, FINALE_SLIDE_END, state.finaleProgress)
    runway.lights.finaleWash.intensity = 18 * washBlend
    // Dim the single spot so its tight cone doesn't fight the wash.
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
    // Shower spot directly above, aimed at the floor at the subject's feet.
    runway.lights.mainSpot.position.set(subjectX, 11, subjectZ)
    runway.lights.mainSpot.target.position.set(subjectX, 0, subjectZ)
    runway.lights.mainSpot.angle = Math.PI / 12
    runway.lights.ambient.intensity = 0.55

    // Dynamic rim lights — always behind subject from camera POV.
    updateRimLights(currentMannequin.group.position)
  }

  if (currentMannequin) {
    // Scroll-driven walk cycle for GLB mannequins with an AnimationMixer.
    // localProgress (0..1 within the look) maps to the walk loop interval so
    // scrolling scrubs the skeleton rather than advancing in real time.
    if (currentMannequin.mixer && currentMannequin.walkAction) {
      currentMannequin.walkAction.time =
        currentMannequin.walkLoopStart +
        state.localProgress * currentMannequin.walkLoopDuration
      currentMannequin.mixer.update(0)
    }
  }

  // Credits marquee — huge parallax title behind the runway, driven by the
  // local scroll progress so it glides horizontally as the user explores
  // each look. Hidden during the finale alongside the transition cartel: a
  // look-specific headline would contradict the ensemble lineup, and a
  // cartel from an earlier look can get stuck on screen if a rapid scroll
  // killed the previous transition timeline before its hideCartel callback
  // fired.
  if (finaleEngaged) {
    creditsUI.hideMarquee()
    creditsUI.hideCartel()
  } else {
    creditsUI.updateMarquee(LOOKS[state.currentLook], state.localProgress)
  }

  // Pin zoom — modulates the camera AFTER rims (rims stay based on orbit
  // position, no weird flip during close-ups) and BEFORE pin projection, so
  // pin labels re-project to match the zoomed camera.
  if (currentMannequin && feature('zoom')) {
    applyPinZoom(state.localProgress, currentMannequin, LOOKS[state.currentLook].pins)
  }

  // Look transitions — snap colors inside the blackout via GSAP timeline.
  if (state.currentLook !== prevLook) {
    if (prevLook < 0) {
      // First reveal, no fade — just align colors and update UI.
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
    // Swap pin anchors to the new mannequin's coord space.
    const nextPins = LOOKS[state.currentLook].pins
    if (nextPins && currentMannequin) {
      pinLayer.setPins(nextPins, currentMannequin.group)
    } else {
      pinLayer.clear()
    }
    prevLook = state.currentLook
  }

  // Reposition + fade pins each frame
  pinLayer.update(cameraRig.camera, state.localProgress)

  // Random audience camera flashes — 100ms pulse, interval 1-3s, fired from
  // inside the front row of the audience around the current subject.
  audienceFlashTimer += delta
  if (audienceFlashTimer > 1 + Math.random() * 2 && state.progress > 0.05) {
    audienceFlashTimer = 0
    const flashSide = Math.random() > 0.5 ? 1 : -1
    const subjectZ = currentMannequin ? currentMannequin.group.position.z : 0
    runway.lights.flashLight.position.set(
      flashSide * (2.6 + Math.random() * 0.8), // inside the front audience row
      1.1 + Math.random() * 0.6, // around eye-level of seated viewers
      subjectZ + (Math.random() - 0.5) * 4,
    )
    runway.lights.flashLight.intensity = 5
    window.setTimeout(() => {
      runway.lights.flashLight.intensity = 0
    }, 100)
  }

  // UI
  lookUI.setProgress(state.progress)
  if (state.progress > 0.02) lookUI.hideScrollHint()

  // Audio
  audio.update(state.walkPhase)

  updateDebugHud()

  // Finale camera override — blend from the orbit pose camera.ts just wrote
  // to the scroll-driven finale pose. Blend ramps over the first slice of
  // finale scroll to avoid a snap on entry.
  if (finaleEngaged) {
    const blend = smoothstep(0, FINALE_SLIDE_END, state.finaleProgress)
    // Orbit lookAt target from camera.ts is (0, LOOK_AT_HEIGHT, subjectZ).
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

  // Final render through the composer
  postfx.render(delta)
}

// setAnimationLoop is the r170+ idiom — handles tab visibility pausing and
// WebXR compatibility. Renderer stops the loop on dispose().
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
