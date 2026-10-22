# MeteGol AR — Especificación del proyecto

> Documento para desarrollar con Claude Code. Actividad 1 del curso de Realidad Virtual y Aumentada:
> "Juego de Realidad Aumentada activado por marcador QR personalizado".
> **Fecha de entrega: 26 de octubre de 2026.**

---

## 1. Resumen

Juego de RA para navegador móvil. El usuario escanea un **marcador QR personalizado** y sobre él aparece una mini cancha con una **portería** y una **zona de tiro**. Por la zona de tiro pasan rodando, uno por uno, tres tipos de objetos: **pelota de fut**, **pelota de playa** y **roca**. El jugador tiene un botón **PATEAR** y debe decidir cuándo usarlo:

- Patear la **pelota de fut** dentro de la zona → **gol**.
- Patear la **pelota de playa** → **se vuela** por arriba de la portería (0 puntos, rompe la racha).
- Patear la **roca** → **pierde 1 vida** (de 3).

La partida termina al perder las 3 vidas o al acabarse 60 segundos.

---

## 2. Stack técnico

- **HTML + CSS + JavaScript (ES modules), sin paso de build.** Todo debe funcionar como sitio estático.
- **MindAR (image tracking) + three.js**, cargados desde CDN (jsDelivr o unpkg) con un `importmap`.
  - Verificar que la versión de three.js sea **compatible con la versión de MindAR** que se use; no mezclar versiones al azar.
- **GLTFLoader** de three.js para los modelos `.glb`.
- **Web Audio API** (o `HTMLAudioElement`) para sonidos. El audio se desbloquea con el primer toque del usuario (botón "Jugar").
- **Vibration API** (`navigator.vibrate`) con detección de soporte: si no existe (iPhone), simplemente no vibra, sin errores.
- **Hosting: Cloudflare Workers (assets estáticos)** en `https://juego-ar.hectormarey145.workers.dev/` (da HTTPS, necesario para usar la cámara).
  - Esta URL ya está impresa en el QR del marcador: **no cambiar el nombre del worker ni la URL**.
  - Antes de tocar la configuración de despliegue (`wrangler.jsonc` / `wrangler.toml`), revisar lo que ya existe en el repo y conservarlo.
  - El código también vive en un **repositorio público de GitHub** (lo pide la rúbrica).
- Sin frameworks (nada de React, etc.). Sin motores de física: todas las trayectorias son animaciones calculadas (interpolación / curvas simples).

---

## 3. Estructura del repositorio

```
/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js        # arranque, conecta MindAR, escena, juego y UI
│   ├── config.js      # TODAS las constantes ajustables del juego
│   ├── scene.js       # construcción de la cancha, carga de modelos, animaciones 3D
│   ├── game.js        # lógica: estados, spawns, puntaje, vidas, niveles, racha
│   ├── ui.js          # HUD, pantallas, botón PATEAR, mensajes
│   └── feedback.js    # sonidos y vibración
├── assets/
│   ├── models/        # soccer_ball.glb, beach_ball.glb, rock.glb, goal.glb
│   ├── sounds/        # click, kick, goal, boing, hit, whoosh, levelup, gameover (.mp3)
│   └── targets/
│       └── marker.mind   # marcador compilado con el compilador de MindAR
├── marker/
│   └── marker.png     # imagen del marcador para imprimir
├── docs/
│   └── screenshots/   # capturas para el README
├── README.md
└── SPEC.md            # este documento
```

**Assets ya listos:** los 4 modelos `.glb`, los 8 sonidos `.mp3`, `marker.png` y `marker.mind` ya están en sus carpetas con estos nombres exactos. Usar los modelos reales desde la Fase 2.

**Regla clave:** cargar modelos debe estar aislado en una función. Si un `.glb` falla al cargar, usar una **primitiva de three.js como respaldo** (esfera blanca = fut, esfera de colores = playa, dodecaedro gris = roca, marco de cilindros = portería) para que el juego siga funcionando.

