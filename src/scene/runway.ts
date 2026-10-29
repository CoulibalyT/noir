import {
  ACESFilmicToneMapping,
  AddEquation,
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CustomBlending,
  CylinderGeometry,
  DoubleSide,
  Euler,
  FogExp2,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OneFactor,
  PCFSoftShadowMap,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  RectAreaLight,
  Scene,
  ShaderMaterial,
  SpotLight,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { Camera, Material, Object3D } from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Quality } from '../quality'
import { feature } from '../features'

export const COSMETIC_LAYER = 1
export const REFLECTOR_LAYER = 2

function setLayerDeep(root: Object3D, layer: number): void {
  root.traverse((obj) => obj.layers.set(layer))
}

function mergeGroupByMaterial(group: Group): Mesh[] {
  group.updateMatrixWorld(true)
  const buckets = new Map<Material, BufferGeometry[]>()
  const sources = new Set<BufferGeometry>()
  group.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const mat = mesh.material as Material
    sources.add(mesh.geometry)
    const geo = mesh.geometry.clone()
    geo.applyMatrix4(mesh.matrixWorld)
    const list = buckets.get(mat) ?? []
    list.push(geo)
    buckets.set(mat, list)
  })
  const result: Mesh[] = []
  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false)
    for (const g of geos) g.dispose()
    if (!merged) continue
    const mesh = new Mesh(merged, mat)
    mesh.matrixAutoUpdate = false
    mesh.updateMatrix()
    result.push(mesh)
  }
  for (const g of sources) g.dispose()
  return result
}

/**
 * Spectateur assis, vu de face : tête (chignon / court / long selon la variante), cou,
 * épaules tombantes, bras ; la variante 1 tient un téléphone devant le visage.
 * La lumière du podium accroche le haut du crâne et des épaules (liseré), le bas fond
 * dans l'ombre du siège. Le matériau est blanc : toute la valeur est cuite ici.
 */
function makeSilhouetteTexture(variant: number): CanvasTexture {
  const W = 256
  const H = 352
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return new CanvasTexture(canvas)

  const cx = W / 2
  const headR = 26 + variant * 2
  const headY = 78 + variant * 4
  const neckW = 16
  const shoulderY = headY + headR + 22
  const shoulderW = 74 + variant * 6
  // Un poil plus clair que le noir du fond : la forme existe même hors du sol éclairé.
  const body = '#131317'

  ctx.filter = 'blur(1px)'
  ctx.fillStyle = body

  // Torse : épaules tombantes, cou, trapèze qui descend jusqu'au bas de la carte.
  ctx.beginPath()
  ctx.moveTo(cx - shoulderW - 6, H)
  ctx.lineTo(cx - shoulderW, shoulderY + 30)
  ctx.quadraticCurveTo(cx - shoulderW, shoulderY, cx - shoulderW * 0.55, shoulderY - 6)
  ctx.quadraticCurveTo(cx - neckW, shoulderY - 12, cx - neckW / 2, shoulderY - 26)
  ctx.lineTo(cx + neckW / 2, shoulderY - 26)
  ctx.quadraticCurveTo(cx + neckW, shoulderY - 12, cx + shoulderW * 0.55, shoulderY - 6)
  ctx.quadraticCurveTo(cx + shoulderW, shoulderY, cx + shoulderW, shoulderY + 30)
  ctx.lineTo(cx + shoulderW + 6, H)
  ctx.closePath()
  ctx.fill()

  // Tête, légèrement inclinée selon la variante.
  ctx.beginPath()
  ctx.ellipse(cx + (variant - 1) * 3, headY, headR * 0.92, headR, (variant - 1) * 0.08, 0, Math.PI * 2)
  ctx.fill()
  if (variant === 0) {
    ctx.beginPath()
    ctx.arc(cx - 6, headY - headR - 8, 11, 0, Math.PI * 2)
    ctx.fill()
  } else if (variant === 2) {
    ctx.beginPath()
    ctx.ellipse(cx, headY + 14, headR * 1.25, headR * 1.05, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Variante 1 : bras levé, téléphone devant le visage.
  if (variant === 1) {
    ctx.beginPath()
    ctx.moveTo(cx + shoulderW * 0.7, shoulderY + 30)
    ctx.quadraticCurveTo(cx + shoulderW * 0.9, shoulderY - 10, cx + 30, headY + 10)
    ctx.lineTo(cx + 44, headY + 16)
    ctx.quadraticCurveTo(cx + shoulderW * 1.05, shoulderY + 6, cx + shoulderW * 0.95, shoulderY + 44)
    ctx.closePath()
    ctx.fill()
    ctx.filter = 'none'
    ctx.fillStyle = '#2a3040'
    roundedRectPath(ctx, cx + 22, headY - 4, 20, 34, 4)
    ctx.fill()
    ctx.filter = 'blur(1px)'
    ctx.fillStyle = body
  }

  // Lumière de rebond du podium : elle tombe d'en haut sur le crâne et accroche la ligne
  // d'épaules. C'est ce qui fait lire "une personne" plutôt qu'une découpe.
  ctx.globalCompositeOperation = 'source-atop'
  ctx.filter = 'blur(2px)'
  const rim = ctx.createLinearGradient(0, headY - headR - 14, 0, shoulderY + 70)
  rim.addColorStop(0, 'rgba(156,160,178,0.85)')
  rim.addColorStop(0.18, 'rgba(118,122,140,0.38)')
  rim.addColorStop(0.45, 'rgba(90,94,108,0.14)')
  rim.addColorStop(1, 'rgba(60,62,72,0)')
  ctx.fillStyle = rim
  ctx.fillRect(0, 0, W, H)
  // Épaules : trait de lumière le long de la courbe.
  ctx.filter = 'blur(3px)'
  ctx.strokeStyle = 'rgba(150,154,172,0.55)'
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(cx - shoulderW, shoulderY + 30)
  ctx.quadraticCurveTo(cx - shoulderW, shoulderY, cx - shoulderW * 0.55, shoulderY - 6)
  ctx.moveTo(cx + shoulderW * 0.55, shoulderY - 6)
  ctx.quadraticCurveTo(cx + shoulderW, shoulderY, cx + shoulderW, shoulderY + 30)
  ctx.stroke()
  ctx.globalCompositeOperation = 'source-over'
  ctx.filter = 'none'

  // Le bas fond dans l'ombre du siège.
  const fade = ctx.createLinearGradient(0, H * 0.7, 0, H)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = fade
  ctx.fillRect(0, H * 0.7, W, H * 0.3)
  ctx.globalCompositeOperation = 'source-over'

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearMipmapLinearFilter
  tex.magFilter = LinearFilter
  tex.anisotropy = 4
  tex.generateMipmaps = true
  return tex
}

function makeBackdrop(): Group {
  const group = new Group()

  const wallMat = new MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.85 })
  const wall = new Mesh(new PlaneGeometry(18, 8), wallMat)
  group.add(wall)

  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(232, 228, 223, 0.9)'
    ctx.font = '300 120px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '40px'
    ctx.fillText('NØIR HAUS', canvas.width / 2, canvas.height / 2 + 6)
  }
  const logoTex = new CanvasTexture(canvas)
  logoTex.colorSpace = SRGBColorSpace
  logoTex.minFilter = LinearMipmapLinearFilter
  logoTex.magFilter = LinearFilter
  const logoMat = new MeshBasicMaterial({
    map: logoTex,
    transparent: true,
    depthWrite: false,
  })
  const logoPlane = new Mesh(new PlaneGeometry(6, 1.5), logoMat)
  logoPlane.position.set(0, 0.3, 0.02)
  group.add(logoPlane)

  return group
}

