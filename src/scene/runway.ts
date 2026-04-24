import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DoubleSide,
  Euler,
  FogExp2,
  Group,
  HalfFloatType,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
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
  Vector3,
  WebGLRenderer,
} from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import type { Quality } from '../quality'
import { feature } from '../features'

function makeSilhouetteTexture(variant: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return new CanvasTexture(canvas)

  const cx = 64
  const headR = 15 + variant
  const headY = 36 + variant * 2
  const shoulderY = headY + headR + 4
  const shoulderW = 38 + variant * 3

  ctx.filter = 'blur(3px)'
  ctx.fillStyle = '#000'

  ctx.beginPath()
  ctx.arc(cx, headY, headR, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(cx - shoulderW, canvas.height)
  ctx.quadraticCurveTo(cx - shoulderW * 0.85, shoulderY + 6, cx - 8, shoulderY)
  ctx.lineTo(cx + 8, shoulderY)
  ctx.quadraticCurveTo(cx + shoulderW * 0.85, shoulderY + 6, cx + shoulderW, canvas.height)
  ctx.closePath()
  ctx.fill()

  ctx.filter = 'none'
  const fade = ctx.createLinearGradient(0, canvas.height * 0.65, 0, canvas.height)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = fade
  ctx.fillRect(0, canvas.height * 0.65, canvas.width, canvas.height * 0.35)
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
  light: PointLight
  nextFlash: number
  active: number
}
function makePhotographerPit(): { group: Group; flashes: PitFlash[] } {
  const group = new Group()
  const silhouetteMat = new MeshStandardMaterial({ color: 0x040404, roughness: 0.95 })
  const cameraBodyMat = new MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.4,
    metalness: 0.6,
  })
  const flashes: PitFlash[] = []

  const count = 14
  for (let i = 0; i < count; i++) {

    const px = (Math.random() - 0.5) * 5
    const pz = (Math.random() - 0.5) * 3
    const body = new Mesh(new BoxGeometry(0.35, 0.95, 0.35), silhouetteMat)
    body.position.set(px, 0.48, pz)
    group.add(body)

    const cam = new Mesh(new BoxGeometry(0.18, 0.12, 0.12), cameraBodyMat)
    cam.position.set(px + (Math.random() - 0.5) * 0.15, 1.0, pz + 0.1)
    group.add(cam)

    const light = new PointLight(0xffffff, 0, 14, 2)
    light.position.copy(cam.position)
    group.add(light)

    flashes.push({
      light,
      nextFlash: Math.random() * 2,
      active: 0,
    })
  }

  return { group, flashes }
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

    float fresnel = 1.0 - abs(dot(viewDir, vWorldNormal));
    fresnel = pow(fresnel, 1.4);

    float n = vnoise(vWorldPos * 0.9 + vec3(0.0, -uTime * 0.25, 0.0));
    n = 0.7 + n * 0.4;

    float alpha = heightBell * fresnel * n * uIntensity;
    gl_FragColor = vec4(uColor, alpha);
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
    blending: AdditiveBlending,
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
  mainSpot: SpotLight
  rimLeft: SpotLight
  rimRight: SpotLight
  backLight: PointLight
  flashLight: PointLight

  finaleWash: RectAreaLight
}

export interface RunwayContext {
  scene: Scene
  renderer: WebGLRenderer
  lights: RunwayLights
  updateAudience: (time: number) => void
  updatePitFlashes: (delta: number) => void
  updateParticles: (delta: number, time: number) => void
  updateSpotCone: (time: number) => void
  dispose: () => void
}