Los modelos vienen de fuentes distintas y **no comparten escala ni orientación**: normalizar cada uno al cargarlo (calcular su caja con `Box3`, centrarlo y escalarlo a un tamaño objetivo definido en `config.js`).

---

## 4. Escena 3D

### Sistema de coordenadas
En MindAR, el ancla del marcador tiene el plano de la imagen en **X/Y** y el eje **Z sale del marcador hacia la cámara**. Si el marcador está acostado en una mesa, **"arriba" es +Z**.

Crear un grupo hijo `field` dentro del ancla y construir todo ahí, de forma que:
- El pasto quede **acostado sobre el marcador**.
- Los objetos **descansen sobre el pasto** y "arriba" sea +Z.
- El ancho del marcador equivale a **1 unidad**; todas las medidas de abajo están en esas unidades.

> **Cambio (Fase 2):** el marcador se usa **parado** (en pantalla o pared), no acostado. Con `MARKER_UPRIGHT: true` en `config.js`, `field` se gira para que el pasto quede horizontal, saliendo del borde inferior del marcador hacia la cámara, con la portería al fondo pegada al marcador y de frente al jugador (vista de penal). Las coordenadas de `field` no cambian: X a lo ancho, +Y hacia la portería, +Z arriba. Con `MARKER_UPRIGHT: false` se recupera la cancha acostada sobre el marcador.

### Elementos
| Elemento | Descripción | Posición aproximada |
|---|---|---|
| Pasto | Plano verde, ligeramente más grande que el marcador, semitransparente o sólido | Centro del marcador |
| Portería | Modelo `goal.glb` | Al fondo (eje Y positivo), centrada |
| Zona de tiro | Anillo/círculo en el piso, color brillante | Al frente, centrada en X = 0 |
| Carril de objetos | Línea imaginaria por donde ruedan los objetos | Pasa por el centro de la zona de tiro, de X = -0.7 a X = +0.7 |

Iluminación simple: una luz ambiental + una direccional.

---

## 5. Mecánica

### Movimiento de objetos
- Un objeto a la vez entra por un lado del carril (`X = -0.7`), **rueda** (rotación visible) hasta el otro lado (`X = +0.7`) y desaparece.
- La dirección puede alternar al azar (izquierda→derecha o derecha→izquierda).
- Entre un objeto y otro hay un intervalo de espera (`SPAWN_INTERVAL`, depende del nivel).
- El tipo de objeto se elige al azar según las probabilidades del nivel.

> **Cambio (ajuste de dificultad):** en la **recta final** (últimos 15 s) los objetos van 1.2× más rápido, el carril vacío se rellena en 0.4 s y puede haber **hasta 2 objetos** a la vez: el segundo entra detrás del primero, en la misma dirección, separado entre 0.28 y 0.5 unidades. Esa separación es mayor que el diámetro de la zona de tiro, así que nunca hay dos objetos dentro de la zona a la vez y PATEAR siempre afecta a uno solo. Al empezar la recta final aparece "¡ÚLTIMOS 15!" y el reloj del HUD se pone rojo. Valores en `FINAL_RUSH`.

### El botón PATEAR
- Al tocarlo, se revisa si hay un objeto **dentro de la zona de tiro** (distancia en X al centro ≤ radio actual de la zona).
- **La zona se achica cada 20 s:** radio 0.12 → 0.10 → 0.085 (`KICK_ZONE_RADII`, `ZONE_SHRINK_EVERY`), con una animación corta y el aviso "¡Zona más chica!".
- Si hay objeto en la zona, se resuelve según la tabla de reglas.
- Si no hay nada en la zona, es una **patada al aire**.
- Un objeto solo puede ser pateado una vez. Después de patearlo, sale de juego con su animación.

