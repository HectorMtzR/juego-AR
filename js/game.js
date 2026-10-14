// Lógica del juego: estados, spawns, puntaje, vidas y tiempo.
// No toca ni la escena ni el DOM: avisa de lo que pasa mediante `handlers`.
// Los niveles y la racha llegan en la Fase 4.
import { CONFIG } from './config.js';

function pickType(weights) {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [type, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll < 0) return type;
  }
  return Object.keys(weights)[0];
}

// handlers:
//   onStart()             empieza una partida
//   onSpawn(type, x)      entra un objeto al carril
//   onMove(x)             el objeto avanzó
//   onLeave()             el objeto salió del carril sin ser pateado
//   onKick(result)        'goal' | 'beach' | 'rock' | 'air'
//   onChange(state)       cambió algo del HUD (también el tiempo)
//   onEnd(reason, state)  'time' | 'lives'
export function createGame(handlers) {
  const state = { playing: false, goals: 0, lives: 0, timeLeft: 0 };
  let object = null; // objeto que cruza el carril: { type, x, dir }
  let spawnTimer = 0;

  const level = () => CONFIG.LEVELS[0];

  function start() {
    state.playing = true;
    state.goals = 0;
    state.lives = CONFIG.START_LIVES;
    state.timeLeft = CONFIG.GAME_DURATION;
    object = null;
    spawnTimer = level().spawnInterval;
    handlers.onStart();
    handlers.onChange(state);
  }

  function end(reason) {
    state.playing = false;
    object = null;
    handlers.onEnd(reason, state);
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

    if (result === 'goal') state.goals += 1;
    if (result === 'rock') state.lives -= 1;

    handlers.onKick(result);
    handlers.onChange(state);
    if (state.lives <= 0) end('lives');
  }

  return { state, start, update, kick };
}
