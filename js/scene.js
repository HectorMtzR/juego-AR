// Construcción de la cancha y carga de modelos.
// Todo vive en un grupo con coordenadas de cancha: X a lo ancho, +Y hacia el
// fondo (portería) y +Z hacia arriba; el ancho del marcador equivale a 1 unidad.
// main.js monta ese grupo en el ancla según la postura del marcador.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';

const MODEL_FILES = {
  soccer: 'soccer_ball.glb',
  beach: 'beach_ball.glb',
  rock: 'rock.glb',
  goal: 'goal.glb',
};

const loader = new GLTFLoader();

// ---------- Modelos ----------

// Carga un modelo ya normalizado. Nunca falla: si el .glb no carga,
// devuelve una primitiva de respaldo para que el juego siga funcionando.
export async function loadModel(type) {
  const size = CONFIG.MODEL_SIZES[type];
  const onGround = type === 'goal';
  try {
    const gltf = await loader.loadAsync(`assets/models/${MODEL_FILES[type]}`);
    return normalizeModel(gltf.scene, size, { yaw: CONFIG.MODEL_YAW[type], onGround });
  } catch (err) {
    console.warn(`No se pudo cargar ${MODEL_FILES[type]}; se usa una primitiva`, err);
    return normalizeModel(createFallback(type), size, { onGround });
  }
}

// Los modelos no comparten escala ni orientación: se orientan con +Z arriba,
// se escalan para que su dimensión mayor mida `size` y se centran en el origen.
// Con `onGround` el origen queda en la base en lugar del centro.
function normalizeModel(model, size, { yaw = 0, onGround = false } = {}) {
  model.rotation.set(Math.PI / 2, THREE.MathUtils.degToRad(yaw), 0); // glTF usa +Y arriba

  const pivot = new THREE.Group();
  pivot.add(model);
  const holder = new THREE.Group();
  holder.add(pivot);
  holder.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(holder, true);
  const dims = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = size / Math.max(dims.x, dims.y, dims.z);

  pivot.scale.setScalar(scale);
  pivot.position.copy(center).multiplyScalar(-scale);
  if (onGround) pivot.position.z += (dims.z * scale) / 2;

  holder.userData.height = dims.z * scale;
  return holder;
}

// Primitivas de respaldo, con +Y arriba igual que un glTF
function createFallback(type) {
  switch (type) {
    case 'soccer':
      return new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 24, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
      );
    case 'beach':
      return new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 24, 16),
        new THREE.MeshStandardMaterial({ map: createBeachTexture() }),
      );
    case 'rock':
      return new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.5),
        new THREE.MeshStandardMaterial({ color: 0x808080, flatShading: true }),
      );
    case 'goal': {
      const frame = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const post = new THREE.CylinderGeometry(0.03, 0.03, 0.7);
      for (const x of [-0.5, 0.5]) {
        const mesh = new THREE.Mesh(post, material);
        mesh.position.set(x, 0.35, 0);
        frame.add(mesh);
      }
      const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.06), material);
      crossbar.rotation.z = Math.PI / 2;
      crossbar.position.y = 0.7;
      frame.add(crossbar);
      return frame;
    }
    default:
      throw new Error(`Tipo de modelo desconocido: ${type}`);
  }
}

function createBeachTexture() {
  const colors = ['#ffffff', '#ffd40a', '#ffffff', '#e80d08', '#ffffff', '#0057c9'];
  const canvas = document.createElement('canvas');
  canvas.width = colors.length;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i, 0, 1, 1);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

// ---------- Cancha ----------

// Pasto con franjas y líneas blancas pintadas en un canvas
function createGrass() {
  const { FIELD_WIDTH: width, FIELD_DEPTH: depth, GOAL_Y } = CONFIG;
  const pxPerUnit = 640;
  const canvas = document.createElement('canvas');
  canvas.width = width * pxPerUnit;
  canvas.height = depth * pxPerUnit;
  const ctx = canvas.getContext('2d');

  const bands = 8;
  const bandHeight = canvas.height / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 ? '#2f9e4f' : '#268a43';
    ctx.fillRect(0, i * bandHeight, canvas.width, bandHeight + 1);
  }

  // De coordenadas de la cancha a píxeles del canvas (+Y de la cancha es arriba)
  const px = (x) => (x + width / 2) * pxPerUnit;
  const py = (y) => (depth / 2 - y) * pxPerUnit;
  const rect = (x0, y0, x1, y1) => ctx.strokeRect(px(x0), py(y1), (x1 - x0) * pxPerUnit, (y1 - y0) * pxPerUnit);

  const margin = 0.04;
  const edgeX = width / 2 - margin;
  const edgeY = depth / 2 - margin;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 0.012 * pxPerUnit;
  rect(-edgeX, -edgeY, edgeX, edgeY);    // borde
  rect(-0.42, GOAL_Y - 0.32, 0.42, edgeY); // área frente a la portería

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
  );
}

// Elementos planos pintados sobre el pasto; `z` los separa para que no parpadeen
function createDecal(geometry, color, opacity, z) {
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
  mesh.position.z = z;
  return mesh;
}

export function createField() {
  const group = new THREE.Group();
  group.name = 'field';

  group.add(new THREE.AmbientLight(0xffffff, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(0.5, -0.8, 1.5);
  // El objetivo también va dentro del grupo para que la luz siga al marcador
  group.add(sun, sun.target);

  group.add(createGrass());

  // Carril por donde ruedan los objetos
  const laneLength = CONFIG.LANE_END_X - CONFIG.LANE_START_X;
  const lane = createDecal(new THREE.PlaneGeometry(laneLength, 0.012), 0xffffff, 0.3, 0.002);
  lane.position.y = CONFIG.LANE_Y;
  group.add(lane);

  // Zona de tiro
  const radius = CONFIG.KICK_ZONE_RADIUS;
  const zone = new THREE.Group();
  zone.position.set(0, CONFIG.LANE_Y, 0);
  const zoneFill = createDecal(new THREE.CircleGeometry(radius, 48), 0xffe14d, 0.25, 0.003);
  const zoneRing = createDecal(new THREE.RingGeometry(radius - 0.018, radius, 48), 0xffe14d, 1, 0.004);
  zone.add(zoneFill, zoneRing);
  group.add(zone);

  // Plantillas normalizadas por tipo; están completas cuando `ready` se resuelve
  const models = {};
  const ready = Promise.all(
    Object.keys(MODEL_FILES).map(async (type) => {
      models[type] = await loadModel(type);
    }),
  ).then(() => {
    models.goal.position.set(0, CONFIG.GOAL_Y, 0);
    group.add(models.goal);

    // Fase 2: los tres objetos quietos sobre el carril para revisar su escala.
    // En la Fase 3 los sustituyen los spawns.
    const demoX = { beach: -0.4, soccer: 0, rock: 0.4 };
    for (const [type, x] of Object.entries(demoX)) {
      const object = models[type].clone();
      object.position.set(x, CONFIG.LANE_Y, object.userData.height / 2);
      group.add(object);
    }
  });

  let time = 0;
  // dt en segundos
  function update(dt) {
    time += dt;
    zoneRing.material.opacity = 0.75 + 0.25 * Math.sin(time * 4);
  }

  return { group, models, ready, update };
}
