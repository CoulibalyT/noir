

export interface AudioManager {
  isMuted: () => boolean
  toggle: () => boolean

  update: (walkPhase: number) => void

  playFlash: () => void

  playFinale: () => void
  dispose: () => void
}

export function createAudio(): AudioManager {

  let ctx: AudioContext | null = null
  let masterGain: GainNode | null = null
  let ambientStop: (() => void) | null = null
  let whiteNoiseBuffer: AudioBuffer | null = null

  let muted = true
  let lastPhase = 0

  const ensureCtx = (): AudioContext => {
    if (ctx) return ctx
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    ctx = new Ctor()
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.85
    masterGain.connect(ctx.destination)

    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1
    whiteNoiseBuffer = buf
    return ctx
  }

  const startAmbient = (): (() => void) => {
    if (!ctx || !masterGain) return () => {}
    const now = ctx.currentTime

    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 420
    lowpass.Q.value = 0.8

    const ambGain = ctx.createGain()
    ambGain.gain.value = 0
    ambGain.gain.linearRampToValueAtTime(0.18, now + 2.0)

    lowpass.connect(ambGain)
    ambGain.connect(masterGain)

    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = 55
    osc1.connect(lowpass)
    osc1.start(now)

    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = 82.5
    osc2.connect(lowpass)
    osc2.start(now)

    const pad = ctx.createOscillator()
    pad.type = 'triangle'
    pad.frequency.value = 220
    const padGain = ctx.createGain()
    padGain.gain.value = 0.04
    pad.connect(padGain)
    padGain.connect(lowpass)
    pad.start(now)

    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.083
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 110
    lfo.connect(lfoGain)
    lfoGain.connect(lowpass.frequency)
    lfo.start(now)

    return () => {
      const t = ctx!.currentTime
      ambGain.gain.cancelScheduledValues(t)
      ambGain.gain.linearRampToValueAtTime(0, t + 0.8)
      osc1.stop(t + 0.9)
      osc2.stop(t + 0.9)
      pad.stop(t + 0.9)
      lfo.stop(t + 0.9)
    }
  }

  const playShutter = (): void => {
    if (!ctx || !masterGain || !whiteNoiseBuffer) return
    const t = ctx.currentTime

    const src = ctx.createBufferSource()
    src.buffer = whiteNoiseBuffer

    src.playbackRate.value = 0.95 + Math.random() * 0.1

    const click = ctx.createBiquadFilter()
    click.type = 'bandpass'
    click.frequency.value = 2500
    click.Q.value = 6

    const clickGain = ctx.createGain()
    clickGain.gain.setValueAtTime(0, t)
    clickGain.gain.linearRampToValueAtTime(0.32, t + 0.004)
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09)

    src.connect(click)
    click.connect(clickGain)
    clickGain.connect(masterGain)

    const src2 = ctx.createBufferSource()
    src2.buffer = whiteNoiseBuffer
    const thud = ctx.createBiquadFilter()
    thud.type = 'bandpass'
    thud.frequency.value = 420
    thud.Q.value = 3
    const thudGain = ctx.createGain()
    thudGain.gain.setValueAtTime(0, t)
    thudGain.gain.linearRampToValueAtTime(0.18, t + 0.015)
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
    src2.connect(thud)
    thud.connect(thudGain)
    thudGain.connect(masterGain)

    src.start(t)
    src.stop(t + 0.12)
    src2.start(t)
    src2.stop(t + 0.16)
  }

  const playHeel = (): void => {
    if (!ctx || !masterGain || !whiteNoiseBuffer) return
    const t = ctx.currentTime

    const src = ctx.createBufferSource()
    src.buffer = whiteNoiseBuffer
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    bp.Q.value = 8
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.14, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    src.connect(bp)
    bp.connect(g)
    g.connect(masterGain)
    src.start(t)
    src.stop(t + 0.06)
  }

  const playFinale = (): void => {
    if (!ctx || !masterGain) return
    const t = ctx.currentTime

    const notes = [165, 196, 247]
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(300, t)
    filter.frequency.exponentialRampToValueAtTime(1800, t + 2.2)
    filter.Q.value = 2

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.24, t + 0.9)
    gain.gain.linearRampToValueAtTime(0.12, t + 2.4)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 4.5)

    filter.connect(gain)
    gain.connect(masterGain)

    for (const freq of notes) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = freq
      const oGain = ctx.createGain()
      oGain.gain.value = 0.14
      o.connect(oGain)
      oGain.connect(filter)
      o.start(t)
      o.stop(t + 4.6)
    }
  }

  const isMuted = (): boolean => muted

  const toggle = (): boolean => {
    muted = !muted
    if (muted) {
      ambientStop?.()
      ambientStop = null
    } else {
      ensureCtx()

      ctx?.resume()
      if (!ambientStop) ambientStop = startAmbient()
    }
    return muted
  }

  const update = (walkPhase: number): void => {
    if (muted) {
      lastPhase = walkPhase
      return
    }
    const prevStep = Math.floor(lastPhase / Math.PI)
    const currStep = Math.floor(walkPhase / Math.PI)
    if (currStep > prevStep) playHeel()
    lastPhase = walkPhase
  }

  const playFlash = (): void => {
    if (muted) return
    playShutter()
  }

  const dispose = (): void => {
    ambientStop?.()
    ambientStop = null
    if (ctx) {
      ctx.close()
      ctx = null
    }
  }

  return { isMuted, toggle, update, playFlash, playFinale, dispose }
}
