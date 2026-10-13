// Construcción de la escena 3D sobre el marcador.
// Fase 1: solo luces y un cubo de prueba. La cancha y los modelos llegan en la Fase 2.
import * as THREE from 'three';

const CUBE_SIZE = 0.3; // el ancho del marcador equivale a 1 unidad

// Crea el grupo `field` dentro del ancla. En el ancla de MindAR el marcador
// ocupa el plano X/Y y +Z sale de la imagen, así que "arriba" es +Z.
export function createField(anchorGroup) {
  const field = new THREE.Group();
  field.name = 'field';
  anchorGroup.add(field);

  field.add(new THREE.AmbientLight(0xffffff, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(0.5, -0.8, 1.5);
  field.add(sun);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE),
    new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.5 }),
  );
  cube.position.z = CUBE_SIZE / 2; // apoyado sobre el marcador
  field.add(cube);

  // dt en segundos
  function update(dt) {
    cube.rotation.z += dt * 0.8;
  }

  return { field, update };
}