interface PitFlash {
  index: number
  nextFlash: number
  active: number
}
function makePhotographerPit(): {
  group: Group
  flares: InstancedMesh
  flashes: PitFlash[]
} {
  const bodies = new Group()
  const silhouetteMat = new MeshStandardMaterial({ color: 0x040404, roughness: 0.95 })
  const cameraBodyMat = new MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.4,
    metalness: 0.6,
  })
  const flashes: PitFlash[] = []

  const count = 14
  const bodyGeo = new BoxGeometry(0.35, 0.95, 0.35)
  const camGeo = new BoxGeometry(0.18, 0.12, 0.12)
  const flareGeo = new PlaneGeometry(0.22, 0.22)
  const flareMat = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const flares = new InstancedMesh(flareGeo, flareMat, count)
  const matrix = new Matrix4()
  const black = new Color(0, 0, 0)

  for (let i = 0; i < count; i++) {
    const px = (Math.random() - 0.5) * 5
    const pz = (Math.random() - 0.5) * 3
    const body = new Mesh(bodyGeo, silhouetteMat)
    body.position.set(px, 0.48, pz)
    bodies.add(body)

    const cam = new Mesh(camGeo, cameraBodyMat)
    cam.position.set(px + (Math.random() - 0.5) * 0.15, 1.0, pz + 0.1)
    bodies.add(cam)

    matrix.makeTranslation(cam.position.x, cam.position.y, cam.position.z + 0.08)
    flares.setMatrixAt(i, matrix)
    flares.setColorAt(i, black)

    flashes.push({
      index: i,
      nextFlash: Math.random() * 2,
      active: 0,
    })
  }
  flares.instanceMatrix.needsUpdate = true
  if (flares.instanceColor) flares.instanceColor.needsUpdate = true

  const group = new Group()
  for (const mesh of mergeGroupByMaterial(bodies)) group.add(mesh)
  group.add(flares)

  return { group, flares, flashes }
}

function makeParticles(count: number): {
  points: Points
  update: (delta: number, time: number) => void
} {
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  const phases = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 12
    positions[i * 3 + 1] = Math.random() * 5
    positions[i * 3 + 2] = 5 - Math.random() * 100
    velocities[i * 3] = (Math.random() - 0.5) * 0.04
    velocities[i * 3 + 1] = 0.015 + Math.random() * 0.025
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.04
    phases[i] = Math.random() * Math.PI * 2
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))

  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.4)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, 64)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace

  const material = new PointsMaterial({
    size: 0.08,
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
    color: 0xfff5e6,
    opacity: 0.5,
  })

  const points = new Points(geometry, material)
  points.frustumCulled = false

  const update = (delta: number, time: number): void => {
    const attr = geometry.attributes.position as BufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0; i < count; i++) {
      const base = i * 3
      arr[base] += velocities[base] * delta + Math.sin(time * 0.3 + phases[i]) * 0.0002
      arr[base + 1] += velocities[base + 1] * delta
      arr[base + 2] += velocities[base + 2] * delta

      if (arr[base + 1] > 5.5) {
        arr[base] = (Math.random() - 0.5) * 12
        arr[base + 1] = 0
        arr[base + 2] = 5 - Math.random() * 100
      }
    }
    attr.needsUpdate = true
  }

  return { points, update }
}