export function createRunway(container: HTMLElement, quality: Quality): RunwayContext {
  const scene = new Scene()

  scene.fog = new FogExp2(0x0a0a0a, 0.065)
  scene.background = new Color(0x0a0a0a)

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(quality.pixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  renderer.outputColorSpace = SRGBColorSpace
  container.appendChild(renderer.domElement)

  void HalfFloatType

  const RUNWAY_LENGTH = 120
  const RUNWAY_CENTER_Z = -45
  const CROSSBAR_Z = -30
  const CROSSBAR_WIDTH = 10
  const CROSSBAR_DEPTH = 4
  const runwayGeo = new PlaneGeometry(4, RUNWAY_LENGTH)
  const crossbarGeo = new PlaneGeometry(CROSSBAR_WIDTH, CROSSBAR_DEPTH)
  let runway: Mesh
  let crossbar: Mesh
  if (quality.useReflector && feature('reflector')) {
    runway = new Reflector(runwayGeo, {
      textureWidth: Math.min(1024, window.innerWidth * quality.pixelRatio),
      textureHeight: Math.min(1024, window.innerHeight * quality.pixelRatio),
      color: new Color(0x0a0a0a),
    })
    crossbar = new Reflector(crossbarGeo, {
      textureWidth: Math.min(1024, window.innerWidth * quality.pixelRatio),
      textureHeight: Math.min(1024, window.innerHeight * quality.pixelRatio),
      color: new Color(0x0a0a0a),
    })
  } else {
    const floorMat = new MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.2,
      metalness: 0.7,
    })
    runway = new Mesh(runwayGeo, floorMat)
    runway.receiveShadow = true
    crossbar = new Mesh(crossbarGeo, floorMat)
    crossbar.receiveShadow = true
  }
  runway.rotation.x = -Math.PI / 2
  runway.position.set(0, 0.001, RUNWAY_CENTER_Z)
  scene.add(runway)
  crossbar.rotation.x = -Math.PI / 2

  crossbar.position.set(0, 0.002, CROSSBAR_Z)
  scene.add(crossbar)

  const edgeMat = new MeshBasicMaterial({ color: 0x1a1a1a })
  for (const x of [-1.8, 1.8]) {
    const edge = new Mesh(new PlaneGeometry(0.01, RUNWAY_LENGTH), edgeMat)
    edge.rotation.x = -Math.PI / 2
    edge.position.set(x, 0.001, RUNWAY_CENTER_Z)
    scene.add(edge)
  }
  for (const z of [CROSSBAR_Z - CROSSBAR_DEPTH / 2, CROSSBAR_Z + CROSSBAR_DEPTH / 2]) {
    const edge = new Mesh(new PlaneGeometry(CROSSBAR_WIDTH, 0.01), edgeMat)
    edge.rotation.x = -Math.PI / 2
    edge.position.set(0, 0.003, z)
    scene.add(edge)
  }

  const ambient = new AmbientLight(0x1a1e24, 0.55)
  scene.add(ambient)

  const mainSpot = new SpotLight(
    0xfff5e6,
    220,
    28,
    Math.PI / 12,
    0.15,
    1.5,
  )
  mainSpot.position.set(0, 11, -10)
  mainSpot.castShadow = true
  mainSpot.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize)
  mainSpot.shadow.bias = -0.0005
  mainSpot.shadow.normalBias = 0.02
  mainSpot.shadow.radius = 2
  mainSpot.shadow.camera.near = 0.5
  mainSpot.shadow.camera.far = 22
  scene.add(mainSpot)
  scene.add(mainSpot.target)

  const rimLeft = new SpotLight(0xb8cde0, 90, 25, Math.PI / 4, 0.75, 1.8)
  rimLeft.position.set(-5, 4.5, -22)
  rimLeft.target.position.set(0, 1.5, -10)
  scene.add(rimLeft)
  scene.add(rimLeft.target)

  const rimRight = new SpotLight(0xb8cde0, 90, 25, Math.PI / 4, 0.75, 1.8)
  rimRight.position.set(5, 4.5, -22)
  rimRight.target.position.set(0, 1.5, -10)
  scene.add(rimRight)
  scene.add(rimRight.target)

  const backLight = new PointLight(0x2a2f3a, 8, 40, 1.8)
  backLight.position.set(0, 4, -35)
  scene.add(backLight)

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
  scene.add(backdrop)

  const pitPosition = new Vector3(0, 0, RUNWAY_CENTER_Z - RUNWAY_LENGTH / 2 + 4)
  const { group: photographerPit, flashes: pitFlashes } = makePhotographerPit()
  photographerPit.position.copy(pitPosition)
  if (feature('pitflashes')) scene.add(photographerPit)

  const { points: particles, update: updateParticles } = makeParticles(
    quality.particleCount,
  )
  if (feature('particles')) scene.add(particles)

  const { mesh: spotCone, update: updateSpotConeShader } = makeSpotCone()
  if (feature('cone')) scene.add(spotCone)

  const silhouetteTextures = [0, 1, 2].map(makeSilhouetteTexture)
  const silhouetteGeo = new PlaneGeometry(1.0, 1.3)

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

  interface Seat {
    x: number
    y: number
    z: number
    scale: number
    side: -1 | 1
    phase: number
  }
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

  const audienceLayers: Array<{ mesh: InstancedMesh; seats: Seat[] }> = []
  const tmpMatrix = new Matrix4()
  const tmpPos = new Vector3()
  const tmpQuat = new Quaternion()
  const tmpEuler = new Euler()
  const tmpScale = new Vector3()

  for (let v = 0; v < silhouetteTextures.length; v++) {
    const seats = seatsPerVariant[v]
    if (seats.length === 0) continue
    const mat = new MeshBasicMaterial({
      map: silhouetteTextures[v],
      transparent: true,
      alphaTest: 0.02,
      opacity: 0.55,
      color: 0x0d0d10,
      depthWrite: false,
      side: DoubleSide,
      fog: true,
    })
    const instanced = new InstancedMesh(silhouetteGeo, mat, seats.length)
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i]
      tmpPos.set(s.x, s.y, s.z)
      tmpEuler.set(0, s.side === -1 ? Math.PI / 2 : -Math.PI / 2, 0)
      tmpQuat.setFromEuler(tmpEuler)
      tmpScale.set(s.scale, s.scale, 1)
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale)
      instanced.setMatrixAt(i, tmpMatrix)
    }
    instanced.instanceMatrix.needsUpdate = true
    if (feature('audience')) scene.add(instanced)
    audienceLayers.push({ mesh: instanced, seats })
  }

  const SWAY_AMPLITUDE = 0.07
  const BREATH_AMPLITUDE = 0.025
  const SWAY_FREQ = 0.45
  const BREATH_FREQ = 0.65

  const updatePitFlashes = (delta: number): void => {
    for (const f of pitFlashes) {
      if (f.active > 0) {
        f.active -= delta
        if (f.active <= 0) f.light.intensity = 0
      } else {
        f.nextFlash -= delta
        if (f.nextFlash <= 0) {
          f.light.intensity = 6
          f.active = 0.08
          f.nextFlash = 0.25 + Math.random() * 1.5
        }
      }
    }
  }

  const updateSpotCone = (time: number): void => {

    const spot = mainSpot
    const target = mainSpot.target.position
    const mid = new Vector3()
      .addVectors(spot.position, target)
      .multiplyScalar(0.5)
    spotCone.position.copy(mid)
    const dir = new Vector3().subVectors(target, spot.position).normalize()
    const up = new Vector3(0, 1, 0)
    const quat = new Quaternion().setFromUnitVectors(up, dir.clone().negate())
    spotCone.setRotationFromQuaternion(quat)
    updateSpotConeShader(time)
  }

  const updateAudience = (time: number): void => {
    for (const layer of audienceLayers) {
      for (let i = 0; i < layer.seats.length; i++) {
        const s = layer.seats[i]
        const tSway = time * SWAY_FREQ + s.phase
        const tBreath = time * BREATH_FREQ + s.phase * 0.73
        const baseRotY = s.side === -1 ? Math.PI / 2 : -Math.PI / 2
        tmpPos.set(s.x, s.y + Math.sin(tBreath) * BREATH_AMPLITUDE, s.z)
        tmpEuler.set(0, baseRotY + Math.sin(tSway) * SWAY_AMPLITUDE, 0)
        tmpQuat.setFromEuler(tmpEuler)
        tmpScale.set(s.scale, s.scale, 1)
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale)
        layer.mesh.setMatrixAt(i, tmpMatrix)
      }
      layer.mesh.instanceMatrix.needsUpdate = true
    }
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

  return {
    scene,
    renderer,
    lights: { ambient, mainSpot, rimLeft, rimRight, backLight, flashLight, finaleWash },
    updateAudience,
    updatePitFlashes,
    updateParticles,
    updateSpotCone,
    dispose,
  }
}
