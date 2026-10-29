// Parcours caméra de la vidéo LinkedIn (secondes → progression 0..1). Interpolation smoothstep
// entre clés ; le ressort et les plafonds de vitesse du rig lissent le reste.
//  0–1.8   ouverture (noir, lumières au cue à 1,1 s)
//  →6.0    orbite lente autour du look 1, premiers pins
//  →10.5   travelling vers le look 2 (letterbox, souffle, flou de vitesse)
//  →12.2   pose sur « Dentelle filigranée » (survol : la description s'ouvre)
//  →14.5   glisse jusqu'à la traîne
//  →19.0   travelling vers le look 3 (« Manches froncées »)
//  →20.5   respiration look 3
//  →24.5   travelling vers le look 4 (« Fraise »)
//  →25.8   respiration look 4
//  →30.0   finale : panoramique, alignement, tempête de flashs, carte de fin
//  →32.0   carte de fin tenue
module.exports.PATH = [
  [0.0, 0.0],
  [1.8, 0.0],
  [6.0, 0.09],
  [10.5, 0.236],
  [12.2, 0.236],
  [14.5, 0.31],
  [19.0, 0.496],
  [20.5, 0.53],
  [24.5, 0.71],
  [25.8, 0.76],
  [30.0, 1.0],
  [32.0, 1.0],
]
module.exports.HOVER_WINDOW = [10.9, 12.4]
