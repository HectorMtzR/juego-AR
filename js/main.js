// Arranque: conecta MindAR, la escena y la UI.
import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';
import { CONFIG } from './config.js';
import { createField } from './scene.js';
import * as ui from './ui.js';

// Con ?preview la cancha se ve sin cámara ni marcador, para ajustarla en la computadora
const PREVIEW = new URLSearchParams(location.search).has('preview');

const container = document.getElementById('ar-container');
// La cancha se crea desde el inicio para ir cargando los modelos
const field = createField();
let started = false;

// Coloca la cancha en el ancla según la postura del marcador. En el ancla de
// MindAR el marcador ocupa el plano X/Y y +Z sale de la imagen hacia la cámara.
function mountField(anchorGroup) {
  if (CONFIG.MARKER_UPRIGHT) {
    // El pasto queda horizontal, del marcador hacia la cámara, y el fondo de
    // la cancha (con la portería) pegado al marcador
    field.group.rotation.x = -Math.PI / 2;
    field.group.position.set(0, CONFIG.UPRIGHT_FLOOR_Y, CONFIG.FIELD_DEPTH / 2);
  }
  anchorGroup.add(field.group);
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
  mountField(anchor.group);
  anchor.onTargetFound = () => ui.setScanning(false);
  anchor.onTargetLost = () => ui.setScanning(true);

  await mindar.start();
  ui.setScanning(!anchor.visible);
  return { renderer, scene, camera };
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
  return { renderer, scene, camera };
}

async function start() {
  if (started) return;
  started = true;
  ui.setStartBusy(true);

  let view;
  try {
    view = await (PREVIEW ? startPreview() : startAR());
  } catch (err) {
    // MindAR rechaza sin detalle si no hay cámara o el usuario niega el permiso
    console.error('No se pudo iniciar', err);
    started = false;
    ui.setStartBusy(false);
    ui.showStartError('No se pudo abrir la cámara. Revisa el permiso y que la página use HTTPS.');
    return;
  }
  ui.hideStart();

  const { renderer, scene, camera } = view;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    field.update(clock.getDelta());
    renderer.render(scene, camera);
  });
}

if (PREVIEW) start();
else ui.onStart(start);
