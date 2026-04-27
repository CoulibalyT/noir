# NØIR HAUS — Défilé AW 26

Une expérience web immersive qui met en scène un défilé de haute couture en 3D, scrollable, bilingue, ouvert aux créateurs.

> _Cinq siècles dans la trame. Phénix brodé main sur soie teinte au thé vert._

---

## Le projet

**NØIR HAUS** est une maison de couture fictive qui ne défile pas dans des salons parisiens, mais dans le navigateur. À chaque saison, quatre pièces sont mises en scène dans une expérience scroll-driven : la caméra orbite autour de chaque mannequin, des pins révèlent les détails de fabrication (broderies, doublures, finitions métal), puis un finale rassemble les quatre looks sur une barre en T avant le rideau.

### Le pourquoi

- **Démocratiser le défilé**. Une fashion week à Paris coûte 200–500 k€ par maison. Une expérience WebGL bien pensée peut faire vivre la même intensité éditoriale, à la portée d'un créateur indépendant qui n'aura jamais de slot Paris Fashion Week.
- **Honorer le travail des artisans CLO3D**. Les vêtements présentés viennent de portfolios CLO-SET Connect publics — chaque créateur est crédité (cartel + finale + lien direct vers son portfolio).
- **Ouvrir la prochaine saison aux soumissions**. Le finale héberge un appel à création : n'importe qui peut envoyer son GLB / fichier CLO / lien et passer dans la saison suivante.
- **Construire un portfolio technique**. Le projet sert aussi de vitrine de mes compétences en WebGL, animation, post-processing, et UX éditoriale.

### Le défilé AW 26

| # | Look | Créateur | Plateforme |
|---|---|---|---|
| 01 | **Héritage** — brocart de soie, fils d'or 24 carats, dentelle rouge cochenille | 한국문화정보원 / KCISA | CLO-SET Connect |
| 02 | **Dentelle** — velours bourgogne, dentelle filigranée | AG | CLO-SET Connect |
| 03 | **Givre** — toile de coton écru, twill denim brut | kapsamun.designer | CLO-SET Connect |
| 04 | **Clown** — dentelle translucide, coupe tailleur stricte, finitions métal | CLO_KET | CLO-SET Connect |

---

## Stack technique

### Langage & build

- **TypeScript** (strict mode)
- **Vite** — bundler + dev server, manual chunks (three / gsap / postprocessing)
- **HTML5** + **CSS3** (custom properties, animations compositor-thread, `@media` queries, `backdrop-filter`)

### Rendu 3D

- **Three.js** r170 — WebGLRenderer, scene graph, materials PBR, shadows, IBL
- **postprocessing** (pmndrs) — `EffectComposer` chain : `BloomEffect`, `ChromaticAberrationEffect`, `VignetteEffect`, `NoiseEffect` + passes maison (`DissolveEffect`, `ColorGradeEffect`, `AnamorphicPass`)
- **GLSL** — shaders maison (cône volumétrique avec noise drift + Fresnel, dissolve grainé avec edge glow, color grade analytique split-toning, anamorphic separable blur ping-pong)

### Loaders & assets

- **GLTFLoader** — chargement des avatars CLO3D
- **MeshoptDecoder** — décompression Meshopt des GLB
- **EXRLoader** + **PMREMGenerator** — HDR studio pour Image-Based Lighting
- **Reflector** (Three addon) — sol réfléchissant du podium et du crossbar T-bar
- **RectAreaLight** + `RectAreaLightUniformsLib` — softbox du finale
- **InstancedMesh** — silhouettes du public (3 variantes), étoiles scintillantes (140 instances)

### Animation

- **GSAP** + **ScrollTrigger** — timelines de transition entre looks (dissolve in / flash / dissolve out / cartel reveal), bloom flash, dissolve uniform tweening
- **Three AnimationMixer** — walk cycle CLO scrubé par le scroll
- **CSS `@keyframes`** — intro reveal char-par-char, mobile block, hint poster (compositor-thread, immune au main thread blocking)