function makeOverheadTruss(): Group {
  const source = new Group()
  const metalMat = new MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.35,
    metalness: 0.9,
    envMapIntensity: 1.2,
  })
  const housingMat = new MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.25,
    metalness: 0.85,
    envMapIntensity: 1.1,
  })
  const lensMat = new MeshStandardMaterial({
    color: 0x050505,
    roughness: 0.15,
    metalness: 0.95,
    envMapIntensity: 1.3,
  })

  const TRUSS_Y = 6.3
  const TRUSS_LENGTH = 120
  const TRUSS_CENTER_Z = -45
  const BEAM_X = 2.4

  const beamGeo = new CylinderGeometry(0.07, 0.07, TRUSS_LENGTH, 10)
  for (const side of [-1, 1] as const) {
    const beam = new Mesh(beamGeo, metalMat)
    beam.position.set(side * BEAM_X, TRUSS_Y, TRUSS_CENTER_Z)
    beam.rotation.x = Math.PI / 2
    source.add(beam)
  }

  const braceGeo = new CylinderGeometry(0.04, 0.04, BEAM_X * 2, 8)
  const braceStart = TRUSS_CENTER_Z - TRUSS_LENGTH / 2 + 3
  const braceEnd = TRUSS_CENTER_Z + TRUSS_LENGTH / 2 - 3
  const braceCount = Math.floor((braceEnd - braceStart) / 5)
  for (let i = 0; i < braceCount; i++) {
    const z = braceStart + i * 5
    const brace = new Mesh(braceGeo, metalMat)
    brace.position.set(0, TRUSS_Y, z)
    brace.rotation.z = Math.PI / 2
    source.add(brace)
  }

  const stemGeo = new CylinderGeometry(0.016, 0.016, 0.35, 6)
  const yokeGeo = new TorusGeometry(0.11, 0.012, 6, 16, Math.PI)
  const bodyGeo = new CylinderGeometry(0.095, 0.115, 0.22, 20, 1, true)
  const backGeo = new CylinderGeometry(0.095, 0.095, 0.04, 16)
  const lensGeo = new CircleGeometry(0.09, 24)
  const bezelGeo = new TorusGeometry(0.093, 0.008, 6, 20)

  const FIXTURE_SPACING = 3.8
  const fixtureStart = TRUSS_CENTER_Z - TRUSS_LENGTH / 2 + 3
  const fixtureEnd = TRUSS_CENTER_Z + TRUSS_LENGTH / 2 - 3
  const fixtureCount = Math.floor((fixtureEnd - fixtureStart) / FIXTURE_SPACING)
  for (let i = 0; i < fixtureCount; i++) {
    const z = fixtureStart + i * FIXTURE_SPACING
    const x = (i % 2 === 0 ? 1 : -1) * (BEAM_X * 0.55)

    const fixture = new Group()
    fixture.position.set(x, TRUSS_Y - 0.38, z)
    const tilt = 0.2 + Math.random() * 0.1
    const pan = (Math.random() - 0.5) * 0.35
    fixture.rotation.set(tilt, pan, 0)

    const stem = new Mesh(stemGeo, metalMat)
    stem.position.set(0, 0.24, 0)
    fixture.add(stem)

    const yoke = new Mesh(yokeGeo, metalMat)
    yoke.position.set(0, 0.06, 0)
    yoke.rotation.x = Math.PI / 2
    fixture.add(yoke)

    const body = new Mesh(bodyGeo, housingMat)
    body.rotation.x = Math.PI / 2
    fixture.add(body)

    const back = new Mesh(backGeo, housingMat)
    back.position.set(0, 0, -0.11)
    back.rotation.x = Math.PI / 2
    fixture.add(back)

    const lens = new Mesh(lensGeo, lensMat)
    lens.position.set(0, 0, 0.111)
    fixture.add(lens)

    const bezel = new Mesh(bezelGeo, metalMat)
    bezel.position.set(0, 0, 0.111)
    fixture.add(bezel)

    source.add(fixture)
  }

  const group = new Group()
  for (const mesh of mergeGroupByMaterial(source)) group.add(mesh)
  return group
}

