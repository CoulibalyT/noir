/**
 * Capture image par image du défilé en temps simulé (mode ?record=1 de l'app).
 * Usage : node scripts/record-video.cjs <playwright-core dir> <chrome exe> <frames dir> [fps] [durée s] [largeur] [hauteur]
 */
const [, , PW, EXE, FRAMES, FPS = '60', DUR = '32', W = '1920', H = '1080'] = process.argv
const { chromium } = require(PW)
const fs = require('fs')
const path = require('path')
const { PATH, HOVER_WINDOW } = require('./video-path.cjs')

const fps = Number(FPS)
const duration = Number(DUR)
const total = Math.round(fps * duration)
const lerp = (t) => {
  for (let i = 1; i < PATH.length; i++) {
    const [t0, p0] = PATH[i - 1]
    const [t1, p1] = PATH[i]
    if (t <= t1) {
      const u = Math.max(0, Math.min(1, (t - t0) / Math.max(1e-6, t1 - t0)))
      const e = u * u * (3 - 2 * u)
      return p0 + (p1 - p0) * e
    }
  }
  return PATH[PATH.length - 1][1]
}

;(async () => {
  fs.mkdirSync(FRAMES, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    executablePath: EXE,
    args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--force-device-scale-factor=1'],
  })
  const page = await browser.newPage({ viewport: { width: Number(W), height: Number(H) }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('[pageerror]', String(e).slice(0, 200)))
  await page.goto('http://localhost:5174/?record=1&dpr=1', { waitUntil: 'load' })
  await page.waitForFunction(() => window.__noir && window.__noir.record && window.__noir.record.enabled && window.__noir.record.ready(), null, { timeout: 120000 })
  await page.evaluate(() => document.fonts.ready)
  // Images à blanc à temps figé (dt = 0) : on vide la file de pré-chargement des textures
  // (une par image) sans faire avancer l'ouverture, qui doit démarrer sur la première image filmée.
  await page.evaluate(() => window.__noir.record.tick(0.0001, null))
  for (let i = 0; i < 400; i++) await page.evaluate(() => window.__noir.record.tick(0, null))
  const pending = await page.evaluate(() => window.__noir.record.warmupPending())
  console.log('warmup pending', pending, '→ capture de', total, 'images')

  const cx = Number(W) / 2
  const cy = Number(H) / 2
  await page.mouse.move(cx, cy)
  const t0 = Date.now()
  for (let i = 0; i < total; i++) {
    const t = i / fps
    const target = lerp(t)
    // Parallaxe : dérive lente de la souris dans le quart bas-gauche, loin des pins (pour ne pas
    // ouvrir une description par accident) ; fenêtre de survol du pin « Dentelle filigranée ».
    let mx = 420 + 120 * Math.sin(t * 0.35)
    let my = 820 + 50 * Math.sin(t * 0.23 + 1)
    if (t >= HOVER_WINDOW[0] && t <= HOVER_WINDOW[1]) {
      const dot = await page.evaluate(() => {
        const p = [...document.querySelectorAll('.pin')].find((el) => parseFloat(el.style.opacity) > 0.6)
        if (!p) return null
        const r = p.querySelector('.pin-dot').getBoundingClientRect()
        return [r.left + r.width / 2, r.top + r.height / 2]
      })
      if (dot) { mx = dot[0]; my = dot[1] }
    }
    await page.mouse.move(mx, my)
    await page.evaluate(([dt, tg]) => window.__noir.record.tick(dt, tg), [1 / fps, target])
    await page.screenshot({ path: path.join(FRAMES, `f_${String(i).padStart(5, '0')}.png`), type: 'png', animations: 'disabled', caret: 'hide' })
    if (i % 120 === 0) {
      const st = await page.evaluate(() => ({ p: +window.__noir.state.progress.toFixed(3), look: window.__noir.state.currentLook }))
      console.log(`frame ${i}/${total} t=${t.toFixed(1)}s target=${target.toFixed(3)} progress=${st.p} look=${st.look + 1} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`)
    }
  }
  console.log('done', total, 'frames in', ((Date.now() - t0) / 1000).toFixed(0), 's')
  await browser.close()
})().catch((e) => { console.error('FAILED', String(e).slice(0, 600)); process.exit(1) })