### Audio

- **Web Audio API** native — ambient drone synthétisé (4 oscillateurs sine en accord E mineur + detuning, ConvolverNode reverb avec IR généré dynamiquement, LFO sur lowpass), shutter clicks, heel taps, finale chord en sustain 7.5 s

### i18n

- Système maison — dictionnaire FR/EN central dans `src/i18n.ts`, auto-détection via `navigator.language`, persistance `localStorage`, sync `<html lang>`, type `Localized = { fr, en }` pour le contenu éditorial des looks et pins

### Post-FX

Pipeline complet (compose order) :
1. `RenderPass` — la scène 3D
2. `BloomEffect` — halo sur les hautes lumières
3. `ChromaticAberrationEffect` — drift coloré aux bords
4. `ColorGradeEffect` (custom) — split-toning teal/cream + S-curve + désat
5. `VignetteEffect` — fall-off en coin
6. `NoiseEffect` — grain de pellicule en overlay blend
7. `DissolveEffect` (custom) — wipe noise pour les transitions de looks

### Quality detection

`detectQuality()` scrute UA, `hardwareConcurrency`, `deviceMemory` → tier `low` ou `high`. Le tier conditionne pixel ratio, shadow map size, audience row count, particle count, Reflector activé/non, HDR env activé/non, postfx individuels.

### Mobile

Mobile **bloqué** au niveau JS+CSS dès le module init (`matchMedia('(pointer: coarse), (max-width: 900px)')`). Aucun asset 3D téléchargé sur mobile. Page de bascule éditoriale invitant à revenir sur desktop.

### Outillage

- `feature(key, default)` — feature flags URL-driven (`?off=bloom,chromatic` ou `?on=anamorphic`) pour debugging et binary search
- `renderer.compile()` — pré-compilation des shaders dès que les mannequins sont chargés (évite le shader compilation jank au premier render)
- `matrixAutoUpdate = false` sur les meshes statiques (truss, edges, photographer pit, backdrop)

### Déploiement

