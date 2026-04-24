import {
  CanvasTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import type { Scene } from 'three'

export interface Backdrop {
  mesh: Mesh
  setVisible: (visible: boolean) => void
  setOpacity: (opacity: number) => void
  dispose: () => void
}

export function createBackdrop(scene: Scene): Backdrop {
  const canvas = document.createElement('canvas')
  const W = 2048
  const H = 768
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle = 'rgba(232, 228, 223, 0.96)'
    ctx.font = "italic 300 380px 'Cormorant Garamond', serif"
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText('NØIR HAUS', W / 2, H / 2 - 40)

    ctx.strokeStyle = 'rgba(201, 185, 154, 0.65)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(W * 0.32, H * 0.72)
    ctx.lineTo(W * 0.68, H * 0.72)
    ctx.stroke()

    ctx.fillStyle = 'rgba(201, 185, 154, 0.9)'
    ctx.font = "200 42px 'Outfit', sans-serif"
    const tagline = 'A W   2 6   ·   D É F I L É   ·   P A R I S'
    ctx.fillText(tagline, W / 2, H * 0.84)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.anisotropy = 8

  const geometry = new PlaneGeometry(22, 8.25)
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const mesh = new Mesh(geometry, material)

  mesh.position.set(0, 4.2, -70)
  mesh.visible = false
  scene.add(mesh)

  return {
    mesh,
    setVisible: (v) => {
      mesh.visible = v
    },
    setOpacity: (o) => {
      material.opacity = o
    },
    dispose: () => {
      scene.remove(mesh)
      geometry.dispose()
      material.dispose()
      texture.dispose()
    },
  }
}
