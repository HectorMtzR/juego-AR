// Todas las constantes ajustables del juego viven aquí.
export const CONFIG = {
  GAME_DURATION: 60,          // segundos
  START_LIVES: 3,
  STREAK_FOR_BONUS: 3,
  BONUS_MULTIPLIER: 2,
  KICK_ZONE_RADIUS: 0.12,     // unidades del marcador
  LANE_START_X: -0.7,
  LANE_END_X: 0.7,
  LEVELS: [
    { minGoals: 0,  speed: 0.35, spawnInterval: 1.2, weights: { soccer: 60, beach: 25, rock: 15 } },
    { minGoals: 5,  speed: 0.5,  spawnInterval: 0.9, weights: { soccer: 50, beach: 25, rock: 25 } },
    { minGoals: 10, speed: 0.7,  spawnInterval: 0.6, weights: { soccer: 45, beach: 25, rock: 30 } },
  ],
  VIBRATION: { tap: 15, goal: 60, rock: 250 }, // ms
  MODEL_SIZES: { soccer: 0.08, beach: 0.11, rock: 0.09, goal: 0.45 }, // tamaño máx. en unidades del marcador (ajustable)
  MODEL_YAW: { soccer: 0, beach: 0, rock: 0, goal: 185 },             // giro en grados sobre el eje vertical del modelo (goal.glb viene de espaldas y 5° chueco)

  // Postura del marcador. true: parado (pantalla o pared); la cancha sale del marcador
  // hacia la cámara y la portería queda de frente. false: acostado en una mesa; la
  // cancha queda encima del marcador.
  MARKER_UPRIGHT: true,
  UPRIGHT_FLOOR_Y: -0.5,      // altura del pasto con el marcador parado (-0.5 = borde inferior del marcador)

  // Cancha, en unidades del marcador (el marcador mide 1 de ancho y +Y es el fondo)
  FIELD_WIDTH: 1.5,
  FIELD_DEPTH: 1.2,
  GOAL_Y: 0.4,                // centro de la portería
  LANE_Y: -0.3,               // carril de objetos y centro de la zona de tiro

  // Marcador compilado con el compilador de MindAR (1 objetivo)
  TARGET_SRC: 'assets/targets/marker.mind',
  TARGET_INDEX: 0,
};
