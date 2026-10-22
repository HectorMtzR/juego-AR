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

// Índice de la etapa que corresponde a los segundos que quedan
function stageFor(timeLeft) {
  let stage = 0;
  CONFIG.STAGES.forEach(({ from }, i) => {
    if (timeLeft <= from) stage = i;
  });
  return stage;
}

const randomBetween = ([min, max]) => min + Math.random() * (max - min);

// handlers:
//   onStart()                     empieza una partida
//   onSpawn(id, type, x, lane)    entra un objeto al carril; `lane` es 0, o ±1 si
//                                 en la etapa vienen objetos de los dos lados
//   onMove(id, x)                 el objeto avanzó
//   onLeave(id)                   el objeto salió del carril sin ser pateado
//   onKick(result, points, id)    'goal' | 'beach' | 'rock' | 'air', los goles que sumó
//                                 y el objeto pateado (null si fue al aire)
//   onLevelUp(level)              se alcanzó un nivel nuevo
//   onStage(stage)                empezó una etapa nueva (un elemento de CONFIG.STAGES)
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
    stage: 0,      // índice en CONFIG.STAGES
    best: loadBest(),
  };
  // Objetos que cruzan el carril: { id, type, x, dir }, del más antiguo al más nuevo
  let objects = [];
  let nextId = 1;
  let spawnTimer = 0;
  let nextGap = 0; // lo que debe avanzar el último objeto antes de que salga otro

  const level = () => CONFIG.LEVELS[state.level - 1];
  const stage = () => CONFIG.STAGES[state.stage];
  const speed = () => level().speed * stage().speedBoost;
  const spawnInterval = () => stage().spawnInterval ?? level().spawnInterval;

  function start() {
    state.playing = true;
    state.goals = 0;
    state.lives = CONFIG.START_LIVES;
    state.timeLeft = CONFIG.GAME_DURATION;
    state.level = 1;
    state.streak = 0;
    state.bonus = false;
    state.stage = stageFor(state.timeLeft);
    objects = [];
    spawnTimer = spawnInterval();
    handlers.onStart();
    handlers.onChange(state);
  }

  function end(reason) {
    state.playing = false;
    objects = [];
    const record = state.goals > state.best;
    if (record) {
      state.best = state.goals;
      saveBest(state.best);
    }
    handlers.onEnd(reason, state, record);
  }

  // Sale otro objeto cuando el último ya avanzó `nextGap` desde su orilla, venga
  // del lado que venga. Como todos ruedan a la misma velocidad, lo que le falta a
  // cada uno para llegar al centro difiere al menos `nextGap` del de los demás, y
  // con eso nunca hay dos dentro de la zona a la vez (ni se cruzan dentro de ella).
  function canSpawn() {
    if (spawnTimer > 0) return false;
    if (objects.length === 0) return true;
    if (objects.length >= stage().maxObjects) return false;
    const last = objects[objects.length - 1];
    const startX = last.dir > 0 ? CONFIG.LANE_START_X : CONFIG.LANE_END_X;
    return Math.abs(last.x - startX) >= nextGap;
  }

  function spawn() {
    const last = objects[objects.length - 1];
    const randomDir = Math.random() < 0.5 ? 1 : -1;
    // Sin `bothSides` los objetos siguen al último, en la misma dirección
    const dir = last && !stage().bothSides ? last.dir : randomDir;
    const object = {
      id: nextId++,
      type: pickType(level().weights),
      x: dir > 0 ? CONFIG.LANE_START_X : CONFIG.LANE_END_X,
      dir,
    };
    objects.push(object);
    spawnTimer = spawnInterval();
    nextGap = randomBetween(stage().gap);
    handlers.onSpawn(object.id, object.type, object.x, stage().bothSides ? dir : 0);
  }

  // dt en segundos. Si no se llama (marcador perdido), el juego queda en pausa.
  function update(dt) {
    if (!state.playing) return;

    for (const object of [...objects]) {
      object.x += object.dir * speed() * dt;
      if (object.x < CONFIG.LANE_START_X || object.x > CONFIG.LANE_END_X) {
        // Dejar pasar un objeto no tiene efecto, ni siquiera sobre la racha
        objects = objects.filter((other) => other !== object);
        if (objects.length === 0) spawnTimer = spawnInterval();
        handlers.onLeave(object.id);
      } else {
        handlers.onMove(object.id, object.x);
      }
    }

    spawnTimer -= dt;
    if (canSpawn()) spawn();

    state.timeLeft = Math.max(0, state.timeLeft - dt);

    const reachedStage = stageFor(state.timeLeft);
    if (reachedStage !== state.stage && state.timeLeft > 0) {
      state.stage = reachedStage;
      handlers.onStage(stage());
    }

    handlers.onChange(state);
    if (state.timeLeft === 0) end('time');
  }

  function kick() {
    if (!state.playing) return;

    let result = 'air';
    // La zona de tiro está centrada en X = 0. La separación entre objetos
    // impide que haya más de uno dentro a la vez.
    const object = objects.find(({ x }) => Math.abs(x) <= stage().zoneRadius);
    if (object) {
      result = object.type === 'soccer' ? 'goal' : object.type;
      // Un objeto solo se patea una vez: sale del carril
      objects = objects.filter((other) => other !== object);
      if (objects.length === 0) spawnTimer = spawnInterval();
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
    handlers.onKick(result, points, object ? object.id : null);

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
