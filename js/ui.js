// UI en HTML/CSS encima de la cámara.
// Fase 1: pantalla de inicio mínima y aviso de "buscando marcador".
// El HUD, el botón PATEAR y la pantalla de fin llegan en las Fases 3 y 4.

const els = {
  start: document.getElementById('screen-start'),
  startBtn: document.getElementById('btn-start'),
  startError: document.getElementById('start-error'),
  scanning: document.getElementById('scanning'),
};

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
