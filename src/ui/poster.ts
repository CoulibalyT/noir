import type { Look } from '../data/looks'
import credits from '../data/credits.json'
import type { I18n } from '../i18n'

interface CreditEntry {
  creator: string | null
  portfolio: string | null
  platform: string | null
  sourceAsset: string | null
  title: string | null
}

const creditsMap = credits as Record<string, CreditEntry>

export interface PosterController {
  capture: (opts: { look: Look; index: number; total: number }) => Promise<void>
  dispose: () => void
}

const POSTER_W = 1080
const POSTER_H = 1920

interface CaptureSource {

  readCanvas: () => HTMLCanvasElement

  renderOnce: () => void

  i18n: I18n
}

export function createPoster(source: CaptureSource): PosterController {

  const toast = document.createElement('div')
  toast.className = 'poster-toast'
  document.body.appendChild(toast)

  let busy = false

  const showToast = (msg: string): void => {
    toast.textContent = msg
    toast.classList.add('visible')
    window.setTimeout(() => toast.classList.remove('visible'), 2200)
  }

  const capture = async ({ look, index, total }: Parameters<PosterController['capture']>[0]): Promise<void> => {
    if (busy) return
    busy = true
    try {

      source.renderOnce()
      const src = source.readCanvas()

      const out = document.createElement('canvas')
      out.width = POSTER_W
      out.height = POSTER_H
      const ctx = out.getContext('2d')
      if (!ctx) throw new Error('2D context unavailable')

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, POSTER_W, POSTER_H)

      const targetAR = POSTER_W / POSTER_H
      const srcAR = src.width / src.height
      let sx = 0
      let sy = 0
      let sw = src.width
      let sh = src.height
      if (srcAR > targetAR) {

        sw = src.height * targetAR
        sx = (src.width - sw) / 2
      } else {

        sh = src.width / targetAR
        sy = (src.height - sh) / 2
      }
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, POSTER_W, POSTER_H)

      const topGrad = ctx.createLinearGradient(0, 0, 0, POSTER_H * 0.35)
      topGrad.addColorStop(0, 'rgba(10,10,10,0.85)')
      topGrad.addColorStop(1, 'rgba(10,10,10,0)')
      ctx.fillStyle = topGrad
      ctx.fillRect(0, 0, POSTER_W, POSTER_H * 0.35)

      const botGrad = ctx.createLinearGradient(0, POSTER_H * 0.55, 0, POSTER_H)
      botGrad.addColorStop(0, 'rgba(10,10,10,0)')
      botGrad.addColorStop(1, 'rgba(10,10,10,0.92)')
      ctx.fillStyle = botGrad
      ctx.fillRect(0, POSTER_H * 0.55, POSTER_W, POSTER_H * 0.45)

      ctx.fillStyle = 'rgba(232, 228, 223, 0.82)'
      ctx.textBaseline = 'top'
      ctx.font = "200 22px 'Outfit', sans-serif"
      const headerY = 88
      ctx.textAlign = 'left'
      ctx.fillText('NØIR HAUS'.split('').join(String.fromCharCode(0x2009)), 88, headerY)
      ctx.textAlign = 'right'
      ctx.fillText(`N° ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, POSTER_W - 88, headerY)

      ctx.strokeStyle = 'rgba(201, 185, 154, 0.6)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(88, headerY + 46)
      ctx.lineTo(POSTER_W - 88, headerY + 46)
      ctx.stroke()

      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(201, 185, 154, 0.9)'
      ctx.font = "200 14px 'Outfit', sans-serif"
      ctx.fillText(
        'AUTOMNE'.split('').join(String.fromCharCode(0x2009)) +
          '   —   ' +
          'HIVER 2026'.split('').join(String.fromCharCode(0x2009)),
        88,
        headerY + 70,
      )

      const c = creditsMap[look.id]
      const lookName = source.i18n.localize(look.name)
      const fabric = source.i18n.localize(look.fabric)
      const title = c?.title ?? lookName
      const creator = c?.creator ?? null
      const platform = c?.platform ?? null

      const blockX = 88
      let cursorY = POSTER_H - 320

      ctx.fillStyle = 'rgba(201, 185, 154, 0.65)'
      ctx.font = "200 13px 'Outfit', sans-serif"
      ctx.fillText(
        'Regard'.split('').join(String.fromCharCode(0x2009)),
        blockX,
        cursorY,
      )
      cursorY += 36

      ctx.fillStyle = 'rgba(232, 228, 223, 0.98)'
      ctx.font = "italic 300 92px 'Cormorant Garamond', serif"
      ctx.fillText(lookName, blockX, cursorY)
      cursorY += 110

      if (title && title !== lookName) {
        ctx.fillStyle = 'rgba(232, 228, 223, 0.85)'
        ctx.font = "italic 300 34px 'Cormorant Garamond', serif"
        ctx.fillText(title, blockX, cursorY)
        cursorY += 46
      }

      ctx.fillStyle = 'rgba(201, 185, 154, 0.85)'
      ctx.font = "200 14px 'Outfit', sans-serif"
      const fabricSpaced = fabric.toUpperCase().split('').join(String.fromCharCode(0x2009))
      ctx.fillText(fabricSpaced, blockX, cursorY)
      cursorY += 30

      if (creator) {
        ctx.textAlign = 'right'
        ctx.fillStyle = 'rgba(232, 228, 223, 0.7)'
        ctx.font = "300 13px 'Outfit', sans-serif"
        const creatorText = platform ? `${creator} · ${platform}` : creator
        ctx.fillText(
          creatorText.toUpperCase().split('').join(String.fromCharCode(0x2009)),
          POSTER_W - 88,
          POSTER_H - 88,
        )
        ctx.textAlign = 'left'
      }

      ctx.strokeStyle = 'rgba(232, 228, 223, 0.15)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(88, POSTER_H - 120)
      ctx.lineTo(POSTER_W - 88, POSTER_H - 120)
      ctx.stroke()

      ctx.fillStyle = 'rgba(232, 228, 223, 0.55)'
      ctx.font = "200 11px 'Outfit', sans-serif"
      ctx.fillText(
        'PARIS  /  AW 26'.split('').join(String.fromCharCode(0x2009)),
        blockX,
        POSTER_H - 88,
      )

      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('toBlob failed')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `noir-haus-aw26-${look.id}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()

      window.setTimeout(() => URL.revokeObjectURL(url), 1000)

      showToast('Affiche exportée')
    } catch (err) {

      console.warn('[poster] capture failed', err)
      showToast('Export impossible')
    } finally {
      busy = false
    }
  }

  return {
    capture,
    dispose: () => toast.remove(),
  }
}
