

export interface AudioManager {
  isMuted: () => boolean
  toggle: () => boolean

  update: (walkPhase: number) => void

  playFlash: () => void

  playFinale: () => void
  setSoundscape: (enabled: boolean) => void
  setSpatial: (pan: number, distance: number) => void
  setDim: (amount: number) => void
  playWhoosh: (strength: number) => void
  playCue: () => void
  playClick: (pan: number, distance: number) => void
  setMusic: (enabled: boolean) => void
  setMusicIntensity: (amount: number) => void
  debug: () => Record<string, number | string | boolean>
  /** Flux du mix complet (pour enregistrer une bande-son, ex. vidéo de présentation). */
  captureStream: () => MediaStream | null
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
  let soundscape = true
  let spatialPan = 0
  let spatialDistance = 3
  let dimAmount = 0
  let droneShelf: BiquadFilterNode | null = null
  let murmurGain: GainNode | null = null
  let murmurStop: (() => void) | null = null
  const DRONE_CUTOFF = 1600
  const MURMUR_LEVEL = 0.04

  // ─── Rythmique de podium (procédurale, zéro fichier) ───
  // Kick quatre temps à 116 BPM, sub en mi mineur sous le drone, charleys en contretemps,
  // clap discret sur 2 et 4, sidechain sur la nappe. Entre au cue d'ouverture, s'étouffe
  // au passe-bas pendant les travellings, redescend sur la carte finale.
  const MUSIC_BPM = 116
  const MUSIC_STEP = 60 / MUSIC_BPM / 2
  const MUSIC_LEVEL = 0.2
  // Pour remplacer la rythmique par un vrai morceau : '/audio/runway.mp3' (boucle, même bus,
  // même passe-bas pendant les travellings). Vide = synthèse.
  const MUSIC_TRACK_URL = ''
  const BASS_NOTES = [82.41, 82.41, 98.0, 61.74]
  let musicEnabled = true
  let musicIntensity = 1
  let musicBus: GainNode | null = null
  let musicLP: BiquadFilterNode | null = null
  let musicStop: (() => void) | null = null
  let padDuck: GainNode | null = null
  let stepIndex = 0
  let nextStepTime = 0
  let musicTimer: number | null = null
  let analyser: AnalyserNode | null = null

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
    shelf.frequency.value = DRONE_CUTOFF
    shelf.Q.value = 0.5
    droneShelf = shelf
    if (soundscape) murmurStop = startMurmur()

    const ambDry = ctx.createGain()
    ambDry.gain.value = 0
    ambDry.gain.linearRampToValueAtTime(0.07, now + 4.5)

    const ambWet = ctx.createGain()
    ambWet.gain.value = 0
    ambWet.gain.linearRampToValueAtTime(0.11, now + 4.5)

