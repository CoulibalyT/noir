import type { Localized } from '../i18n'

export interface LookLighting {
  color: number
  accent: number
  spotColor: number
  exposure?: number
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

  head?: boolean
}

export interface MaterialPin {

  label: Localized

  detail?: Localized

  description?: Localized

  anchor: [number, number, number]

  atProgress: number
}

export interface Look {
  id: string
  name: Localized
  fabric: Localized
  desc: Localized
  lighting: LookLighting
  outfit: OutfitDefinition
  model?: string

  modelHeight?: number
  accessories?: LookAccessories
  pins?: MaterialPin[]

  hideFloatingProps?: boolean
}

export const LOOKS: Look[] = [
  {
    id: 'heritage',
    name: { fr: 'Héritage', en: 'Heritage' },
    fabric: {
      fr: 'Brocart de soie · Fils d’or 24 carats · Dentelle rouge cochenille',
      en: 'Silk brocade · 24-karat gold thread · Cochineal-dyed red lace',
    },
    desc: {
      fr: 'Cinq siècles dans la trame. Phénix brodé main sur soie teinte au thé vert, bandes arc-en-ciel aux manches, rouge cérémoniel interdit aux roturiers par édit royal. On ne porte pas ce vêtement — on l’endosse comme une dynastie.',
      en: 'Five centuries woven into the cloth. Phoenix hand-embroidered on green-tea-dyed silk, rainbow bands at the sleeves, ceremonial red forbidden to commoners by royal edict. You don’t wear this garment — you take it on like a dynasty.',
    },
    lighting: { color: 0x1a1210, accent: 0xd4a960, spotColor: 0xfff0d5 },
    model: 'look1.glb',
    hideFloatingProps: true,
    pins: [
      {
        label: { fr: 'Brocart impérial', en: 'Imperial brocade' },
        detail: {
          fr: '원삼 · Soie tissée main',
          en: '원삼 · Hand-woven silk',
        },
        description: {
          fr: 'Tissage jacquard sur métier traditionnel. Fil de soie teint au thé vert pour le fond, motifs idéogrammiques "longue vie" rebrodés fil d’or 24 carats.',
          en: 'Jacquard woven on a traditional loom. Green-tea-dyed silk ground, "longevity" ideogram motifs re-embroidered in 24-karat gold thread.',
        },
        anchor: [0, 1.25, 0.22],
        atProgress: 0.14,
      },
      {
        label: { fr: '색동 · Saekdong', en: '색동 · Saekdong' },
        detail: {
          fr: 'Bandes arc-en-ciel sur les manches',
          en: 'Rainbow bands at the sleeves',
        },
        description: {
          fr: 'Cinq couleurs du pungsu — rouge, jaune, bleu, blanc, noir — alignées en bandes horizontales. Symbole de protection porté par les enfants de cour et les reines aux cérémonies.',
          en: 'The five pungsu colours — red, yellow, blue, white, black — laid in horizontal bands. A protective emblem worn by court children and queens at ceremony.',
        },
        anchor: [0.42, 1.05, 0.05],
        atProgress: 0.33,
      },
      {
        label: { fr: '흉배 · Rang royal', en: '흉배 · Royal rank' },
        detail: {
          fr: 'Emblème phénix brodé fil d’or',
          en: 'Phoenix emblem in gold thread',
        },
        description: {
          fr: 'Le rectangle brodé 봉황흉배 désigne le rang de reine. Double phénix mâle-femelle sur fond de pivoines — l’iconographie exacte des dames du palais de Changdeokgung.',
          en: 'The embroidered 봉황흉배 rectangle marks the rank of queen. Twin male-female phoenix on a peony ground — the exact iconography of the ladies of Changdeokgung palace.',
        },
        anchor: [0, 1.2, -0.2],
        atProgress: 0.52,
      },
      {
        label: { fr: '홍치마 · Jupe rouge', en: '홍치마 · Red skirt' },
        detail: {
          fr: 'Satin duchesse teinté cochenille',
          en: 'Duchesse satin, cochineal-dyed',
        },
        description: {
          fr: 'Sous-jupe en satin cinq couches. Teinture cochenille broyée à la main — le rouge cérémoniel de la cour Joseon, interdit aux roturiers par édit royal.',
          en: 'Five-layer satin underskirt. Hand-ground cochineal dye — the ceremonial red of the Joseon court, forbidden to commoners by royal edict.',
        },
        anchor: [0, 0.45, 0.25],
        atProgress: 0.69,
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
    name: { fr: 'Dentelle', en: 'Lace' },
    fabric: {
      fr: 'Velours bourgogne profond · Dentelle noire filigranée · Bustier armé',
      en: 'Deep burgundy velvet · Filigreed black lace · Boned bustier',
    },
    desc: {
      fr: 'Robe-fourreau en velours teint cinq fois. Le tissu absorbe la lumière, la dentelle la rend au décuple — travaillée en filigrane floral, posée en transparence sur un bustier baleiné. L’ourlet traîne, la coupe mord le corps.',
      en: 'Sheath dress in velvet dyed five times over. The fabric drinks light, the lace throws it back — filigreed in floral relief, laid over a boned bustier. The hem drags, the cut bites the body.',
    },
    lighting: { color: 0x0a0a0d, accent: 0xc0bdc8, spotColor: 0xfafaff, exposure: 1.1 },
    model: 'look2.glb',
    pins: [
      {
        label: { fr: 'Dentelle filigranée', en: 'Filigreed lace' },
        detail: {
          fr: 'Motif floral · maille fine',
          en: 'Floral motif · fine mesh',
        },
        anchor: [0, 1.1, 0.18],
        atProgress: 0.18,
      },
      {
        label: { fr: 'Traîne', en: 'Train' },
        detail: {
          fr: 'Dentelle sur velours · 60 cm au sol',
          en: 'Lace over velvet · 60 cm on the floor',
        },
        description: {
          fr: 'La dentelle déborde du velours et traîne derrière le pas. Rien ne la retient : la robe laisse une trace.',
          en: 'The lace spills past the velvet and drags behind each step. Nothing holds it back: the dress leaves a trace.',
        },
        anchor: [-0.2, 0.12, -0.45],
        atProgress: 0.48,
      },
      {
        label: { fr: 'Bustier armé', en: 'Boned bustier' },
        detail: {
          fr: 'Baleines spirale · zip invisible au dos',
          en: 'Spiral boning · invisible back zip',
        },
        description: {
          fr: 'Douze baleines spiralées tiennent le velours contre le corps. Le zip est dans le dos, la face est d’un seul tenant.',
          en: 'Twelve spiral bones hold the velvet against the body. The zip sits at the back; the front is one unbroken piece.',
        },
        anchor: [0.05, 1.3, 0.12],
        atProgress: 0.66,
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
    name: { fr: 'Givre', en: 'Frost' },
    fabric: {
      fr: 'Toile de coton écru · Twill denim brut · Ferrures métal apparentes',
      en: 'Raw cotton canvas · Unwashed denim twill · Exposed metal hardware',
    },
    desc: {
      fr: 'Tailleur déconstruit — coupe utilitaire, poches cargo empilées, zips argentés à la vue. Le luxe se déguise en équipement de terrain : surpiqûres contrastées, sangles tactiques, rien de décoratif. Le givre est dans la précision, pas dans l’ornement.',
      en: 'Deconstructed tailoring — utility cut, stacked cargo pockets, silver zips on display. Luxury disguised as field gear: contrast topstitching, tactical straps, nothing decorative. The frost lives in the precision, not the ornament.',
    },
    lighting: { color: 0x10131a, accent: 0xb8d4e8, spotColor: 0xeef4ff },
    model: 'look3.glb',
    pins: [
      {
        label: { fr: 'Poches cargo empilées', en: 'Stacked cargo pockets' },
        detail: {
          fr: 'Zip argenté · rabat double',
          en: 'Silver zip · double flap',
        },
        description: {
          fr: 'Trois volumes superposés sur la poitrine, chacun fermé par un zip métal apparent. La fonction tient lieu de motif.',
          en: 'Three stacked volumes on the chest, each closed by an exposed metal zip. Function stands in for pattern.',
        },
        anchor: [0.13, 1.05, 0.15],
        atProgress: 0.21,
      },
      {
        label: { fr: 'Manches froncées', en: 'Ruched sleeves' },
        detail: {
          fr: 'Coulisse serrée · coton écru',
          en: 'Drawn cord · raw cotton',
        },
        description: {
          fr: 'Coulisses tirées sur toute la longueur du bras, le volume tenu par la tension du cordon. Le givre est dans la précision du pli.',
          en: 'Drawcords pulled along the full length of the arm, the volume held by the tension of the cord. The frost lives in the precision of the fold.',
        },
        anchor: [0.36, 1.12, 0.02],
        atProgress: 0.48,
      },
      {
        label: { fr: 'Zips de genou', en: 'Knee zips' },
        detail: {
          fr: 'Ouverture latérale · twill denim brut',
          en: 'Side opening · raw denim twill',
        },
        description: {
          fr: 'Deux glissières symétriques ouvrent le pantalon à mi-jambe. Le denim n’est pas lavé : il marquera chaque pli de celle qui le porte.',
          en: 'Two symmetrical zips open the trouser at mid-leg. The denim is unwashed: it will record every crease of its wearer.',
        },
        anchor: [0.1, 0.3, 0.08],
        atProgress: 0.66,
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
    name: { fr: 'Clown', en: 'Clown' },
    fabric: {
      fr: 'Dentelle translucide cousue main · Coupe tailleur stricte · Fraise et flocons appliqués',
      en: 'Hand-stitched translucent lace · Strict tailoring · Ruff and snowflake appliqués',
    },
    desc: {
      fr: 'Veste structurée et pantalon taille haute, intégralement en dentelle. Rien à cacher, rien à offrir — la transparence comme armure. Les coutures suivent la coupe d’un costume masculin classique, la matière en démonte toute l’autorité.',
      en: 'Structured jacket and high-waisted trousers, wholly in lace. Nothing to hide, nothing to offer — transparency as armour. The seams follow the cut of a classic men’s suit, while the fabric dismantles its authority.',
    },
    lighting: { color: 0x120a14, accent: 0xe8a8c4, spotColor: 0xfff4fa, exposure: 0.5 },
    model: 'look4.glb',
    pins: [
      {
        label: { fr: 'Dentelle', en: 'Lace' },
        detail: {
          fr: 'Tissage filigrane cousue main',
          en: 'Hand-stitched filigree weave',
        },
        description: {
          fr: 'Dentelle ajourée reproduisant un motif floral édouardien. Posée sur une base tulle ton chair, le réseau de fils noirs lit au premier regard comme un tatouage.',
          en: 'Openwork lace replicating an Edwardian floral motif. Laid over a flesh-tone tulle base, the black thread network reads first as a tattoo.',
        },
        anchor: [0, 1.35, 0.18],
        atProgress: 0.25,
      },
      {
        label: { fr: 'Fraise', en: 'Ruff' },
        detail: {
          fr: 'Col plissé en dentelle rigidifiée',
          en: 'Pleated collar in stiffened lace',
        },
        description: {
          fr: 'Collerette élisabéthaine montée sur tulle amidonné. Le costume masculin se referme sur un col de cour.',
          en: 'An Elizabethan ruff set on starched tulle. The men’s suit closes on a court collar.',
        },
        anchor: [-0.2, 1.4, 0.15],
        atProgress: 0.55,
      },
      {
        label: { fr: 'Flocons', en: 'Snowflakes' },
        detail: {
          fr: 'Appliqués dentelle découpés main',
          en: 'Hand-cut lace appliqués',
        },
        description: {
          fr: 'Cristaux de dentelle cousus un à un sur la poitrine, l’épaule et le genou. La seule chose qui tombe de ce costume, c’est la neige.',
          en: 'Lace crystals stitched one by one on chest, shoulder and knee. The only thing that falls from this suit is snow.',
        },
        anchor: [-0.1, 1.06, 0.18],
        atProgress: 0.8,
      },
    ],
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

export const FINALE_SCROLL_FRACTION = 0.2
export const SCROLL_PER_LOOK = (1 - FINALE_SCROLL_FRACTION) / TOTAL_LOOKS
export const LOOKS_SCROLL_END = TOTAL_LOOKS * SCROLL_PER_LOOK
