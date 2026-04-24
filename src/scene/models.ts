import {
  AnimationMixer,
  Box3,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three'
import type { Material } from 'three'
import type { AnimationClip, Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { Look, OutfitDefinition } from '../data/looks'
import { feature } from '../features'

export interface MannequinParts {
  upperBody: Group
  head: Group
  shoulders: Mesh
  leftArm: Group
  rightArm: Group
  hips: Mesh
  leftLeg: Group
  rightLeg: Group
  leftKnee: Group
  rightKnee: Group
}

export interface MannequinEntry {
  group: Group
  startZ: number
  look: Look
  parts: MannequinParts | null
  mixer: AnimationMixer | null
  walkAction: import('three').AnimationAction | null
  walkLoopStart: number
  walkLoopDuration: number
  isGltf: boolean
}

function createProceduralMannequin(outfit: OutfitDefinition): {
  group: Group
  parts: MannequinParts
} {
  const group = new Group()

  const skinMat = new MeshStandardMaterial(outfit.skin)
  const mainMat = new MeshStandardMaterial(outfit.main)
  const accentMat = new MeshStandardMaterial(outfit.accent)
  const hairMat = new MeshStandardMaterial(outfit.hair)
  const shoeMat = new MeshStandardMaterial(outfit.shoe)

  const upperBody = new Group()
  upperBody.position.y = 1.05
  group.add(upperBody)

  const headGroup = new Group()
  headGroup.position.y = 0.82
  upperBody.add(headGroup)

  const skull = new Mesh(new SphereGeometry(0.1, 32, 32), skinMat)
  skull.scale.set(1, 1.1, 1)
  skull.castShadow = true
  headGroup.add(skull)

  const jaw = new Mesh(new SphereGeometry(0.07, 16, 16), skinMat)
  jaw.position.set(0, -0.06, 0.02)
  jaw.scale.set(0.85, 0.7, 0.8)
  headGroup.add(jaw)

  const hairBack = new Mesh(new SphereGeometry(0.105, 32, 32), hairMat)
  hairBack.position.set(0, 0.02, -0.02)
  hairBack.scale.set(1.02, 1.05, 1.1)
  headGroup.add(hairBack)

  const bun = new Mesh(new SphereGeometry(0.05, 16, 16), hairMat)
  bun.position.set(0, 0.0, -0.13)
  headGroup.add(bun)

  const neck = new Mesh(new CylinderGeometry(0.035, 0.04, 0.18, 16), skinMat)
  neck.position.y = 0.7
  neck.castShadow = true
  upperBody.add(neck)

  const shoulderWidth = outfit.oversized ? 0.58 : 0.48
  const shoulders = new Mesh(new BoxGeometry(shoulderWidth, 0.04, 0.16), mainMat)
  shoulders.position.y = 0.59
  shoulders.castShadow = true
  upperBody.add(shoulders)

  for (const side of [-1, 1] as const) {
    const pad = new Mesh(
      new SphereGeometry(0.06, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      mainMat,
    )
    pad.position.set(side * shoulderWidth * 0.48, 0.6, 0)
    pad.rotation.z = side * -0.2
    pad.castShadow = true
    upperBody.add(pad)
  }

  const torsoTop = outfit.oversized ? 0.2 : 0.17
  const torsoBot = outfit.fitted ? 0.12 : 0.14
  const torso = new Mesh(new CylinderGeometry(torsoTop, torsoBot, 0.5, 16), mainMat)
  torso.position.y = 0.32
  torso.castShadow = true
  upperBody.add(torso)

  if (outfit.hasCollar) {
    const collar = new Mesh(
      new CylinderGeometry(0.1, 0.12, 0.14, 16, 1, true),
      mainMat,
    )
    collar.position.y = 0.62
    collar.castShadow = true
    upperBody.add(collar)

    for (const side of [-1, 1] as const) {
      const flap = new Mesh(new BoxGeometry(0.08, 0.13, 0.02), mainMat)
      flap.position.set(side * 0.07, 0.62, 0.08)
      flap.rotation.y = side * 0.3
      flap.rotation.z = side * -0.15
      upperBody.add(flap)
    }
  }

  if (outfit.hasCapelet) {
    const capelet = new Mesh(new CylinderGeometry(0.15, 0.5, 0.5, 24, 4), mainMat)
    capelet.position.y = 0.4
    capelet.castShadow = true
    upperBody.add(capelet)
  }

  const garment = new Mesh(
    new CylinderGeometry(
      outfit.coatTopRadius,
      outfit.coatBottomRadius,
      outfit.coatLength,
      20,
      8,
    ),
    mainMat,
  )
  garment.position.y = 0.06 - outfit.coatLength * 0.3
  garment.castShadow = true
  upperBody.add(garment)

  if (outfit.hasBelt && outfit.beltColor) {
    const beltMat = new MeshStandardMaterial(outfit.beltColor)
    const beltRadius = (outfit.fitted ? 0.13 : 0.16) + 0.005
    const belt = new Mesh(
      new CylinderGeometry(beltRadius, beltRadius, 0.03, 20, 1, true),
      beltMat,
    )
    belt.position.y = 0.06
    belt.castShadow = true
    upperBody.add(belt)

    const buckle = new Mesh(new BoxGeometry(0.025, 0.035, 0.01), beltMat)
    buckle.position.set(0, 0.06, beltRadius + 0.005)
    upperBody.add(buckle)
  }

  if (outfit.widePants) {
    for (const x of [-0.065, 0.065]) {
      const pantLeg = new Mesh(new CylinderGeometry(0.065, 0.1, 0.95, 12), accentMat)
      pantLeg.position.set(x, -0.4, 0)
      pantLeg.castShadow = true
      upperBody.add(pantLeg)
    }
  }

  const armOffset = shoulderWidth * 0.48

  const leftArmPivot = new Group()
  leftArmPivot.position.set(-armOffset, 0.55, 0)
  upperBody.add(leftArmPivot)

  const lUpperArm = new Mesh(new CylinderGeometry(0.035, 0.03, 0.32, 12), mainMat)
  lUpperArm.position.y = -0.16
  lUpperArm.castShadow = true
  leftArmPivot.add(lUpperArm)

  const lForearm = new Mesh(
    new CylinderGeometry(0.025, 0.02, 0.28, 12),
    outfit.oversized ? mainMat : skinMat,
  )
  lForearm.position.y = -0.38
  leftArmPivot.add(lForearm)

  const lHand = new Mesh(new SphereGeometry(0.02, 8, 8), skinMat)
  lHand.position.y = -0.52
  lHand.scale.set(1, 1.3, 0.6)
  leftArmPivot.add(lHand)

  const rightArmPivot = new Group()
  rightArmPivot.position.set(armOffset, 0.55, 0)
  upperBody.add(rightArmPivot)

  const rUpperArm = new Mesh(new CylinderGeometry(0.035, 0.03, 0.32, 12), mainMat)
  rUpperArm.position.y = -0.16
  rUpperArm.castShadow = true
  rightArmPivot.add(rUpperArm)

  const rForearm = new Mesh(
    new CylinderGeometry(0.025, 0.02, 0.28, 12),
    outfit.oversized ? mainMat : skinMat,
  )
  rForearm.position.y = -0.38
  rightArmPivot.add(rForearm)

  const rHand = new Mesh(new SphereGeometry(0.02, 8, 8), skinMat)
  rHand.position.y = -0.52
  rHand.scale.set(1, 1.3, 0.6)
  rightArmPivot.add(rHand)

  const hips = new Mesh(new CylinderGeometry(0.14, 0.13, 0.1, 16), accentMat)
  hips.position.y = 1.0
  group.add(hips)

  const leftLegPivot = new Group()
  leftLegPivot.position.set(-0.06, 0.95, 0)
  group.add(leftLegPivot)

  const lThigh = new Mesh(new CylinderGeometry(0.05, 0.04, 0.48, 12), accentMat)
  lThigh.position.y = -0.24
  lThigh.castShadow = true
  leftLegPivot.add(lThigh)

  const leftKneePivot = new Group()
  leftKneePivot.position.set(0, -0.48, 0)
  leftLegPivot.add(leftKneePivot)

  const lShin = new Mesh(new CylinderGeometry(0.038, 0.03, 0.46, 12), accentMat)
  lShin.position.y = -0.23
  lShin.castShadow = true
  leftKneePivot.add(lShin)

  const lShoeBase = new Mesh(new BoxGeometry(0.05, 0.02, 0.16), shoeMat)
  lShoeBase.position.set(0, -0.46, 0.03)
  lShoeBase.castShadow = true
  leftKneePivot.add(lShoeBase)

  const lHeel = new Mesh(new CylinderGeometry(0.008, 0.01, 0.08, 8), shoeMat)
  lHeel.position.set(0, -0.42, -0.04)
  lHeel.rotation.x = 0.15
  leftKneePivot.add(lHeel)

  const lToe = new Mesh(new CylinderGeometry(0.001, 0.025, 0.06, 8), shoeMat)
  lToe.position.set(0, -0.46, 0.12)
  lToe.rotation.x = Math.PI / 2
  leftKneePivot.add(lToe)

  const rightLegPivot = new Group()
  rightLegPivot.position.set(0.06, 0.95, 0)
  group.add(rightLegPivot)

  const rThigh = new Mesh(new CylinderGeometry(0.05, 0.04, 0.48, 12), accentMat)
  rThigh.position.y = -0.24
  rThigh.castShadow = true
  rightLegPivot.add(rThigh)

  const rightKneePivot = new Group()
  rightKneePivot.position.set(0, -0.48, 0)
  rightLegPivot.add(rightKneePivot)

  const rShin = new Mesh(new CylinderGeometry(0.038, 0.03, 0.46, 12), accentMat)
  rShin.position.y = -0.23
  rShin.castShadow = true
  rightKneePivot.add(rShin)

  const rShoeBase = new Mesh(new BoxGeometry(0.05, 0.02, 0.16), shoeMat)
  rShoeBase.position.set(0, -0.46, 0.03)
  rShoeBase.castShadow = true
  rightKneePivot.add(rShoeBase)

  const rHeel = new Mesh(new CylinderGeometry(0.008, 0.01, 0.08, 8), shoeMat)
  rHeel.position.set(0, -0.42, -0.04)
  rHeel.rotation.x = 0.15
  rightKneePivot.add(rHeel)

  const rToe = new Mesh(new CylinderGeometry(0.001, 0.025, 0.06, 8), shoeMat)
  rToe.position.set(0, -0.46, 0.12)
  rToe.rotation.x = Math.PI / 2
  rightKneePivot.add(rToe)

  const parts: MannequinParts = {
    upperBody,
    head: headGroup,
    shoulders,
    leftArm: leftArmPivot,
    rightArm: rightArmPivot,
    hips,
    leftLeg: leftLegPivot,
    rightLeg: rightLegPivot,
    leftKnee: leftKneePivot,
    rightKnee: rightKneePivot,
  }

  return { group, parts }
}

// Silk shimmer injection — adds a view-dependent golden sheen on top of the
// baked PBR. As the camera orbits, the jacquard picks up a moving highlight,
// reading as real woven silk catching the spot. Applied to the wonsam's
// brocart/satin materials.
const SILK_SHEEN_COLOR = new Color(0xffd28c)
function injectSilkShimmer(mat: MeshStandardMaterial): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSheenColor = { value: SILK_SHEEN_COLOR }
    shader.uniforms.uSheenIntensity = { value: 0.55 }

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vSheenWorldPos;
      varying vec3 vSheenWorldNormal;`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vSheenWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vSheenWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vSheenWorldPos;
      varying vec3 vSheenWorldNormal;
      uniform vec3 uSheenColor;
      uniform float uSheenIntensity;`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 sheenView = normalize(cameraPosition - vSheenWorldPos);
      float sheenF = 1.0 - abs(dot(sheenView, vSheenWorldNormal));
      sheenF = pow(sheenF, 3.0);
      diffuseColor.rgb += uSheenColor * sheenF * uSheenIntensity;`,
    )
  }
}

// Native iridescence via Three's KHR_materials_iridescence support — promotes
// a MeshStandardMaterial to MeshPhysicalMaterial in place and sets the
// thin-film parameters. Avoids the onBeforeCompile path that broke the
// renderer on transparent + skinned lace materials.
function applyNativeIridescence(mesh: Mesh, mat: Material): void {
  let physical: MeshPhysicalMaterial
  if (mat instanceof MeshPhysicalMaterial) {
    physical = mat
  } else if (mat instanceof MeshStandardMaterial) {
    physical = new MeshPhysicalMaterial()
    physical.copy(mat)
    // Swap on the mesh — the old reference might be shared with other meshes
    // that we don't want to upgrade, so we only replace this mesh's pointer.
    if (Array.isArray(mesh.material)) {
      const arr = mesh.material as Material[]
      const idx = arr.indexOf(mat)
      if (idx >= 0) arr[idx] = physical
    } else {
      mesh.material = physical
    }
  } else {
    return
  }
  physical.iridescence = 0.5 // overall strength
  physical.iridescenceIOR = 1.3 // soap-film-like refractive index
  physical.iridescenceThicknessRange = [100, 380] // nm — bigger range = wider color sweep
  physical.needsUpdate = true
}

// Tune PBR materials coming out of CLO3D so they actually look like the fabric
// type they represent. CLO bakes reasonable baseColor / normal / metallicRoughness
// maps, but their envMapIntensity + roughness are often conservative, leaving
// satin looking like paper. We adjust by matching the material name to a
// category (naming convention is stable across CLO exports).
function tuneCloMaterials(root: Object3D): void {
  const categories: Array<{
    test: RegExp
    envMapIntensity?: number
    roughnessMul?: number
    metalness?: number
    clearcoat?: number
  }> = [
    // Patent leather / plastic — mirror-like
    { test: /plastic|patent|PU|cuir.verni/i, envMapIntensity: 2.0, roughnessMul: 0.5, metalness: 0 },
    // Satin (CLO's default shiny fabric shader)
    { test: /satin|duchesse/i, envMapIntensity: 1.6, roughnessMul: 0.8, metalness: 0 },
    // Silk / brocart (Korean garment names fall here too)
    { test: /silk|soie|brocart|치마|원삼|색동|흉배|한삼|띠/i, envMapIntensity: 1.2, roughnessMul: 0.9, metalness: 0 },
    // Lace — light, airy, some micro-reflection
    { test: /lace|dentelle|organza|tulle/i, envMapIntensity: 1.0, roughnessMul: 1.0, metalness: 0 },
    // Wool / cotton / tweed — matte
    { test: /wool|laine|cotton|coton|tweed|mohair|cashmere|cachemire/i, envMapIntensity: 0.4, metalness: 0 },
    // Skin — subtle subsurface feel (no real SSS, but low reflection + clearcoat helps)
    { test: /skin|face|body|arm|leg|mara/i, envMapIntensity: 0.5, clearcoat: 0.2 },
    // Metal / hardware (belts, buckles)
    { test: /metal|gold|silver|buckle/i, envMapIntensity: 1.5, metalness: 1 },
  ]

  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (!mat) continue
      const pbr = mat as import('three').MeshStandardMaterial & {
        clearcoat?: number
        transmission?: number
        thickness?: number
      }
      if (pbr.envMapIntensity === undefined) continue

      // CLO exports some fabrics (lace, organza, snow motifs) with KHR_materials
      // _transmission. Three.js renders transmission via a separate pass that
      // we don't set up, so transmission > 0 ends up making the mesh render as
      // invisible. Force to 0; we fake "sheer" via opacity/alphaMap instead.
      if (pbr.transmission !== undefined && pbr.transmission > 0) {
        pbr.transmission = 0
        pbr.thickness = 0
        pbr.needsUpdate = true
      }

      const name = pbr.name ?? ''
      const rule = categories.find((c) => c.test.test(name))
      if (!rule) continue

      if (rule.envMapIntensity !== undefined) pbr.envMapIntensity = rule.envMapIntensity
      if (rule.roughnessMul !== undefined) {
        pbr.roughness = Math.min(Math.max(pbr.roughness * rule.roughnessMul, 0.02), 1)
      }
      if (rule.metalness !== undefined) pbr.metalness = rule.metalness
      if (rule.clearcoat !== undefined && 'clearcoat' in pbr) {
        pbr.clearcoat = rule.clearcoat
      }

      // Silk shimmer via onBeforeCompile (works on the wonsam, opt-in).
      if (
        feature('shimmer', false) &&
        /silk|soie|brocart|satin|duchesse|치마|원삼|색동|흉배|한삼|띠/i.test(name)
      ) {
        injectSilkShimmer(pbr as MeshStandardMaterial)
      }
      // Iridescence via Three's native MeshPhysicalMaterial.iridescence.
      if (feature('iridescence') && /lace|dentelle|organza|tulle/i.test(name)) {
        applyNativeIridescence(mesh, pbr as Material)
      }

      pbr.needsUpdate = true
    }
  })
}

function fitToHeight(root: Object3D, targetHeight = 1.8): void {
  const box = new Box3().setFromObject(root)
  const size = box.getSize(new Vector3())
  if (size.y > 0) {
    const scale = targetHeight / size.y
    root.scale.multiplyScalar(scale)
    const newBox = new Box3().setFromObject(root)
    // Center on the X/Z axes (catches CLO drape exports that simulated
    // asymmetrically and would otherwise sit off the runway centerline) and
    // ground on Y.
    const center = newBox.getCenter(new Vector3())
    root.position.x -= center.x
    root.position.z -= center.z
    root.position.y -= newBox.min.y
  }
}

async function tryLoadGltf(
  loader: GLTFLoader,
  url: string,
): Promise<{
  scene: Group
  mixer: AnimationMixer | null
  walkAction: import('three').AnimationAction | null
  walkLoopStart: number
  walkLoopDuration: number
} | null> {
  try {
    const head = await fetch(url, { method: 'HEAD' })
    if (!head.ok) return null
  } catch {
    return null
  }

  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene

        root.traverse((obj) => {
          const mesh = obj as Mesh
          if (!mesh.isMesh) return
          mesh.castShadow = true
          mesh.receiveShadow = true

          if (feature('doubleside')) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            for (const mat of mats) {
              if (!mat) continue
              const std = mat as MeshStandardMaterial
              if (std.transparent || (std.alphaTest ?? 0) > 0) {
                std.side = DoubleSide
                std.needsUpdate = true
              }
            }
          }
        })

        tuneCloMaterials(root)

        let mixer: AnimationMixer | null = null
        let walkAction: import('three').AnimationAction | null = null
        let walkLoopStart = 0
        let walkLoopDuration = 1

        if (gltf.animations && gltf.animations.length > 0) {
          // Prefer a clip explicitly named "walk"; otherwise pick the longest
          // non-"Transition" clip — in CLO exports the actual walk cycle is
          // several seconds long while "Transition" is a 1s pose-to-pose.
          const named = gltf.animations.find((a) => /walk/i.test(a.name))
          const candidates = gltf.animations
            .filter((a) => a.tracks.length > 0 && !/^transition$/i.test(a.name))
            .sort((a, b) => b.duration - a.duration)
          const walkClip: AnimationClip | undefined =
            named ??
            candidates[0] ??
            gltf.animations.find((a) => a.tracks.length > 0) ??
            gltf.animations[0]

          if (walkClip && walkClip.tracks.length > 0) {
            mixer = new AnimationMixer(root)
            walkAction = mixer.clipAction(walkClip)
            walkAction.play()
            walkAction.paused = true

            // CLO clips begin with a T-pose → first-frame transition. Skip the
            // first second so the rest position and the scrolling playhead
            // both land inside the looping walk portion.
            const skip = /t-?pose/i.test(walkClip.name) ? 1.0 : 0
            walkLoopStart = Math.min(skip, Math.max(walkClip.duration - 0.5, 0))
            walkLoopDuration = Math.max(walkClip.duration - walkLoopStart, 0.1)
          }
        }

        resolve({ scene: root, mixer, walkAction, walkLoopStart, walkLoopDuration })
      },
      undefined,
      () => resolve(null),
    )
  })
}

export async function buildMannequins(
  scene: Scene,
  looks: Look[],
  modelsBaseUrl: string,
): Promise<MannequinEntry[]> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const entries: MannequinEntry[] = []

  for (let i = 0; i < looks.length; i++) {
    const look = looks[i]
    const startZ = -(15 + i * 20)
    let group: Group
    let parts: MannequinParts | null = null
    let mixer: AnimationMixer | null = null
    let walkAction: import('three').AnimationAction | null = null
    let walkLoopStart = 0
    let walkLoopDuration = 1
    let isGltf = false

    const gltf = look.model
      ? await tryLoadGltf(loader, `${modelsBaseUrl}/${look.model}`)
      : null

    if (gltf) {
      group = gltf.scene
      mixer = gltf.mixer
      walkAction = gltf.walkAction
      walkLoopStart = gltf.walkLoopStart
      walkLoopDuration = gltf.walkLoopDuration
      isGltf = true

      const targetHeight = look.modelHeight ?? 1.8
      fitToHeight(group, targetHeight)

      if (look.hideFloatingProps) {
        const FLOAT_HORIZ_THRESHOLD = 1.0 // meters off body axis
        const FLOAT_Y_MIN = 1.2 // only cull props above torso height
        const tmpBox = new Box3()
        const tmpCenter = new Vector3()
        group.traverse((obj) => {
          const mesh = obj as Mesh
          if (!mesh.isMesh) return
          tmpBox.setFromObject(mesh)
          tmpBox.getCenter(tmpCenter)
          // Group is at world (0,0,0) at this point; center is effectively
          // model-local. Hide anything drifting above the torso AND far from
          // the body's vertical axis.
          const horizDist = Math.sqrt(
            tmpCenter.x * tmpCenter.x + tmpCenter.z * tmpCenter.z,
          )
          if (horizDist > FLOAT_HORIZ_THRESHOLD && tmpCenter.y > FLOAT_Y_MIN) {
            mesh.visible = false
          }
        })
      }
    } else {
      const proc = createProceduralMannequin(look.outfit)
      group = proc.group
      parts = proc.parts
    }

    group.position.set(0, 0, startZ)
    group.visible = false
    scene.add(group)

    entries.push({
      group,
      startZ,
      look,
      parts,
      mixer,
      walkAction,
      walkLoopStart,
      walkLoopDuration,
      isGltf,
    })
  }

  return entries
}

export function animateProceduralWalk(parts: MannequinParts, phase: number): void {
  const t = phase

  const stride = 0.3
  const armSwing = 0.18
  const kneeBend = 0.35
  const hipSway = 0.03
  const torsoBob = 0.006
  const torsoTwist = 0.04

  parts.leftLeg.rotation.x = Math.sin(t) * stride
  parts.rightLeg.rotation.x = Math.sin(t + Math.PI) * stride

  parts.leftLeg.position.x = -0.06 + Math.sin(t) * 0.015
  parts.rightLeg.position.x = 0.06 - Math.sin(t) * 0.015

  parts.leftKnee.rotation.x = Math.max(0, Math.sin(t - 0.5)) * kneeBend
  parts.rightKnee.rotation.x = Math.max(0, Math.sin(t + Math.PI - 0.5)) * kneeBend

  parts.leftArm.rotation.x = Math.sin(t + Math.PI) * armSwing
  parts.rightArm.rotation.x = Math.sin(t) * armSwing
  parts.leftArm.rotation.z = 0.08
  parts.rightArm.rotation.z = -0.08

  parts.upperBody.position.y = 1.05 + Math.abs(Math.sin(t * 2)) * torsoBob
  parts.upperBody.position.x = Math.sin(t) * hipSway
  parts.upperBody.rotation.y = Math.sin(t) * torsoTwist
  parts.upperBody.rotation.z = Math.sin(t) * -0.015

  parts.head.rotation.y = Math.sin(t * 0.3) * 0.015
  parts.head.rotation.x = -0.05

  parts.shoulders.rotation.y = Math.sin(t) * -torsoTwist * 0.6
}

export function disposeMannequins(scene: Scene, entries: MannequinEntry[]): void {
  for (const entry of entries) {
    entry.group.traverse((obj) => {
      const mesh = obj as Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else if (mat) mat.dispose()
    })
    scene.remove(entry.group)
  }
}
