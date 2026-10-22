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

// Puntos del modelo en el plano X/Z de su grupo (el plano en el que gira al
// rodar), para calcular qué tan alto debe ir según su giro
function profilePoints(model) {
  model.updateMatrixWorld(true);
  const points = [];
  const vertex = new THREE.Vector3();
  model.traverse((child) => {
    const position = child.isMesh && child.geometry.attributes.position;
    if (!position) return;
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld);
      points.push(vertex.x, vertex.z);
    }
  });
  return points;
}

// Altura del centro para que el punto más bajo, girado `angle` sobre Y, toque el piso
function contactHeight(points, angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  let lowest = Infinity;
  for (let i = 0; i < points.length; i += 2) {
    lowest = Math.min(lowest, -points[i] * sin + points[i + 1] * cos);
  }
  return -lowest;
}

// Sombra difusa bajo los objetos: un degradado radial pintado una sola vez
function createShadowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.6)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
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

  // Zona de tiro. Se dibuja con el radio inicial y se escala al achicarse.
  const radius = CONFIG.STAGES[0].zoneRadius;
  let zoneScale = 1; // escala a la que tiende la zona (radio actual / inicial)
  const zone = new THREE.Group();
  zone.position.set(0, CONFIG.LANE_Y, 0);
  const zoneFill = createDecal(new THREE.CircleGeometry(radius, 48), 0xffe14d, 0.25, 0.003);
  const zoneRing = createDecal(new THREE.RingGeometry(radius - 0.018, radius, 48), 0xffe14d, 1, 0.004);
  zone.add(zoneFill, zoneRing);
  group.add(zone);

  // Plantillas normalizadas por tipo; están completas cuando `ready` se resuelve
  const models = {};
  let rockProfile = null; // la roca no es redonda: su altura depende de su giro
  const ready = Promise.all(
    Object.keys(MODEL_FILES).map(async (type) => {
      models[type] = await loadModel(type);
    }),
  ).then(() => {
    models.goal.position.set(0, CONFIG.GOAL_Y, 0);
    group.add(models.goal);
    rockProfile = profilePoints(models.rock);
  });

  // Una sola geometría y un solo material para todas las sombras; cada una
  // cambia solo de escala (crece con el objeto y se encoge al elevarse)
  const shadowGeometry = new THREE.CircleGeometry(1, 24);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: createShadowTexture(),
    transparent: true,
    opacity: CONFIG.SHADOW_OPACITY,
    depthWrite: false,
  });

  function createShadow(radius) {
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.position.z = 0.006; // sobre la zona de tiro
    shadow.userData.size = radius * 1.3;
    group.add(shadow);
    return shadow;
  }

  // La sombra sigue al objeto en el piso y se encoge cuanto más alto está
  function placeShadow(shadow, object, radius) {
    const lift = Math.max(0, object.position.z - radius);
    const k = THREE.MathUtils.clamp(1 - lift * 2.5, 0.25, 1);
    shadow.position.x = object.position.x;
    shadow.position.y = object.position.y;
    shadow.scale.setScalar(shadow.userData.size * k * object.scale.x);
  }

  // Altura del centro de cada objeto mientras rueda
  function restHeight(roller) {
    const { type, object, radius, traveled } = roller;
    if (type === 'rock' && rockProfile) return contactHeight(rockProfile, object.rotation.y);
    if (type === 'beach') {
      const { height, length } = CONFIG.BEACH_BOUNCE;
      return radius + height * Math.abs(Math.sin((traveled / length) * Math.PI));
    }
    return radius;
  }

  // ---------- Objetos ----------

  // Objetos que cruzan el carril, por id: { type, object, radius, shadow, traveled }
  const rollers = new Map();
  const flying = []; // objetos ya pateados, con su animación de salida

  // `lane` desplaza el objeto hacia el fondo (+1) o el frente (-1) del carril
  function spawn(id, type, x, lane) {
    const object = models[type].clone();
    const radius = object.userData.height / 2;
    // Giro inicial al azar para que no todos los objetos se vean iguales
    object.rotation.y = Math.random() * Math.PI * 2;
    const roller = { type, object, radius, shadow: createShadow(radius), traveled: 0 };
    object.position.set(x, CONFIG.LANE_Y + lane * CONFIG.CROSS_LANE_OFFSET, 0);
    object.position.z = restHeight(roller);
    group.add(object);
    placeShadow(roller.shadow, object, radius);
    rollers.set(id, roller);
  }

  function moveTo(id, x) {
    const roller = rollers.get(id);
    const { object, radius } = roller;
    const dx = x - object.position.x;
    object.rotation.y += dx / radius; // rueda sin patinar
    object.position.x = x;
    roller.traveled += Math.abs(dx);
    object.position.z = restHeight(roller);
    placeShadow(roller.shadow, object, radius);
  }

  function removeRoller(id) {
    const roller = rollers.get(id);
    if (!roller) return;
    group.remove(roller.object, roller.shadow);
    rollers.delete(id);
  }

  function removeRollers() {
    for (const { object, shadow } of rollers.values()) group.remove(object, shadow);
    rollers.clear();
  }

  // Patada al aire: dos anillos blancos salen de la zona de tiro y se desvanecen
  const puffs = [];
  function puff() {
    for (const delay of [0, 0.08]) {
      const ring = createDecal(new THREE.RingGeometry(0.8, 1, 40), 0xffffff, 0, 0.005);
      ring.position.y = CONFIG.LANE_Y;
      ring.scale.setScalar(radius * zone.scale.x);
      group.add(ring);
      puffs.push({ ring, from: ring.scale.x, time: -delay });
    }
  }

  // Saca de juego al objeto pateado con la animación de su resultado
  function kick(id, result) {
    if (result === 'air') {
      puff();
      return;
    }
    const roller = rollers.get(id);
    if (!roller || !KICK_ANIMATIONS[result]) return;
    const { object, radius, shadow } = roller;
    rollers.delete(id);
    flying.push({
      object,
      radius,
      shadow,
      from: object.position.clone(),
      time: 0,
      spinSide: Math.random() < 0.5 ? -1 : 1,
      ...KICK_ANIMATIONS[result],
    });
  }

  // La zona llega a su nuevo tamaño en `update`, con una animación corta
  function setZoneRadius(value) {
    zoneScale = value / radius;
  }

  function reset() {
    removeRollers();
    for (const { object, shadow } of flying) group.remove(object, shadow);
    flying.length = 0;
    for (const { ring } of puffs) group.remove(ring);
    puffs.length = 0;
    zoneScale = 1;
    zone.scale.setScalar(1);
  }

  let time = 0;
  // dt en segundos
  function update(dt) {
    time += dt;
    zoneRing.material.opacity = 0.75 + 0.25 * Math.sin(time * 4);
    zone.scale.setScalar(THREE.MathUtils.damp(zone.scale.x, zoneScale, 12, dt));

    for (let i = puffs.length - 1; i >= 0; i--) {
      const item = puffs[i];
      item.time += dt;
      const k = THREE.MathUtils.clamp(item.time / PUFF_DURATION, 0, 1);
      if (k >= 1) {
        group.remove(item.ring);
        item.ring.geometry.dispose();
        item.ring.material.dispose();
        puffs.splice(i, 1);
      } else {
        item.ring.scale.setScalar(item.from * (1 + 1.2 * k));
        item.ring.material.opacity = item.time < 0 ? 0 : 0.8 * (1 - k);
      }
    }

    for (let i = flying.length - 1; i >= 0; i--) {
      const item = flying[i];
      item.time += dt;
      if (item.time >= item.duration) {
        group.remove(item.object, item.shadow);
        flying.splice(i, 1);
      } else {
        item.step(item, dt);
        placeShadow(item.shadow, item.object, item.radius);
      }
    }
  }

  return {
    group, models, ready, update, spawn, moveTo, removeRoller, removeRollers, kick, setZoneRadius, reset,
  };
}

