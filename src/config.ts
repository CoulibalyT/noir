export type ImmersionKey =
  | 'gaze'
  | 'dof'
  | 'soundscape'
  | 'music'
  | 'opening'
  | 'parallax'
  | 'flashwall'
  | 'speedfx'
  | 'letterbox'

export const IMMERSION: Record<ImmersionKey, boolean> = {
  gaze: true,
  dof: true,
  soundscape: true,
  music: true,
  opening: true,
  parallax: true,
  flashwall: true,
  speedfx: true,
  letterbox: true,
}
