import { Color, HalfFloatType, Uniform, Vector2 } from 'three'
import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import {
  BloomEffect,
  BlendFunction,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
} from 'postprocessing'

// Custom Effect — screen-space noise dissolve with accent-colored edge glow.
// threshold 0 = fully visible, 1 = fully dissolved to black. GSAP tweens this
// during look transitions for a signature "fade" that's noise-based instead
// of a flat exposure ramp.
const DISSOLVE_FRAGMENT = /* glsl */ `
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
    // Two-octave noise — crisp grain + large-scale mask, so dissolution looks
    // organic instead of uniform random.
    float n = vnoise2(uv * 90.0) * 0.7 + vnoise2(uv * 14.0) * 0.3;
    float t = threshold;
    // Dissolved pixels go black; edge band (just above threshold) glows accent.
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

// Anamorphic bloom — horizontal streaks on bright pixels. Signature of
// anamorphic cinema lenses. Sample count is high and step size small so
// neighbouring taps overlap — otherwise each tap ends up as a visible
// bright dot (the "dashed line" artifact on skin/satin specular peaks).
// Threshold stays aggressive so only real hot spots (spot hotspots, camera
// flash, metal buckles) contribute; everything else is below the knee.
const ANAMORPHIC_FRAGMENT = /* glsl */ `
  uniform float uStrength;
  uniform float uThreshold;
  uniform vec3 uTint;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 streak = vec3(0.0);
    float total = 0.0;
    for (int i = 0; i < 25; i++) {
      float fi = float(i - 12);
      vec2 offset = vec2(fi * 0.0035, 0.0);
      vec3 s = texture2D(inputBuffer, uv + offset).rgb;
      float luma = dot(s, vec3(0.2126, 0.7152, 0.0722));
      // Soft knee above threshold so the transition from "not streaked"
      // to "streaked" doesn't pop a hard bright dot.
      float bright = max(0.0, luma - uThreshold);
      bright = bright * bright;
      float w = exp(-fi * fi / 40.0);
      streak += s * bright * w;
      total += w;
    }
    streak /= max(total, 0.0001);
    outputColor = vec4(inputColor.rgb + streak * uStrength * uTint, inputColor.a);
  }
`

export class AnamorphicEffect extends Effect {
  constructor() {
    super('AnamorphicEffect', ANAMORPHIC_FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<number | Color>>([
        ['uStrength', new Uniform(0.35)],
        ['uThreshold', new Uniform(0.9)],
        ['uTint', new Uniform(new Color(0.55, 0.75, 1.0))],
      ]),
    })
  }
}

// Filmic color grade — split-toning (cool shadows, warm highlights) plus a
// soft contrast curve and a touch of desaturation. Emulates a fashion-film
// LUT analytically (no baked .cube texture needed) so it can be tuned at
// runtime without a texture reload.
const COLORGRADE_FRAGMENT = /* glsl */ `
  uniform float uContrast;
  uniform float uSaturation;
  uniform vec3 uLift;
  uniform vec3 uGain;
  uniform float uTemperature;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    // Temperature tilt — +ve = warm, -ve = cool. Kept subtle to avoid
    // clipping on saturated fabrics.
    vec3 temp = vec3(1.0) + vec3(0.04, 0.0, -0.05) * uTemperature;
    c *= temp;
    // Lift (shadows) and Gain (highlights) split toning.
    c = c * uGain + uLift;
    // Saturation vs. luminance.
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(luma), c, uSaturation);
    // Soft S-curve around mid-grey.
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
        // Cool teal in shadows, cream in highlights — classic editorial
        // split-tone.
        ['uLift', new Uniform(new Color(0.003, 0.01, 0.022))],
        ['uGain', new Uniform(new Color(1.03, 1.0, 0.95))],
        ['uTemperature', new Uniform(0.2)],
      ]),
    })
  }
}

export interface PostFXOptions {
  bloom?: boolean
  chromatic?: boolean
  vignette?: boolean
  noise?: boolean
  dof?: boolean
  anamorphic?: boolean
  colorGrade?: boolean
}

