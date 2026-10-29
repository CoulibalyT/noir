import { Euler, Quaternion, Vector3 } from 'three'
import type { Bone, Camera } from 'three'
import type { MannequinEntry } from './models'

const MAX_YAW = 0.6
const MAX_PITCH = 0.25
const TRACK_FADE_START = 1.45
const TRACK_FADE_END = 2.0
const GAZE_TAU = 0.45
const NECK_SHARE = 0.35

const BREATH_PERIOD = 4.3
const BREATH_AMP = 0.016
const SHIFT_PERIOD = 7.5
const SHIFT_ROLL = 0.028
const SHIFT_X = 0.012

export interface RigState {
  yaw: number
  pitch: number
  phase: number
}

export function createRigState(): RigState {
  return { yaw: 0, pitch: 0, phase: Math.random() * Math.PI * 2 }
}

const headPos = new Vector3()
const toCam = new Vector3()
const parentQ = new Quaternion()
const parentQInv = new Quaternion()
const deltaW = new Quaternion()
const tmpQ = new Quaternion()
const euler = new Euler()
const shiftOffset = new Vector3()

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function applyWorldDelta(bone: Bone, rest: Quaternion, delta: Quaternion): void {
  const parent = bone.parent
  if (!parent) {
    bone.quaternion.copy(delta).multiply(rest)
    return
  }
  parent.getWorldQuaternion(parentQ)
  parentQInv.copy(parentQ).invert()
  bone.quaternion.copy(parentQInv).multiply(delta).multiply(parentQ).multiply(rest)
}

export function updateRig(
  entry: MannequinEntry,
  state: RigState,
  camera: Camera,
  time: number,
  dt: number,
  gazeWeight: number,
): boolean {
  const rig = entry.rig
  if (!rig) return false

  rig.head.getWorldPosition(headPos)
  toCam.subVectors(camera.position, headPos)
  const dist = toCam.length()
  let targetYaw = 0
  let targetPitch = 0
  if (dist > 1e-3 && gazeWeight > 0) {
    const yawRaw = Math.atan2(toCam.x, toCam.z)
    const pitchRaw = Math.asin(clamp(toCam.y / dist, -1, 1))
    const track = 1 - smooth(TRACK_FADE_START, TRACK_FADE_END, Math.abs(yawRaw))
    targetYaw = clamp(yawRaw, -MAX_YAW, MAX_YAW) * track * gazeWeight
    targetPitch = clamp(pitchRaw, -MAX_PITCH, MAX_PITCH) * track * gazeWeight
  }
  const k = 1 - Math.exp(-dt / GAZE_TAU)
  const prevYaw = state.yaw
  const prevPitch = state.pitch
  state.yaw += (targetYaw - state.yaw) * k
  state.pitch += (targetPitch - state.pitch) * k

  if (rig.neck) {
    euler.set(-state.pitch * NECK_SHARE, state.yaw * NECK_SHARE, 0, 'YXZ')
    deltaW.setFromEuler(euler)
    applyWorldDelta(rig.neck, rig.neckRest, deltaW)
  }
  const headShare = rig.neck ? 1 - NECK_SHARE : 1
  euler.set(-state.pitch * headShare, state.yaw * headShare, 0, 'YXZ')
  deltaW.setFromEuler(euler)
  applyWorldDelta(rig.head, rig.headRest, deltaW)

  // Vêtement statique : on s'arrête au regard, le corps ne bouge pas dans la robe.
  if (!rig.bodyMotion) {
    return Math.abs(state.yaw - prevYaw) > 1e-4 || Math.abs(state.pitch - prevPitch) > 1e-4
  }

  const breath = Math.sin((time * Math.PI * 2) / BREATH_PERIOD + state.phase)
  if (rig.chest) {
    euler.set(-breath * BREATH_AMP, 0, 0, 'YXZ')
    deltaW.setFromEuler(euler)
    applyWorldDelta(rig.chest, rig.chestRest, deltaW)
  }

  const s = Math.sin((time * Math.PI * 2) / SHIFT_PERIOD + state.phase * 0.5)
  const shaped = Math.sign(s) * Math.pow(Math.abs(s), 0.6)
  if (rig.pelvis) {
    euler.set(0, 0, shaped * SHIFT_ROLL, 'YXZ')
    deltaW.setFromEuler(euler)
    applyWorldDelta(rig.pelvis, rig.pelvisRest, deltaW)
    const parent = rig.pelvis.parent
    shiftOffset.set(shaped * SHIFT_X, 0, 0)
    if (parent) {
      parent.getWorldQuaternion(tmpQ).invert()
      shiftOffset.applyQuaternion(tmpQ)
    }
    rig.pelvis.position.copy(rig.pelvisRestPos).add(shiftOffset)
  }
  if (rig.spine) {
    euler.set(0, 0, -shaped * SHIFT_ROLL * 0.6, 'YXZ')
    deltaW.setFromEuler(euler)
    applyWorldDelta(rig.spine, rig.spineRest, deltaW)
  }

  return Math.abs(state.yaw - prevYaw) > 1e-4 || Math.abs(state.pitch - prevPitch) > 1e-4
}