### Reglas
| Objeto | Pateado en la zona | Dejado pasar |
|---|---|---|
| Pelota de fut | **Gol**: +1 punto (o +2 con racha activa). Racha +1. Animación: arco hacia la red. | Sin efecto. La racha **no** se rompe. |
| Pelota de playa | **Se vuela**: 0 puntos. Racha se reinicia. Animación: sale volando hacia arriba girando, por encima de la portería. | Sin efecto. |
| Roca | **-1 vida**. Racha se reinicia. Animación: la roca apenas se mueve / tiembla. | Sin efecto. |
| (nada) | **Patada al aire**: sin puntos. Racha se reinicia. | — |

### Racha
- Con **3 goles seguidos** se activa **x2**: cada gol siguiente vale 2 puntos.
- La racha se reinicia al patear pelota de playa, roca o al aire.
- Mostrar en el HUD cuando el x2 está activo.

### Fin de partida
- **Pierdes las 3 vidas** → "¡Te lastimaste! Fin del juego".
- **Se acaban los 60 s** → "¡Tiempo!".
- En ambos casos se muestra la pantalla de fin.

### Niveles (según goles anotados)
| Nivel | Se alcanza con | Velocidad (unidades/s) | Intervalo entre objetos | Prob. fut / playa / roca |
|---|---|---|---|---|
| 1 | Inicio | 0.35 | 1.2 s | 60% / 25% / 15% |
| 2 | 5 goles | 0.5 | 0.9 s | 50% / 25% / 25% |
| 3 | 10 goles | 0.7 | 0.6 s | 45% / 25% / 30% |

Al subir de nivel, mostrar un aviso breve ("¡Nivel 2!") con sonido.

### Pausa automática
- Si MindAR pierde el marcador (`onTargetLost`), el juego **se pausa**: se detienen objetos y temporizador, y aparece "Apunta tu cámara al marcador".
- Al encontrarlo de nuevo (`onTargetFound`), el juego continúa.

---

## 6. Constantes (`config.js`)

Todas las cifras del juego deben vivir aquí para poder ajustarlas sin tocar la lógica:

```js
export const CONFIG = {
  GAME_DURATION: 60,          // segundos
  START_LIVES: 3,
  STREAK_FOR_BONUS: 3,
  BONUS_MULTIPLIER: 2,
  KICK_ZONE_RADII: [0.12, 0.1, 0.085], // unidades del marcador; uno por etapa
  ZONE_SHRINK_EVERY: 20,      // segundos
  FINAL_RUSH: { time: 15, maxObjects: 2, speedBoost: 1.2, spawnInterval: 0.4, gap: [0.28, 0.5] },
  LANE_START_X: -0.7,
  LANE_END_X: 0.7,
  LEVELS: [
    { minGoals: 0,  speed: 0.35, spawnInterval: 1.2, weights: { soccer: 60, beach: 25, rock: 15 } },
    { minGoals: 5,  speed: 0.5,  spawnInterval: 0.9, weights: { soccer: 50, beach: 25, rock: 25 } },
    { minGoals: 10, speed: 0.7,  spawnInterval: 0.6, weights: { soccer: 45, beach: 25, rock: 30 } },
  ],
  VIBRATION: { tap: 15, goal: 60, rock: 250 }, // ms
  MODEL_SIZES: { soccer: 0.08, beach: 0.11, rock: 0.09, goal: 0.45 }, // tamaño máx. en unidades del marcador (ajustable)
};
```

---

## 7. Retroalimentación

Cada acción del jugador debe tener respuesta clara (criterio de 2 puntos de la rúbrica).

| Evento | Visual | Sonido | Vibración |
|---|---|---|---|
| Tocar PATEAR | Botón se hunde (scale) y cambia de color | `click` | `tap` |
| Gol | Pelota en arco hacia la red + texto grande "¡GOOOL!" (+ "x2" si aplica) | `goal` | `goal` |
| Pelota de playa | Sale volando hacia arriba girando + texto "¡Se voló!" | `boing` | — |
| Roca | Destello rojo en pantalla + corazón del HUD se rompe/desaparece con animación | `hit` | `rock` |
| Patada al aire | Pequeño efecto de aire en la zona de tiro | `whoosh` | — |
| Subir de nivel | Texto "¡Nivel X!" | `levelup` | — |
| Fin de partida | Pantalla de fin | `gameover` | — |

