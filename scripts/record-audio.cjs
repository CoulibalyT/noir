/**
 * Bande-son de la vidéo : on joue le défilé en temps réel (même parcours caméra que la vidéo),
 * son activé, et on enregistre le mix Web Audio (rumeur, rythmique, souffles, déclics) en Opus.
 * Usage : node scripts/record-audio.cjs <playwright-core dir> <chrome exe> <out.webm> <durée s>
 */
const [, , PW, EXE, OUT, DUR] = process.argv
const { chromium } = require(PW)
const fs = require('fs')
const { PATH } = require('./video-path.cjs')
;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: EXE,
    args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.on('console', (m) => { if (/\[rec\]|error/i.test(m.text())) console.log('[page]', m.text().slice(0, 200)) })
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)))
  await page.goto('http://localhost:5174/?dpr=1', { waitUntil: 'load' })
  await page.waitForFunction(() => window.__noir && window.__noir.mannequins().length === 4 && window.__noir.opening().started, null, { timeout: 90000 })
  await page.waitForTimeout(500)
  console.log('page ready, toggling audio')
  // Le bouton est sous le curseur custom (pointer-events: none) : clic direct via le DOM, plus sûr.
  await page.evaluate(() => document.getElementById('audio-toggle').click())
  await page.waitForTimeout(300)
  console.log('audio state', JSON.stringify(await page.evaluate(() => window.__noir.audio.debug())))
  const duration = Number(DUR)
  const b64 = await page.evaluate(
    ({ keyframes, duration }) => new Promise((resolve, reject) => {
      const n = window.__noir
      const stream = n.audio.captureStream()
      if (!stream) return reject(new Error('no stream'))
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 })
      const chunks = []
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const buf = await blob.arrayBuffer()
        let s = ''
        const bytes = new Uint8Array(buf)
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
        resolve(btoa(s))
      }
      const lerp = (t) => {
        for (let i = 1; i < keyframes.length; i++) {
          const [t0, p0] = keyframes[i - 1]
          const [t1, p1] = keyframes[i]
          if (t <= t1) { const u = Math.max(0, Math.min(1, (t - t0) / Math.max(1e-6, t1 - t0))); const e = u * u * (3 - 2 * u); return p0 + (p1 - p0) * e }
        }
        return keyframes[keyframes.length - 1][1]
      }
      rec.onerror = (e) => { console.log('[rec] error', String(e.error || e)); reject(new Error('recorder error')) }
      rec.onstart = () => console.log('[rec] started')
      const start = performance.now()
      rec.start(250)
      const id = setInterval(() => {
        const t = (performance.now() - start) / 1000
        n.rig.setTarget(lerp(t))
        if (t >= duration) { clearInterval(id); console.log('[rec] stopping, chunks', chunks.length); rec.stop() }
      }, 1000 / 60)
      setTimeout(() => reject(new Error('audio capture timeout')), (duration + 20) * 1000)
    }),
    { keyframes: PATH, duration },
  )
  fs.writeFileSync(OUT, Buffer.from(b64, 'base64'))
  console.log('audio written', OUT, fs.statSync(OUT).size, 'bytes')
  await browser.close()
})().catch((e) => { console.error('FAILED', String(e).slice(0, 600)); process.exit(1) })
