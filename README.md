# NØIR HAUS — Défilé AW 26

Une expérience web immersive qui met en scène un défilé de haute couture en 3D, scrollable, bilingue, ouvert aux créateurs. Un seul plan-séquence : la caméra ne coupe jamais, elle voyage d'un look à l'autre.

> _Cinq siècles dans la trame. Phénix brodé main sur soie teinte au thé vert._

---

## Le projet

**NØIR HAUS** est une maison de couture fictive qui ne défile pas dans des salons parisiens, mais dans le navigateur. À chaque saison, quatre pièces sont mises en scène dans une expérience scroll-driven : la caméra orbite autour de chaque mannequin, des pins révèlent les détails de fabrication (broderies, doublures, finitions métal), puis elle glisse le long du podium jusqu'au look suivant qui émerge de la brume, et un finale rassemble les quatre looks sur une barre en T avant le rideau.

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

## L'expérience scroll, en détail

Tout le défilé est un **scroll virtuel** : la page ne défile pas, la molette, le trackpad, le tactile et le clavier (flèches, espace, PageUp/Down, Home/End) alimentent une seule valeur de progression, lissée par un **ressort amorti critique** indépendant du framerate (même ressenti à 60 et 120 Hz). Il n'y a plus de `scrollTo` natif qui se bat avec le navigateur.

- **Cap de vitesse globale** — la progression est plafonnée à `MAX_PROGRESS_PER_SECOND = 0.065`, soit un minimum d'environ 15 secondes pour traverser les 4 looks + finale, peu importe la rapidité d'input. Le cap descend à 55 % pendant les travellings pour laisser le temps au plan.
- **Cap d'écart cible/position** — la cible ne peut jamais s'écarter de plus de `MAX_AHEAD_BASE = 0.06` de la position actuelle : quand tu lâches la molette, la caméra s'arrête en moins d'une seconde.
- **Travelling continu entre les looks** — plus de coupure ni de fondu sur image figée. À la fin de l'orbite (local 0.78), la caméra passe à côté du mannequin (décalage latéral 1,7 m, légère montée, roll de 2°, FOV qui s'ouvre), file dans la brume, le look suivant émerge, le follow-spot et les rim lights balaient le podium, les couleurs de lumière (brouillard, fond, accents) se fondent d'une palette à l'autre, et l'orbite suivante s'enchaîne sans rupture. Tout est scrubbé : en arrière, le plan se rejoue à l'envers.
- **Zoom glissant sur les pins** — chaque pin a une fenêtre de zoom (plateau ±0.06, rampe 0.10). Quand deux fenêtres se chevauchent, les ancrages sont **pondérés** : la caméra glisse d'un détail au suivant le long du vêtement au lieu de dézoomer/rezoomer.
- **Snap doux sur les pins** — après 800 ms sans input, si le prochain pin du look est à moins de 0.10, la caméra y glisse via le ressort puis se pose 2 s. Le premier coup de molette **casse** la pose : aucun input n'est jamais ignoré.
- **Cartes de pins** — fenêtre de visibilité alignée sur le zoom (pleine à ±0.07, éteinte à ±0.14) pour qu'un seul détail soit lisible à la fois ; fond quasi opaque avec flou arrière, et la carte bascule à gauche du point quand l'ancre tombe dans le tiers droit de l'écran. Interaction **par appareil** : sur pointeur fin la description s'ouvre au survol du point et se referme dès que la souris en sort (rien ne reste collé) ; sur tactile un tap ouvre/ferme, un tap ailleurs ou un scroll referme.
- **Scroll dimming** — exposition, bloom et vignette baissent légèrement quand le rythme d'input dépasse ~1,5× le cap de vitesse (puis reviennent en ~0,25 s). Feedback visuel discret, jamais punitif.
- **Indicateur visuel** — barre dorée fine en bas (transform-only, aucun layout) avec une comète lumineuse à l'extrémité.
- **Rideau de replay** — le bouton « revoir » du finale ferme un rideau noir, remet tout à zéro, puis le rouvre sur le look 01.

---

## Stack technique

### Langage & build

- **TypeScript** (strict mode)
- **Vite** — bundler + dev server, manual chunks (three / gsap / postprocessing)
- **HTML5** + **CSS3** (custom properties, animations compositor-thread, `@media` queries, `backdrop-filter`)

### Rendu 3D