    // La nappe passe par un gain que le kick creuse (sidechain) quand la musique tourne.
    const duck = ctx.createGain()
    duck.gain.value = 1
    padDuck = duck
    shelf.connect(duck)
    duck.connect(ambDry)
    ambDry.connect(masterGain)
    duck.connect(ambWet)
    ambWet.connect(reverbBus)
    if (musicEnabled) musicStop = startMusic()

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
      droneShelf = null
      murmurStop?.()
      murmurStop = null
      musicStop?.()
      musicStop = null
      padDuck = null
    }
  }

  const musicCutoff = (): number => 400 + 8600 * musicIntensity * (1 - 0.82 * dimAmount)

  const noiseBurst = (t: number, dur: number): AudioBufferSourceNode => {
    const src = ctx!.createBufferSource()
    src.buffer = whiteNoiseBuffer
    src.start(t, Math.random() * 1.5, dur + 0.05)
    return src
  }

  const kick = (t: number, bus: GainNode): void => {
    const c = ctx!
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(170, t)
    o.frequency.exponentialRampToValueAtTime(46, t + 0.09)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.95, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    o.connect(g)
    g.connect(bus)
    o.start(t)
    o.stop(t + 0.42)

    const n = noiseBurst(t, 0.012)
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2400
    const ng = c.createGain()
    ng.gain.setValueAtTime(0.1, t)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.012)
    n.connect(hp)
    hp.connect(ng)
    ng.connect(bus)

    if (padDuck) {
      padDuck.gain.cancelScheduledValues(t)
      padDuck.gain.setValueAtTime(1, t)
      padDuck.gain.linearRampToValueAtTime(0.5, t + 0.02)
      padDuck.gain.linearRampToValueAtTime(1, t + 0.4)
    }
  }

  const subPluck = (t: number, bus: GainNode, freq: number): void => {
    const c = ctx!
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.34, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
    o.connect(g)
    g.connect(bus)
    o.start(t)
    o.stop(t + 0.26)

    // Un soupçon d'octave pour exister sur des enceintes de laptop.
    const h = c.createOscillator()
    h.type = 'triangle'
    h.frequency.value = freq * 2
    const hg = c.createGain()
    hg.gain.setValueAtTime(0.0001, t)
    hg.gain.exponentialRampToValueAtTime(0.05, t + 0.01)
    hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    h.connect(hg)
    hg.connect(bus)
    h.start(t)
    h.stop(t + 0.18)
  }

  const hat = (t: number, bus: GainNode, open: boolean, vel: number): void => {
    const c = ctx!
    const dur = open ? 0.24 : 0.05
    const n = noiseBurst(t, dur)
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7600
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.065 * vel, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    n.connect(hp)
    hp.connect(g)
    g.connect(bus)
  }

  const clap = (t: number, bus: GainNode, vel: number): void => {
    const c = ctx!
    const n = noiseBurst(t, 0.2)
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1500
    bp.Q.value = 1.1
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    // Trois micro-attaques : la signature d'un clap.
    for (let i = 0; i < 3; i++) {
      const a = t + i * 0.011
      g.gain.exponentialRampToValueAtTime(0.09 * vel, a + 0.003)
      g.gain.exponentialRampToValueAtTime(0.02 * vel, a + 0.01)
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    n.connect(bp)
    bp.connect(g)
    g.connect(bus)
    if (reverbBus) {
      const w = c.createGain()
      w.gain.value = 0.25
      g.connect(w)
      w.connect(reverbBus)
    }
  }

  const scheduleStep = (s: number, t: number, bus: GainNode): void => {
    const bar = Math.floor(s / 8)
    const inBar = s % 8
    if (inBar % 2 === 0) kick(t, bus)
    if (inBar === 2 || inBar === 6) clap(t, bus, 0.45 + 0.1 * Math.random())
    if (inBar % 2 === 1) {
      const open = inBar === 7 && bar % 2 === 1
      hat(t, bus, open, 0.55 + 0.45 * Math.random())
      subPluck(t, bus, BASS_NOTES[bar % 4])
    }
  }

  const startMusic = (): (() => void) => {
    if (!ctx || !masterGain || !reverbBus) return () => {}
    const c = ctx
    const now = c.currentTime
    const bus = c.createGain()
    bus.gain.setValueAtTime(0, now)
    bus.gain.linearRampToValueAtTime(MUSIC_LEVEL * musicIntensity, now + 2.5)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = musicCutoff()
    lp.Q.value = 0.6
    const wet = c.createGain()
    wet.gain.value = 0.08
    bus.connect(lp)
    lp.connect(masterGain)
    lp.connect(wet)
    wet.connect(reverbBus)
    musicBus = bus
    musicLP = lp

    let track: AudioBufferSourceNode | null = null
    if (MUSIC_TRACK_URL) {
      fetch(MUSIC_TRACK_URL)
        .then((r) => r.arrayBuffer())
        .then((ab) => c.decodeAudioData(ab))
        .then((buffer) => {
          if (musicBus !== bus) return
          track = c.createBufferSource()
          track.buffer = buffer
          track.loop = true
          track.connect(bus)
          track.start()
        })
        .catch(() => {
          // Fichier absent ou illisible : silence plutôt que de casser le reste du paysage sonore.
        })
    } else {
      stepIndex = 0
      nextStepTime = now + 0.1
      musicTimer = window.setInterval(() => {
        const horizon = c.currentTime + 0.16
        while (nextStepTime < horizon) {
          scheduleStep(stepIndex, nextStepTime, bus)
          stepIndex++
          nextStepTime += MUSIC_STEP
        }
      }, 25)
    }

    return () => {
      const t = c.currentTime
      if (musicTimer !== null) {
        window.clearInterval(musicTimer)
        musicTimer = null
      }
      bus.gain.cancelScheduledValues(t)
      bus.gain.setValueAtTime(bus.gain.value, t)
      bus.gain.linearRampToValueAtTime(0, t + 1.2)
      if (track) track.stop(t + 1.3)
      window.setTimeout(() => {
        bus.disconnect()
        lp.disconnect()
        wet.disconnect()
      }, 1500)
      if (musicBus === bus) {
        musicBus = null
        musicLP = null
      }
    }
  }

  const startMurmur = (): (() => void) => {
    if (!ctx || !masterGain || !reverbBus || !whiteNoiseBuffer) return () => {}
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = whiteNoiseBuffer
    src.loop = true
    src.playbackRate.value = 0.5

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 260
    band.Q.value = 0.6
    const low = ctx.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = 1100

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(MURMUR_LEVEL, now + 4)
    murmurGain = gain

    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.11
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = MURMUR_LEVEL * 0.35
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)

    const wet = ctx.createGain()
    wet.gain.value = 0.5

    src.connect(band)
    band.connect(low)
    low.connect(gain)
    gain.connect(masterGain)
    gain.connect(wet)
    wet.connect(reverbBus)
    src.start(now)
    lfo.start(now)

    return () => {
      const t = ctx!.currentTime
      gain.gain.cancelScheduledValues(t)
      gain.gain.linearRampToValueAtTime(0, t + 1)
      src.stop(t + 1.2)
      lfo.stop(t + 1.2)
      murmurGain = null
    }
  }

  const spatialize = (node: AudioNode, target: AudioNode): void => {
    if (!ctx || !soundscape || typeof ctx.createStereoPanner !== 'function') {
      node.connect(target)
      return
    }
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, spatialPan))
    const attenuation = ctx.createGain()
    attenuation.gain.value = 1 / (1 + Math.max(0, spatialDistance - 1) * 0.18)
    node.connect(panner)
    panner.connect(attenuation)
    attenuation.connect(target)
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
    spatialize(dryGain, masterGain)
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
    spatialize(g, masterGain)

    const send = ctx.createGain()
    send.gain.value = 0.6
    g.connect(send)
    send.connect(reverbBus)

    src.start(t)
    src.stop(t + 0.1)
  }

  const playWhooshNow = (strength: number): void => {
    if (!ctx || !masterGain || !reverbBus || !whiteNoiseBuffer) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = whiteNoiseBuffer
    src.loop = true
    src.playbackRate.value = 0.7
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(120, t)
    lp.frequency.exponentialRampToValueAtTime(760, t + 0.7)
    lp.frequency.exponentialRampToValueAtTime(140, t + 1.7)
    lp.Q.value = 0.8
    const g = ctx.createGain()
    const peak = 0.075 * strength
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.6)
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.9)
    const wet = ctx.createGain()
    wet.gain.value = 0.4
    src.connect(lp)
    lp.connect(g)
    g.connect(masterGain)
    g.connect(wet)
    wet.connect(reverbBus)
    src.start(t)
    src.stop(t + 2)
  }

  const playClickNow = (pan: number, distance: number): void => {
    if (!ctx || !masterGain || !reverbBus || !whiteNoiseBuffer) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = whiteNoiseBuffer
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2600 + Math.random() * 800
    bp.Q.value = 6
    const g = ctx.createGain()
    const level = 0.028 / (1 + Math.max(0, distance - 1) * 0.2)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(level, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.045)
    const prevPan = spatialPan
    const prevDist = spatialDistance
    spatialPan = pan
    spatialDistance = distance
    src.connect(bp)
    bp.connect(g)
    spatialize(g, masterGain)
    spatialPan = prevPan
    spatialDistance = prevDist
    const send = ctx.createGain()
    send.gain.value = 0.35
    g.connect(send)
    send.connect(reverbBus)
    src.start(t)
    src.stop(t + 0.06)
  }

  const playCueNow = (): void => {
    if (!ctx || !masterGain || !reverbBus) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(82, t)
    o.frequency.exponentialRampToValueAtTime(48, t + 0.35)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    const wet = ctx.createGain()
    wet.gain.value = 0.6
    o.connect(g)
    g.connect(masterGain)
    g.connect(wet)
    wet.connect(reverbBus)
    o.start(t)
    o.stop(t + 0.6)
    playShutter()
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
    if (soundscape && murmurGain && ctx) {
      const t = ctx.currentTime
      const base = MURMUR_LEVEL * (1 - dimAmount * 0.5)
      murmurGain.gain.cancelScheduledValues(t)
      murmurGain.gain.setValueAtTime(murmurGain.gain.value, t)
      murmurGain.gain.linearRampToValueAtTime(base * 1.7, t + 0.12)
      murmurGain.gain.linearRampToValueAtTime(base, t + 0.9)
    }
  }

  const setSoundscape = (enabled: boolean): void => {
    soundscape = enabled
    if (!enabled && murmurStop) {
      murmurStop()
      murmurStop = null
    }
  }

  const setSpatial = (pan: number, distance: number): void => {
    spatialPan = pan
    spatialDistance = distance
  }

  const setDim = (amount: number): void => {
    const a = Math.max(0, Math.min(1, amount))
    if (Math.abs(a - dimAmount) < 0.002) return
    dimAmount = a
    if (!ctx || muted) return
    const t = ctx.currentTime
    if (droneShelf) {
      droneShelf.frequency.cancelScheduledValues(t)
      droneShelf.frequency.setTargetAtTime(DRONE_CUTOFF * (1 - 0.65 * a), t, 0.08)
    }
    if (murmurGain && soundscape) {
      murmurGain.gain.cancelScheduledValues(t)
      murmurGain.gain.setTargetAtTime(MURMUR_LEVEL * (1 - a * 0.5), t, 0.15)
    }
    if (musicLP) {
      musicLP.frequency.cancelScheduledValues(t)
      musicLP.frequency.setTargetAtTime(musicCutoff(), t, 0.1)
    }
  }

  const setMusic = (enabled: boolean): void => {
    musicEnabled = enabled
    if (!enabled && musicStop) {
      musicStop()
      musicStop = null
    } else if (enabled && !muted && ambientStop && !musicStop) {
      musicStop = startMusic()
    }
  }

  const setMusicIntensity = (amount: number): void => {
    const a = Math.max(0, Math.min(1, amount))
    if (Math.abs(a - musicIntensity) < 0.002) return
    musicIntensity = a
    if (!ctx || !musicBus || !musicLP) return
    const t = ctx.currentTime
    musicBus.gain.cancelScheduledValues(t)
    musicBus.gain.setValueAtTime(musicBus.gain.value, t)
    musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL * a, t + 0.9)
    musicLP.frequency.cancelScheduledValues(t)
    musicLP.frequency.setTargetAtTime(musicCutoff(), t, 0.25)
  }

  const debug = (): Record<string, number | string | boolean> => {
    if (!ctx || !masterGain) return { state: 'none', muted }
    if (!analyser) {
      analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      masterGain.connect(analyser)
    }
    const data = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
    return {
      state: ctx.state,
      rms: Math.sqrt(sum / data.length),
      step: stepIndex,
      musicGain: musicBus ? musicBus.gain.value : 0,
      cutoff: musicLP ? musicLP.frequency.value : 0,
      intensity: musicIntensity,
      muted,
    }
  }

  const playWhoosh = (strength: number): void => {
    if (muted || !soundscape) return
    playWhooshNow(strength)
  }

  const playCue = (): void => {
    if (muted) return
    playCueNow()
  }

  const playClick = (pan: number, distance: number): void => {
    if (muted || !soundscape) return
    playClickNow(pan, distance)
  }

  const captureStream = (): MediaStream | null => {
    if (!ctx || !masterGain) return null
    const dest = ctx.createMediaStreamDestination()
    masterGain.connect(dest)
    return dest.stream
  }

  const dispose = (): void => {
    ambientStop?.()
    ambientStop = null
    if (musicTimer !== null) {
      window.clearInterval(musicTimer)
      musicTimer = null
    }
    if (ctx) {
      ctx.close()
      ctx = null
    }
  }

  return {
    isMuted,
    toggle,
    update,
    playFlash,
    playFinale,
    setSoundscape,
    setSpatial,
    setDim,
    playWhoosh,
    playCue,
    playClick,
    setMusic,
    setMusicIntensity,
    debug,
    captureStream,
    dispose,
  }
}
