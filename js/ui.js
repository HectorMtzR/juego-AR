// UI en HTML/CSS encima de la cámara: pantallas, HUD, botón PATEAR y mensajes.
// La pantalla de inicio con reglas y la mejor marca llegan en la Fase 4.
import { CONFIG } from './config.js';

const els = {
  start: document.getElementById('screen-start'),
  startBtn: document.getElementById('btn-start'),
  startError: document.getElementById('start-error'),
  scanning: document.getElementById('scanning'),
  hud: document.getElementById('hud'),
  goals: document.getElementById('hud-goals'),
  lives: document.getElementById('hud-lives'),
  time: document.getElementById('hud-time'),
  message: document.getElementById('message'),
  kickBtn: document.getElementById('btn-kick'),
  end: document.getElementById('screen-end'),
  endTitle: document.getElementById('end-title'),
  endSummary: document.getElementById('end-summary'),
  restartBtn: document.getElementById('btn-restart'),
};

const KICK_MESSAGES = {
  goal: '¡GOOOL!',
  beach: '¡Se voló!',
  rock: '¡Auch! -1 vida',
  air: 'Al aire',
};

const END_TITLES = {
  time: '¡Tiempo!',
  lives: '¡Te lastimaste! Fin del juego',
};

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

export function setScanning(visible) {
  els.scanning.hidden = !visible;
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
  els.hud.hidden = false;
}

export function setHud({ goals, lives, timeLeft }) {
  setText(els.goals, String(goals));
  setText(els.time, String(Math.ceil(timeLeft)));
  [...els.lives.children].forEach((heart, i) => heart.classList.toggle('lost', i >= lives));
}

export function showKick(result) {
  els.message.textContent = KICK_MESSAGES[result];
  els.message.dataset.result = result;
  els.message.hidden = false;
  // Reinicia la animación aunque el mensaje anterior siga en pantalla
  els.message.style.animation = 'none';
  void els.message.offsetWidth;
  els.message.style.animation = '';
}

// ---------- Fin ----------

export function onRestart(handler) {
  els.restartBtn.addEventListener('click', handler);
}

export function showEnd(reason, goals) {
  els.endTitle.textContent = END_TITLES[reason];
  els.endSummary.textContent = `Anotaste ${goals} ${goals === 1 ? 'gol' : 'goles'}`;
  els.hud.hidden = true;
  els.end.hidden = false;
}