- **Three.js** r170 — WebGLRenderer, scene graph, materials PBR, shadows (mises à jour seulement quand la scène bouge), IBL, layers (les cosmétiques et les miroirs sont exclus des rendus de réflexion)
- **postprocessing** (pmndrs) — `EffectComposer` : `SMAAEffect` (anti-aliasing, l'`antialias` du canvas étant inutile derrière un composer), puis une seule `EffectPass` fusionnant `BloomEffect` (mipmap blur), `ChromaticAberrationEffect`, `ColorGradeEffect`, `VignetteEffect`, `NoiseEffect` et `DissolveEffect` (legacy) ; `AnamorphicPass` en opt-in
- **GLSL** — shaders maison (cône volumétrique avec noise drift + Fresnel, color grade analytique split-toning teal/cream, anamorphic separable blur ping-pong, dissolve grainé legacy)

### Lumière

Un vrai plateau de défilé, pas un viewer : trois sources dures sur du noir, et tout suit le sujet.

- **Key en poursuite** (`keySpot`) — relative à la caméra : 35° hors axe côté gauche, 45° d'élévation, 5,5 m du sujet. C'est elle qui porte l'ombre (PCF soft 2048). Elle tourne avec l'orbite, donc le modelé et le relief des normal maps (brocart, dentelle) restent constants.
- **Top light** (`mainSpot`) — fixe au zénith du sujet, plus faible ; c'est elle que matérialise le cône volumétrique.
- **Fill** chaud côté caméra, **rims** gauche/droite et **contre-jour** central derrière le sujet, tous relatifs à la caméra. Pendant le travelling, rims et contre-jour basculent sur le look suivant avant la key : il arrive en silhouette liserée, puis la poursuite le prend.
- **Palette par look** dans `looks.ts` (`lighting.color` brouillard/fond, `accent` rims et contre-jour, `spotColor` key et top) + **gain d'exposition** (`exposure`, 0,5 pour la dentelle blanche du look 04). Les palettes se fondent pendant le travelling.
- **HDR studio à 0,35** : l'environnement ne fait que les reflets, le spot fait la lumière.
- **Sol laqué** = base `MeshPhysicalMaterial` quasi sans spéculaire (reçoit la flaque du spot et l'ombre de contact) + `Reflector` par-dessus en blending additif avec atténuation Fresnel (reflet net au ras du sol pendant les travellings, discret vu de haut). Le cône et le public sont exclus du rendu de réflexion.

### Immersion (désactivable à l'unité)

Neuf couches, chacune un booléen dans [`src/config.ts`](src/config.ts) (`IMMERSION`) et un flag URL pour tester (`?off=gaze,dof`) :

| Clé | Ce que ça fait |
|---|---|
| `gaze` | Les mannequins suivent la caméra du regard (tête + cou, ±35°, décrochage quand on passe derrière). Respiration et report de poids ne s'activent que si le vêtement est skinné : les exports CLO de cette collection sont des maillages statiques, bouger le bassin ferait ressortir la peau à travers la robe. Procédural sur 5 os du rig CLO, `src/scene/rig.ts`. |
| `dof` | Profondeur de champ pendant les zooms sur pins, focus sur l'ancrage, bokeh qui monte avec le zoom. `DepthPass` dédiée (la depth partagée du composer est buguée sur ANGLE/Metal), activée seulement pendant le zoom. |
| `soundscape` | Rumeur de public en nappe (bruit filtré + LFO, gonfle aux flashs), talons et déclics spatialisés sur la position du mannequin, souffle grave au départ des travellings, drone qui se ferme au passe-bas quand on scrolle vite. Web Audio, zéro fichier. |
| `music` | Rythmique de podium synthétisée : kick quatre temps à 116 BPM, sub en mi mineur sous le drone, charleys en contretemps, clap discret, sidechain qui fait respirer la nappe. Entre au cue d'ouverture, s'étouffe au passe-bas pendant les travellings, redescend sur la carte finale. Un vrai morceau peut la remplacer via `MUSIC_TRACK_URL` dans `src/audio/audio.ts`. |
| `opening` | Lumières de salle à 5 % pendant 1,1 s après le chargement, puis cue : spot qui claque, flash bloom, thunk + shutter, scroll libéré à 1,7 s. |
| `parallax` | ±2° de lacet et ±1,2° de tangage sur la position souris, inertie 0,35 s. |
| `flashwall` | Flashs visibles dans le public (sprites billboard texturés : cœur brûlé, halo, traînées anamorphiques, taille et inclinaison aléatoires, plein feu 40 ms puis décroissance), synchronisés au déclic et à la PointLight ; 48 écrans de téléphone à bords doux qui s'allument et s'éteignent ; tempête de flashs sur l'alignement final. |
| `speedfx` | Aberration chromatique, vignette et flou radial qui montent avec la vitesse caméra pendant les travellings. |
| `letterbox` | Bandes 2.35 (11 vh) qui se ferment pendant les travellings et se rouvrent à l'arrivée. |

### Tester sur d'autres appareils

Le serveur de dev écoute sur le réseau local (`host: true`) : l'URL « Network » affichée au lancement (ex. `http://192.168.1.10:5174/`) s'ouvre depuis n'importe quel appareil sur le même Wi-Fi.

1. **Build de prod d'abord** — `npm run build && npm run preview -- --host` : le mode dev n'est ni minifié ni compressé, il sous-estime les perfs réelles.
2. **Ajouter `?stats=1`** à l'URL sur l'appareil testé : fps, ms par frame, DPR courant, tier, palier de dégradation et GPU s'affichent en haut à droite, sans devtools.
3. **Parcours de référence** (même ordre sur chaque appareil) : attendre la fin de l'ouverture, orbiter le look 1, zoomer sur deux pins, traverser vers le look 2 vite puis lentement, activer le son, finir le finale et revenir en arrière. Noter les fps mini et le palier atteint.
4. **Téléphone et tablette** : le mur mobile doit s'afficher, et rien d'autre ne doit se charger (vérifier dans l'onglet réseau qu'aucun `.glb` ne part). L'iPad en mode « site de bureau » avec trackpad est détecté via `maxTouchPoints`.
5. **Safari** : ouvrir la même URL dans Safari sur le Mac (moteur différent de Chrome, audio soumis au geste utilisateur, preloads désactivés exprès).
6. **Simuler une petite machine** : `?tier=low`, ou `?dpr=2` sur un grand écran pour voir la résolution adaptative descendre, ou Chrome DevTools → Performance → CPU 4× slowdown pour déclencher l'échelle de dégradation (`[noir] palier qualité n` dans la console).
7. **Vérifier le son** : le bouton « Son » doit lancer rumeur + rythmique ; sur Safari le premier clic est obligatoire (politique autoplay).

### Loaders & assets

- **GLTFLoader** — chargement des avatars CLO3D (look 01 d'abord, les trois autres en parallèle), textures des looks suivants pré-uploadées au GPU une par frame pour éviter tout à-coup au premier travelling
- **MeshoptDecoder** — décompression Meshopt des GLB (les 4 looks sont en Meshopt + WebP, 20 / 3,7 / 17,5 / 6,5 Mo)
- **EXRLoader** + **PMREMGenerator** — HDR studio 2k (4,6 Mo) pour Image-Based Lighting
- **Reflector** (Three addon) — miroir additif à Fresnel du podium et du crossbar T-bar, sur une base laquée éclairée (shader patché, voir « Lumière »)
- **RectAreaLight** + `RectAreaLightUniformsLib` — softbox du finale
- **InstancedMesh** — silhouettes du public (3 variantes dessinées sur canvas : tête, cou, épaules, bras, téléphone à la main, lumière de rebond cuite sur le crâne et les épaules ; billboard cylindrique vers la caméra et balancement dans le vertex shader, fondu à moins de 2 m), étoiles scintillantes (140 instances), flashs du pit photographes
- **mergeGeometries** — truss et pit fusionnés par matériau (3 + 2 draw calls au lieu de ~230)

### Animation & transitions

- **GSAP** — micro-timelines (bloom flash, flash light, cartel, rideau de replay). Plus de ScrollTrigger : le scroll est virtuel.
- **Travelling continu** — la transition entre looks est une chorégraphie caméra scrubbée au scroll (`src/scene/camera.ts`, `travelPose`), pas un overlay. Aucune capture de frame, aucun écran noir, réversible.
- **Three AnimationMixer** — walk cycle CLO scrubé par le scroll (chaque animation GLB est mappée sur le scroll local du look)
- **CSS `@keyframes`** — intro reveal char-par-char, mobile block, hint poster, scroll hint bobbing (compositor-thread, immune au main thread blocking)

### Audio

- **Web Audio API** native — ambient drone synthétisé (4 oscillateurs sine en accord E mineur + detuning, ConvolverNode reverb avec IR généré dynamiquement, LFO sur lowpass), shutter feutré (whoosh lowpass dynamique au lieu de click), heel taps, finale chord en sustain 7.5 s

### i18n

- Système maison — dictionnaire FR/EN central dans `src/i18n.ts`, auto-détection via `navigator.language`, persistance `localStorage`, sync `<html lang>`, type `Localized = { fr, en }` pour le contenu éditorial des looks et pins. Toggle FR/EN dans le chrome.

### Post-FX

Pipeline complet (compose order) :
1. `RenderPass` — la scène 3D
2. `BloomEffect` — halo sur les hautes lumières
3. `ChromaticAberrationEffect` — drift coloré aux bords
4. `ColorGradeEffect` (custom) — split-toning teal/cream + S-curve + désat
5. `VignetteEffect` — fall-off en coin
6. `NoiseEffect` — grain de pellicule en overlay blend
7. `DissolveEffect` (custom) — legacy, dispo via flag

L'**exposition**, le **bloom intensity** et la **vignette darkness** sont modulés en temps réel par le rythme d'input pour le dimming. La **résolution est adaptative** : le pixel ratio démarre à 1.5× sur les écrans haute densité et monte jusqu'à 2× ou descend jusqu'à 1× par paliers de 0.25 selon le temps de frame mesuré (`?off=adaptive` pour figer).

### Quality detection

`detectQuality()` scrute UA, `hardwareConcurrency`, `deviceMemory` → tier `low` ou `high`. Le tier conditionne la plage de pixel ratio, shadow map size, résolution des Reflectors, audience row count, particle count, Reflector activé/non, HDR env activé/non, SMAA et postfx individuels.

En cours de session, la résolution adaptative descend par pas de 0,25 jusqu'au plancher du tier (0,75 en `high`). Si la frame reste au-dessus de 24 ms pendant 2,5 s une fois au plancher, une **échelle de dégradation** retire une couche à la fois : miroirs du sol, puis shadow map 1024 + profondeur de champ, puis public. Elle ne remonte jamais dans la session (pas d'oscillation). Test : `__noir.runway.degrade(n)` en dev.

### Mobile

Mobile **bloqué** au niveau JS+CSS dès le module init (`matchMedia('(pointer: coarse), (max-width: 900px)')`). Aucun asset 3D téléchargé sur mobile. Page de bascule éditoriale invitant à revenir sur desktop.

### OpenGraph / partage social

`<meta property="og:image">` pointe sur `/og-image.jpg` (1200×630, 218 KB), généré une fois via le mode capture P puis converti via `sips -s format jpeg`. Twitter Card `summary_large_image` configurée. Title 57 chars, description 145 chars (dans les fenêtres optimales).

### Outillage & perf

- `feature(key, default)` — feature flags URL-driven (`?off=bloom,chromatic` ou `?on=anamorphic`) pour debugging et binary search
- `renderer.compile()` — pré-compilation des shaders dès que les mannequins sont chargés (évite le shader compilation jank au premier render)
- `matrixAutoUpdate = false` sur les meshes statiques (truss, edges, photographer pit, backdrop)
- Préchargement (`<link rel="preload">`) du HDR + premier GLB pour réduire le LCP

### Déploiement

- **Git** + **GitHub** ([CoulibalyT/noir](https://github.com/CoulibalyT/noir))
- **Vercel** — hébergement + CI build automatique sur push `main`
- `vercel.json` — `Cache-Control: max-age=31536000, immutable` sur les assets pour les visites répétées instantanées

---

## Pourquoi ces choix techniques

| Choix | Alternative | Raison |
|---|---|---|
| **Three.js vanilla** | React Three Fiber | Contrôle total sur la scene graph, le render loop et les passes custom. Pas besoin de l'overhead React pour une expérience single-page. |
| **Vite + TypeScript** | Next.js / Webpack | Single-page WebGL, pas de SSR utile, build léger, HMR rapide pendant le dev. |
| **postprocessing (pmndrs)** | EffectComposer Three.js direct | API plus moderne, Effect chain dans une seule pass shader (moins de frame buffer swaps), gestion mips correcte. |
| **Scroll virtuel + ressort** | Scroll natif + ScrollTrigger scrub | Une seule source de vérité, indépendante du framerate, aucun `scrollTo` qui se bat avec le navigateur, et le cap de vitesse devient trivial. |
| **Travelling scrubbé** | Cross-fade sur image figée | Aucune coupure, réversible au scroll arrière, pas de capture canvas (donc pas d'à-coup), et c'est le moment le plus « défilé » de l'expérience. |
| **GSAP** | CSS animations / Web Animations API | Micro-timelines (flash, cartel, rideau) avec eases pro et kill/replay propres. |
| **i18n maison** | i18next, FormatJS | 30 lignes de code, zéro dep externe, type-safe avec union de string keys. |
| **Mailto** | Form embed (Tally, Typeform) | Zero-friction, pas de service tiers, l'email arrive direct dans la boîte du créateur. |
| **Web Audio synth** | Fichiers MP3/OGG | Pas d'asset audio à télécharger, le son est procédural et adapté au tempo du défilé, modifiable au runtime. |

---

## Structure du repo

```
defile/
├── public/
│   ├── hdri/                  # HDR studio (EXR 2k utilisé ; le 4k d'origine est conservé)
│   ├── models/                # look1..look4.glb (Meshopt + WebP) ; les dossiers glTF d'origine sont conservés
│   └── og-image.jpg           # social preview 1200×630
├── src/
│   ├── audio/audio.ts         # Web Audio API (ambient + cues)
│   ├── data/
│   │   ├── looks.ts           # 4 Look definitions (bilingue)
│   │   └── credits.json       # crédits CLO-SET (creator, portfolio, source)
│   ├── scene/
│   │   ├── camera.ts          # scroll virtuel (ressort amorti), orbit, travelling entre looks, caps
│   │   ├── environment.ts     # HDR + PMREM
│   │   ├── runway.ts          # podium laqué + miroirs Fresnel, rig lumière (key/top/fill/rims/back), audience GPU-sway, mur de flashs, truss fusionné, étoiles
│   │   ├── rig.ts             # regard caméra (+ respiration/report de poids si vêtement skinné)
│   │   ├── models.ts          # GLB loader + tuneCloMaterials (PBR fixups)
│   │   ├── postfx.ts          # composer chain, SMAA, DoF (DepthPass dédiée), flou radial, ColorGrade, Dissolve
│   │   ├── anamorphic.ts      # AnamorphicPass séparable (opt-in)
│   │   └── backdrop.ts        # plane NØIR HAUS finale
│   ├── ui/
│   │   ├── intro.ts           # poster d'ouverture (CSS-driven)
│   │   ├── lookInfo.ts        # name / fabric / desc top-right + fadeOut/swap/fadeIn
│   │   ├── credits.ts         # marquee parallax + cartel
│   │   ├── pins.ts            # hotspots ancrés sur le mannequin (projection après sync des matrices caméra)
│   │   ├── finale.ts          # overlay final (credits + submit CTA + auteur)
│   │   ├── poster.ts          # capture 9:16 affichée en overlay + downloadable
│   │   └── cursor.ts          # cursor custom (ring + dot)
│   ├── i18n.ts                # FR/EN dictionary + Localized helper
│   ├── config.ts              # interrupteurs des couches d'immersion
│   ├── features.ts            # feature flags URL-driven
│   ├── quality.ts             # tier detection
│   ├── main.ts                # bootstrap, frame loop, poursuite lumière relative caméra, snap/dwell, dimming, résolution adaptative, warmup textures
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
localhost:5174/?tier=low               # force le palier qualité « low » (sans miroir ni HDR, 4 rangs de public, SMAA off)
localhost:5174/?stats=1                # HUD de test : fps, ms, DPR, tier, palier de dégradation, GPU
localhost:5174/?on=anamorphic          # active les streaks anamorphic (opt-in)
localhost:5174/?off=truss,stars        # scène brute
localhost:5174/?only=cone              # ne garde que le cône volumétrique
localhost:5174/?off=smaa,adaptive      # sans anti-aliasing SMAA, résolution figée
localhost:5174/?dpr=2                  # simule un écran Retina (plage de pixel ratio) sur un écran 1x
localhost:5174/?off=gaze,dof,letterbox # coupe des couches d'immersion (liste des clés dans src/config.ts)
```

En dev, `window.__noir` expose le rig caméra (`__noir.rig.jumpTo(0.5)`), l'état de scroll et la résolution adaptative.

Raccourcis clavier :

```
P                         Capture une affiche 9:16 du frame courant (overlay + download optionnel)
ESC                       Ferme le poster overlay
↑ ↓ Espace PageUp/Down    Input scroll clavier (Home / End pour les extrémités)
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

Les vêtements 3D du défilé AW 26 sont l'œuvre de créateurs CLO-SET Connect, dont les portfolios sont liés directement dans l'expérience. Aucun fichier source n'a été modifié au-delà des fixups matériaux nécessaires au rendu Three.js (transmission, roughness sur les cheveux, velours exporté semi-transparent rendu opaque, plancher d'opacité sur les dentelles). Les crédits sont visibles à chaque transition (cartel) et listés dans le finale.

HDR studio : [Photo Studio 01](https://polyhaven.com/a/photo_studio_01) — Poly Haven (CC0).

Polices : Cormorant Garamond + Outfit, via Google Fonts.

---

> NØIR HAUS · Paris · AW 26
