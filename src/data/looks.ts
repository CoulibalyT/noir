export interface LookLighting {
  color: number
  accent: number
  spotColor: number
}

export interface LookMaterial {
  color: number
  roughness: number
  metalness: number
}

export interface OutfitDefinition {
  skin: LookMaterial
  main: LookMaterial
  accent: LookMaterial
  hair: LookMaterial
  shoe: LookMaterial
  coatLength: number
  coatTopRadius: number
  coatBottomRadius: number
  hasCollar?: boolean
  hasBelt?: boolean
  hasCapelet?: boolean
  beltColor?: LookMaterial
  widePants?: boolean
  fitted?: boolean
  oversized?: boolean
}

export interface LookAccessories {
  // When true, attach a procedural neck + head on top of the GLB (for garments
  // exported as drape-only, without a body underneath).
  head?: boolean
}

export interface MaterialPin {
  // Label shown on the pin (e.g. "Brocart impérial").
  label: string
  // Optional secondary line under the label.
  detail?: string
  // Long description revealed when the pin is clicked/expanded.
  description?: string
  // Anchor point in model-local coordinates (meters, after fitToHeight).
  // Origin is at the feet, y up, z+ facing the camera at start of orbit.
  anchor: [number, number, number]
  // Where in the look's local scroll range (0..1) this pin peaks.
  atProgress: number
}

export interface Look {
  id: string
  name: string
  fabric: string
  desc: string
  lighting: LookLighting
  outfit: OutfitDefinition
  model?: string
  // Override for GLB fit height. Defaults to 1.8 (full figure). Use a shorter
  // value (e.g. 1.48) when attaching a procedural head above the garment.
  modelHeight?: number
  accessories?: LookAccessories
  pins?: MaterialPin[]
  // Hide meshes whose bounding-box center sits more than ~1m off the body's
  // vertical axis after fitToHeight. Use for CLO exports where unrigged
  // props/ornaments (Korean hair pieces, accessories) float away from the
  // re-rigged body. Leaves the core avatar + garment meshes intact.
  hideFloatingProps?: boolean
}

