// UI en HTML/CSS encima de la cámara: pantallas, HUD, botón PATEAR y mensajes.
import { CONFIG } from './config.js';

const els = {
  start: document.getElementById('screen-start'),
  startInfo: document.getElementById('start-info'),
  startBtn: document.getElementById('btn-start'),
  startBest: document.getElementById('start-best'),
  startError: document.getElementById('start-error'),
  scanning: document.getElementById('scanning'),
  hud: document.getElementById('hud'),
  goals: document.getElementById('hud-goals'),
  lives: document.getElementById('hud-lives'),
  time: document.getElementById('hud-time'),
  timeItem: document.getElementById('hud-time').parentElement,
  level: document.getElementById('hud-level'),
  bonus: document.getElementById('hud-bonus'),
  message: document.getElementById('message'),
  flash: document.getElementById('flash'),
  levelUp: document.getElementById('level-up'),
  kickBtn: document.getElementById('btn-kick'),
  end: document.getElementById('screen-end'),
  endReason: document.getElementById('end-reason'),
  endSummary: document.getElementById('end-summary'),
  endBest: document.getElementById('end-best'),
  restartBtn: document.getElementById('btn-restart'),
};

const KICK_MESSAGES = {
  goal: '¡GOOOL!',
  beach: '¡Se voló!',
  rock: '¡Auch! -1 vida',
  air: 'Al aire',
};

const END_REASONS = {
  time: '¡Tiempo!',
  lives: '¡Te lastimaste! Fin del juego',
};

const goalsText = (goals) => `${goals} ${goals === 1 ? 'gol' : 'goles'}`;

els.startInfo.textContent =
  `Tienes ${CONFIG.GAME_DURATION} segundos y ${CONFIG.START_LIVES} vidas. ` +
  `Con ${CONFIG.STREAK_FOR_BONUS} goles seguidos, cada gol vale x${CONFIG.BONUS_MULTIPLIER}. ` +
  'Cada 20 segundos se pone más difícil.';
els.bonus.textContent = `🔥 x${CONFIG.BONUS_MULTIPLIER}`;

els.lives.replaceChildren(
  ...Array.from({ length: CONFIG.START_LIVES }, () => {
    const heart = document.createElement('span');
    heart.textContent = '❤️';
    return heart;
  }),
);

// Solo toca el DOM si el texto cambió (se llama en cada cuadro)
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

// Muestra un texto con su animación de entrada y salida, reiniciándola
// aunque el anterior siga en pantalla
function pop(el, text) {
  el.textContent = text;
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

// ---------- Inicio ----------

export function onStart(handler) {
  els.startBtn.addEventListener('click', handler);
}

export function setStartBusy(busy) {
  els.startBtn.disabled = busy;
  els.startBtn.textContent = busy ? 'Cargando…' : 'Jugar';
}

export function showStartError(message) {
  els.startError.textContent = message;
  els.startError.hidden = false;
}

export function hideStart() {
  els.start.hidden = true;
}

export function setBest(best) {
  els.startBest.textContent = `Mejor marca: ${goalsText(best)}`;
  els.startBest.hidden = best <= 0;
}

// ---------- Juego ----------

export function onKick(handler) {
  // pointerdown responde al tocar, sin esperar a que se levante el dedo
  els.kickBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    els.kickBtn.classList.add('pressed');
    setTimeout(() => els.kickBtn.classList.remove('pressed'), 120);
    handler();
  });
}

export function showGame() {
  els.end.hidden = true;
  els.message.hidden = true;
  els.levelUp.hidden = true;
  els.flash.hidden = true;
  els.hud.hidden = false;
}

// Sin marcador a la vista: aviso para buscarlo y botón PATEAR atenuado
export function setPaused(paused) {
  els.scanning.hidden = !paused;
  els.hud.classList.toggle('paused', paused);
}

export function setHud({ goals, lives, timeLeft, level, bonus, stage }) {
  setText(els.goals, String(goals));
  setText(els.time, String(Math.ceil(timeLeft)));
  els.timeItem.classList.toggle('hud-final', CONFIG.STAGES[stage].alert);
  setText(els.level, `Nivel ${level}`);
  els.bonus.hidden = !bonus;
  // Al perderse, el corazón se rompe (💔) con una animación de CSS
  [...els.lives.children].forEach((heart, i) => {
    const lost = i >= lives;
    heart.classList.toggle('lost', lost);
    setText(heart, lost ? '💔' : '❤️');
  });
}

export function showKick(result, points) {
  els.message.dataset.result = result;
  pop(els.message, points > 1 ? `${KICK_MESSAGES[result]} x${points}` : KICK_MESSAGES[result]);
  if (result === 'rock') pop(els.flash, '');
}

export function showLevelUp(level) {
  pop(els.levelUp, `¡Nivel ${level}!`);
}

export function showStage({ message }) {
  if (message) pop(els.levelUp, message);
}

// ---------- Fin ----------

export function onRestart(handler) {
  els.restartBtn.addEventListener('click', handler);
}

export function showEnd(reason, { goals, best }, record) {
  els.endReason.textContent = END_REASONS[reason];
  els.endSummary.textContent = `Anotaste ${goalsText(goals)}`;
  els.endBest.textContent = record ? '🏆 ¡Nueva mejor marca!' : `Mejor marca: ${goalsText(best)}`;
  els.hud.hidden = true;
  els.end.hidden = false;
}
