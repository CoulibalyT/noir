import { PMREMGenerator } from 'three'
import type { DataTextureLoader, Scene, Texture, WebGLRenderer } from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export interface EnvironmentOptions {

  hdrUrl?: string

  intensity?: number

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
