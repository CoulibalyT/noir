import { Color, HalfFloatType, RGBADepthPacking, Uniform, Vector2 } from 'three'
import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import {
  BloomEffect,
  BlendFunction,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  DepthPass,
  EdgeDetectionMode,
  Effect,
  EffectAttribute,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  VignetteEffect,
} from 'postprocessing'
import { AnamorphicPass } from './anamorphic'

const DISSOLVE_FRAGMENT =  `
  uniform float threshold;
  uniform vec3 edgeColor;

  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  float vnoise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
      mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (threshold <= 0.001) {
      outputColor = inputColor;
      return;
    }

    float n = vnoise2(uv * 90.0) * 0.7 + vnoise2(uv * 14.0) * 0.3;
    float t = threshold;

    float dissolved = step(n, t);
    float edge = smoothstep(t, t + 0.04, n) * (1.0 - smoothstep(t + 0.04, t + 0.1, n));
    vec3 color = mix(inputColor.rgb, vec3(0.0), dissolved);
    color += edgeColor * edge * 1.4;
    outputColor = vec4(color, inputColor.a);
  }
`

export class DissolveEffect extends Effect {
  constructor() {
    super('DissolveEffect', DISSOLVE_FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<number | Color>>([
        ['threshold', new Uniform(0)],
        ['edgeColor', new Uniform(new Color(0xc9b99a))],
      ]),
    })
  }

  get threshold(): Uniform<number> {
    return this.uniforms.get('threshold') as Uniform<number>
  }
}

const COLORGRADE_FRAGMENT =  `
  uniform float uContrast;
  uniform float uSaturation;
  uniform vec3 uLift;
  uniform vec3 uGain;
  uniform float uTemperature;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;

    vec3 temp = vec3(1.0) + vec3(0.04, 0.0, -0.05) * uTemperature;
    c *= temp;

    c = c * uGain + uLift;

    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(luma), c, uSaturation);

    c = mix(vec3(0.5), c, uContrast);
    outputColor = vec4(c, inputColor.a);
  }
`

export class ColorGradeEffect extends Effect {
  constructor() {
    super('ColorGradeEffect', COLORGRADE_FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<number | Color>>([
        ['uContrast', new Uniform(1.08)],
        ['uSaturation', new Uniform(0.88)],

        ['uLift', new Uniform(new Color(0.003, 0.01, 0.022))],
        ['uGain', new Uniform(new Color(1.03, 1.0, 0.95))],
        ['uTemperature', new Uniform(0.2)],
      ]),
    })
  }
}

const RADIAL_FRAGMENT = `
  uniform float uAmount;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uAmount < 0.001) {
      outputColor = inputColor;
      return;
    }
    vec2 dir = uv - vec2(0.5);
    vec4 sum = inputColor;
    float wsum = 1.0;
    for (int i = 1; i <= 6; i++) {
      float t = float(i) / 6.0;
      float w = 1.0 - t * 0.6;
      sum += texture2D(inputBuffer, uv - dir * t * uAmount * 0.12) * w;
      wsum += w;
    }
    outputColor = sum / wsum;
  }
`

export class RadialBlurEffect extends Effect {
  constructor() {
    super('RadialBlurEffect', RADIAL_FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform<number>>([['uAmount', new Uniform(0)]]),
    })
  }

  get amount(): Uniform<number> {
    return this.uniforms.get('uAmount') as Uniform<number>
  }
}

class ColorSmaaEffect extends SMAAEffect {
  constructor() {
    super({
      preset: SMAAPreset.HIGH,
      edgeDetectionMode: EdgeDetectionMode.COLOR,
    })
    this.setAttributes(this.getAttributes() & ~EffectAttribute.DEPTH)
  }
}

export interface PostFXOptions {
  bloom?: boolean
  chromatic?: boolean
  vignette?: boolean
  noise?: boolean
  smaa?: boolean
  anamorphic?: boolean
  colorGrade?: boolean
  dof?: boolean
  radial?: boolean
}

export interface PostFX {
  dissolve: DissolveEffect
  composer: EffectComposer
  render: (delta: number) => void
  setSize: (w: number, h: number) => void
  setDof: (amount: number, focusDistance: number) => void
  setSpeed: (amount: number) => void
  effects: {
    bloom: BloomEffect
    chromatic: ChromaticAberrationEffect
    vignette: VignetteEffect
    noise: NoiseEffect
    smaa: SMAAEffect | null
    anamorphic: AnamorphicPass | null
    colorGrade: ColorGradeEffect
    dof: DepthOfFieldEffect | null
    radial: RadialBlurEffect | null
  }
  dispose: () => void
}