- **Git** + **GitHub** ([CoulibalyT/noir](https://github.com/CoulibalyT/noir))
- **Vercel** — hébergement + CI build automatique sur push `main`
- `vercel.json` — `Cache-Control: max-age=31536000, immutable` sur les assets pour les visites répétées instantanées
- Préchargement (`<link rel="preload">`) du HDR + premier GLB pour réduire le LCP

---

## Pourquoi ces choix techniques

| Choix | Alternative | Raison |
|---|---|---|
| **Three.js vanilla** | React Three Fiber | Contrôle total sur la scene graph, le render loop et les passes custom. Pas besoin de l'overhead React pour une expérience single-page. |
| **Vite + TypeScript** | Next.js / Webpack | Single-page WebGL, pas de SSR utile, build léger, HMR rapide pendant le dev. |
| **postprocessing (pmndrs)** | EffectComposer Three.js direct | API plus moderne, Effect chain dans une seule pass shader (moins de frame buffer swaps), gestion mips correcte. |
| **GSAP** | CSS animations / Web Animations API | Timelines complexes avec offsets relatifs, scrub avec inertie, eases pro, kill/replay propres. |
| **i18n maison** | i18next, FormatJS | 30 lignes de code, zéro dep externe, type-safe avec union de string keys. |
| **Mailto** | Form embed (Tally, Typeform) | Zero-friction, pas de service tiers, l'email arrive direct dans la boîte du créateur. |
| **Web Audio synth** | Fichiers MP3/OGG | Pas d'asset audio à télécharger, le son est procédural et adapté au tempo du défilé, modifiable au runtime. |

---

## Structure du repo

```
defile/
├── public/
│   ├── hdri/                  # HDR studio (EXR 4k)
│   └── models/                # GLB des 4 looks (Meshopt-compressed)
├── src/
│   ├── audio/audio.ts         # Web Audio API (ambient + cues)
│   ├── data/
│   │   ├── looks.ts           # 4 Look definitions (bilingue)
│   │   └── credits.json       # crédits CLO-SET (creator, portfolio, source)
│   ├── scene/
│   │   ├── camera.ts          # rig caméra scroll-driven (orbit + finale arc)
│   │   ├── environment.ts     # HDR + PMREM
│   │   ├── runway.ts          # podium T-bar, audience, truss, étoiles, lights
│   │   ├── models.ts          # GLB loader + tuneCloMaterials (PBR fixups)
│   │   ├── postfx.ts          # composer chain + DissolveEffect + ColorGradeEffect
│   │   ├── anamorphic.ts      # AnamorphicPass séparable (opt-in)
│   │   └── backdrop.ts        # plane NØIR HAUS finale
│   ├── ui/
│   │   ├── intro.ts           # poster d'ouverture (CSS-driven)
│   │   ├── lookInfo.ts        # name / fabric / desc top-right
│   │   ├── credits.ts         # marquee parallax + cartel
│   │   ├── pins.ts            # hotspots ancrés sur le mannequin
│   │   ├── finale.ts          # overlay final (credits + submit CTA + auteur)
│   │   ├── poster.ts          # capture 9:16 PNG affichée + downloadable
│   │   └── cursor.ts          # cursor custom (ring + dot)
│   ├── i18n.ts                # FR/EN dictionary + Localized helper
│   ├── features.ts            # feature flags URL-driven
│   ├── quality.ts             # tier detection
│   ├── main.ts                # bootstrap, frame loop, transitions
│   └── style.css              # tout le chrome UI
├── index.html
├── vite.config.ts
├── vercel.json                # cache headers
└── tsconfig.json
```

---

## Lancer en local

```bash
cd defile
npm install
npm run dev          # localhost:5174
```

Autres scripts :

```bash
npm run build        # production build (tsc --noEmit && vite build)
npm run preview      # preview du build prod
npm run typecheck    # tsc --noEmit
```

Feature flags utiles pour le debug :

```
localhost:5174/?off=bloom,chromatic    # désactive la chaîne post-FX
localhost:5174/?off=audience           # cache le public
localhost:5174/?on=anamorphic          # active les streaks anamorphic (opt-in)
localhost:5174/?off=truss,stars        # scène brute
localhost:5174/?only=cone              # ne garde que le cône volumétrique
```

Raccourci clavier :

```
P       Capture une affiche 9:16 du frame courant (avec crédits intégrés)
ESC     Ferme le poster overlay
```

---

## Soumettre une création

NØIR HAUS ouvre son défilé aux créateurs. Pour participer à la prochaine saison :

📩 [coulibaly.tene00@gmail.com](mailto:coulibaly.tene00@gmail.com)

Joindre :
- un fichier **GLB** (idéalement Meshopt-compressed) ou un projet **CLO3D** brut
- ou un lien vers le portfolio (CLO-SET Connect, Sketchfab, etc.)
- éventuellement une note sur la pièce, son histoire, le fil narratif

Les sélections sont créditées sur la cartel pendant le défilé et dans le finale, avec lien vers le portfolio.

---

## Auteur

**Tene Coulibaly** — créatif + dev fullstack basé à Paris.

- Portfolio : [tene-coulibaly.vercel.app](https://tene-coulibaly.vercel.app/)
- Email : [coulibaly.tene00@gmail.com](mailto:coulibaly.tene00@gmail.com)

---

## Crédits

Les vêtements 3D du défilé AW 26 sont l'œuvre de créateurs CLO-SET Connect, dont les portfolios sont liés directement dans l'expérience. Aucun fichier source n'a été modifié au-delà des fixups matériaux nécessaires au rendu Three.js (transmission, roughness sur les cheveux). Les crédits sont visibles à chaque transition (cartel) et listés dans le finale.

HDR studio : [Photo Studio 01](https://polyhaven.com/a/photo_studio_01) — Poly Haven (CC0).

Polices : Cormorant Garamond + Outfit, via Google Fonts.

---

> NØIR HAUS · Paris · AW 26
