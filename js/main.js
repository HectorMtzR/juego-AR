// Arranque: conecta MindAR, la escena y la UI.
import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';
import { CONFIG } from './config.js';
import { createField } from './scene.js';
import * as ui from './ui.js';

let started = false;

async function start() {
  if (started) return;
  started = true;
  ui.setStartBusy(true);

  const mindar = new MindARThree({
    container: document.getElementById('ar-container'),
    imageTargetSrc: CONFIG.TARGET_SRC,
    maxTrack: 1,
    // La UI propia sustituye a las pantallas por defecto de MindAR
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
  });
  const { renderer, scene, camera } = mindar;

  const anchor = mindar.addAnchor(CONFIG.TARGET_INDEX);
  const field = createField(anchor.group);

  anchor.onTargetFound = () => ui.setScanning(false);
  anchor.onTargetLost = () => ui.setScanning(true);

  try {
    await mindar.start();
  } catch (err) {
    // MindAR rechaza sin detalle si no hay cámara o el usuario niega el permiso
    console.error('No se pudo iniciar MindAR', err);
    started = false;
    ui.setStartBusy(false);
    ui.showStartError('No se pudo abrir la cámara. Revisa el permiso y que la página use HTTPS.');
    return;
  }

  ui.hideStart();
  ui.setScanning(true);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    field.update(clock.getDelta());
    renderer.render(scene, camera);
  });
}

ui.onStart(start);