const PUFF_DURATION = 0.4; // s

// ---------- Animaciones de salida ----------
// Trayectorias calculadas, sin física. `step` recibe el objeto pateado con su
// posición inicial (`from`) y el tiempo transcurrido (`time`).

// Encoge el objeto durante los últimos `fade` segundos para que no desaparezca de golpe
function shrinkAtEnd({ object, time, duration }, fade) {
  object.scale.setScalar(THREE.MathUtils.clamp((duration - time) / fade, 0, 1));
}

const KICK_ANIMATIONS = {
  // Arco hacia la red; la pelota se queda un momento dentro de la portería
  goal: {
    duration: 1.2,
    step(item, dt) {
      const { object, from } = item;
      const flight = 0.45;
      const k = Math.min(item.time / flight, 1);
      object.position.set(
        from.x,
        THREE.MathUtils.lerp(from.y, CONFIG.GOAL_Y, k),
        from.z + 0.16 * 4 * k * (1 - k),
      );
      if (k < 1) object.rotation.x -= dt * 25;
      shrinkAtEnd(item, 0.15);
    },
  },

  // Sale volando hacia arriba, girando, por encima de la portería
  beach: {
    duration: 1.1,
    step(item, dt) {
      const { object, from } = item;
      const k = item.time / item.duration;
      object.position.set(
        from.x + item.spinSide * 0.25 * k,
        THREE.MathUtils.lerp(from.y, CONFIG.GOAL_Y + 0.5, k),
        from.z + 1.1 * Math.sin((k * Math.PI) / 2),
      );
      object.rotation.x -= dt * 14;
      object.rotation.z += dt * item.spinSide * 9;
      shrinkAtEnd(item, 0.3);
    },
  },

  // La roca apenas se mueve: tiembla en su lugar
  rock: {
    duration: 0.7,
    step(item) {
      const { object, from } = item;
      const k = item.time / item.duration;
      object.position.x = from.x + Math.sin(item.time * 70) * 0.012 * (1 - k);
      shrinkAtEnd(item, 0.2);
    },
  },
};
