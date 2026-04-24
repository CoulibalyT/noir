import { PMREMGenerator } from 'three'
import type { DataTextureLoader, Scene, Texture, WebGLRenderer } from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export interface EnvironmentOptions {
  // Path (relative to /public) to an .hdr equirectangular file. If omitted or
  // the file is missing, falls back to the procedural RoomEnvironment — good
  // enough for studio-style reflections without shipping an HDR asset.
  hdrUrl?: string
  // Multiplier applied globally to how strongly the env lights the scene.
  // Sensible range: 0.3 (dim museum) to 1.5 (bright studio). Default 1.0.
  intensity?: number
  // When false, skip the HDR download even if hdrUrl is provided and use
  // Three's procedural RoomEnvironment instead. Set false on low-tier devices.
  useHdr?: boolean
}

export interface EnvironmentHandle {
  envMap: Texture
  dispose: () => void
}

export async function createEnvironment(
  renderer: WebGLRenderer,
  scene: Scene,
  options: EnvironmentOptions = {},
): Promise<EnvironmentHandle> {
  const pmrem = new PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()

  let envMap: Texture

  // If the HDR load is disabled (low-tier), always fall through to the
  // procedural RoomEnvironment — avoids a multi-MB download on mobile.
  if (options.hdrUrl && options.useHdr !== false) {
    try {
      const loader: DataTextureLoader = /\.exr$/i.test(options.hdrUrl)
        ? new EXRLoader()
        : new RGBELoader()
      const hdrTexture = await new Promise<Texture>((resolve, reject) => {
        loader.load(options.hdrUrl!, resolve, undefined, reject)
      })
      envMap = pmrem.fromEquirectangular(hdrTexture).texture
      hdrTexture.dispose()
    } catch {
      envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    }
  } else {
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  }

  scene.environment = envMap
  if (options.intensity !== undefined) {
    scene.environmentIntensity = options.intensity
  }

  pmrem.dispose()

  return {
    envMap,
    dispose: () => {
      envMap.dispose()
      if (scene.environment === envMap) scene.environment = null
    },
  }
}