---

## 8. Pantallas y UI

La UI es HTML/CSS encima de la cámara (no dentro de la escena 3D). Diseño pensado para **celular en vertical** y uso con el pulgar.

1. **Inicio**
   - Nombre del juego.
   - Reglas con íconos: ⚽ = gol, 🏖️ = se vuela, 🪨 = pierdes vida.
   - Botón **"Jugar"** (este toque desbloquea el audio y arranca MindAR).
2. **Buscando marcador**
   - Mensaje "Apunta tu cámara al marcador" con una pequeña animación.
   - El juego empieza (o se reanuda) al detectar el marcador.
3. **Juego (HUD)**
   - Arriba: goles, corazones (vidas), tiempo restante, nivel e indicador de racha x2.
   - Abajo: **botón PATEAR grande**, centrado, fácil de tocar.
4. **Fin**
   - "¡Se acabó! Anotaste X goles" y el motivo (tiempo o vidas).
   - **Mejor marca** guardada en `localStorage` (lecturas y escrituras dentro de `try/catch`; si falla, el juego sigue funcionando sin guardar).
   - Botón **"Jugar otra vez"**.

---

## 9. Marcador QR

> **Ya está hecho.** No regenerar el marcador ni el `.mind`.

- El QR codifica `https://juego-ar.hectormarey145.workers.dev/`: escanearlo con la cámara normal abre el juego, y después el mismo marcador funciona como objetivo de RA.
- Alrededor del QR va un **marco de cancha asimétrico** (balones en las esquinas, líneas de cancha abajo a la izquierda, título "MeteGol AR") para que el rastreador tenga puntos de referencia únicos.
- Imagen cuadrada de 1200×1200 px, en blanco y negro. Compilada en el compilador de MindAR: 1 objetivo (`targetIndex: 0`) con puntos repartidos en toda la imagen.
- Archivos: `marker/marker.png` y `assets/targets/marker.mind`.

---

## 10. Recursos externos y créditos

Por cada recurso se registra **nombre, autor, fuente (enlace) y licencia**. Esto va completo en el README. Los campos con `PENDIENTE` los completa el equipo; Claude Code deja la tabla con esos huecos visibles.

### Modelos (4, todos < 1 MB)
| Archivo | Modelo | Autor | Fuente | Licencia |
|---|---|---|---|---|
| `soccer_ball.glb` | Simple soccer football | Smirnoff Alexander | Poly Pizza (PENDIENTE: enlace) | PENDIENTE |
| `beach_ball.glb` | Beach ball | the_normalgamer | Poly Pizza (PENDIENTE: enlace) | PENDIENTE |
| `rock.glb` | Boulder | Poly by Google | Poly Pizza (PENDIENTE: enlace) | PENDIENTE (probablemente CC-BY 3.0) |
| `goal.glb` | Soccer goal | Poly by Google | Poly Pizza (PENDIENTE: enlace) | PENDIENTE (probablemente CC-BY 3.0) |

### Sonidos (8, .mp3)
`click`, `kick`, `goal`, `boing`, `hit`, `whoosh`, `levelup`, `gameover`: **sonidos originales creados por síntesis para este proyecto** (sin licencia de terceros).

---

## 11. README.md (requisito de la rúbrica)

Debe incluir:
1. Nombre y descripción del juego.
2. Cómo se juega (reglas).
3. Herramientas y tecnologías.
4. Enlace para jugar (`https://juego-ar.hectormarey145.workers.dev/`) y enlace/imagen del marcador para imprimir.
5. Instrucciones de instalación y ejecución local.
6. Capturas de pantalla (`docs/screenshots/`).
7. **Créditos con licencia** de cada modelo y sonido.
8. Autor.

