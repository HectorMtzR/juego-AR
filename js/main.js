// Arranque: conecta MindAR, la escena y la UI.
import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';
import { CONFIG } from './config.js';
import { createField } from './scene.js';
import { createGame } from './game.js';
import * as ui from './ui.js';

// Con ?preview la cancha se ve sin cámara ni marcador, para ajustarla en la computadora
const PREVIEW = new URLSearchParams(location.search).has('preview');

const container = document.getElementById('ar-container');
// La cancha se crea desde el inicio para ir cargando los modelos
const field = createField();
let started = false;
let tracking = false; // marcador a la vista; sin él el juego queda en pausa

const game = createGame({
  onStart() {
    field.reset();
    ui.showGame();
  },
  onSpawn: (type, x) => field.spawn(type, x),
  onMove: (x) => field.moveTo(x),
  onLeave: () => field.removeRoller(),
  onKick(result, points) {
    field.kick(result);
    ui.showKick(result, points);
  },
  onLevelUp: (level) => ui.showLevelUp(level),
  onChange: (state) => ui.setHud(state),
  onEnd(reason, state, record) {
    field.removeRoller();
    ui.showEnd(reason, state, record);
  },
});

// Crea el grupo que sigue al marcador y coloca la cancha dentro según la
// postura del marcador. Igual que en el ancla de MindAR, en este grupo el
// marcador ocupa el plano X/Y y +Z sale de la imagen hacia la cámara.
function createStage() {
  const stage = new THREE.Group();
  stage.visible = false;
  if (CONFIG.MARKER_UPRIGHT) {
    // El pasto queda horizontal, del marcador hacia la cámara, y el fondo de
    // la cancha (con la portería) pegado al marcador
    field.group.rotation.x = -Math.PI / 2;
    field.group.position.set(0, CONFIG.UPRIGHT_FLOOR_Y, CONFIG.FIELD_DEPTH / 2);
  }
  stage.add(field.group);
  return stage;
}

// Fracción a avanzar hacia la pose medida en este cuadro: poca si el error es
// pequeño (temblor del rastreo) y casi toda si es grande (movimiento real).
function blend(dt, error, { slow, fast, low, high }) {
  const k = THREE.MathUtils.clamp((error - low) / (high - low), 0, 1);
  return 1 - Math.exp(-dt / THREE.MathUtils.lerp(slow, fast, k));
}

const measured = {
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  scale: new THREE.Vector3(),
};

// MindAR recalcula la pose del marcador en cada cuadro de video y esa medida
// tiembla, sobre todo el giro cuando el marcador se ve de frente. En vez de
// colgar la cancha del ancla, `stage` la sigue con un suavizado.
// Devuelve si el marcador está a la vista.
function followAnchor(stage, anchorGroup, dt) {
  if (!anchorGroup.visible) {
    stage.visible = false;
    return false;
  }
  anchorGroup.matrix.decompose(measured.position, measured.quaternion, measured.scale);
  stage.scale.copy(measured.scale);
  if (!stage.visible) {
    // Marcador recién encontrado: se coloca directo, sin transición
    stage.visible = true;
    stage.position.copy(measured.position);
    stage.quaternion.copy(measured.quaternion);
    return true;
  }
  const markerWidth = measured.scale.x;
  const distance = stage.position.distanceTo(measured.position) / markerWidth;
  stage.position.lerp(measured.position, blend(dt, distance, CONFIG.SMOOTHING.position));
  const angle = THREE.MathUtils.radToDeg(stage.quaternion.angleTo(measured.quaternion));
  stage.quaternion.slerp(measured.quaternion, blend(dt, angle, CONFIG.SMOOTHING.rotation));
  return true;
}

async function startAR() {
  const mindar = new MindARThree({
    container,
    imageTargetSrc: CONFIG.TARGET_SRC,
    maxTrack: 1,
    // La UI propia sustituye a las pantallas por defecto de MindAR
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
  });
  const { renderer, scene, camera } = mindar;

  const anchor = mindar.addAnchor(CONFIG.TARGET_INDEX);
  const stage = createStage();
  scene.add(stage);

  await mindar.start();
  return { renderer, scene, camera, update: (dt) => followAnchor(stage, anchor.group, dt) };
}

async function startPreview() {
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x20242b);
  scene.add(field.group);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 50);
  camera.up.set(0, 0, 1);
  camera.position.set(0, -1.7, 1.1);
  new OrbitControls(camera, renderer.domElement);

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  return { renderer, scene, camera, update: () => true };
}

async function start() {
  if (started) return;
  started = true;
  ui.setStartBusy(true);

  let view;
  try {
    [view] = await Promise.all([PREVIEW ? startPreview() : startAR(), field.ready]);
  } catch (err) {
    // MindAR rechaza sin detalle si no hay cámara o el usuario niega el permiso
    console.error('No se pudo iniciar', err);
    started = false;
    ui.setStartBusy(false);
    ui.showStartError('No se pudo abrir la cámara. Revisa el permiso y que la página use HTTPS.');
    return;
  }
  ui.hideStart();
  ui.setPaused(true);
  game.start();

  const { renderer, scene, camera } = view;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const visible = view.update(dt);
    if (visible !== tracking) {
      tracking = visible;
      ui.setPaused(!tracking);
    }
    // El juego empieza al detectar el marcador y se detiene mientras no se vea
    if (tracking) {
      game.update(dt);
      field.update(dt);
    }
    renderer.render(scene, camera);
  });
}

ui.onKick(() => {
  if (tracking) game.kick();
});
ui.onRestart(() => game.start());
ui.setBest(game.state.best);
if (PREVIEW) start();
else ui.onStart(start);