function makeStarSprite(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 28)
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
    grad.addColorStop(0.25, 'rgba(255, 250, 235, 0.7)')
    grad.addColorStop(0.55, 'rgba(255, 250, 235, 0.18)')
    grad.addColorStop(1, 'rgba(255, 250, 235, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, 64)
    ctx.globalCompositeOperation = 'lighter'
    const spikes = ctx.createLinearGradient(0, 32, 64, 32)
    spikes.addColorStop(0, 'rgba(255, 250, 235, 0)')
    spikes.addColorStop(0.5, 'rgba(255, 250, 235, 0.85)')
    spikes.addColorStop(1, 'rgba(255, 250, 235, 0)')
    ctx.strokeStyle = spikes
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(4, 32)
    ctx.lineTo(60, 32)
    ctx.stroke()
    const spikesV = ctx.createLinearGradient(32, 0, 32, 64)
    spikesV.addColorStop(0, 'rgba(255, 250, 235, 0)')
    spikesV.addColorStop(0.5, 'rgba(255, 250, 235, 0.85)')
    spikesV.addColorStop(1, 'rgba(255, 250, 235, 0)')
    ctx.strokeStyle = spikesV
    ctx.beginPath()
    ctx.moveTo(32, 4)
    ctx.lineTo(32, 60)
    ctx.stroke()
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

interface StarState {
  x: number
  y: number
  z: number
  base: number
  phase: number
  speed: number
  hue: number
}

function makeStars(): {
  mesh: InstancedMesh
  update: (delta: number, time: number) => void
} {
  const COUNT = 140
  const tex = makeStarSprite()
  const geo = new PlaneGeometry(0.32, 0.32)
  const mat = new MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
    toneMapped: false,
  })
  const mesh = new InstancedMesh(geo, mat, COUNT)
  mesh.frustumCulled = false
  mesh.renderOrder = 2

  const stars: StarState[] = []
  for (let i = 0; i < COUNT; i++) {
    const arcR = 6 + Math.random() * 22
    const arcAngle = (Math.random() - 0.5) * Math.PI
    const x = Math.sin(arcAngle) * arcR
    const y = 2.5 + Math.random() * 10
    const z = 5 - Math.random() * 110
    stars.push({
      x,
      y,
      z,
      base: 0.35 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.1,
      hue: Math.random(),
    })
  }

  const matrix = new Matrix4()
  const pos = new Vector3()
  const quat = new Quaternion()
  const scaleVec = new Vector3(1, 1, 1)
  const color = new Color()

  for (let i = 0; i < COUNT; i++) {
    const s = stars[i]
    pos.set(s.x, s.y, s.z)
    const scl = 0.6 + Math.random() * 1.2
    scaleVec.set(scl, scl, scl)
    matrix.compose(pos, quat, scaleVec)
    mesh.setMatrixAt(i, matrix)
    mesh.setColorAt(i, color.setRGB(0, 0, 0))
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

  const update = (_delta: number, time: number): void => {
    for (let i = 0; i < COUNT; i++) {
      const s = stars[i]
      const pulse = 0.5 + 0.5 * Math.sin(time * s.speed + s.phase)
      const intensity = s.base * Math.pow(pulse, 3)
      const warm = s.hue > 0.65 ? 0.06 : 0
      const cool = s.hue < 0.35 ? 0.08 : 0
      color.setRGB(
        intensity * (1 - cool * 0.5),
        intensity * (1 - cool * 0.2 - warm * 0.15),
        intensity * (1 + cool - warm * 0.4),
      )
      mesh.setColorAt(i, color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  return { mesh, update }
}

const SPOT_CONE_VS =  `
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vLocalPos = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`
const SPOT_CONE_FS =  `
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  uniform float uHeight;
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColor;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0.0,0.0,0.0)), hash(i + vec3(1.0,0.0,0.0)), f.x),
          mix(hash(i + vec3(0.0,1.0,0.0)), hash(i + vec3(1.0,1.0,0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0,0.0,1.0)), hash(i + vec3(1.0,0.0,1.0)), f.x),
          mix(hash(i + vec3(0.0,1.0,1.0)), hash(i + vec3(1.0,1.0,1.0)), f.x), f.y),
      f.z);
  }

  void main() {

    float heightT = (vLocalPos.y + uHeight * 0.5) / uHeight;

    float d = (heightT - 0.6) / 0.6;
    float heightBell = max(0.0, 1.0 - d * d);

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 worldNormal = normalize(vWorldNormal);

    float facing = clamp(abs(dot(viewDir, worldNormal)), 0.0, 1.0);
    float fresnel = pow(max(1.0 - facing, 0.0), 1.4);

    float n = vnoise(vWorldPos * 0.9 + vec3(0.0, -uTime * 0.25, 0.0));
    n = 0.7 + n * 0.4;

    float alpha = clamp(heightBell * fresnel * n * uIntensity, 0.0, 1.0);
    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`

function makeSpotCone(): { mesh: Mesh; update: (time: number) => void } {
  const height = 11
  const baseRadius = height * Math.tan(Math.PI / 12) * 1.15
  const geo = new ConeGeometry(baseRadius, height, 48, 24, true)

  const material = new ShaderMaterial({
    vertexShader: SPOT_CONE_VS,
    fragmentShader: SPOT_CONE_FS,
    uniforms: {
      uHeight: { value: height },
      uTime: { value: 0 },
      uIntensity: { value: 0.22 },
      uColor: { value: new Color(0xfff7e8) },
    },
    transparent: true,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendEquation: AddEquation,
    depthWrite: false,
    side: DoubleSide,
  })

  const mesh = new Mesh(geo, material)
  return {
    mesh,
    update: (time: number) => {
      material.uniforms.uTime.value = time
    },
  }
}

export interface RunwayLights {
  ambient: AmbientLight
  keySpot: SpotLight
  mainSpot: SpotLight
  fillLight: SpotLight
  rimLeft: SpotLight
  rimRight: SpotLight
  backLight: SpotLight
  flashLight: PointLight

  finaleWash: RectAreaLight
}

export interface RunwayContext {
  scene: Scene
  renderer: WebGLRenderer
  lights: RunwayLights
  flashWall: FlashWall
  updateAudience: (time: number) => void
  updatePitFlashes: (delta: number) => void
  updateParticles: (delta: number, time: number) => void
  updateSpotCone: (time: number) => void
  updateStars: (delta: number, time: number) => void
  /**
   * Échelle de dégradation quand la résolution adaptative est déjà au plancher et que la
   * frame reste au-dessus de 24 ms : 1 = miroirs du sol coupés, 2 = shadow map 1024,
   * 3 = public masqué. Cumulatif, jamais remonté dans la session (pas d'oscillation).
   */
  degrade: (stage: number) => void
  dispose: () => void
}

const SWAY_AMPLITUDE = 0.07
const BREATH_AMPLITUDE = 0.025
const SWAY_FREQ = 0.45
const BREATH_FREQ = 0.65

const AUDIENCE_VERTEX_INJECT = `#include <begin_vertex>
  // Billboard cylindrique : chaque spectateur fait toujours face à la caméra autour de Y,
  // on ne le voit jamais de profil (une carte vue de côté devient un ovale).
  vec3 audienceCenter = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  vec3 audienceToCam = cameraPosition - audienceCenter;
  // À moins de ~2 m la carte s'efface : jamais de grand aplat sombre qui traverse le cadre.
  vAudienceFade = smoothstep(0.9, 2.3, length(audienceToCam));
  float audienceYaw = atan(audienceToCam.x, audienceToCam.z);
  float audienceSway = sin(uTime * ${SWAY_FREQ.toFixed(4)} + aPhase) * ${SWAY_AMPLITUDE.toFixed(4)};
  // Léger balancement du buste (le haut bouge plus que le bas).
  transformed.x += audienceSway * 1.6 * max(transformed.y + 0.65, 0.0);
  float audienceCos = cos(audienceYaw);
  float audienceSin = sin(audienceYaw);
  transformed.xz = vec2(
    transformed.x * audienceCos + transformed.z * audienceSin,
    -transformed.x * audienceSin + transformed.z * audienceCos
  );
  transformed.y += sin(uTime * ${BREATH_FREQ.toFixed(4)} + aPhase * 0.73) * ${BREATH_AMPLITUDE.toFixed(4)};`

interface AudienceSeat {
  x: number
  y: number
  z: number
  scale: number
  side: -1 | 1
  phase: number
}

export interface FlashWall {
  flash: (x: number, z: number) => void
  update: (dt: number, storm: number, stormZ: number, camera: Camera) => void
  setEnabled: (enabled: boolean) => void
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Un flash d'appareil photo n'est pas un carré blanc : cœur brûlé, halo doux et deux
 * traînées (anamorphique horizontale, verticale plus courte), peints une fois sur un
 * canvas et posés en additif. La couleur HDR de l'instance fait le reste dans le bloom.
 */
function makeFlashTexture(): CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  ctx.globalCompositeOperation = 'lighter'

  const halo = ctx.createRadialGradient(c, c, 0, c, c, c)
  halo.addColorStop(0, 'rgba(255,255,255,1)')
  halo.addColorStop(0.05, 'rgba(255,252,242,0.96)')
  halo.addColorStop(0.14, 'rgba(255,240,212,0.42)')
  halo.addColorStop(0.38, 'rgba(255,226,190,0.1)')
  halo.addColorStop(1, 'rgba(255,220,180,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, size, size)

  const streak = (len: number, thick: number, alpha: number, vertical: boolean): void => {
    ctx.save()
    ctx.translate(c, c)
    if (vertical) ctx.rotate(Math.PI / 2)
    const g = ctx.createLinearGradient(-len, 0, len, 0)
    g.addColorStop(0, 'rgba(255,240,220,0)')
    g.addColorStop(0.5, `rgba(255,250,240,${alpha})`)
    g.addColorStop(1, 'rgba(255,240,220,0)')
    ctx.fillStyle = g
    if ('filter' in ctx) ctx.filter = 'blur(1.2px)'
    ctx.fillRect(-len, -thick / 2, len * 2, thick)
    ctx.restore()
  }
  streak(c * 0.98, 3, 0.75, false)
  streak(c * 0.98, 10, 0.18, false)
  streak(c * 0.55, 2.5, 0.55, true)

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearMipmapLinearFilter
  tex.magFilter = LinearFilter
  tex.generateMipmaps = true
  return tex
}

/** Écran de téléphone : rectangle arrondi au dégradé doux, sans arête dure vue de loin. */
function makePhoneTexture(): CanvasTexture {
  const w = 64
  const h = 112
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(w / 2, h * 0.45, 4, w / 2, h / 2, h * 0.62)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.75)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  roundedRectPath(ctx, 6, 6, w - 12, h - 12, 10)
  ctx.fill()
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function makeFlashWall(seats: AudienceSeat[]): { group: Group; wall: FlashWall } {
  const group = new Group()
  const FLASH_COUNT = 32
  const PHONE_COUNT = 48
  // Plein feu 40 ms puis décroissance rapide : la rémanence d'un tube flash.
  const FLASH_LIFE = 0.18
  const flashGeo = new PlaneGeometry(0.62, 0.62)
  const flashMat = new MeshBasicMaterial({
    map: makeFlashTexture(),
    color: 0xffffff,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: DoubleSide,
  })
  const flashes = new InstancedMesh(flashGeo, flashMat, FLASH_COUNT)
  flashes.frustumCulled = false
  const phoneGeo = new PlaneGeometry(0.055, 0.1)
  const phoneMat = new MeshBasicMaterial({
    map: makePhoneTexture(),
    color: 0xffffff,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: DoubleSide,
  })
  const phones = new InstancedMesh(phoneGeo, phoneMat, PHONE_COUNT)
  phones.frustumCulled = false
  group.add(flashes)
  group.add(phones)

  const matrix = new Matrix4()
  const pos = new Vector3()
  const quat = new Quaternion()
  const euler = new Euler()
  const scale = new Vector3(1, 1, 1)
  const black = new Color(0, 0, 0)
  const flashColor = new Color(9, 9, 8.2)
  const tmpColor = new Color()
  const rollQuat = new Quaternion()
  const zAxis = new Vector3(0, 0, 1)
  const phoneColor = new Color(0.22, 0.28, 0.42)
  const billboardQuat = new Quaternion()
  let hasBillboard = false
  let phoneReorientTimer = 0

  const placeAt = (
    mesh: InstancedMesh,
    index: number,
    seat: AudienceSeat,
    y: number,
    size = 1,
    roll = 0,
  ): void => {
    pos.set(seat.x, y, seat.z)
    if (hasBillboard) {
      quat.copy(billboardQuat)
      if (roll !== 0) quat.multiply(rollQuat.setFromAxisAngle(zAxis, roll))
    } else {
      euler.set(0, seat.side === -1 ? Math.PI / 2 : -Math.PI / 2, 0)
      quat.setFromEuler(euler)
    }
    scale.setScalar(size)
    matrix.compose(pos, quat, scale)
    mesh.setMatrixAt(index, matrix)
  }

  for (let i = 0; i < FLASH_COUNT; i++) {
    placeAt(flashes, i, seats[i % seats.length], -5)
    flashes.setColorAt(i, black)
  }
  flashes.instanceMatrix.needsUpdate = true
  if (flashes.instanceColor) flashes.instanceColor.needsUpdate = true

  const phoneSeats: AudienceSeat[] = []
  const phoneState: { on: boolean; next: number }[] = []
  for (let i = 0; i < PHONE_COUNT; i++) {
    const seat = seats[Math.floor(Math.random() * seats.length)]
    phoneSeats.push(seat)
    placeAt(phones, i, seat, seat.y + 0.32)
    const on = Math.random() < 0.35
    phones.setColorAt(i, on ? phoneColor : black)
    phoneState.push({ on, next: 1 + Math.random() * 6 })
  }
  phones.instanceMatrix.needsUpdate = true
  if (phones.instanceColor) phones.instanceColor.needsUpdate = true

  const flashTimers = new Float32Array(FLASH_COUNT)
  let nextSlot = 0
  let stormAcc = 0
  let enabled = true

  const flashNear = (x: number, z: number): void => {
    const side: -1 | 1 = x < 0 ? -1 : 1
    const candidates = seats.filter(
      (s) => s.side === side && Math.abs(s.z - z) < 2.2 && Math.abs(s.x) < 6.5,
    )
    if (candidates.length === 0) return
    const seat = candidates[Math.floor(Math.random() * candidates.length)]
    const slot = nextSlot
    nextSlot = (nextSlot + 1) % FLASH_COUNT
    // Taille et inclinaison des traînées variables : deux flashs ne se ressemblent jamais.
    placeAt(flashes, slot, seat, seat.y + 0.3, 0.7 + Math.random() * 0.6, (Math.random() - 0.5) * 0.5)
    flashes.setColorAt(slot, flashColor)
    flashTimers[slot] = FLASH_LIFE
    flashes.instanceMatrix.needsUpdate = true
    if (flashes.instanceColor) flashes.instanceColor.needsUpdate = true
  }

  const flash = (x: number, z: number): void => {
    if (!enabled) return
    flashNear(x, z)
  }

  const update = (dt: number, storm: number, stormZ: number, camera: Camera): void => {
    billboardQuat.copy(camera.quaternion)
    hasBillboard = true
    phoneReorientTimer -= dt
    if (phoneReorientTimer <= 0) {
      phoneReorientTimer = 0.4
      for (let i = 0; i < PHONE_COUNT; i++) {
        placeAt(phones, i, phoneSeats[i], phoneSeats[i].y + 0.32)
      }
      phones.instanceMatrix.needsUpdate = true
    }
    let dirty = false
    for (let i = 0; i < FLASH_COUNT; i++) {
      if (flashTimers[i] > 0) {
        flashTimers[i] -= dt
        if (flashTimers[i] <= 0) {
          flashes.setColorAt(i, black)
        } else {
          const k = Math.min(1, flashTimers[i] / (FLASH_LIFE - 0.04))
          tmpColor.copy(flashColor).multiplyScalar(k * k)
          flashes.setColorAt(i, tmpColor)
        }
        dirty = true
      }
    }
    if (dirty && flashes.instanceColor) flashes.instanceColor.needsUpdate = true

    if (!enabled) return

    let phonesDirty = false
    for (let i = 0; i < PHONE_COUNT; i++) {
      const st = phoneState[i]
      st.next -= dt
      if (st.next <= 0) {
        st.on = !st.on
        st.next = st.on ? 3 + Math.random() * 9 : 2 + Math.random() * 8
        phones.setColorAt(i, st.on ? phoneColor : black)
        phonesDirty = true
      }
    }
    if (phonesDirty && phones.instanceColor) phones.instanceColor.needsUpdate = true

    if (storm > 0.001) {
      stormAcc += dt * 14 * storm
      while (stormAcc >= 1) {
        stormAcc -= 1
        const side = Math.random() < 0.5 ? -1 : 1
        flashNear(side * 3, stormZ + (Math.random() - 0.5) * 14)
      }
    }
  }

  const setEnabled = (value: boolean): void => {
    enabled = value
    if (!value) {
      for (let i = 0; i < PHONE_COUNT; i++) phones.setColorAt(i, black)
      if (phones.instanceColor) phones.instanceColor.needsUpdate = true
    }
  }

  return { group, wall: { flash, update, setEnabled } }
}

const REFLECTOR_VERTEX = `
  uniform mat4 textureMatrix;
  varying vec4 vUv;
  varying vec3 vWorldPos;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    vUv = textureMatrix * vec4(position, 1.0);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
    #include <logdepthbuf_vertex>
  }
`

const REFLECTOR_FRAGMENT = `
  uniform vec3 color;
  uniform sampler2D tDiffuse;
  uniform float uReflectivity;
  uniform float uGrazingBoost;
  varying vec4 vUv;
  varying vec3 vWorldPos;

  #include <logdepthbuf_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    vec4 base = texture2DProj(tDiffuse, vUv);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float facing = clamp(viewDir.y, 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 3.0);
    float strength = uReflectivity * mix(1.0, uGrazingBoost, fresnel);
    gl_FragColor = vec4(base.rgb * color * strength, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function tuneReflector(reflector: Reflector): void {
  const mat = reflector.material as ShaderMaterial
  mat.vertexShader = REFLECTOR_VERTEX
  mat.fragmentShader = REFLECTOR_FRAGMENT
  mat.uniforms.uReflectivity = { value: 0.28 }
  mat.uniforms.uGrazingBoost = { value: 2.5 }
  mat.transparent = true
  mat.blending = CustomBlending
  mat.blendSrc = OneFactor
  mat.blendDst = OneFactor
  mat.blendEquation = AddEquation
  mat.depthWrite = false
  mat.needsUpdate = true
}

export function createRunway(container: HTMLElement, quality: Quality): RunwayContext {
  const scene = new Scene()

  scene.fog = new FogExp2(0x0a0a0a, 0.065)
  scene.background = new Color(0x0a0a0a)

  const renderer = new WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setPixelRatio(quality.pixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.outputColorSpace = SRGBColorSpace
  container.appendChild(renderer.domElement)

  const RUNWAY_LENGTH = 120
  const RUNWAY_CENTER_Z = -45
  const CROSSBAR_Z = -30
  const CROSSBAR_WIDTH = 10
  const CROSSBAR_DEPTH = 4
  const runwayGeo = new PlaneGeometry(4, RUNWAY_LENGTH)
  const crossbarGeo = new PlaneGeometry(CROSSBAR_WIDTH, CROSSBAR_DEPTH)

  const floorMat = new MeshPhysicalMaterial({
    color: 0x121212,
    roughness: 0.8,
    metalness: 0,
    specularIntensity: 0.15,
    envMapIntensity: 0.2,
  })
  const placeFloor = (mesh: Mesh, y: number, z: number): void => {
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(0, y, z)
    mesh.updateMatrix()
    mesh.matrixAutoUpdate = false
    mesh.layers.set(REFLECTOR_LAYER)
    scene.add(mesh)
  }

  const runwayLit = new Mesh(runwayGeo, floorMat)
  runwayLit.receiveShadow = true
  placeFloor(runwayLit, 0.001, RUNWAY_CENTER_Z)
  const crossbarLit = new Mesh(crossbarGeo, floorMat)
  crossbarLit.receiveShadow = true
  placeFloor(crossbarLit, 0.002, CROSSBAR_Z)

  const reflectorMeshes: Reflector[] = []
  if (quality.useReflector && feature('reflector')) {
    const reflectorW = Math.min(quality.reflectorSize, Math.round(window.innerWidth * quality.pixelRatio))
    const reflectorH = Math.min(quality.reflectorSize, Math.round(window.innerHeight * quality.pixelRatio))
    const runwayMirror = new Reflector(runwayGeo, {
      textureWidth: reflectorW,
      textureHeight: reflectorH,
      color: new Color(0xffffff),
    })
    tuneReflector(runwayMirror)
    placeFloor(runwayMirror, 0.004, RUNWAY_CENTER_Z)
    reflectorMeshes.push(runwayMirror)
    const crossbarMirror = new Reflector(crossbarGeo, {
      textureWidth: reflectorW,
      textureHeight: reflectorH,
      color: new Color(0xffffff),
    })
    tuneReflector(crossbarMirror)
    placeFloor(crossbarMirror, 0.005, CROSSBAR_Z)
    reflectorMeshes.push(crossbarMirror)
  }

  const edgeMat = new MeshBasicMaterial({ color: 0x1a1a1a })
  for (const x of [-1.8, 1.8]) {
    const edge = new Mesh(new PlaneGeometry(0.01, RUNWAY_LENGTH), edgeMat)
    edge.rotation.x = -Math.PI / 2
    edge.position.set(x, 0.001, RUNWAY_CENTER_Z)
    edge.updateMatrix()
    edge.matrixAutoUpdate = false
    scene.add(edge)
  }
  for (const z of [CROSSBAR_Z - CROSSBAR_DEPTH / 2, CROSSBAR_Z + CROSSBAR_DEPTH / 2]) {
    const edge = new Mesh(new PlaneGeometry(CROSSBAR_WIDTH, 0.01), edgeMat)
    edge.rotation.x = -Math.PI / 2
    edge.position.set(0, 0.003, z)
    edge.updateMatrix()
    edge.matrixAutoUpdate = false
    scene.add(edge)
  }

  const ambient = new AmbientLight(0x232a36, 0.95)
  scene.add(ambient)

  const fillLight = new SpotLight(0xfff2dc, 18, 30, Math.PI / 4, 0.9, 1.3)
  fillLight.position.set(3, 4, -4)
  fillLight.target.position.set(0, 1.2, -4)
  scene.add(fillLight)
  scene.add(fillLight.target)

  const keySpot = new SpotLight(0xfff5e6, 100, 30, Math.PI / 9, 0.45, 1.4)
  keySpot.position.set(-3, 6.5, 0)
  keySpot.target.position.set(0, 1, -4)
  keySpot.castShadow = true
  keySpot.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize)
  keySpot.shadow.bias = -0.0005
  keySpot.shadow.normalBias = 0.02
  keySpot.shadow.radius = 2
  keySpot.shadow.camera.near = 0.5
  keySpot.shadow.camera.far = 22
  scene.add(keySpot)
  scene.add(keySpot.target)

  const mainSpot = new SpotLight(
    0xfff5e6,
    60,
    32,
    Math.PI / 11,
    0.2,
    1.4,
  )
  mainSpot.position.set(0, 11, -10)
  mainSpot.castShadow = false
  scene.add(mainSpot)
  scene.add(mainSpot.target)

  const rimLeft = new SpotLight(0xb8cde0, 90, 28, Math.PI / 4, 0.75, 1.8)
  rimLeft.position.set(-5, 4.5, -22)
  rimLeft.target.position.set(0, 1.5, -10)
  scene.add(rimLeft)
  scene.add(rimLeft.target)

  const rimRight = new SpotLight(0xb8cde0, 90, 28, Math.PI / 4, 0.75, 1.8)
  rimRight.position.set(5, 4.5, -22)
  rimRight.target.position.set(0, 1.5, -10)
  scene.add(rimRight)
  scene.add(rimRight.target)

  const backLight = new SpotLight(0xdfe8ff, 70, 30, Math.PI / 6, 0.6, 1.5)
  backLight.position.set(0, 5.5, -10)
  backLight.target.position.set(0, 1.5, -4)
  scene.add(backLight)
  scene.add(backLight.target)

  const flashLight = new PointLight(0xffffff, 0, 15, 2)
  flashLight.position.set(2, 2, -2)
  scene.add(flashLight)

  RectAreaLightUniformsLib.init()
  const finaleWash = new RectAreaLight(0xfff4e0, 0, CROSSBAR_WIDTH, CROSSBAR_DEPTH)
  finaleWash.position.set(0, 8, CROSSBAR_Z)
  finaleWash.lookAt(0, 0, CROSSBAR_Z)
  scene.add(finaleWash)

  const backdrop = makeBackdrop()
  backdrop.position.set(0, 3, RUNWAY_CENTER_Z - RUNWAY_LENGTH / 2 - 2)
  backdrop.traverse((obj) => {
    obj.updateMatrix()
    obj.matrixAutoUpdate = false
  })
  scene.add(backdrop)

  const pitPosition = new Vector3(0, 0, RUNWAY_CENTER_Z - RUNWAY_LENGTH / 2 + 4)
  const { group: photographerPit, flares: pitFlares, flashes: pitFlashes } =
    makePhotographerPit()
  photographerPit.position.copy(pitPosition)
  photographerPit.updateMatrix()
  photographerPit.matrixAutoUpdate = false
  setLayerDeep(photographerPit, COSMETIC_LAYER)
  if (feature('pitflashes')) scene.add(photographerPit)

  const { points: particles, update: updateParticles } = makeParticles(
    quality.particleCount,
  )
  if (feature('particles')) scene.add(particles)

  const { mesh: spotCone, update: updateSpotConeShader } = makeSpotCone()
  spotCone.layers.set(COSMETIC_LAYER)
  if (feature('cone')) scene.add(spotCone)

  if (feature('truss')) scene.add(makeOverheadTruss())

  const { mesh: starsMesh, update: updateStars } = makeStars()
  if (feature('stars')) scene.add(starsMesh)

  const silhouetteTextures = [0, 1, 2].map(makeSilhouetteTexture)
  const silhouetteGeo = new PlaneGeometry(0.95, 1.3)

  const AUDIENCE_START_Z = 5
  const AUDIENCE_END_Z = -95
  const AUDIENCE_LENGTH = AUDIENCE_START_Z - AUDIENCE_END_Z

  const allRows = [
    { xOffset: 2.3, scale: 1.0, spacing: 0.85 },
    { xOffset: 3.0, scale: 0.97, spacing: 0.9 },
    { xOffset: 3.8, scale: 0.94, spacing: 0.95 },
    { xOffset: 4.6, scale: 0.91, spacing: 1.0 },
    { xOffset: 5.5, scale: 0.88, spacing: 1.05 },
    { xOffset: 6.5, scale: 0.85, spacing: 1.1 },
    { xOffset: 7.5, scale: 0.82, spacing: 1.15 },
    { xOffset: 8.6, scale: 0.79, spacing: 1.2 },
    { xOffset: 9.8, scale: 0.76, spacing: 1.25 },
    { xOffset: 11.1, scale: 0.73, spacing: 1.3 },
    { xOffset: 12.5, scale: 0.7, spacing: 1.35 },
    { xOffset: 14.0, scale: 0.67, spacing: 1.4 },
  ]
  const rows = allRows.slice(0, quality.audienceRowCount)
  const AUDIENCE_Y = 0.85

  type Seat = AudienceSeat
  const seatsPerVariant: [Seat[], Seat[], Seat[]] = [[], [], []]

  let seatCounter = 0
  for (const side of [-1, 1] as const) {
    for (const row of rows) {
      const count = Math.floor(AUDIENCE_LENGTH / row.spacing)
      for (let i = 0; i < count; i++) {
        const scaleVar = row.scale * (0.9 + Math.random() * 0.25)
        seatsPerVariant[seatCounter % 3].push({
          x: side * (row.xOffset + Math.random() * 0.25),
          y: AUDIENCE_Y * scaleVar,
          z:
            AUDIENCE_START_Z -
            (i + 0.5) * row.spacing +
            (Math.random() - 0.5) * 0.4,
          scale: scaleVar,
          side,
          phase: Math.random() * Math.PI * 2,
        })
        seatCounter++
      }
    }
  }

  const audienceTime = { value: 0 }
  const audienceMeshes: InstancedMesh[] = []
  const tmpMatrix = new Matrix4()
  const tmpPos = new Vector3()
  const tmpQuat = new Quaternion()
  const tmpScale = new Vector3()

  for (let v = 0; v < silhouetteTextures.length; v++) {
    const seats = seatsPerVariant[v]
    if (seats.length === 0) continue
    const mat = new MeshBasicMaterial({
      map: silhouetteTextures[v],
      transparent: true,
      alphaTest: 0.02,
      opacity: 0.74,
      color: 0xffffff,
      depthWrite: false,
      side: DoubleSide,
      fog: true,
    })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = audienceTime
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aPhase;\nuniform float uTime;\nvarying float vAudienceFade;',
        )
        .replace('#include <begin_vertex>', AUDIENCE_VERTEX_INJECT)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAudienceFade;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.a *= vAudienceFade;')
    }
    mat.customProgramCacheKey = () => 'audience-sway'

    const geo = silhouetteGeo.clone()
    const phases = new Float32Array(seats.length)
    const instanced = new InstancedMesh(geo, mat, seats.length)
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i]
      tmpPos.set(s.x, s.y, s.z)
      // Pas de rotation ici : le shader oriente la carte vers la caméra. Échelle uniforme
      // pour que cette rotation ne déforme pas la silhouette.
      tmpQuat.identity()
      tmpScale.setScalar(s.scale)
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale)
      instanced.setMatrixAt(i, tmpMatrix)
      phases[i] = s.phase
    }
    geo.setAttribute('aPhase', new InstancedBufferAttribute(phases, 1))
    instanced.instanceMatrix.needsUpdate = true
    instanced.frustumCulled = false
    instanced.layers.set(COSMETIC_LAYER)
    if (feature('audience')) scene.add(instanced)
    audienceMeshes.push(instanced)
  }

  const { group: flashWallGroup, wall: flashWall } = makeFlashWall(
    seatsPerVariant.flat(),
  )
  setLayerDeep(flashWallGroup, COSMETIC_LAYER)
  scene.add(flashWallGroup)

  const FLASH_COLOR = new Color(3.2, 3.0, 2.7)
  const BLACK = new Color(0, 0, 0)

  const updatePitFlashes = (delta: number): void => {
    let dirty = false
    for (const f of pitFlashes) {
      if (f.active > 0) {
        f.active -= delta
        if (f.active <= 0) {
          pitFlares.setColorAt(f.index, BLACK)
          dirty = true
        }
      } else {
        f.nextFlash -= delta
        if (f.nextFlash <= 0) {
          pitFlares.setColorAt(f.index, FLASH_COLOR)
          dirty = true
          f.active = 0.08
          f.nextFlash = 0.25 + Math.random() * 1.5
        }
      }
    }
    if (dirty && pitFlares.instanceColor) pitFlares.instanceColor.needsUpdate = true
  }

  const coneMid = new Vector3()
  const coneDir = new Vector3()
  const coneQuat = new Quaternion()
  const CONE_UP = new Vector3(0, 1, 0)

  const updateSpotCone = (time: number): void => {
    const spot = mainSpot
    const target = mainSpot.target.position
    coneMid.addVectors(spot.position, target).multiplyScalar(0.5)
    spotCone.position.copy(coneMid)
    coneDir.subVectors(spot.position, target).normalize()
    coneQuat.setFromUnitVectors(CONE_UP, coneDir)
    spotCone.setRotationFromQuaternion(coneQuat)
    updateSpotConeShader(time)
  }

  const updateAudience = (time: number): void => {
    audienceTime.value = time
  }

  const dispose = () => {
    scene.traverse((obj) => {
      const mesh = obj as Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else if (mat) mat.dispose()
    })
    renderer.dispose()
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement)
    }
  }

  const degrade = (stage: number): void => {
    if (stage >= 1) for (const m of reflectorMeshes) m.visible = false
    if (stage >= 2 && keySpot.shadow.mapSize.x > 1024) {
      keySpot.shadow.mapSize.set(1024, 1024)
      keySpot.shadow.map?.dispose()
      keySpot.shadow.map = null
    }
    if (stage >= 3) for (const m of audienceMeshes) m.visible = false
  }

  return {
    scene,
    renderer,
    degrade,
    lights: {
      ambient,
      keySpot,
      mainSpot,
      fillLight,
      rimLeft,
      rimRight,
      backLight,
      flashLight,
      finaleWash,
    },
    flashWall,
    updateAudience,
    updatePitFlashes,
    updateParticles,
    updateSpotCone,
    updateStars,
    dispose,
  }
}
