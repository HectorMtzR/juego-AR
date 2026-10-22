// Sonidos y vibración.
// Nada de aquí puede romper el juego: si no hay Web Audio, si un .mp3 no carga o
// si el teléfono no vibra (iPhone), esa respuesta simplemente no ocurre.
import { CONFIG } from './config.js';

const SOUNDS = ['click', 'kick', 'goal', 'boing', 'hit', 'whoosh', 'levelup', 'gameover'];

const AudioCtx = window.AudioContext || window.webkitAudioContext;
// El contexto nace suspendido; el navegador solo deja reanudarlo dentro de un toque
const ctx = AudioCtx ? new AudioCtx() : null;
const buffers = {};
let output = null;

if (ctx) {
  output = ctx.createGain();
  output.gain.value = CONFIG.SOUND_VOLUME;
  output.connect(ctx.destination);

  for (const name of SOUNDS) {
    fetch(`assets/sounds/${name}.mp3`)
      .then((response) => response.arrayBuffer())
      // Safari antiguo solo acepta decodeAudioData con callbacks
      .then((data) => new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)))
      .then((buffer) => {
        buffers[name] = buffer;
      })
      .catch((err) => console.warn(`No se pudo cargar el sonido ${name}`, err));
  }

  // Desbloquea el audio con cualquier toque (el primero es el botón "Jugar").
  // Se repite en cada toque porque iOS suspende el contexto al cambiar de app.
  const unlock = () => {
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  };
  for (const type of ['pointerdown', 'touchend', 'click']) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }
}

export function play(name) {
  const buffer = buffers[name];
  if (!buffer || ctx.state !== 'running') return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(output);
  source.start();
}

// `kind` es una clave de CONFIG.VIBRATION
export function vibrate(kind) {
  try {
    navigator.vibrate?.(CONFIG.VIBRATION[kind]);
  } catch {
    // sin soporte o bloqueada por el navegador: no vibra
  }
}
