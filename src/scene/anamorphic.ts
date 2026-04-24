import {
  Color,
  HalfFloatType,
  NoBlending,
  ShaderMaterial,
  Uniform,
  Vector2,
  WebGLRenderTarget,
} from 'three'
import type { WebGLRenderer } from 'three'
import { Pass } from 'postprocessing'

// Separable anamorphic bloom — threshold → 5-step ping-pong horizontal
// Gaussian blur at half resolution → additive composite onto the input.
// The single-pass version (AnamorphicEffect) couldn't widen the streak
// without introducing visible banding between tap positions; ping-pong
// grows the effective kernel geometrically without extra per-pixel cost.

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Soft-knee threshold — extracts bright pixels (above uThreshold) into
// their own buffer so the blur step only streaks true highlights instead
// of spreading the whole frame.
const THRESHOLD_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float uThreshold;
  uniform float uKnee;
  varying vec2 vUv;

  void main() {
    vec4 c = texture2D(tDiffuse, vUv);
    float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    float soft = smoothstep(uThreshold, uThreshold + uKnee, luma);
    gl_FragColor = vec4(c.rgb * soft, 1.0);
  }
`

// 9-tap horizontal Gaussian (standard weights). uRadius scales how far
// apart the taps sit — doubling it every iteration expands the effective
// blur radius geometrically without needing a huge single-pass kernel.
const H_BLUR_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uTexel;
  uniform float uRadius;
  varying vec2 vUv;

  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227027;
    vec2 o1 = vec2(uTexel.x * 1.3846153846 * uRadius, 0.0);
    vec2 o2 = vec2(uTexel.x * 3.2307692308 * uRadius, 0.0);
    c += texture2D(tDiffuse, vUv + o1).rgb * 0.3162162162;
    c += texture2D(tDiffuse, vUv - o1).rgb * 0.3162162162;
    c += texture2D(tDiffuse, vUv + o2).rgb * 0.0702702703;
    c += texture2D(tDiffuse, vUv - o2).rgb * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
  }
`

const COMBINE_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tStreak;
  uniform float uStrength;
  uniform vec3 uTint;
  varying vec2 vUv;

  void main() {
    vec4 src = texture2D(tDiffuse, vUv);
    vec3 streak = texture2D(tStreak, vUv).rgb;
    gl_FragColor = vec4(src.rgb + streak * uTint * uStrength, src.a);
  }
`

export interface AnamorphicPassOptions {
  resolutionScale?: number
  threshold?: number
  knee?: number
  strength?: number
  tint?: Color
}

export class AnamorphicPass extends Pass {
  private readonly rtA: WebGLRenderTarget
  private readonly rtB: WebGLRenderTarget
  private readonly thresholdMat: ShaderMaterial
  private readonly blurMat: ShaderMaterial
  private readonly combineMat: ShaderMaterial
  private readonly resolutionScale: number

  constructor(options: AnamorphicPassOptions = {}) {
    super('AnamorphicPass')
    this.resolutionScale = options.resolutionScale ?? 0.5

    const rtOpts = {
      type: HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    }
    this.rtA = new WebGLRenderTarget(1, 1, rtOpts)
    this.rtB = new WebGLRenderTarget(1, 1, rtOpts)

    this.thresholdMat = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: THRESHOLD_FRAG,
      uniforms: {
        tDiffuse: new Uniform(null),
        uThreshold: new Uniform(options.threshold ?? 0.85),
        uKnee: new Uniform(options.knee ?? 0.25),
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    })

    this.blurMat = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: H_BLUR_FRAG,
      uniforms: {
        tDiffuse: new Uniform(null),
        uTexel: new Uniform(new Vector2()),
        uRadius: new Uniform(1),
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    })

    this.combineMat = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: COMBINE_FRAG,
      uniforms: {
        tDiffuse: new Uniform(null),
        tStreak: new Uniform(null),
        uStrength: new Uniform(options.strength ?? 1.1),
        uTint: new Uniform(options.tint ?? new Color(0.55, 0.78, 1.0)),
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    })
  }

  override setSize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width * this.resolutionScale))
    const h = Math.max(1, Math.floor(height * this.resolutionScale))
    this.rtA.setSize(w, h)
    this.rtB.setSize(w, h)
    ;(this.blurMat.uniforms.uTexel.value as Vector2).set(1 / w, 1 / h)
  }

  override render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget | null,
    outputBuffer: WebGLRenderTarget | null,
  ): void {
    if (!inputBuffer) return

    // 1. Threshold → rtA
    this.fullscreenMaterial = this.thresholdMat
    this.thresholdMat.uniforms.tDiffuse.value = inputBuffer.texture
    renderer.setRenderTarget(this.rtA)
    renderer.render(this.scene, this.camera)

    // 2. Ping-pong horizontal blur. Radii double each iteration so the
    // effective kernel width grows as 1 + 2 + 4 + 8 + 16 = 31 texels at
    // half-res → ~60-70 texels at full res → solid anamorphic streak.
    this.fullscreenMaterial = this.blurMat
    const radii = [1, 2, 4, 8, 16]
    let src = this.rtA
    let dst = this.rtB
    for (const r of radii) {
      this.blurMat.uniforms.tDiffuse.value = src.texture
      this.blurMat.uniforms.uRadius.value = r
      renderer.setRenderTarget(dst)
      renderer.render(this.scene, this.camera)
      const tmp = src
      src = dst
      dst = tmp
    }
    // After the swap, the latest blur is in `src`.

    // 3. Composite streak on top of the original input → outputBuffer
    this.fullscreenMaterial = this.combineMat
    this.combineMat.uniforms.tDiffuse.value = inputBuffer.texture
    this.combineMat.uniforms.tStreak.value = src.texture
    renderer.setRenderTarget(outputBuffer)
    renderer.render(this.scene, this.camera)
  }

  override dispose(): void {
    this.rtA.dispose()
    this.rtB.dispose()
    this.thresholdMat.dispose()
    this.blurMat.dispose()
    this.combineMat.dispose()
    super.dispose()
  }
}