export const LOOKS: Look[] = [
  {
    id: 'heritage',
    name: 'Héritage',
    fabric: 'Brocart de soie · Fils d’or 24 carats · Dentelle rouge cochenille',
    desc: 'Cinq siècles dans la trame. Phénix brodé main sur soie teinte au thé vert, bandes arc-en-ciel aux manches, rouge cérémoniel interdit aux roturiers par édit royal. On ne porte pas ce vêtement — on l’endosse comme une dynastie.',
    lighting: { color: 0x1a1210, accent: 0xd4a960, spotColor: 0xfff0d5 },
    model: 'look1.glb',
    hideFloatingProps: true,
    pins: [
      {
        label: 'Brocart impérial',
        detail: '원삼 · Soie tissée main',
        description:
          'Tissage jacquard sur métier traditionnel. Fil de soie teint au thé vert pour le fond, motifs idéogrammiques "longue vie" rebrodés fil d’or 24 carats.',
        anchor: [0, 1.25, 0.22],
        atProgress: 0.15,
      },
      {
        label: '색동 · Saekdong',
        detail: 'Bandes arc-en-ciel sur les manches',
        description:
          'Cinq couleurs du pungsu — rouge, jaune, bleu, blanc, noir — alignées en bandes horizontales. Symbole de protection porté par les enfants de cour et les reines aux cérémonies.',
        anchor: [0.42, 1.05, 0.05],
        atProgress: 0.4,
      },
      {
        label: '흉배 · Rang royal',
        detail: 'Emblème phénix brodé fil d’or',
        description:
          'Le rectangle brodé 봉황흉배 désigne le rang de reine. Double phénix mâle-femelle sur fond de pivoines — l’iconographie exacte des dames du palais de Changdeokgung.',
        anchor: [0, 1.2, -0.2],
        atProgress: 0.65,
      },
      {
        label: '홍치마 · Jupe rouge',
        detail: 'Satin duchesse teinté cochenille',
        description:
          'Sous-jupe en satin cinq couches. Teinture cochenille broyée à la main — le rouge cérémoniel de la cour Joseon, interdit aux roturiers par édit royal.',
        anchor: [0, 0.45, 0.25],
        atProgress: 0.88,
      },
    ],
    outfit: {
      skin: { color: 0x2a1f1a, roughness: 0.7, metalness: 0.1 },
      main: { color: 0x2a1a1a, roughness: 0.6, metalness: 0.2 },
      accent: { color: 0x3a2a1a, roughness: 0.5, metalness: 0.3 },
      hair: { color: 0x0d0d0d, roughness: 0.8, metalness: 0.0 },
      shoe: { color: 0x080808, roughness: 0.1, metalness: 0.6 },
      coatLength: 1.45,
      coatTopRadius: 0.28,
      coatBottomRadius: 0.55,
      oversized: true,
    },
  },
  {
    id: 'dentelle',
    name: 'Dentelle',
    fabric: 'Velours bourgogne profond · Dentelle noire filigranée · Bustier armé',
    desc: 'Robe-fourreau en velours teint cinq fois. Le tissu absorbe la lumière, la dentelle la rend au décuple — travaillée en filigrane floral, posée en transparence sur un bustier baleiné. L’ourlet traîne, la coupe mord le corps.',
    lighting: { color: 0x0a0a0d, accent: 0xc0bdc8, spotColor: 0xfafaff },
    model: 'look2.glb',
    pins: [
      {
        label: 'Dentelle filigranée',
        detail: 'Motif floral · maille fine',
        anchor: [0, 1.1, 0.18],
        atProgress: 0.2,
      },
      {
        label: 'Escarpins open-toe',
        detail: 'Cuir verni · talon 10 cm',
        anchor: [0, 0.08, 0.15],
        atProgress: 0.6,
      },
    ],
    outfit: {
      skin: { color: 0x3a2a20, roughness: 0.7, metalness: 0.1 },
      main: { color: 0x12100e, roughness: 0.05, metalness: 0.9 },
      accent: { color: 0x1c1c1c, roughness: 0.6, metalness: 0.2 },
      hair: { color: 0x1a1008, roughness: 0.6, metalness: 0.1 },
      shoe: { color: 0x0a0a0a, roughness: 0.05, metalness: 0.9 },
      coatLength: 0.95,
      coatTopRadius: 0.18,
      coatBottomRadius: 0.32,
    },
  },
  {
    id: 'givre',
    name: 'Givre',
    fabric: 'Toile de coton écru · Twill denim brut · Ferrures métal apparentes',
    desc: 'Tailleur déconstruit — coupe utilitaire, poches cargo empilées, zips argentés à la vue. Le luxe se déguise en équipement de terrain : surpiqûres contrastées, sangles tactiques, rien de décoratif. Le givre est dans la précision, pas dans l’ornement.',
    lighting: { color: 0x10131a, accent: 0xb8d4e8, spotColor: 0xeef4ff },
    model: 'look3_naomi/E.gltf',
    pins: [
      {
        label: 'Snowflakes',
        detail: 'Broderie fil métallique',
        description:
          'Motif flocon répété sur dentelle ajourée. Fil argenté tissé main, ~280 points par flocon.',
        anchor: [0, 1.2, 0.2],
        atProgress: 0.25,
      },
      {
        label: 'Bones',
        detail: 'Armature corset apparente',
        description:
          'Baleines métalliques visibles sous la dentelle. Référence à la lingerie corsetterie 1890s, retournée comme un statement structurel.',
        anchor: [0.35, 0.95, 0.05],
        atProgress: 0.6,
      },
    ],
    outfit: {
      skin: { color: 0x2a1f1a, roughness: 0.7, metalness: 0.1 },
      main: { color: 0x1a1815, roughness: 0.7, metalness: 0.15 },
      accent: { color: 0x25201a, roughness: 0.5, metalness: 0.3 },
      hair: { color: 0x151515, roughness: 0.9, metalness: 0.0 },
      shoe: { color: 0x1a1510, roughness: 0.6, metalness: 0.3 },
      coatLength: 0.7,
      coatTopRadius: 0.35,
      coatBottomRadius: 0.45,
      hasCapelet: true,
    },
  },
  {
    id: 'clown',
    name: 'Clown',
    fabric: 'Dentelle translucide cousue main · Coupe tailleur stricte · Finitions métal',
    desc: 'Veste structurée et pantalon taille haute, intégralement en dentelle. Rien à cacher, rien à offrir — la transparence comme armure. Les coutures suivent la coupe d’un costume masculin classique, la matière en démonte toute l’autorité.',
    lighting: { color: 0x120a14, accent: 0xe8a8c4, spotColor: 0xfff4fa },
    model: 'clown_v2/e.gltf',
    outfit: {
      skin: { color: 0x2a1f1a, roughness: 0.7, metalness: 0.1 },
      main: { color: 0x2a1a2a, roughness: 0.6, metalness: 0.2 },
      accent: { color: 0x3a1a2a, roughness: 0.5, metalness: 0.3 },
      hair: { color: 0x0d0d0d, roughness: 0.8, metalness: 0.0 },
      shoe: { color: 0x0a0a0a, roughness: 0.2, metalness: 0.5 },
      coatLength: 1.1,
      coatTopRadius: 0.24,
      coatBottomRadius: 0.48,
    },
  },
]

export const TOTAL_LOOKS = LOOKS.length
// Last slice of scroll is reserved for the finale: mannequins gather on the
// T-bar crossbar and the camera travels horizontally across the lineup as
// the user keeps scrolling. Everything before that is the per-look walk.
export const FINALE_SCROLL_FRACTION = 0.2
export const SCROLL_PER_LOOK = (1 - FINALE_SCROLL_FRACTION) / TOTAL_LOOKS
export const LOOKS_SCROLL_END = TOTAL_LOOKS * SCROLL_PER_LOOK
