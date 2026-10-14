// Lógica del juego: estados, spawns, puntaje, vidas, tiempo, niveles y racha.
// No toca ni la escena ni el DOM: avisa de lo que pasa mediante `handlers`.
import { CONFIG } from './config.js';

const BEST_KEY = 'metegol-ar-best';

// localStorage puede no existir o estar bloqueado (modo privado): sin él el
// juego sigue funcionando, solo no recuerda la mejor marca.
function loadBest() {
  try {
    const value = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // sin almacenamiento: la marca solo dura esta sesión
  }
}

function pickType(weights) {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [type, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll < 0) return type;
  }
  return Object.keys(weights)[0];
}

// Número de nivel (desde 1) que corresponde a una cantidad de goles
function levelFor(goals) {
  let level = 1;
  CONFIG.LEVELS.forEach(({ minGoals }, i) => {
    if (goals >= minGoals) level = i + 1;
  });
  return level;
}

// handlers:
//   onStart()                     empieza una partida
//   onSpawn(type, x)              entra un objeto al carril
//   onMove(x)                     el objeto avanzó
//   onLeave()                     el objeto salió del carril sin ser pateado
//   onKick(result, points)        'goal' | 'beach' | 'rock' | 'air' y los goles que sumó
//   onLevelUp(level)              se alcanzó un nivel nuevo
//   onChange(state)               cambió algo del HUD (también el tiempo)
//   onEnd(reason, state, record)  'time' | 'lives'; `record` si hay nueva mejor marca
export function createGame(handlers) {
  const state = {
    playing: false,
    goals: 0,
    lives: 0,
    timeLeft: 0,
    level: 1,
    streak: 0,     // goles seguidos
    bonus: false,  // racha activa: el siguiente gol vale BONUS_MULTIPLIER
    best: loadBest(),
  };
  let object = null; // objeto que cruza el carril: { type, x, dir }
  let spawnTimer = 0;

  const level = () => CONFIG.LEVELS[state.level - 1];

  function start() {
    state.playing = true;
    state.goals = 0;
    state.lives = CONFIG.START_LIVES;
    state.timeLeft = CONFIG.GAME_DURATION;
    state.level = 1;
    state.streak = 0;
    state.bonus = false;
    object = null;
    spawnTimer = level().spawnInterval;
    handlers.onStart();
    handlers.onChange(state);
  }

  function end(reason) {
    state.playing = false;
    object = null;
    const record = state.goals > state.best;
    if (record) {
      state.best = state.goals;
      saveBest(state.best);
    }
    handlers.onEnd(reason, state, record);
  }

  function spawn() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    object = {
      type: pickType(level().weights),
      x: dir > 0 ? CONFIG.LANE_START_X : CONFIG.LANE_END_X,
      dir,
    };
    handlers.onSpawn(object.type, object.x);
  }

  // dt en segundos. Si no se llama (marcador perdido), el juego queda en pausa.
  function update(dt) {
    if (!state.playing) return;

    if (object) {
      object.x += object.dir * level().speed * dt;
      if (object.x < CONFIG.LANE_START_X || object.x > CONFIG.LANE_END_X) {
        // Dejar pasar un objeto no tiene efecto, ni siquiera sobre la racha
        object = null;
        spawnTimer = level().spawnInterval;
        handlers.onLeave();
      } else {
        handlers.onMove(object.x);
      }
    } else {
      spawnTimer -= dt;
      if (spawnTimer <= 0) spawn();
    }

    state.timeLeft = Math.max(0, state.timeLeft - dt);
    handlers.onChange(state);
    if (state.timeLeft === 0) end('time');
  }

  function kick() {
    if (!state.playing) return;

    let result = 'air';
    // La zona de tiro está centrada en X = 0
    if (object && Math.abs(object.x) <= CONFIG.KICK_ZONE_RADIUS) {
      result = object.type === 'soccer' ? 'goal' : object.type;
      // Un objeto solo se patea una vez: sale del carril
      object = null;
      spawnTimer = level().spawnInterval;
    }

    let points = 0;
    if (result === 'goal') {
      points = state.bonus ? CONFIG.BONUS_MULTIPLIER : 1;
      state.goals += points;
      state.streak += 1;
    } else {
      // Pelota de playa, roca o patada al aire rompen la racha
      state.streak = 0;
      if (result === 'rock') state.lives -= 1;
    }
    state.bonus = state.streak >= CONFIG.STREAK_FOR_BONUS;
    handlers.onKick(result, points);

    const reached = levelFor(state.goals);
    if (reached > state.level) {
      state.level = reached;
      handlers.onLevelUp(reached);
    }

    handlers.onChange(state);
    if (state.lives <= 0) end('lives');
  }

  return { state, start, update, kick };
}