---

## 12. Fases de desarrollo

Trabajar fase por fase. Al terminar cada una, debe quedar algo funcionando y hacer **commit con mensaje claro**.

| Fase | Objetivo | Listo cuando… |
|---|---|---|
| 1. Base | Estructura del repo, MindAR + three.js funcionando con un cubo sobre el marcador, publicado en Cloudflare | Se ve un cubo sobre el marcador desde el celular |
| 2. Escena | Cancha, portería (`goal.glb`), zona de tiro y carril, con modelos normalizados en escala | La cancha se ve bien orientada sobre el marcador |
| 3. Mecánica | Spawns con los 3 modelos reales, movimiento, botón PATEAR, reglas, puntaje, vidas, tiempo | Se puede jugar una partida completa |
| 4. Flujo | Pantallas de inicio y fin, pausa al perder el marcador, niveles, racha, mejor marca | El juego tiene principio, desarrollo y final |
| 5. Feedback | Sonidos, vibración y todas las animaciones de la tabla 7 | Cada acción tiene respuesta visual + sonora |
| 6. Modelos | Ajuste fino de escala, orientación y rotación al rodar de los 4 GLB | Los modelos se ven bien proporcionados y ruedan de forma creíble |
| 7. Pulido | Ajustar dificultad, pruebas en 2 teléfonos, README, capturas | Lista la entrega |

---

## 13. Pruebas

- [ ] Probar en **al menos 2 teléfonos distintos** (idealmente un Android y un iPhone).
- [ ] El marcador se detecta rápido a distancia cercana, media y lejana.
- [ ] Al perder el marcador, el juego se pausa y se reanuda bien.
- [ ] Sin errores en consola durante una partida completa.
- [ ] Fluido: sin tirones al cargar modelos ni al patear.
- [ ] En iPhone no hay errores por la falta de vibración.
- [ ] El enlace de Cloudflare abre en ventana de incógnito (público).
- [ ] El QR abre el juego con la cámara normal de ambos teléfonos.

---

## 14. Rúbrica y cómo se cubre

| Criterio | Pts | Cómo lo cubre el juego |
|---|---|---|
| Marcador QR personalizado | 1.5 | QR propio con marco de cancha asimétrico, probado en el compilador de MindAR |
| Tres modelos 3D de uso público | 1.5 | 4 modelos CC0/CC acreditados en el README, < 5 MB y bien escalados |
| Mecánica de juego | 2 | Objetivo (goles), reglas de 3 objetos, puntaje, vidas y final por tiempo o vidas |
| Interacción y retroalimentación táctil | 2 | Botón PATEAR con respuesta visual, sonora y vibración en cada resultado |
| Funcionamiento en el teléfono | 1 | Estable, pausa automática, probado en 2 teléfonos |
| Repositorio GitHub | 1 | Código separado por módulos y README completo |
| Artículo LinkedIn | 1 | 300–500 palabras con proceso, retos, video y enlace (fuera del código) |

---

## 15. Tareas manuales (las hace el equipo, no Claude Code)

- [x] Descargar los 4 modelos `.glb`.
- [ ] Completar enlaces y licencias de los modelos (tabla de la sección 10).
- [x] Conseguir los sonidos (originales, por síntesis).
- [x] Diseñar el marcador (QR con la URL + marco de cancha) y compilarlo en el compilador de MindAR.
- [ ] Imprimir el marcador (después de probar la Fase 1 en pantalla).
- [ ] Grabar el video demo de 30–60 s con buena luz.
- [ ] Escribir y publicar el artículo de LinkedIn.
- [ ] Subir los 3 enlaces al formulario.

---

## 16. Ideas a futuro

- **Salida más caótica de los objetos:** *(hecho en parte: recta final con hasta 2 objetos, ver sección 5)*. Se podría ir más lejos con objetos que vengan de lados contrarios, decidiendo a cuál afecta PATEAR cuando hay más de uno en la zona de tiro.
