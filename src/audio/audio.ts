

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
  let reverbBus: GainNode | null = null
  let ambientStop: (() => void) | null = null
  let whiteNoiseBuffer: AudioBuffer | null = null

  let muted = true
  let lastPhase = 0

  const makeReverbIR = (c: AudioContext, duration = 3.2, decay = 2.5): AudioBuffer => {
    const rate = c.sampleRate
    const length = Math.floor(rate * duration)
    const buf = c.createBuffer(2, length, rate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buf.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const t = i / length
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay)
      }
    }
    return buf
  }

  const ensureCtx = (): AudioContext => {
    if (ctx) return ctx
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    ctx = new Ctor()
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.75
    masterGain.connect(ctx.destination)

    const convolver = ctx.createConvolver()
    convolver.buffer = makeReverbIR(ctx, 3.2, 2.2)
    reverbBus = ctx.createGain()
    reverbBus.gain.value = 1
    reverbBus.connect(convolver)
    convolver.connect(masterGain)

    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1
    whiteNoiseBuffer = buf
    return ctx
  }

  const startAmbient = (): (() => void) => {
    if (!ctx || !masterGain || !reverbBus) return () => {}
    const now = ctx.currentTime

    const shelf = ctx.createBiquadFilter()
    shelf.type = 'lowpass'
    shelf.frequency.value = 1600
    shelf.Q.value = 0.5

    const ambDry = ctx.createGain()
    ambDry.gain.value = 0
    ambDry.gain.linearRampToValueAtTime(0.07, now + 4.5)

    const ambWet = ctx.createGain()
    ambWet.gain.value = 0
    ambWet.gain.linearRampToValueAtTime(0.11, now + 4.5)

    shelf.connect(ambDry)
    ambDry.connect(masterGain)
    shelf.connect(ambWet)
    ambWet.connect(reverbBus)

    const chord = [164.81, 246.94, 329.63, 493.88]

    const oscs: OscillatorNode[] = []
    const detunes: OscillatorNode[] = []
    chord.forEach((freq, i) => {
      const o = ctx!.createOscillator()
      o.type = 'sine'
      o.frequency.value = freq
      const g = ctx!.createGain()
      g.gain.value = i === 0 ? 0.35 : 0.22 - i * 0.04
      o.connect(g)
      g.connect(shelf)
      o.start(now)
      oscs.push(o)

      const d = ctx!.createOscillator()
      d.type = 'sine'
      d.frequency.value = freq + 0.4 + i * 0.1
      const dg = ctx!.createGain()
      dg.gain.value = (i === 0 ? 0.25 : 0.16 - i * 0.03) * 0.7
      d.connect(dg)
      dg.connect(shelf)
      d.start(now)
      detunes.push(d)
    })

    const breath = ctx.createOscillator()
    breath.type = 'sine'
    breath.frequency.value = 0.07
    const breathGain = ctx.createGain()
    breathGain.gain.value = 450
    breath.connect(breathGain)
    breathGain.connect(shelf.frequency)
    breath.start(now)

    return () => {
      const t = ctx!.currentTime
      ambDry.gain.cancelScheduledValues(t)
      ambDry.gain.linearRampToValueAtTime(0, t + 1.2)
      ambWet.gain.cancelScheduledValues(t)
      ambWet.gain.linearRampToValueAtTime(0, t + 1.2)
      for (const o of oscs) o.stop(t + 1.4)
      for (const d of detunes) d.stop(t + 1.4)
      breath.stop(t + 1.4)
    }
  }

  const playShutter = (): void => {
    if (!ctx || !masterGain || !reverbBus || !whiteNoiseBuffer) return
    const t = ctx.currentTime

    const src = ctx.createBufferSource()
    src.buffer = whiteNoiseBuffer
    src.playbackRate.value = 0.55 + Math.random() * 0.15
    src.loop = true

    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.setValueAtTime(280, t)
    lowpass.frequency.exponentialRampToValueAtTime(1200, t + 0.35)
    lowpass.frequency.exponentialRampToValueAtTime(220, t + 1.4)
    lowpass.Q.value = 0.9

    const dryGain = ctx.createGain()
    dryGain.gain.setValueAtTime(0, t)
    dryGain.gain.linearRampToValueAtTime(0.05, t + 0.4)
    dryGain.gain.exponentialRampToValueAtTime(0.001, t + 1.6)

    const wetGain = ctx.createGain()
    wetGain.gain.setValueAtTime(0, t)
    wetGain.gain.linearRampToValueAtTime(0.07, t + 0.5)
    wetGain.gain.exponentialRampToValueAtTime(0.001, t + 2.4)

    src.connect(lowpass)
    lowpass.connect(dryGain)
    dryGain.connect(masterGain)
    lowpass.connect(wetGain)
    wetGain.connect(reverbBus)

    src.start(t)
    src.stop(t + 1.7)
  }

  const playHeel = (): void => {
    if (!ctx || !masterGain || !reverbBus || !whiteNoiseBuffer) return
    const t = ctx.currentTime

    const src = ctx.createBufferSource()
    src.buffer = whiteNoiseBuffer
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    bp.Q.value = 12
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.05, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
    src.connect(bp)
    bp.connect(g)
    g.connect(masterGain)

    const send = ctx.createGain()
    send.gain.value = 0.6
    g.connect(send)
    send.connect(reverbBus)

    src.start(t)
    src.stop(t + 0.1)
  }

  const playFinale = (): void => {
    if (!ctx || !masterGain || !reverbBus) return
    const t = ctx.currentTime

    const notes = [164.81, 196.0, 246.94, 329.63]

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(220, t)
    filter.frequency.exponentialRampToValueAtTime(1400, t + 3.5)
    filter.Q.value = 0.7

    const dryGain = ctx.createGain()
    dryGain.gain.setValueAtTime(0, t)
    dryGain.gain.linearRampToValueAtTime(0.14, t + 2.2)
    dryGain.gain.linearRampToValueAtTime(0.08, t + 4.5)
    dryGain.gain.exponentialRampToValueAtTime(0.001, t + 7.5)

    const wetGain = ctx.createGain()
    wetGain.gain.setValueAtTime(0, t)
    wetGain.gain.linearRampToValueAtTime(0.22, t + 2.2)
    wetGain.gain.linearRampToValueAtTime(0.12, t + 4.5)
    wetGain.gain.exponentialRampToValueAtTime(0.001, t + 7.5)

    filter.connect(dryGain)
    dryGain.connect(masterGain)
    filter.connect(wetGain)
    wetGain.connect(reverbBus)

    for (const freq of notes) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = freq
      const oGain = ctx.createGain()
      oGain.gain.value = 0.18
      o.connect(oGain)
      oGain.connect(filter)
      o.start(t)
      o.stop(t + 7.7)

      const d = ctx.createOscillator()
      d.type = 'sine'
      d.frequency.value = freq + 0.6
      const dGain = ctx.createGain()
      dGain.gain.value = 0.1
      d.connect(dGain)
      dGain.connect(filter)
      d.start(t)
      d.stop(t + 7.7)
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