export interface PostFX {
  dissolve: DissolveEffect
  composer: EffectComposer
  render: (delta: number) => void
  setSize: (w: number, h: number) => void
  effects: {
    bloom: BloomEffect
    chromatic: ChromaticAberrationEffect
    dof: DepthOfFieldEffect
    vignette: VignetteEffect
    noise: NoiseEffect
    anamorphic: AnamorphicEffect
    colorGrade: ColorGradeEffect
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
  const enableDof = options.dof ?? false // default off now
  const enableAnamorphic = options.anamorphic ?? true
  const enableColorGrade = options.colorGrade ?? true
  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType })
  composer.addPass(new RenderPass(scene, camera))

  // Editorial bloom — only the brightest highlights bleed (spot hotspots,
  // satin specular peaks, camera flashes). Never generic "glow".
  // mipmapBlur disabled: propagated NaN/Infinity values from dense skinned
  // GLBs through the mip chain, turning the whole screen black. Gaussian
  // fallback is immune to that.
  const bloom = new BloomEffect({
    intensity: 0.45,
    luminanceThreshold: 0.82,
    luminanceSmoothing: 0.22,
    mipmapBlur: false,
    radius: 0.75,
  })

  // Barely there — adds just enough color drift at the edges to read as lens,
  // not digital.
  const chromatic = new ChromaticAberrationEffect({
    offset: new Vector2(0.0007, 0.0007),
    radialModulation: true,
    modulationOffset: 0.2,
  })

  // DoF disabled — in orbit/inspection mode the whole garment needs to stay
  // sharp. Keeping the pass disabled (bokehScale 0) rather than removing so
  // the rest of the effect chain stays identical.
  const dof = new DepthOfFieldEffect(camera, {
    focusDistance: 0.12,
    focalLength: 0.02,
    bokehScale: 0,
  })

  // Subtle corner fall-off — editorial prints have gentle vignettes, not heavy.
  const vignette = new VignetteEffect({
    offset: 0.45,
    darkness: 0.55,
  })

  // Film grain — tiny, monochromatic, OVERLAY so it reads as emulsion not
  // digital noise.
  const noise = new NoiseEffect({
    blendFunction: BlendFunction.OVERLAY,
    premultiply: true,
  })
  noise.blendMode.opacity.value = 0.06

  // Anamorphic lens streak + filmic color grade — the "premium/couture"
  // layer. Anamorphic sits right after bloom so it widens the same hot
  // spots; color grade goes toward the end so everything the viewer sees
  // (including bloom halos and streaks) flows through the LUT curve.
  const anamorphic = new AnamorphicEffect()
  const colorGrade = new ColorGradeEffect()

  if (enableDof) composer.addPass(new EffectPass(camera, dof))
  const chainEffects = [
    enableBloom ? bloom : null,
    enableBloom && enableAnamorphic ? anamorphic : null,
    enableChromatic ? chromatic : null,
    enableColorGrade ? colorGrade : null,
    enableVignette ? vignette : null,
    enableNoise ? noise : null,
  ].filter(Boolean) as Effect[]
  if (chainEffects.length > 0) {
    composer.addPass(new EffectPass(camera, ...chainEffects))
  }

  // Noise-dissolve as the last pass — runs on the fully-composed image.
  const dissolve = new DissolveEffect()
  composer.addPass(new EffectPass(camera, dissolve))

  const setSize = (w: number, h: number): void => {
    composer.setSize(w, h)
  }

  const render = (delta: number): void => {
    composer.render(delta)
  }

  const onResize = () => setSize(window.innerWidth, window.innerHeight)
  window.addEventListener('resize', onResize)

  const dispose = (): void => {
    window.removeEventListener('resize', onResize)
    composer.dispose()
  }

  return {
    composer,
    render,
    setSize,
    effects: { bloom, chromatic, dof, vignette, noise, anamorphic, colorGrade },
    dissolve,
    dispose,
  }
}