export function createPostFX(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  options: PostFXOptions = {},
): PostFX {
  const enableBloom = options.bloom ?? true
  const enableChromatic = options.chromatic ?? true
  const enableVignette = options.vignette ?? true
  const enableNoise = options.noise ?? true
  const enableSmaa = options.smaa ?? true
  const enableAnamorphic = options.anamorphic ?? true
  const enableColorGrade = options.colorGrade ?? true
  const enableDof = options.dof ?? true
  const enableRadial = options.radial ?? true
  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType })
  composer.addPass(new RenderPass(scene, camera))

  let depthPass: DepthPass | null = null
  let dof: DepthOfFieldEffect | null = null
  let dofPass: EffectPass | null = null
  if (enableDof) {
    depthPass = new DepthPass(scene, camera, { resolutionScale: 0.5 })
    depthPass.enabled = false
    composer.addPass(depthPass)
    dof = new DepthOfFieldEffect(camera, {
      worldFocusDistance: 1.2,
      worldFocusRange: 0.45,
      bokehScale: 2.5,
      resolutionScale: 0.5,
    })
    dofPass = new EffectPass(camera, dof)
    dofPass.setDepthTexture(depthPass.texture, RGBADepthPacking)
    dofPass.needsDepthTexture = false
    dofPass.enabled = false
  }

  const smaa = enableSmaa ? new ColorSmaaEffect() : null
  if (smaa) composer.addPass(new EffectPass(camera, smaa))
  if (dofPass) composer.addPass(dofPass)

  let radial: RadialBlurEffect | null = null
  let radialPass: EffectPass | null = null
  if (enableRadial) {
    radial = new RadialBlurEffect()
    radialPass = new EffectPass(camera, radial)
    radialPass.enabled = false
    composer.addPass(radialPass)
  }

  const bloom = new BloomEffect({
    intensity: 0.45,
    luminanceThreshold: 0.82,
    luminanceSmoothing: 0.22,
    mipmapBlur: true,
    radius: 0.7,
    levels: 7,
  })

  const chromatic = new ChromaticAberrationEffect({
    offset: new Vector2(0.0007, 0.0007),
    radialModulation: true,
    modulationOffset: 0.2,
  })

  const vignette = new VignetteEffect({
    offset: 0.45,
    darkness: 0.55,
  })

  const noise = new NoiseEffect({
    blendFunction: BlendFunction.OVERLAY,
    premultiply: true,
  })
  noise.blendMode.opacity.value = 0.06

  const colorGrade = new ColorGradeEffect()
  const dissolve = new DissolveEffect()

  const anamorphic = enableBloom && enableAnamorphic ? new AnamorphicPass() : null
  if (anamorphic) composer.addPass(anamorphic)

  const chainEffects = [
    enableBloom ? bloom : null,
    enableChromatic ? chromatic : null,
    enableColorGrade ? colorGrade : null,
    enableVignette ? vignette : null,
    enableNoise ? noise : null,
    dissolve,
  ].filter(Boolean) as Effect[]
  composer.addPass(new EffectPass(camera, ...chainEffects))

  const setSize = (w: number, h: number): void => {
    composer.setSize(w, h)
  }

  const render = (delta: number): void => {
    composer.render(delta)
  }

  const setDof = (amount: number, focusDistance: number): void => {
    if (!dof || !dofPass || !depthPass) return
    const on = amount > 0.02
    dofPass.enabled = on
    depthPass.enabled = on
    if (!on) return
    dof.cocMaterial.worldFocusDistance = Math.max(0.2, focusDistance)
    dof.cocMaterial.worldFocusRange = 0.6 + (1 - amount) * 0.6
    dof.bokehScale = 0.5 + amount * 1.5
  }

  const setSpeed = (amount: number): void => {
    if (!radial || !radialPass) return
    const on = amount > 0.01
    radialPass.enabled = on
    radial.amount.value = on ? Math.min(1, amount) : 0
  }

  const dispose = (): void => {
    composer.dispose()
  }

  return {
    composer,
    render,
    setSize,
    setDof,
    setSpeed,
    effects: { bloom, chromatic, vignette, noise, smaa, anamorphic, colorGrade, dof, radial },
    dissolve,
    dispose,
  }
}
